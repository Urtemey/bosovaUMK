"""Pytest configuration and fixtures for boZoVa backend tests."""
import pytest
from app import create_app, db as _db
from app.models.teacher import Teacher
from app.models.classroom import Classroom
from app.models.student import Student
from app.models.test import Test
from app.models.question import Question, QuestionType


class TestConfig:
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = "test-jwt-secret"
    SECRET_KEY = "test-secret"
    JWT_ACCESS_TOKEN_EXPIRES = 3600
    JWT_REFRESH_TOKEN_EXPIRES = 2592000


@pytest.fixture(scope="session")
def app():
    app = create_app(TestConfig)
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()


@pytest.fixture(scope="function")
def db(app):
    with app.app_context():
        yield _db
        _db.session.rollback()
        # Truncate all tables between tests
        for table in reversed(_db.metadata.sorted_tables):
            _db.session.execute(table.delete())
        _db.session.commit()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def teacher(db):
    t = Teacher(login="testteacher", display_name="Test Teacher")
    t.set_password("pass123")
    db.session.add(t)
    db.session.commit()
    return t


@pytest.fixture
def teacher_token(client, teacher):
    resp = client.post("/api/auth/login", json={"login": "testteacher", "password": "pass123"})
    return resp.get_json()["access_token"]


@pytest.fixture
def classroom(db, teacher):
    c = Classroom(name="5А", grade=5, teacher_id=teacher.id)
    db.session.add(c)
    db.session.commit()
    return c


@pytest.fixture
def student(db, classroom):
    s = Student(display_name="Иван Иванов", classroom_id=classroom.id)
    db.session.add(s)
    db.session.commit()
    return s


@pytest.fixture
def published_test(db, teacher):
    t = Test(
        title="Тест по информатике",
        grade=5,
        topic="Введение",
        created_by=teacher.id,
        is_published=True,
        settings={"show_score": True, "max_attempts": 3},
    )
    db.session.add(t)
    db.session.commit()
    return t

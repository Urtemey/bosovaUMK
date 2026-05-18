"""Integration tests for /api/attempts/* endpoints."""
import pytest
from app.models.question import Question, QuestionType


@pytest.fixture
def question(db, published_test):
    q = Question(
        test_id=published_test.id,
        order=1,
        question_type=QuestionType.SINGLE_CHOICE,
        content={"text": "Что такое ЦП?", "options": ["Принтер", "Процессор", "Клавиатура"]},
        correct_answer=1,
        points=1,
    )
    db.session.add(q)
    db.session.commit()
    return q


@pytest.fixture
def other_question(db, teacher):
    from app.models.test import Test
    other_test = Test(title="Другой тест", grade=6, created_by=teacher.id, is_published=True)
    db.session.add(other_test)
    db.session.flush()
    q = Question(
        test_id=other_test.id,
        order=1,
        question_type=QuestionType.SINGLE_CHOICE,
        content={"text": "Чужой вопрос?", "options": ["А", "Б"]},
        correct_answer=0,
        points=1,
    )
    db.session.add(q)
    db.session.commit()
    return q


class TestStartAttempt:
    def test_start_anonymous(self, client, question):
        resp = client.post("/api/attempts/start", json={
            "test_id": question.test_id,
            "anonymous_name": "Иван",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert "attempt" in data
        assert "questions" in data
        assert len(data["questions"]) == 1
        assert data["attempt"]["is_finished"] is False
        # correct_answer not exposed to students
        assert "correct_answer" not in data["questions"][0]

    def test_start_as_student(self, client, student_token, question):
        resp = client.post("/api/attempts/start",
                           json={"test_id": question.test_id},
                           headers={"Authorization": f"Bearer {student_token}"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["attempt"]["student_id"] is not None

    def test_start_missing_test_id(self, client):
        resp = client.post("/api/attempts/start", json={})
        assert resp.status_code == 400

    def test_start_nonexistent_test(self, client):
        resp = client.post("/api/attempts/start", json={"test_id": 99999})
        assert resp.status_code == 404


class TestSubmitAnswer:
    def test_submit_correct_answer(self, client, question):
        start = client.post("/api/attempts/start", json={"test_id": question.test_id})
        attempt_id = start.get_json()["attempt"]["id"]

        resp = client.post(f"/api/attempts/{attempt_id}/answer", json={
            "question_id": question.id,
            "answer": 1,
        })
        assert resp.status_code == 200

    def test_submit_to_finished_attempt(self, client, question):
        start = client.post("/api/attempts/start", json={"test_id": question.test_id})
        attempt_id = start.get_json()["attempt"]["id"]
        client.post(f"/api/attempts/{attempt_id}/finish")

        resp = client.post(f"/api/attempts/{attempt_id}/answer", json={
            "question_id": question.id,
            "answer": 1,
        })
        assert resp.status_code == 400

    def test_submit_question_from_wrong_test(self, client, question, other_question):
        start = client.post("/api/attempts/start", json={"test_id": question.test_id})
        attempt_id = start.get_json()["attempt"]["id"]

        resp = client.post(f"/api/attempts/{attempt_id}/answer", json={
            "question_id": other_question.id,
            "answer": 0,
        })
        assert resp.status_code == 404

    def test_update_existing_answer(self, client, question):
        start = client.post("/api/attempts/start", json={"test_id": question.test_id})
        attempt_id = start.get_json()["attempt"]["id"]

        client.post(f"/api/attempts/{attempt_id}/answer", json={"question_id": question.id, "answer": 0})
        resp = client.post(f"/api/attempts/{attempt_id}/answer", json={"question_id": question.id, "answer": 1})
        assert resp.status_code == 200


class TestFinishAttempt:
    def test_finish_calculates_score(self, client, question):
        start = client.post("/api/attempts/start", json={"test_id": question.test_id})
        attempt_id = start.get_json()["attempt"]["id"]
        client.post(f"/api/attempts/{attempt_id}/answer", json={"question_id": question.id, "answer": 1})

        resp = client.post(f"/api/attempts/{attempt_id}/finish")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["is_finished"] is True
        assert data["score_percent"] == 100.0

    def test_finish_wrong_answer_gives_zero(self, client, question):
        start = client.post("/api/attempts/start", json={"test_id": question.test_id})
        attempt_id = start.get_json()["attempt"]["id"]
        client.post(f"/api/attempts/{attempt_id}/answer", json={"question_id": question.id, "answer": 0})

        resp = client.post(f"/api/attempts/{attempt_id}/finish")
        assert resp.status_code == 200
        assert resp.get_json()["score_percent"] == 0.0

    def test_finish_already_finished(self, client, question):
        start = client.post("/api/attempts/start", json={"test_id": question.test_id})
        attempt_id = start.get_json()["attempt"]["id"]
        client.post(f"/api/attempts/{attempt_id}/finish")

        resp = client.post(f"/api/attempts/{attempt_id}/finish")
        assert resp.status_code == 400

    def test_finish_no_answers_gives_zero(self, client, question):
        start = client.post("/api/attempts/start", json={"test_id": question.test_id})
        attempt_id = start.get_json()["attempt"]["id"]
        resp = client.post(f"/api/attempts/{attempt_id}/finish")
        assert resp.status_code == 200
        assert resp.get_json()["score_percent"] == 0.0


class TestGetAttempt:
    def test_get_attempt(self, client, question):
        start = client.post("/api/attempts/start", json={"test_id": question.test_id})
        attempt_id = start.get_json()["attempt"]["id"]
        client.post(f"/api/attempts/{attempt_id}/finish")

        resp = client.get(f"/api/attempts/{attempt_id}")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == attempt_id
        assert data["is_finished"] is True

    def test_get_nonexistent_attempt(self, client):
        assert client.get("/api/attempts/99999").status_code == 404


class TestAnswerCheckerOrdering:
    """Проверяем ordering через реальный флоу attempt."""

    def test_ordering_correct(self, client, db, published_test):
        q = Question(
            test_id=published_test.id,
            order=1,
            question_type=QuestionType.ORDERING,
            content={"text": "Упорядочи", "items": ["А", "Б", "В"]},
            correct_answer=[0, 1, 2],
            points=1,
        )
        db.session.add(q)
        db.session.commit()

        start = client.post("/api/attempts/start", json={"test_id": published_test.id})
        attempt_id = start.get_json()["attempt"]["id"]
        client.post(f"/api/attempts/{attempt_id}/answer", json={"question_id": q.id, "answer": [0, 1, 2]})
        resp = client.post(f"/api/attempts/{attempt_id}/finish")
        assert resp.get_json()["score_percent"] == 100.0

    def test_ordering_wrong(self, client, db, published_test):
        q = Question(
            test_id=published_test.id,
            order=1,
            question_type=QuestionType.ORDERING,
            content={"text": "Упорядочи", "items": ["А", "Б", "В"]},
            correct_answer=[0, 1, 2],
            points=1,
        )
        db.session.add(q)
        db.session.commit()

        start = client.post("/api/attempts/start", json={"test_id": published_test.id})
        attempt_id = start.get_json()["attempt"]["id"]
        client.post(f"/api/attempts/{attempt_id}/answer", json={"question_id": q.id, "answer": [2, 1, 0]})
        resp = client.post(f"/api/attempts/{attempt_id}/finish")
        assert resp.get_json()["score_percent"] == 0.0

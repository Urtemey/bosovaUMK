"""Integration tests for /api/assignments/* endpoints."""
import pytest
from app.models.assignment import TestAssignment


@pytest.fixture
def assignment(db, published_test, classroom, teacher):
    a = TestAssignment(
        test_id=published_test.id,
        classroom_id=classroom.id,
        share_link="testlink123",
        created_by=teacher.id,
    )
    db.session.add(a)
    db.session.commit()
    return a


class TestCreateAssignment:
    def test_create_for_classroom(self, client, teacher_token, published_test, classroom):
        resp = client.post("/api/assignments",
                           json={"test_id": published_test.id, "classroom_id": classroom.id},
                           headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["test_id"] == published_test.id
        assert data["classroom_id"] == classroom.id
        assert "share_link" in data

    def test_create_for_student(self, client, teacher_token, published_test, student):
        resp = client.post("/api/assignments",
                           json={"test_id": published_test.id, "student_id": student.id},
                           headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["student_id"] == student.id

    def test_create_requires_auth(self, client, published_test, classroom):
        resp = client.post("/api/assignments",
                           json={"test_id": published_test.id, "classroom_id": classroom.id})
        assert resp.status_code == 401

    def test_create_missing_test_id(self, client, teacher_token, classroom):
        resp = client.post("/api/assignments",
                           json={"classroom_id": classroom.id},
                           headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 400


class TestGetByLink:
    def test_get_by_link_success(self, client, assignment):
        resp = client.get(f"/api/assignments/by-link/{assignment.share_link}")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["assignment"]["id"] == assignment.id
        assert "test" in data
        assert data["test"]["id"] == assignment.test_id

    def test_get_by_invalid_link(self, client):
        assert client.get("/api/assignments/by-link/nonexistent").status_code == 404


class TestListForClassroom:
    def test_list_requires_auth(self, client, classroom):
        assert client.get(f"/api/assignments/classroom/{classroom.id}").status_code == 401

    def test_list_success(self, client, teacher_token, assignment, classroom):
        resp = client.get(f"/api/assignments/classroom/{classroom.id}",
                          headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert any(a["id"] == assignment.id for a in data)

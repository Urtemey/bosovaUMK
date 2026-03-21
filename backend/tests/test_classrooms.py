"""Integration tests for /api/classrooms/* endpoints."""
import pytest


class TestClassroomCRUD:
    def test_create_classroom(self, client, teacher_token):
        resp = client.post("/api/classrooms", json={"name": "7Б", "grade": 7},
                           headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["name"] == "7Б"
        assert data["grade"] == 7

    def test_create_classroom_requires_auth(self, client):
        resp = client.post("/api/classrooms", json={"name": "7Б", "grade": 7})
        assert resp.status_code == 401

    def test_list_classrooms(self, client, classroom, teacher_token):
        resp = client.get("/api/classrooms", headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) >= 1
        assert any(c["id"] == classroom.id for c in data)

    def test_get_classroom(self, client, classroom, teacher_token):
        resp = client.get(f"/api/classrooms/{classroom.id}",
                          headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == classroom.id
        assert data["name"] == "5А"

    def test_get_nonexistent_classroom(self, client, teacher_token):
        resp = client.get("/api/classrooms/99999",
                          headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 404

    def test_delete_classroom(self, client, db, teacher):
        from app.models.classroom import Classroom
        c = Classroom(name="Temp", grade=6, teacher_id=teacher.id)
        db.session.add(c)
        db.session.commit()
        cid = c.id

        resp = client.post("/api/auth/login", json={"login": "testteacher", "password": "pass123"})
        token = resp.get_json()["access_token"]

        resp = client.delete(f"/api/classrooms/{cid}",
                             headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200


class TestStudentManagement:
    def test_add_student(self, client, classroom, teacher_token):
        resp = client.post(f"/api/classrooms/{classroom.id}/students",
                           json={"display_name": "Петров Петр"},
                           headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert "login" in data
        assert "code" in data
        assert len(data["login"]) == 7
        assert len(data["code"]) == 6

    def test_add_student_batch(self, client, classroom, teacher_token):
        resp = client.post(f"/api/classrooms/{classroom.id}/students/batch",
                           json={"students": [
                               {"display_name": "Алёнов Алёша"},
                               {"display_name": "Беляев Борис"},
                           ]},
                           headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert len(data) == 2

    def test_delete_student(self, client, student, classroom, teacher_token):
        resp = client.delete(
            f"/api/classrooms/{classroom.id}/students/{student.id}",
            headers={"Authorization": f"Bearer {teacher_token}"},
        )
        assert resp.status_code == 200

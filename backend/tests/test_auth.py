"""Integration tests for /api/auth/* endpoints."""
import pytest


class TestRegister:
    def test_register_success(self, client, db):
        resp = client.post("/api/auth/register", json={
            "login": "newteacher",
            "password": "secure123",
            "display_name": "Новый Учитель",
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["teacher"]["login"] == "newteacher"

    def test_register_duplicate_login(self, client, teacher):
        resp = client.post("/api/auth/register", json={
            "login": "testteacher",
            "password": "pass123",
            "display_name": "Дубликат",
        })
        assert resp.status_code == 409

    def test_register_missing_fields(self, client, db):
        resp = client.post("/api/auth/register", json={"login": "x"})
        assert resp.status_code == 400


class TestLogin:
    def test_login_success(self, client, teacher):
        resp = client.post("/api/auth/login", json={
            "login": "testteacher",
            "password": "pass123",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert "access_token" in data
        assert data["teacher"]["login"] == "testteacher"

    def test_login_wrong_password(self, client, teacher):
        resp = client.post("/api/auth/login", json={
            "login": "testteacher",
            "password": "wrongpass",
        })
        assert resp.status_code == 401

    def test_login_unknown_user(self, client, db):
        resp = client.post("/api/auth/login", json={
            "login": "nobody",
            "password": "pass",
        })
        assert resp.status_code == 401


class TestStudentLogin:
    def test_student_login_success(self, client, student):
        resp = client.post("/api/auth/student-login", json={
            "login": student.login,
            "code": student.code,
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert "access_token" in data
        assert data["student"]["id"] == student.id

    def test_student_login_wrong_code(self, client, student):
        resp = client.post("/api/auth/student-login", json={
            "login": student.login,
            "code": "000000",
        })
        assert resp.status_code == 401


class TestMe:
    def test_me_returns_teacher(self, client, teacher_token):
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["role"] == "teacher"
        assert data["user"]["login"] == "testteacher"

    def test_me_requires_auth(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

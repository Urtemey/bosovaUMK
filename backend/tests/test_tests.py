"""Integration tests for /api/tests/* endpoints."""
import pytest
from app.models.question import QuestionType


class TestListTests:
    def test_list_published(self, client, published_test):
        resp = client.get("/api/tests")
        assert resp.status_code == 200
        data = resp.get_json()
        assert any(t["id"] == published_test.id for t in data)

    def test_filter_by_grade(self, client, published_test):
        resp = client.get("/api/tests?grade=5")
        assert resp.status_code == 200
        data = resp.get_json()
        assert all(t["grade"] == 5 for t in data)

    def test_unpublished_not_listed(self, client, db, teacher):
        from app.models.test import Test
        t = Test(title="Черновик", grade=5, created_by=teacher.id, is_published=False)
        db.session.add(t)
        db.session.commit()
        resp = client.get("/api/tests")
        ids = [x["id"] for x in resp.get_json()]
        assert t.id not in ids


class TestGetTest:
    def test_get_published_test(self, client, question):
        test_id = question.test_id
        resp = client.get(f"/api/tests/{test_id}")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == test_id
        assert "questions" in data
        # correct_answer NOT returned for anonymous
        assert "correct_answer" not in data["questions"][0]

    def test_get_test_correct_answer_for_creator(self, client, teacher_token, question):
        test_id = question.test_id
        resp = client.get(f"/api/tests/{test_id}",
                          headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert "correct_answer" in data["questions"][0]
        assert data["questions"][0]["correct_answer"] == 1

    def test_get_nonexistent_test(self, client):
        assert client.get("/api/tests/99999").status_code == 404


class TestMyTests:
    def test_my_tests_requires_auth(self, client):
        assert client.get("/api/tests/my").status_code == 401

    def test_my_tests_returns_own(self, client, teacher_token, published_test):
        resp = client.get("/api/tests/my", headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert any(t["id"] == published_test.id for t in data)


class TestCreateTest:
    def test_create_requires_auth(self, client):
        resp = client.post("/api/tests", json={"title": "X", "grade": 5})
        assert resp.status_code == 401

    def test_create_success(self, client, teacher_token):
        resp = client.post("/api/tests",
                           json={"title": "Новый тест", "grade": 7, "topic": "Сети"},
                           headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["title"] == "Новый тест"
        assert data["grade"] == 7

    def test_create_missing_fields(self, client, teacher_token):
        resp = client.post("/api/tests", json={"title": "Без класса"},
                           headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 400


class TestUpdateTest:
    def test_update_success(self, client, teacher_token, published_test):
        resp = client.put(f"/api/tests/{published_test.id}",
                          json={"title": "Обновлённый тест"},
                          headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 200
        assert resp.get_json()["title"] == "Обновлённый тест"

    def test_update_requires_auth(self, client, published_test):
        resp = client.put(f"/api/tests/{published_test.id}", json={"title": "X"})
        assert resp.status_code == 401


class TestDeleteTest:
    def test_delete_success(self, client, teacher_token, published_test):
        resp = client.delete(f"/api/tests/{published_test.id}",
                             headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 200
        assert client.get(f"/api/tests/{published_test.id}").status_code == 404

    def test_delete_requires_auth(self, client, published_test):
        assert client.delete(f"/api/tests/{published_test.id}").status_code == 401


class TestDuplicateTest:
    def test_duplicate_success(self, client, teacher_token, question):
        test_id = question.test_id
        resp = client.post(f"/api/tests/{test_id}/duplicate",
                           headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["id"] != test_id
        assert "копия" in data["title"]
        assert len(data["questions"]) == 1


class TestQuestionCRUD:
    def test_add_question(self, client, teacher_token, published_test):
        resp = client.post(f"/api/tests/{published_test.id}/questions",
                           json={
                               "question_type": "single_choice",
                               "content": {"text": "Вопрос?", "options": ["А", "Б"]},
                               "correct_answer": 0,
                               "points": 2,
                           },
                           headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["question_type"] == "single_choice"
        assert data["correct_answer"] == 0

    def test_add_question_invalid_type(self, client, teacher_token, published_test):
        resp = client.post(f"/api/tests/{published_test.id}/questions",
                           json={"question_type": "invalid", "content": {}, "correct_answer": 0},
                           headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 400

    def test_update_question(self, client, teacher_token, question):
        resp = client.put(f"/api/tests/{question.test_id}/questions/{question.id}",
                          json={"correct_answer": 2},
                          headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 200
        assert resp.get_json()["correct_answer"] == 2

    def test_delete_question(self, client, teacher_token, question):
        resp = client.delete(f"/api/tests/{question.test_id}/questions/{question.id}",
                             headers={"Authorization": f"Bearer {teacher_token}"})
        assert resp.status_code == 200

    def test_add_question_requires_auth(self, client, published_test):
        resp = client.post(f"/api/tests/{published_test.id}/questions",
                           json={"question_type": "single_choice", "content": {}, "correct_answer": 0})
        assert resp.status_code == 401

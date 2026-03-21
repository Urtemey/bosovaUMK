"""Unit tests for answer_checker service — all 6 question types."""
import pytest
from app.models.question import QuestionType
from app.services.answer_checker import check_answer


# ─── single_choice ──────────────────────────────────────────────

class TestSingleChoice:
    def test_correct(self):
        assert check_answer(QuestionType.SINGLE_CHOICE, "2", "2") is True

    def test_wrong(self):
        assert check_answer(QuestionType.SINGLE_CHOICE, "1", "2") is False

    def test_int_vs_string(self):
        # должно работать при смешанных типах
        assert check_answer(QuestionType.SINGLE_CHOICE, 2, "2") is True

    def test_none_answer(self):
        assert check_answer(QuestionType.SINGLE_CHOICE, None, "2") is False


# ─── multiple_choice ─────────────────────────────────────────────

class TestMultipleChoice:
    def test_correct_same_order(self):
        assert check_answer(QuestionType.MULTIPLE_CHOICE, ["1", "3"], ["1", "3"]) is True

    def test_correct_different_order(self):
        assert check_answer(QuestionType.MULTIPLE_CHOICE, ["3", "1"], ["1", "3"]) is True

    def test_wrong_partial(self):
        assert check_answer(QuestionType.MULTIPLE_CHOICE, ["1"], ["1", "3"]) is False

    def test_wrong_extra(self):
        assert check_answer(QuestionType.MULTIPLE_CHOICE, ["1", "2", "3"], ["1", "3"]) is False

    def test_not_list(self):
        assert check_answer(QuestionType.MULTIPLE_CHOICE, "1", ["1"]) is False

    def test_none_answer(self):
        assert check_answer(QuestionType.MULTIPLE_CHOICE, None, ["1"]) is False


# ─── text_input ───────────────────────────────────────────────────

class TestTextInput:
    def test_exact_match(self):
        assert check_answer(QuestionType.TEXT_INPUT, "Москва", "Москва") is True

    def test_case_insensitive(self):
        assert check_answer(QuestionType.TEXT_INPUT, "москва", "Москва") is True

    def test_strip_whitespace(self):
        assert check_answer(QuestionType.TEXT_INPUT, "  Москва  ", "Москва") is True

    def test_wrong(self):
        assert check_answer(QuestionType.TEXT_INPUT, "Питер", "Москва") is False

    def test_list_of_correct_answers(self):
        assert check_answer(QuestionType.TEXT_INPUT, "cpu", ["CPU", "процессор"]) is True

    def test_list_not_in(self):
        assert check_answer(QuestionType.TEXT_INPUT, "gpu", ["CPU", "процессор"]) is False

    def test_none_answer(self):
        assert check_answer(QuestionType.TEXT_INPUT, None, "Москва") is False


# ─── matching ─────────────────────────────────────────────────────

class TestMatching:
    def test_correct(self):
        assert check_answer(QuestionType.MATCHING, {"a": "1", "b": "2"}, {"a": "1", "b": "2"}) is True

    def test_wrong_pair(self):
        assert check_answer(QuestionType.MATCHING, {"a": "2", "b": "1"}, {"a": "1", "b": "2"}) is False

    def test_int_keys(self):
        assert check_answer(QuestionType.MATCHING, {1: 2, 2: 1}, {"1": "2", "2": "1"}) is True

    def test_not_dict(self):
        assert check_answer(QuestionType.MATCHING, ["a", "1"], {"a": "1"}) is False

    def test_none_answer(self):
        assert check_answer(QuestionType.MATCHING, None, {"a": "1"}) is False


# ─── drag_drop ────────────────────────────────────────────────────

class TestDragDrop:
    def test_dict_correct(self):
        assert check_answer(QuestionType.DRAG_DROP, {"slot1": "A", "slot2": "B"}, {"slot1": "A", "slot2": "B"}) is True

    def test_dict_wrong(self):
        assert check_answer(QuestionType.DRAG_DROP, {"slot1": "B", "slot2": "A"}, {"slot1": "A", "slot2": "B"}) is False

    def test_list_correct(self):
        assert check_answer(QuestionType.DRAG_DROP, ["A", "B", "C"], ["A", "B", "C"]) is True

    def test_list_wrong_order(self):
        assert check_answer(QuestionType.DRAG_DROP, ["B", "A", "C"], ["A", "B", "C"]) is False

    def test_type_mismatch(self):
        assert check_answer(QuestionType.DRAG_DROP, ["A"], {"slot1": "A"}) is False

    def test_none_answer(self):
        assert check_answer(QuestionType.DRAG_DROP, None, {"slot1": "A"}) is False


# ─── select_list ──────────────────────────────────────────────────

class TestSelectList:
    def test_correct(self):
        assert check_answer(QuestionType.SELECT_LIST, {"q1": "да", "q2": "нет"}, {"q1": "да", "q2": "нет"}) is True

    def test_wrong(self):
        assert check_answer(QuestionType.SELECT_LIST, {"q1": "нет", "q2": "нет"}, {"q1": "да", "q2": "нет"}) is False

    def test_not_dict(self):
        assert check_answer(QuestionType.SELECT_LIST, "да", {"q1": "да"}) is False

    def test_none_answer(self):
        assert check_answer(QuestionType.SELECT_LIST, None, {"q1": "да"}) is False


# ─── unknown type ─────────────────────────────────────────────────

def test_unknown_type_returns_false():
    assert check_answer("nonexistent_type", "answer", "answer") is False

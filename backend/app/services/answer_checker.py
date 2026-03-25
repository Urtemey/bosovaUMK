"""Service for checking student answers against correct answers."""

from app.models.question import QuestionType


def check_answer(question_type, student_answer, correct_answer):
    """Check if the student answer is correct for the given question type.

    Returns True/False.
    """
    if student_answer is None:
        return False

    checkers = {
        QuestionType.SINGLE_CHOICE: _check_single_choice,
        QuestionType.MULTIPLE_CHOICE: _check_multiple_choice,
        QuestionType.TEXT_INPUT: _check_text_input,
        QuestionType.MATCHING: _check_matching,
        QuestionType.DRAG_DROP: _check_drag_drop,
        QuestionType.SELECT_LIST: _check_select_list,
        QuestionType.ORDERING: _check_ordering,
        QuestionType.CODE: _check_code,
    }

    checker = checkers.get(question_type)
    if not checker:
        return False

    return checker(student_answer, correct_answer)


def _check_single_choice(student, correct):
    """Student selects one option. Compare selected index/value."""
    return str(student) == str(correct)


def _check_multiple_choice(student, correct):
    """Student selects multiple options. Both must be sorted sets."""
    if not isinstance(student, list) or not isinstance(correct, list):
        return False
    return sorted(str(s) for s in student) == sorted(str(c) for c in correct)


def _check_text_input(student, correct):
    """Student types text. Case-insensitive, strip whitespace."""
    if isinstance(correct, list):
        return str(student).strip().lower() in [str(c).strip().lower() for c in correct]
    return str(student).strip().lower() == str(correct).strip().lower()


def _check_matching(student, correct):
    """Student matches pairs. Compare as dict."""
    if not isinstance(student, dict) or not isinstance(correct, dict):
        return False
    return {str(k): str(v) for k, v in student.items()} == {str(k): str(v) for k, v in correct.items()}


def _check_drag_drop(student, correct):
    """Student drags items into slots. Compare as dict or list."""
    if isinstance(correct, dict) and isinstance(student, dict):
        return {str(k): str(v) for k, v in student.items()} == {str(k): str(v) for k, v in correct.items()}
    if isinstance(correct, list) and isinstance(student, list):
        return [str(s) for s in student] == [str(c) for c in correct]
    return False


def _check_select_list(student, correct):
    """Student selects from dropdowns. Compare as dict."""
    if not isinstance(student, dict) or not isinstance(correct, dict):
        return False
    return {str(k): str(v) for k, v in student.items()} == {str(k): str(v) for k, v in correct.items()}


def _check_ordering(student, correct):
    """Student orders items. Compare as list of indices."""
    if not isinstance(student, list) or not isinstance(correct, list):
        return False
    return [str(s) for s in student] == [str(c) for c in correct]


def _check_code(student, correct):
    """Check code question by comparing student outputs against expected outputs.

    Student answer format: {"outputs": ["output1", "output2", ...]}
    Correct answer format: {"test_cases": [{"input": "...", "expected_output": "..."}, ...]}

    Each output is compared stripped/trimmed with the corresponding expected_output.
    """
    if not isinstance(student, dict) or not isinstance(correct, dict):
        return False

    outputs = student.get('outputs')
    test_cases = correct.get('test_cases')

    if not isinstance(outputs, list) or not isinstance(test_cases, list):
        return False

    if len(outputs) != len(test_cases):
        return False

    for output, test_case in zip(outputs, test_cases):
        expected = test_case.get('expected_output', '')
        if str(output).strip() != str(expected).strip():
            return False

    return True

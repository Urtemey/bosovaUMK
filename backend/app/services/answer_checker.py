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
        QuestionType.NUMBER_PAIRS: _check_number_pairs,
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


def _to_number(value):
    """Parse a value into a float, accepting comma as decimal separator.

    Returns None if the value can't be parsed (treated as wrong/empty).
    """
    if value is None:
        return None
    try:
        return float(str(value).strip().replace(',', '.'))
    except (ValueError, TypeError):
        return None


def _check_number_pairs(student, correct):
    """Check a number-pairs answer.

    Correct answer format:
        {
          "pairs": [[a, b], [c, d], ...],
          "ordered_pairs": bool,    # does the order of the pairs matter?
          "ordered_within": bool,   # does the order within each pair matter?
        }
    Student answer format: [[a, b], [c, d], ...]

    Numbers are compared by value (1 == 01 == 1.0, comma allowed as separator).
    """
    if not isinstance(correct, dict):
        return False

    pairs = correct.get('pairs')
    if not isinstance(pairs, list) or not pairs:
        return False

    ordered_pairs = bool(correct.get('ordered_pairs', False))
    ordered_within = bool(correct.get('ordered_within', True))

    if not isinstance(student, list):
        return False

    def norm_pair(pair):
        if not isinstance(pair, (list, tuple)) or len(pair) != 2:
            return None
        a, b = _to_number(pair[0]), _to_number(pair[1])
        if a is None or b is None:
            return None
        return (a, b) if ordered_within else tuple(sorted((a, b)))

    correct_norm = [norm_pair(p) for p in pairs]
    student_norm = [norm_pair(p) for p in student]

    # Teacher data is assumed valid; a malformed/empty student pair => wrong.
    if any(p is None for p in correct_norm):
        return False
    if any(p is None for p in student_norm):
        return False
    if len(correct_norm) != len(student_norm):
        return False

    if ordered_pairs:
        return correct_norm == student_norm
    return sorted(correct_norm) == sorted(student_norm)

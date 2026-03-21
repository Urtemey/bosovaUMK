from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.attempt import TestAttempt
from app.models.answer import Answer
from app.models.question import Question
from app.models.test import Test
from app.models.assignment import TestAssignment
from app.services.answer_checker import check_answer

attempts_bp = Blueprint('attempts', __name__)


@attempts_bp.route('/start', methods=['POST'])
def start_attempt():
    """Start a new test attempt. Can be authenticated (student) or anonymous (via link)."""
    data = request.get_json()
    test_id = data.get('test_id')
    assignment_id = data.get('assignment_id')
    anonymous_name = data.get('anonymous_name')

    if not test_id:
        return jsonify({'error': 'test_id обязателен'}), 400

    test = Test.query.get_or_404(test_id)

    student_id = None
    try:
        from flask_jwt_extended import verify_jwt_in_request
        verify_jwt_in_request(optional=True)
        claims = get_jwt()
        if claims and claims.get('role') == 'student':
            student_id = int(get_jwt_identity())
    except Exception:
        pass

    attempt = TestAttempt(
        test_id=test.id,
        assignment_id=assignment_id,
        student_id=student_id,
        anonymous_name=anonymous_name,
        started_at=datetime.utcnow(),
    )
    db.session.add(attempt)
    db.session.commit()

    questions = Question.query.filter_by(test_id=test.id).order_by(Question.order).all()
    return jsonify({
        'attempt': attempt.to_dict(),
        'questions': [q.to_dict() for q in questions],
    }), 201


@attempts_bp.route('/<int:attempt_id>/answer', methods=['POST'])
def submit_answer(attempt_id):
    """Submit answer for a single question."""
    attempt = TestAttempt.query.get_or_404(attempt_id)
    if attempt.is_finished:
        return jsonify({'error': 'Тест уже завершён'}), 400

    data = request.get_json()
    question_id = data.get('question_id')
    student_answer = data.get('answer')

    question = Question.query.get_or_404(question_id)

    existing = Answer.query.filter_by(attempt_id=attempt.id, question_id=question_id).first()
    if existing:
        existing.student_answer = student_answer
        existing.is_correct = check_answer(question.question_type, student_answer, question.correct_answer)
        existing.answered_at = datetime.utcnow()
    else:
        answer = Answer(
            attempt_id=attempt.id,
            question_id=question_id,
            student_answer=student_answer,
            is_correct=check_answer(question.question_type, student_answer, question.correct_answer),
            answered_at=datetime.utcnow(),
        )
        db.session.add(answer)

    db.session.commit()
    return jsonify({'message': 'Ответ сохранён'})


@attempts_bp.route('/<int:attempt_id>/finish', methods=['POST'])
def finish_attempt(attempt_id):
    """Finish the test attempt and calculate score."""
    attempt = TestAttempt.query.get_or_404(attempt_id)
    if attempt.is_finished:
        return jsonify({'error': 'Тест уже завершён'}), 400

    attempt.finished_at = datetime.utcnow()
    attempt.is_finished = True

    total_questions = Question.query.filter_by(test_id=attempt.test_id).count()
    correct_answers = Answer.query.filter_by(attempt_id=attempt.id, is_correct=True).count()

    attempt.score_percent = round((correct_answers / total_questions * 100) if total_questions > 0 else 0, 1)

    db.session.commit()

    return jsonify(attempt.to_dict(include_answers=True))


@attempts_bp.route('/<int:attempt_id>', methods=['GET'])
def get_attempt(attempt_id):
    attempt = TestAttempt.query.get_or_404(attempt_id)
    return jsonify(attempt.to_dict(include_answers=True))


@attempts_bp.route('/results/<int:classroom_id>/<int:test_id>', methods=['GET'])
@jwt_required()
def get_classroom_results(classroom_id, test_id):
    """Get results journal for a classroom and test."""
    from app.models.classroom import Classroom
    from app.models.student import Student

    teacher_id = int(get_jwt_identity())
    classroom = Classroom.query.filter_by(id=classroom_id, teacher_id=teacher_id).first_or_404()

    students = Student.query.filter_by(classroom_id=classroom.id).order_by(Student.display_name).all()
    results = []

    for student in students:
        best_attempt = TestAttempt.query.filter_by(
            student_id=student.id, test_id=test_id, is_finished=True
        ).order_by(TestAttempt.score_percent.desc()).first()

        results.append({
            'student': student.to_dict(),
            'attempt': best_attempt.to_dict() if best_attempt else None,
        })

    return jsonify(results)


@attempts_bp.route('/journal/<int:classroom_id>', methods=['GET'])
@jwt_required()
def get_journal(classroom_id):
    """Get full journal for a classroom — all tests, all students."""
    from app.models.classroom import Classroom
    from app.models.student import Student

    teacher_id = int(get_jwt_identity())
    classroom = Classroom.query.filter_by(id=classroom_id, teacher_id=teacher_id).first_or_404()

    students = Student.query.filter_by(classroom_id=classroom.id).order_by(Student.display_name).all()

    assignments = TestAssignment.query.filter_by(classroom_id=classroom.id).all()
    test_ids = list(set(a.test_id for a in assignments))
    tests = Test.query.filter(Test.id.in_(test_ids)).all() if test_ids else []

    journal = []
    for student in students:
        student_row = {
            'student': student.to_dict(),
            'results': {},
            'average': None,
        }
        scores = []
        for test in tests:
            best = TestAttempt.query.filter_by(
                student_id=student.id, test_id=test.id, is_finished=True
            ).order_by(TestAttempt.score_percent.desc()).first()

            if best:
                student_row['results'][test.id] = {
                    'score_percent': best.score_percent,
                    'duration_seconds': best.duration_seconds,
                }
                scores.append(best.score_percent)
            else:
                student_row['results'][test.id] = None

        student_row['average'] = round(sum(scores) / len(scores), 1) if scores else None
        journal.append(student_row)

    return jsonify({
        'classroom': classroom.to_dict(),
        'tests': [t.to_dict() for t in tests],
        'journal': journal,
    })


@attempts_bp.route('/test-stats/<int:classroom_id>/<int:test_id>', methods=['GET'])
@jwt_required()
def get_test_stats(classroom_id, test_id):
    """Detailed per-question statistics for a test in a classroom."""
    from app.models.classroom import Classroom
    from app.models.student import Student

    teacher_id = int(get_jwt_identity())
    classroom = Classroom.query.filter_by(id=classroom_id, teacher_id=teacher_id).first_or_404()
    test = Test.query.get_or_404(test_id)

    students = Student.query.filter_by(classroom_id=classroom.id).order_by(Student.display_name).all()
    questions = Question.query.filter_by(test_id=test_id).order_by(Question.order).all()

    # Per-student results (best attempt)
    student_results = []
    for student in students:
        best = TestAttempt.query.filter_by(
            student_id=student.id, test_id=test_id, is_finished=True
        ).order_by(TestAttempt.score_percent.desc()).first()
        student_results.append({
            'student': student.to_dict(),
            'attempt': best.to_dict(include_answers=True) if best else None,
        })

    # Per-question statistics
    question_stats = []
    for q in questions:
        total = 0
        correct = 0
        times = []

        for student in students:
            best = TestAttempt.query.filter_by(
                student_id=student.id, test_id=test_id, is_finished=True
            ).order_by(TestAttempt.score_percent.desc()).first()
            if best:
                answer = Answer.query.filter_by(attempt_id=best.id, question_id=q.id).first()
                if answer:
                    total += 1
                    if answer.is_correct:
                        correct += 1
                    if answer.answered_at and best.started_at:
                        seconds = int((answer.answered_at - best.started_at).total_seconds())
                        if 0 <= seconds <= 3600:
                            times.append(seconds)

        question_stats.append({
            'question_id': q.id,
            'order': q.order,
            'question_type': q.question_type,
            'text': (q.content or {}).get('text', f'Вопрос {q.order}'),
            'total_answered': total,
            'correct_count': correct,
            'wrong_count': total - correct,
            'correct_percent': round(correct / total * 100, 1) if total > 0 else None,
            'avg_time_seconds': round(sum(times) / len(times)) if times else None,
        })

    return jsonify({
        'classroom': classroom.to_dict(),
        'test': test.to_dict(),
        'student_results': student_results,
        'question_stats': question_stats,
        'total_students': len(students),
        'attempted_count': sum(1 for r in student_results if r['attempt'] is not None),
    })
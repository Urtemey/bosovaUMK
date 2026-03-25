from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.test import Test
from app.models.question import Question, QuestionType
from app.models.answer import Answer
from app.models.attempt import TestAttempt
from app.models.assignment import TestAssignment

tests_bp = Blueprint('tests', __name__)


@tests_bp.route('', methods=['GET'])
def list_tests():
    grade = request.args.get('grade', type=int)
    query = Test.query
    if grade:
        query = query.filter_by(grade=grade)
    query = query.filter_by(is_published=True).order_by(Test.grade, Test.id)
    tests = query.all()
    return jsonify([t.to_dict() for t in tests])


@tests_bp.route('/my', methods=['GET'])
@jwt_required()
def list_my_tests():
    teacher_id = int(get_jwt_identity())
    tests = Test.query.filter_by(created_by=teacher_id).order_by(Test.grade, Test.id).all()
    return jsonify([t.to_dict() for t in tests])


@tests_bp.route('/<int:test_id>', methods=['GET'])
def get_test(test_id):
    test = Test.query.get_or_404(test_id)
    return jsonify(test.to_dict(include_questions=True))


@tests_bp.route('', methods=['POST'])
@jwt_required()
def create_test():
    teacher_id = int(get_jwt_identity())
    data = request.get_json()

    title = data.get('title', '').strip()
    grade = data.get('grade')
    if not title or not grade:
        return jsonify({'error': 'title и grade обязательны'}), 400

    test = Test(
        title=title,
        grade=grade,
        topic=data.get('topic', '').strip() or None,
        description=data.get('description', '').strip() or None,
        created_by=teacher_id,
        settings=data.get('settings', {}),
        is_published=data.get('is_published', False),
    )
    db.session.add(test)
    db.session.commit()
    return jsonify(test.to_dict()), 201


@tests_bp.route('/<int:test_id>', methods=['PUT'])
@jwt_required()
def update_test(test_id):
    teacher_id = int(get_jwt_identity())
    test = Test.query.filter_by(id=test_id, created_by=teacher_id).first_or_404()

    data = request.get_json()
    if 'title' in data:
        test.title = data['title'].strip()
    if 'grade' in data:
        test.grade = data['grade']
    if 'topic' in data:
        test.topic = data['topic'].strip() or None
    if 'description' in data:
        test.description = data['description'].strip() or None
    if 'settings' in data:
        test.settings = data['settings']
    if 'is_published' in data:
        test.is_published = data['is_published']

    db.session.commit()
    return jsonify(test.to_dict())


@tests_bp.route('/<int:test_id>/duplicate', methods=['POST'])
@jwt_required()
def duplicate_test(test_id):
    teacher_id = int(get_jwt_identity())
    original = Test.query.get_or_404(test_id)

    new_test = Test(
        title=original.title + ' (копия)',
        grade=original.grade,
        topic=original.topic,
        description=original.description,
        created_by=teacher_id,
        settings=dict(original.settings) if original.settings else {},
        is_published=False,
    )
    db.session.add(new_test)
    db.session.flush()

    for q in original.questions.order_by(Question.order):
        new_q = Question(
            test_id=new_test.id,
            order=q.order,
            question_type=q.question_type,
            content=q.content,
            correct_answer=q.correct_answer,
            points=q.points,
        )
        db.session.add(new_q)

    db.session.commit()
    return jsonify(new_test.to_dict(include_questions=True)), 201


@tests_bp.route('/<int:test_id>', methods=['DELETE'])
@jwt_required()
def delete_test(test_id):
    teacher_id = int(get_jwt_identity())
    test = Test.query.filter_by(id=test_id, created_by=teacher_id).first_or_404()

    # Delete answers for all attempts of this test
    attempt_ids = [a.id for a in TestAttempt.query.filter_by(test_id=test.id).all()]
    if attempt_ids:
        Answer.query.filter(Answer.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)

    # Delete attempts
    TestAttempt.query.filter_by(test_id=test.id).delete(synchronize_session=False)

    # Delete assignments
    TestAssignment.query.filter_by(test_id=test.id).delete(synchronize_session=False)

    # Delete answers referencing questions of this test
    question_ids = [q.id for q in Question.query.filter_by(test_id=test.id).all()]
    if question_ids:
        Answer.query.filter(Answer.question_id.in_(question_ids)).delete(synchronize_session=False)

    # Delete questions and test
    Question.query.filter_by(test_id=test.id).delete(synchronize_session=False)
    db.session.delete(test)
    db.session.commit()
    return jsonify({'message': 'Тест удалён'})


@tests_bp.route('/<int:test_id>/questions', methods=['POST'])
@jwt_required()
def add_question(test_id):
    teacher_id = int(get_jwt_identity())
    test = Test.query.filter_by(id=test_id, created_by=teacher_id).first_or_404()

    data = request.get_json()
    question_type = data.get('question_type')
    if question_type not in QuestionType.ALL:
        return jsonify({'error': f'Тип вопроса должен быть одним из: {QuestionType.ALL}'}), 400

    max_order = db.session.query(db.func.max(Question.order)).filter_by(test_id=test.id).scalar() or 0

    question = Question(
        test_id=test.id,
        order=max_order + 1,
        question_type=question_type,
        content=data.get('content', {}),
        correct_answer=data.get('correct_answer'),
        points=data.get('points', 1),
    )
    db.session.add(question)
    db.session.commit()

    return jsonify(question.to_dict(include_correct=True)), 201


@tests_bp.route('/<int:test_id>/questions/<int:question_id>', methods=['PUT'])
@jwt_required()
def update_question(test_id, question_id):
    teacher_id = int(get_jwt_identity())
    Test.query.filter_by(id=test_id, created_by=teacher_id).first_or_404()
    question = Question.query.filter_by(id=question_id, test_id=test_id).first_or_404()

    data = request.get_json()
    if 'content' in data:
        question.content = data['content']
    if 'correct_answer' in data:
        question.correct_answer = data['correct_answer']
    if 'order' in data:
        question.order = data['order']
    if 'points' in data:
        question.points = data['points']

    db.session.commit()
    return jsonify(question.to_dict(include_correct=True))


@tests_bp.route('/import-html', methods=['POST'])
@jwt_required()
def import_from_html():
    """Import questions from contenttests HTML file. Accepts multipart/form-data or JSON."""
    from app.services.html_importer import parse_html_questions

    teacher_id = int(get_jwt_identity())

    if request.content_type and 'multipart/form-data' in request.content_type:
        file = request.files.get('file')
        if not file:
            return jsonify({'error': 'Файл не загружен'}), 400
        html_content = file.read().decode('utf-8', errors='replace')
        title = request.form.get('title', file.filename or 'Импортированный тест').replace('.html', '')
        grade = int(request.form.get('grade', 9))
        topic = request.form.get('topic', '')
    else:
        data = request.get_json()
        if not data or not data.get('html_content'):
            return jsonify({'error': 'html_content обязателен'}), 400
        html_content = data['html_content']
        title = data.get('title', 'Импортированный тест')
        grade = data.get('grade', 9)
        topic = data.get('topic', '')

    try:
        parsed_questions = parse_html_questions(html_content)
    except Exception as e:
        return jsonify({'error': f'Ошибка парсинга: {str(e)}'}), 400

    if not parsed_questions:
        return jsonify({'error': 'Вопросы не найдены в файле'}), 400

    test = Test(
        title=title,
        grade=grade,
        topic=topic or None,
        created_by=teacher_id,
        settings={},
        is_published=False,
    )
    db.session.add(test)
    db.session.flush()

    for order, q_data in enumerate(parsed_questions, start=1):
        question = Question(
            test_id=test.id,
            order=order,
            question_type=q_data['question_type'],
            content=q_data['content'],
            correct_answer=q_data['correct_answer'],
            points=q_data.get('points', 1),
        )
        db.session.add(question)

    db.session.commit()

    return jsonify({
        'test': test.to_dict(include_questions=True),
        'imported_count': len(parsed_questions),
    }), 201


@tests_bp.route('/<int:test_id>/questions/<int:question_id>', methods=['DELETE'])
@jwt_required()
def delete_question(test_id, question_id):
    teacher_id = int(get_jwt_identity())
    Test.query.filter_by(id=test_id, created_by=teacher_id).first_or_404()
    question = Question.query.filter_by(id=question_id, test_id=test_id).first_or_404()

    # Delete answers referencing this question
    Answer.query.filter_by(question_id=question.id).delete(synchronize_session=False)

    db.session.delete(question)
    db.session.commit()
    return jsonify({'message': 'Вопрос удалён'})

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.question import Question, QuestionType
from app.models.test import Test

questions_bp = Blueprint('questions', __name__)


def _require_teacher():
    """Verify the current JWT belongs to a teacher. Returns teacher_id or aborts."""
    claims = get_jwt()
    if claims.get('role') != 'teacher':
        return None
    return int(get_jwt_identity())


@questions_bp.route('', methods=['GET'])
@jwt_required()
def list_questions():
    """Browse all questions with filtering and pagination.

    Query params:
        grade (int) - filter by test grade
        topic (str) - filter by test topic (exact match)
        question_type (str) - filter by question type
        search (str) - text search in content JSON (case-insensitive)
        page (int) - page number, default 1
        per_page (int) - items per page, default 50, max 100
    """
    teacher_id = _require_teacher()
    if teacher_id is None:
        return jsonify({'error': 'Доступ только для учителей'}), 403

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)
    grade = request.args.get('grade', type=int)
    topic = request.args.get('topic', type=str)
    question_type = request.args.get('question_type', type=str)
    search = request.args.get('search', type=str)

    # Base query joining with Test to get test info
    query = db.session.query(Question).join(Test, Question.test_id == Test.id)

    # Apply filters
    if grade:
        query = query.filter(Test.grade == grade)
    if topic:
        query = query.filter(Test.topic == topic)
    if question_type:
        if question_type not in QuestionType.ALL:
            return jsonify({'error': f'Тип вопроса должен быть одним из: {QuestionType.ALL}'}), 400
        query = query.filter(Question.question_type == question_type)
    if search:
        # Search in the JSON content field — cast to text for ILIKE
        query = query.filter(
            db.cast(Question.content, db.Text).ilike(f'%{search}%')
        )

    query = query.order_by(Test.grade, Test.id, Question.order)

    # Paginate
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    # Build response — load tests in bulk to avoid N+1
    test_ids = {q.test_id for q in pagination.items}
    tests_map = {}
    if test_ids:
        tests = Test.query.filter(Test.id.in_(test_ids)).all()
        tests_map = {t.id: t for t in tests}

    questions = []
    for q in pagination.items:
        t = tests_map.get(q.test_id)
        questions.append({
            'id': q.id,
            'test_id': q.test_id,
            'question_type': q.question_type,
            'content': q.content,
            'points': q.points,
            'order': q.order,
            'test': {
                'test_id': t.id,
                'test_title': t.title,
                'grade': t.grade,
                'topic': t.topic,
            } if t else None,
        })

    return jsonify({
        'questions': questions,
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    })


@questions_bp.route('/<int:question_id>', methods=['GET'])
@jwt_required()
def get_question(question_id):
    """Get a single question with correct answer (for editing)."""
    teacher_id = _require_teacher()
    if teacher_id is None:
        return jsonify({'error': 'Доступ только для учителей'}), 403

    q = Question.query.get_or_404(question_id)
    t = Test.query.get(q.test_id)
    return jsonify({
        **q.to_dict(include_correct=True),
        'test': {
            'test_id': t.id,
            'test_title': t.title,
            'grade': t.grade,
            'topic': t.topic,
        } if t else None,
    })


@questions_bp.route('/<int:question_id>', methods=['PUT'])
@jwt_required()
def update_question(question_id):
    """Update a question and propagate changes to all linked copies."""
    teacher_id = _require_teacher()
    if teacher_id is None:
        return jsonify({'error': 'Доступ только для учителей'}), 403

    q = Question.query.get_or_404(question_id)
    data = request.get_json()

    # Determine the "root" source — the canonical original
    root_id = q.source_id or q.id

    # Find all linked questions: the root + all copies pointing to it
    linked = Question.query.filter(
        db.or_(
            Question.id == root_id,
            Question.source_id == root_id,
        )
    ).all()

    # Apply changes to ALL linked questions
    for linked_q in linked:
        if 'content' in data:
            linked_q.content = data['content']
        if 'correct_answer' in data:
            linked_q.correct_answer = data['correct_answer']
        if 'question_type' in data and data['question_type'] in QuestionType.ALL:
            linked_q.question_type = data['question_type']
        if 'points' in data:
            linked_q.points = data['points']

    db.session.commit()

    updated_count = len(linked)
    result = q.to_dict(include_correct=True)
    result['updated_copies'] = updated_count
    return jsonify(result)


@questions_bp.route('/add-to-test', methods=['POST'])
@jwt_required()
def add_to_test():
    """Copy selected questions to a target test.

    Body:
        test_id (int) - target test ID (must be owned by current teacher)
        question_ids (list[int]) - IDs of questions to copy
    """
    teacher_id = _require_teacher()
    if teacher_id is None:
        return jsonify({'error': 'Доступ только для учителей'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Тело запроса обязательно'}), 400

    test_id = data.get('test_id')
    question_ids = data.get('question_ids')

    if not test_id or not question_ids:
        return jsonify({'error': 'test_id и question_ids обязательны'}), 400

    if not isinstance(question_ids, list) or len(question_ids) == 0:
        return jsonify({'error': 'question_ids должен быть непустым массивом'}), 400

    # Verify ownership of the target test
    target_test = Test.query.filter_by(id=test_id, created_by=teacher_id).first()
    if not target_test:
        return jsonify({'error': 'Тест не найден или нет доступа'}), 404

    # Fetch source questions
    source_questions = Question.query.filter(Question.id.in_(question_ids)).all()
    if not source_questions:
        return jsonify({'error': 'Вопросы не найдены'}), 404

    # Determine starting order
    max_order = db.session.query(db.func.max(Question.order)).filter_by(
        test_id=target_test.id
    ).scalar() or 0

    # Copy questions to target test
    added = 0
    for i, q in enumerate(source_questions, start=1):
        new_q = Question(
            test_id=target_test.id,
            order=max_order + i,
            question_type=q.question_type,
            content=q.content,
            correct_answer=q.correct_answer,
            points=q.points,
            source_id=q.source_id or q.id,
        )
        db.session.add(new_q)
        added += 1

    db.session.commit()
    return jsonify({'added': added}), 201


@questions_bp.route('/topics', methods=['GET'])
@jwt_required()
def list_topics():
    """Get unique topics grouped by grade.

    Returns: { topics: { "5": ["topic1", ...], "6": [...], ... } }
    """
    teacher_id = _require_teacher()
    if teacher_id is None:
        return jsonify({'error': 'Доступ только для учителей'}), 403

    # Query distinct grade/topic pairs where topic is not null
    rows = (
        db.session.query(Test.grade, Test.topic)
        .filter(Test.topic.isnot(None), Test.topic != '')
        .distinct()
        .order_by(Test.grade, Test.topic)
        .all()
    )

    topics = {}
    for grade, topic in rows:
        grade_key = str(grade)
        if grade_key not in topics:
            topics[grade_key] = []
        topics[grade_key].append(topic)

    return jsonify({'topics': topics})

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.assignment import TestAssignment
from app.models.test import Test
from app.models.classroom import Classroom

assignments_bp = Blueprint('assignments', __name__)


@assignments_bp.route('', methods=['POST'])
@jwt_required()
def create_assignment():
    teacher_id = int(get_jwt_identity())
    data = request.get_json()

    test_id = data.get('test_id')
    if not test_id:
        return jsonify({'error': 'test_id обязателен'}), 400

    Test.query.get_or_404(test_id)

    classroom_id = data.get('classroom_id')
    student_id = data.get('student_id')

    if classroom_id:
        Classroom.query.filter_by(id=classroom_id, teacher_id=teacher_id).first_or_404()

    assignment = TestAssignment(
        test_id=test_id,
        classroom_id=classroom_id,
        student_id=student_id,
        settings_override=data.get('settings', {}),
        created_by=teacher_id,
    )

    if data.get('create_share_link', False) or (not classroom_id and not student_id):
        assignment.generate_share_link()

    db.session.add(assignment)
    db.session.commit()

    return jsonify(assignment.to_dict()), 201


@assignments_bp.route('/by-link/<share_link>', methods=['GET'])
def get_assignment_by_link(share_link):
    assignment = TestAssignment.query.filter_by(share_link=share_link).first_or_404()
    test = Test.query.get(assignment.test_id)
    return jsonify({
        'assignment': assignment.to_dict(),
        'test': test.to_dict(include_questions=True),
    })


@assignments_bp.route('/classroom/<int:classroom_id>', methods=['GET'])
@jwt_required()
def list_classroom_assignments(classroom_id):
    teacher_id = int(get_jwt_identity())
    Classroom.query.filter_by(id=classroom_id, teacher_id=teacher_id).first_or_404()
    assignments = TestAssignment.query.filter_by(classroom_id=classroom_id).all()
    return jsonify([a.to_dict() for a in assignments])

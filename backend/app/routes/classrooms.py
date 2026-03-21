from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.classroom import Classroom
from app.models.student import Student

classrooms_bp = Blueprint('classrooms', __name__)


@classrooms_bp.route('', methods=['GET'])
@jwt_required()
def list_classrooms():
    teacher_id = int(get_jwt_identity())
    classrooms = Classroom.query.filter_by(teacher_id=teacher_id).order_by(Classroom.grade).all()
    return jsonify([c.to_dict() for c in classrooms])


@classrooms_bp.route('', methods=['POST'])
@jwt_required()
def create_classroom():
    teacher_id = int(get_jwt_identity())
    data = request.get_json()
    name = data.get('name', '').strip()
    grade = data.get('grade')
    
    if not name or not grade:
        return jsonify({'error': 'name и grade обязательны'}), 400
    if grade not in range(5, 12):
        return jsonify({'error': 'grade должен быть от 5 до 11'}), 400

    classroom = Classroom(name=name, grade=grade, teacher_id=teacher_id)
    db.session.add(classroom)
    db.session.commit()

    return jsonify(classroom.to_dict()), 201


@classrooms_bp.route('/<int:classroom_id>', methods=['GET'])
@jwt_required()
def get_classroom(classroom_id):
    teacher_id = int(get_jwt_identity())
    classroom = Classroom.query.filter_by(id=classroom_id, teacher_id=teacher_id).first_or_404()
    return jsonify(classroom.to_dict(include_students=True))


@classrooms_bp.route('/<int:classroom_id>', methods=['DELETE'])
@jwt_required()
def delete_classroom(classroom_id):
    teacher_id = int(get_jwt_identity())
    classroom = Classroom.query.filter_by(id=classroom_id, teacher_id=teacher_id).first_or_404()
    db.session.delete(classroom)
    db.session.commit()
    return jsonify({'message': 'Класс удалён'}), 200


@classrooms_bp.route('/<int:classroom_id>/students', methods=['POST'])
@jwt_required()
def add_student(classroom_id):
    teacher_id = int(get_jwt_identity())
    classroom = Classroom.query.filter_by(id=classroom_id, teacher_id=teacher_id).first_or_404()

    data = request.get_json()
    display_name = data.get('display_name', '').strip()
    if not display_name:
        return jsonify({'error': 'display_name обязателен'}), 400

    login = Student.generate_login()
    while Student.query.filter_by(login=login).first():
        login = Student.generate_login()

    code = Student.generate_code()

    student = Student(
        display_name=display_name,
        login=login,
        code=code,
        classroom_id=classroom.id,
    )
    db.session.add(student)
    db.session.commit()

    return jsonify(student.to_dict(include_credentials=True)), 201


@classrooms_bp.route('/<int:classroom_id>/students/batch', methods=['POST'])
@jwt_required()
def add_students_batch(classroom_id):
    teacher_id = int(get_jwt_identity())
    classroom = Classroom.query.filter_by(id=classroom_id, teacher_id=teacher_id).first_or_404()

    data = request.get_json()
    names = data.get('names', [])
    if not names:
        return jsonify({'error': 'names список обязателен'}), 400

    students = []
    for name in names:
        name = name.strip()
        if not name:
            continue
        login = Student.generate_login()
        while Student.query.filter_by(login=login).first():
            login = Student.generate_login()

        student = Student(
            display_name=name,
            login=login,
            code=Student.generate_code(),
            classroom_id=classroom.id,
        )
        db.session.add(student)
        students.append(student)

    db.session.commit()
    return jsonify([s.to_dict(include_credentials=True) for s in students]), 201


@classrooms_bp.route('/<int:classroom_id>/students/<int:student_id>', methods=['DELETE'])
@jwt_required()
def remove_student(classroom_id, student_id):
    teacher_id = int(get_jwt_identity())
    Classroom.query.filter_by(id=classroom_id, teacher_id=teacher_id).first_or_404()
    student = Student.query.filter_by(id=student_id, classroom_id=classroom_id).first_or_404()
    db.session.delete(student)
    db.session.commit()
    return jsonify({'message': 'Ученик удалён'}), 200

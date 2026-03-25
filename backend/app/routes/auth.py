from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity
)
from app import db
from app.models.teacher import Teacher
from app.models.student import Student

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register_teacher():
    data = request.get_json()
    login = data.get('login', '').strip()
    password = data.get('password', '')
    display_name = data.get('display_name', '').strip()

    if not login or not password or not display_name:
        return jsonify({'error': 'login, password и display_name обязательны'}), 400

    if Teacher.query.filter_by(login=login).first():
        return jsonify({'error': 'Пользователь с таким логином уже существует'}), 409

    teacher = Teacher(login=login, display_name=display_name)
    teacher.set_password(password)
    db.session.add(teacher)
    db.session.commit()

    access_token = create_access_token(identity=str(teacher.id), additional_claims={'role': 'teacher'})
    refresh_token = create_refresh_token(identity=str(teacher.id), additional_claims={'role': 'teacher'})

    return jsonify({
        'teacher': teacher.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token,
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login_teacher():
    data = request.get_json()
    login = data.get('login', '').strip()
    password = data.get('password', '')

    teacher = Teacher.query.filter_by(login=login).first()
    if not teacher or not teacher.check_password(password):
        return jsonify({'error': 'Неверный логин или пароль'}), 401

    access_token = create_access_token(identity=str(teacher.id), additional_claims={'role': 'teacher'})
    refresh_token = create_refresh_token(identity=str(teacher.id), additional_claims={'role': 'teacher'})

    return jsonify({
        'teacher': teacher.to_dict(),
        'access_token': access_token,
        'refresh_token': refresh_token,
    })


@auth_bp.route('/student-login', methods=['POST'])
def login_student():
    data = request.get_json()
    login = data.get('login', '').strip()
    code = data.get('code', '').strip()

    student = Student.query.filter_by(login=login).first()
    if not student or student.code != code:
        return jsonify({'error': 'Неверный логин или код'}), 401

    access_token = create_access_token(identity=str(student.id), additional_claims={'role': 'student'})

    return jsonify({
        'student': student.to_dict(),
        'access_token': access_token,
    })


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    user_id = int(get_jwt_identity())
    teacher = Teacher.query.get(user_id)
    if teacher:
        return jsonify({'role': 'teacher', 'user': teacher.to_dict()})

    student = Student.query.get(user_id)
    if student:
        return jsonify({'role': 'student', 'user': student.to_dict()})

    return jsonify({'error': 'Пользователь не найден'}), 404


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    user_id = int(identity)

    teacher = Teacher.query.get(user_id)
    if teacher:
        role = 'teacher'
    else:
        role = 'student'

    access_token = create_access_token(identity=identity, additional_claims={'role': role})
    return jsonify({'access_token': access_token})

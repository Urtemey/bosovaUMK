from flask import jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity


def current_role():
    return get_jwt().get('role')


def current_user_id():
    return int(get_jwt_identity())


def role_for_teacher(teacher):
    return getattr(teacher, 'role', None) or 'teacher'


def require_role(*allowed_roles):
    role = current_role()
    if role not in allowed_roles:
        return None, (jsonify({'error': '???????????? ????'}), 403)
    return current_user_id(), None

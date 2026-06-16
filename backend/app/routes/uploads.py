from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.utils.roles import require_role
from app.services.s3_uploader import (
    upload_image,
    upload_file,
    S3NotConfigured,
    UnsupportedImage,
    UnsupportedFile,
)

uploads_bp = Blueprint('uploads', __name__)


@uploads_bp.route('/image', methods=['POST'])
@jwt_required()
def upload_image_route():
    """Загрузка изображения в S3. Только для учителя (admin).

    multipart/form-data, поле `file`. Возвращает {"url": "https://..."}.
    """
    teacher_id, error = require_role('admin')
    if error:
        return error

    file = request.files.get('file')
    if file is None or file.filename == '':
        return jsonify({'error': 'Файл не передан'}), 400

    data = file.read()
    if not data:
        return jsonify({'error': 'Пустой файл'}), 400

    try:
        url = upload_image(data)
    except UnsupportedImage as e:
        return jsonify({'error': str(e)}), 400
    except S3NotConfigured as e:
        return jsonify({'error': str(e)}), 503
    except Exception:
        return jsonify({'error': 'Не удалось загрузить изображение'}), 502

    return jsonify({'url': url}), 201


@uploads_bp.route('/file', methods=['POST'])
@jwt_required()
def upload_file_route():
    """Загрузка файла-вложения к условию задачи в S3. Только для учителя (admin).

    multipart/form-data, поле `file`. Возвращает {"url": "https://...", "name": "..."}.
    """
    teacher_id, error = require_role('admin')
    if error:
        return error

    file = request.files.get('file')
    if file is None or file.filename == '':
        return jsonify({'error': 'Файл не передан'}), 400

    filename = file.filename
    data = file.read()
    if not data:
        return jsonify({'error': 'Пустой файл'}), 400

    try:
        url = upload_file(data, filename)
    except UnsupportedFile as e:
        return jsonify({'error': str(e)}), 400
    except S3NotConfigured as e:
        return jsonify({'error': str(e)}), 503
    except Exception:
        return jsonify({'error': 'Не удалось загрузить файл'}), 502

    return jsonify({'url': url, 'name': filename}), 201

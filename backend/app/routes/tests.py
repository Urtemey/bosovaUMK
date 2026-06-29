import re

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt, verify_jwt_in_request
from app import db
from app.models.test import Test, normalize_section, SECTIONS_BY_GRADE
from app.models.question import Question, QuestionType
from app.models.answer import Answer
from app.models.attempt import TestAttempt
from app.models.assignment import TestAssignment
from app.utils.roles import require_role

tests_bp = Blueprint('tests', __name__)


@tests_bp.route('', methods=['GET'])
def list_tests():
    grade = request.args.get('grade', type=int)
    query = Test.query
    if grade:
        query = query.filter_by(grade=grade)
    query = query.filter_by(is_published=True).order_by(Test.grade, Test.display_order, Test.id)
    tests = query.all()
    return jsonify([t.to_dict() for t in tests])


@tests_bp.route('/reorder', methods=['POST'])
@jwt_required()
def reorder_tests():
    teacher_id, error = require_role('admin')
    if error:
        return error

    data = request.get_json() or {}
    grade = data.get('grade')
    order = data.get('order')
    if not isinstance(grade, int) or not isinstance(order, list):
        return jsonify({'error': 'grade (int) и order (list[int]) обязательны'}), 400

    tests = Test.query.filter(Test.grade == grade, Test.id.in_(order)).all()
    by_id = {t.id: t for t in tests}
    for index, tid in enumerate(order):
        test = by_id.get(int(tid))
        if test is not None:
            test.display_order = index

    db.session.commit()
    return jsonify({'message': 'Порядок обновлён', 'count': len(by_id)})


@tests_bp.route('/my', methods=['GET'])
@jwt_required()
def list_my_tests():
    teacher_id, error = require_role('admin')
    if error:
        return error
    tests = Test.query.filter_by(created_by=teacher_id).order_by(Test.grade, Test.display_order, Test.id).all()
    return jsonify([t.to_dict() for t in tests])


def _export_response(tests):
    """Собирает HTML-документ по тестам и отдаёт как файл для скачивания."""
    from urllib.parse import quote
    from flask import Response
    from app.services.export_renderer import render_tests_html

    origin = request.url_root.rstrip('/')
    html = render_tests_html(tests, origin=origin)

    if len(tests) == 1:
        base = tests[0].title
    else:
        base = f'Тесты ({len(tests)})'
    # имя файла: ascii-fallback + RFC 5987 для кириллицы
    ascii_name = re.sub(r'[^A-Za-z0-9._-]+', '_', base).strip('_') or 'tests'
    filename = f'{ascii_name}.html'
    filename_star = quote(f'{base}.html')

    resp = Response(html, mimetype='text/html; charset=utf-8')
    resp.headers['Content-Disposition'] = (
        f"attachment; filename=\"{filename}\"; filename*=UTF-8''{filename_star}"
    )
    return resp


@tests_bp.route('/<int:test_id>/export', methods=['GET'])
@jwt_required()
def export_test(test_id):
    teacher_id, error = require_role('admin')
    if error:
        return error
    test = Test.query.filter_by(id=test_id, created_by=teacher_id).first_or_404()
    return _export_response([test])


@tests_bp.route('/export', methods=['POST'])
@jwt_required()
def export_tests_bulk():
    """Массовый экспорт: { "test_ids": [int, ...] } -> один HTML-документ."""
    teacher_id, error = require_role('admin')
    if error:
        return error
    data = request.get_json() or {}
    test_ids = data.get('test_ids')
    if not isinstance(test_ids, list) or not test_ids:
        return jsonify({'error': 'test_ids (непустой список) обязателен'}), 400

    tests = Test.query.filter(
        Test.id.in_(test_ids), Test.created_by == teacher_id
    ).order_by(Test.grade, Test.display_order, Test.id).all()
    if not tests:
        return jsonify({'error': 'Тесты не найдены или нет доступа'}), 404
    return _export_response(tests)


@tests_bp.route('/<int:test_id>', methods=['GET'])
def get_test(test_id):
    test = Test.query.get_or_404(test_id)
    include_correct = False
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if identity:
            claims = get_jwt()
            if claims.get('role') == 'admin' and test.created_by == int(identity):
                include_correct = True
    except Exception:
        pass
    return jsonify(test.to_dict(include_questions=True, include_correct=include_correct))


@tests_bp.route('', methods=['POST'])
@jwt_required()
def create_test():
    teacher_id, error = require_role('admin')
    if error:
        return error
    data = request.get_json()

    title = data.get('title', '').strip()
    grade = data.get('grade')
    if not title or not grade:
        return jsonify({'error': 'title и grade обязательны'}), 400

    test = Test(
        title=title,
        grade=grade,
        section=normalize_section(grade, data.get('section')),
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
    teacher_id, error = require_role('admin')
    if error:
        return error
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
    # Подраздел приводим к допустимому для текущего класса. Если класс сменили
    # без явного section — сбрасываем недопустимый старый подраздел.
    if 'section' in data:
        test.section = normalize_section(test.grade, data['section'])
    elif 'grade' in data:
        test.section = normalize_section(test.grade, test.section)

    db.session.commit()
    return jsonify(test.to_dict())


@tests_bp.route('/<int:test_id>/duplicate', methods=['POST'])
@jwt_required()
def duplicate_test(test_id):
    teacher_id, error = require_role('admin')
    if error:
        return error
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
            source_id=q.source_id or q.id,
        )
        db.session.add(new_q)

    db.session.commit()
    return jsonify(new_test.to_dict(include_questions=True)), 201


def _cascade_delete_test(test):
    """Delete a test and everything referencing it. Does NOT commit."""
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


@tests_bp.route('/<int:test_id>', methods=['DELETE'])
@jwt_required()
def delete_test(test_id):
    teacher_id, error = require_role('admin')
    if error:
        return error
    test = Test.query.filter_by(id=test_id, created_by=teacher_id).first_or_404()

    _cascade_delete_test(test)
    db.session.commit()
    return jsonify({'message': 'Тест удалён'})


@tests_bp.route('/<int:test_id>/split', methods=['POST'])
@jwt_required()
def split_test(test_id):
    """Split a test into several new tests by question ranges.

    Body: {
      "segments": [{"title": str, "start": int, "end": int}, ...],  # 1-based inclusive
      "delete_original": bool
    }
    Returns the list of created tests.
    """
    teacher_id, error = require_role('admin')
    if error:
        return error
    original = Test.query.filter_by(id=test_id, created_by=teacher_id).first_or_404()

    data = request.get_json() or {}
    segments = data.get('segments')

    if not isinstance(segments, list) or len(segments) < 2:
        return jsonify({'error': 'Нужно указать минимум 2 части'}), 400

    questions = original.questions.order_by(Question.order).all()
    n = len(questions)
    if n < 2:
        return jsonify({'error': 'В тесте должно быть минимум 2 вопроса для разделения'}), 400

    normalized = []
    for seg in segments:
        if not isinstance(seg, dict):
            return jsonify({'error': 'Некорректный формат части'}), 400
        title = (seg.get('title') or '').strip()
        if not title:
            return jsonify({'error': 'У каждой части должно быть название'}), 400
        try:
            start = int(seg.get('start'))
            end = int(seg.get('end'))
        except (TypeError, ValueError):
            return jsonify({'error': 'Некорректные границы части'}), 400
        if not (1 <= start <= end <= n):
            return jsonify({'error': f'Границы части должны быть в диапазоне 1..{n}'}), 400
        normalized.append((title, start, end))

    base_order = db.session.query(db.func.max(Test.display_order)).filter_by(grade=original.grade).scalar() or 0

    new_tests = []
    for offset, (title, start, end) in enumerate(normalized, start=1):
        new_test = Test(
            title=title,
            grade=original.grade,
            topic=original.topic,
            description=original.description,
            created_by=teacher_id,
            settings=dict(original.settings) if original.settings else {},
            is_published=False,
            display_order=base_order + offset,
        )
        db.session.add(new_test)
        db.session.flush()

        for new_order, q in enumerate(questions[start - 1:end], start=1):
            db.session.add(Question(
                test_id=new_test.id,
                order=new_order,
                question_type=q.question_type,
                content=q.content,
                correct_answer=q.correct_answer,
                points=q.points,
                source_id=q.source_id or q.id,
            ))
        new_tests.append(new_test)

    # Исходный тест сохраняем, но убираем из каталога (переводим в черновик),
    # чтобы он не дублировал новые части.
    original.is_published = False

    db.session.commit()
    return jsonify([t.to_dict() for t in new_tests]), 201


@tests_bp.route('/<int:test_id>/questions', methods=['POST'])
@jwt_required()
def add_question(test_id):
    teacher_id, error = require_role('admin')
    if error:
        return error
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
    teacher_id, error = require_role('admin')
    if error:
        return error
    Test.query.filter_by(id=test_id, created_by=teacher_id).first_or_404()
    question = Question.query.filter_by(id=question_id, test_id=test_id).first_or_404()

    data = request.get_json()
    if 'question_type' in data:
        question_type = data['question_type']
        if question_type not in QuestionType.ALL:
            return jsonify({'error': f'Тип вопроса должен быть одним из: {QuestionType.ALL}'}), 400
        question.question_type = question_type
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
    """Import questions from contenttests HTML file. Accepts multipart/form-data or JSON.

    Дополнительно (multipart): поле `images` — файлы изображений, на которые
    ссылается HTML; поле `image_paths` — JSON-массив относительных путей в том же
    порядке (из webkitRelativePath; если пусто — берётся имя файла). Изображения
    кладутся в S3 по ключу images/<относительный путь>, чтобы ссылки в вопросах
    указывали на реальные объекты.
    """
    import json
    from app.services.html_importer import parse_html_questions

    teacher_id, error = require_role('admin')
    if error:
        return error

    image_files = []
    image_paths = []

    if request.content_type and 'multipart/form-data' in request.content_type:
        file = request.files.get('file')
        if not file:
            return jsonify({'error': 'Файл не загружен'}), 400
        html_content = file.read().decode('utf-8', errors='replace')
        title = request.form.get('title', file.filename or 'Импортированный тест').replace('.html', '')
        grade = int(request.form.get('grade', 9))
        topic = request.form.get('topic', '')

        image_files = request.files.getlist('images')
        try:
            image_paths = json.loads(request.form.get('image_paths') or '[]')
        except (ValueError, TypeError):
            image_paths = []
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

    # Загрузка сопутствующих изображений в S3 (если переданы).
    images_uploaded = 0
    images_failed = 0
    images_error = None
    if image_files:
        from app.services.s3_uploader import (
            upload_content_image,
            _detect,
            S3NotConfigured,
        )
        for idx, img in enumerate(image_files):
            if img is None or img.filename == '':
                continue
            rel = image_paths[idx] if idx < len(image_paths) and image_paths[idx] else img.filename
            try:
                data = img.read()
                if not data:
                    images_failed += 1
                    continue
                # Принимаем только настоящие изображения (по магическим байтам).
                _, content_type = _detect(data[:16])
                if content_type is None:
                    images_failed += 1
                    continue
                upload_content_image(data, rel, content_type=content_type)
                images_uploaded += 1
            except S3NotConfigured as e:
                images_error = str(e)
                break
            except Exception:
                images_failed += 1

    return jsonify({
        'test': test.to_dict(include_questions=True),
        'imported_count': len(parsed_questions),
        'images_uploaded': images_uploaded,
        'images_failed': images_failed,
        'images_error': images_error,
    }), 201


def _upload_provided_images(image_files, image_paths):
    """Заливает переданные вручную файлы изображений в S3 по их путям.

    Используется для HTML-импорта, где картинки лежат отдельными файлами и в
    HTML на них ссылаются по относительному пути (images/<rel>). Возвращает
    (uploaded, failed, error).
    """
    if not image_files:
        return 0, 0, None
    from app.services.s3_uploader import upload_content_image, _detect, S3NotConfigured
    uploaded = failed = 0
    error = None
    for idx, img in enumerate(image_files):
        if img is None or img.filename == '':
            continue
        rel = image_paths[idx] if idx < len(image_paths) and image_paths[idx] else img.filename
        try:
            data = img.read()
            if not data:
                failed += 1
                continue
            _, content_type = _detect(data[:16])
            if content_type is None:
                failed += 1
                continue
            upload_content_image(data, rel, content_type=content_type)
            uploaded += 1
        except S3NotConfigured as e:
            error = str(e)
            break
        except Exception:
            failed += 1
    return uploaded, failed, error


def _create_test_with_questions(title, grade, topic, teacher_id, parsed_questions, section=None):
    """Создаёт черновик теста и его вопросы. Без commit."""
    test = Test(
        title=title,
        grade=grade,
        section=normalize_section(grade, section),
        topic=topic or None,
        created_by=teacher_id,
        settings={},
        is_published=False,
    )
    db.session.add(test)
    db.session.flush()
    for order, q in enumerate(parsed_questions, start=1):
        db.session.add(Question(
            test_id=test.id,
            order=order,
            question_type=q['question_type'],
            content=q['content'],
            correct_answer=q['correct_answer'],
            points=q.get('points', 1),
        ))
    return test


@tests_bp.route('/import', methods=['POST'])
@jwt_required()
def import_files():
    """Массовый импорт тестов из нескольких файлов: HTML (contenttests) и/или
    ZIP (IMS/QTI content package, DL_RES_*.zip).

    multipart/form-data:
      - files: один или несколько файлов (.html, .htm, .zip)
      - grade (int), topic (str) — применяются ко всем
      - title (str) — название (используется, если файл один)
      - images / image_paths — опционально, картинки для HTML (как раньше)

    Каждый файл -> отдельный тест-черновик. Картинки из ZIP заливаются в S3
    автоматически. Возвращает массив результатов по каждому файлу.
    """
    import json
    from app.services.html_importer import parse_html_questions
    from app.services.qti_importer import parse_qti_zip, QtiParseError
    from app.services.s3_uploader import upload_image, S3NotConfigured

    teacher_id, error = require_role('admin')
    if error:
        return error

    if not (request.content_type and 'multipart/form-data' in request.content_type):
        return jsonify({'error': 'Ожидается multipart/form-data'}), 400

    files = request.files.getlist('files')
    if not files:
        single = request.files.get('file')
        if single:
            files = [single]
    files = [f for f in files if f and f.filename]
    if not files:
        return jsonify({'error': 'Файлы не загружены'}), 400

    grade = int(request.form.get('grade', 9))
    topic = request.form.get('topic', '')
    section = request.form.get('section') or None
    explicit_title = request.form.get('title', '').strip()

    # картинки, переданные вручную (для HTML)
    image_files = request.files.getlist('images')
    try:
        image_paths = json.loads(request.form.get('image_paths') or '[]')
    except (ValueError, TypeError):
        image_paths = []

    # заливаем переданные вручную картинки один раз (общий ключ images/<rel>)
    manual_uploaded, manual_failed, manual_error = _upload_provided_images(image_files, image_paths)

    # загрузчик для картинок из ZIP: случайное имя в S3, без коллизий
    s3_disabled = {'flag': False}

    def zip_uploader(data, filename):
        if s3_disabled['flag']:
            return None
        try:
            return upload_image(data)
        except S3NotConfigured:
            s3_disabled['flag'] = True
            return None
        except Exception:
            return None

    results = []
    total_tests = 0
    total_questions = 0
    total_images = manual_uploaded

    for f in files:
        name = f.filename or 'файл'
        ext = name.rsplit('.', 1)[-1].lower() if '.' in name else ''
        title = explicit_title if (explicit_title and len(files) == 1) else name.rsplit('.', 1)[0]
        try:
            if ext == 'zip':
                data = f.read()
                parsed = parse_qti_zip(data, uploader=zip_uploader)
                questions = parsed['questions']
                if not questions:
                    results.append({'filename': name, 'ok': False, 'error': 'Вопросы не найдены в архиве'})
                    continue
                zip_title = title if explicit_title and len(files) == 1 else (parsed.get('title') or title)
                test = _create_test_with_questions(zip_title, grade, topic, teacher_id, questions, section)
                db.session.commit()
                total_tests += 1
                total_questions += len(questions)
                total_images += parsed.get('images_uploaded', 0)
                results.append({
                    'filename': name,
                    'ok': True,
                    'test_id': test.id,
                    'title': test.title,
                    'imported_count': len(questions),
                    'images_uploaded': parsed.get('images_uploaded', 0),
                    'images_failed': parsed.get('images_failed', 0),
                    'unsupported': parsed.get('unsupported', 0),
                })
            elif ext in ('html', 'htm'):
                html_content = f.read().decode('utf-8', errors='replace')
                questions = parse_html_questions(html_content)
                if not questions:
                    results.append({'filename': name, 'ok': False, 'error': 'Вопросы не найдены в файле'})
                    continue
                test = _create_test_with_questions(title, grade, topic, teacher_id, questions, section)
                db.session.commit()
                total_tests += 1
                total_questions += len(questions)
                results.append({
                    'filename': name,
                    'ok': True,
                    'test_id': test.id,
                    'title': test.title,
                    'imported_count': len(questions),
                })
            else:
                results.append({'filename': name, 'ok': False, 'error': 'Неподдерживаемый формат (нужен .html или .zip)'})
        except QtiParseError as e:
            db.session.rollback()
            results.append({'filename': name, 'ok': False, 'error': str(e)})
        except Exception as e:
            db.session.rollback()
            results.append({'filename': name, 'ok': False, 'error': f'Ошибка: {e}'})

    return jsonify({
        'results': results,
        'total_tests': total_tests,
        'total_questions': total_questions,
        'total_images_uploaded': total_images,
        'manual_images_failed': manual_failed,
        's3_error': manual_error or ('S3 не настроен — изображения из архивов не загружены' if s3_disabled['flag'] else None),
    }), 201


def _s3_keys_in_content(content):
    """Собирает ключи объектов S3 (images/…, files/…), на которые ссылается
    JSON-содержимое вопроса (поля image/file и встроенные <img src> в HTML)."""
    import json
    from app.services.s3_uploader import key_from_url
    keys = set()
    try:
        blob = json.dumps(content, ensure_ascii=False)
    except (TypeError, ValueError):
        return keys
    # любые http(s)-ссылки + значения src="..." внутри HTML
    for url in re.findall(r'https?://[^\s"\'<>\\)]+', blob):
        k = key_from_url(url)
        if k:
            keys.add(k)
    return keys


@tests_bp.route('/set-section', methods=['POST'])
@jwt_required()
def set_section_bulk():
    """Массово перемещает тесты в подраздел (БУ/УУ/ВПР/ОГЭ/ЕГЭ).

    Body: { "test_ids": [int, ...], "section": str|null }
    section=null/'' — убрать подраздел. Тесты, чей класс не допускает указанный
    подраздел, пропускаются (skipped).
    """
    teacher_id, error = require_role('admin')
    if error:
        return error

    data = request.get_json() or {}
    test_ids = data.get('test_ids')
    section = data.get('section') or None

    if not isinstance(test_ids, list) or not test_ids:
        return jsonify({'error': 'test_ids (непустой список) обязателен'}), 400

    tests = Test.query.filter(Test.id.in_(test_ids), Test.created_by == teacher_id).all()
    updated = skipped = 0
    for t in tests:
        if section is None:
            t.section = None
            updated += 1
        elif section in SECTIONS_BY_GRADE.get(t.grade, ()):
            t.section = section
            updated += 1
        else:
            skipped += 1
    db.session.commit()
    return jsonify({'updated': updated, 'skipped': skipped})


@tests_bp.route('/bulk-delete', methods=['POST'])
@jwt_required()
def bulk_delete_tests():
    """Массовое удаление тестов с опциями.

    Body: {
      "test_ids": [int, ...],
      "delete_s3_images": bool   # удалять связанные картинки из S3
                                 # (только те, что больше нигде не используются)
    }
    Вопросы выбранных тестов удаляются вместе с тестами (каскад); связанные
    копии в ДРУГИХ тестах не трогаются.
    """
    teacher_id, error = require_role('admin')
    if error:
        return error

    data = request.get_json() or {}
    test_ids = data.get('test_ids')
    delete_s3_images = bool(data.get('delete_s3_images', False))

    if not isinstance(test_ids, list) or not test_ids:
        return jsonify({'error': 'test_ids (непустой список) обязателен'}), 400

    tests = Test.query.filter(Test.id.in_(test_ids), Test.created_by == teacher_id).all()
    if not tests:
        return jsonify({'error': 'Тесты не найдены или нет доступа'}), 404

    owned_ids = [t.id for t in tests]

    # ключи S3, на которые ссылаются удаляемые вопросы (до удаления)
    candidate_keys = set()
    deleted_question_ids = set()
    if delete_s3_images:
        for q in Question.query.filter(Question.test_id.in_(owned_ids)).all():
            deleted_question_ids.add(q.id)
            candidate_keys |= _s3_keys_in_content(q.content)

    deleted_questions = Question.query.filter(Question.test_id.in_(owned_ids)).count()

    for test in tests:
        _cascade_delete_test(test)
    db.session.commit()

    images_deleted = images_skipped = images_failed = 0
    s3_error = None
    if delete_s3_images and candidate_keys:
        # Какие ключи всё ещё используются оставшимися вопросами — проверяем
        # точечными SQL EXISTS (по числу ключей), а не загрузкой всех вопросов.
        to_delete = []
        for key in candidate_keys:
            used = db.session.query(Question.id).filter(
                db.cast(Question.content, db.Text).ilike(f'%{key}%')
            ).first()
            if used:
                images_skipped += 1
            else:
                to_delete.append(key)

        # Удаление из S3 не должно валить/вешать запрос — тесты уже удалены.
        if to_delete:
            try:
                from app.services.s3_uploader import delete_objects, S3NotConfigured
                images_deleted, images_failed = delete_objects(to_delete)
            except S3NotConfigured as e:
                s3_error = str(e)
            except Exception as e:
                s3_error = f'Ошибка удаления из S3: {e}'

    return jsonify({
        'deleted_tests': len(tests),
        'deleted_questions': deleted_questions,
        'images_deleted': images_deleted,
        'images_skipped': images_skipped,
        'images_failed': images_failed,
        's3_error': s3_error,
    })


@tests_bp.route('/<int:test_id>/questions/<int:question_id>', methods=['DELETE'])
@jwt_required()
def delete_question(test_id, question_id):
    teacher_id, error = require_role('admin')
    if error:
        return error
    Test.query.filter_by(id=test_id, created_by=teacher_id).first_or_404()
    question = Question.query.filter_by(id=question_id, test_id=test_id).first_or_404()

    # Delete answers referencing this question
    Answer.query.filter_by(question_id=question.id).delete(synchronize_session=False)

    db.session.delete(question)
    db.session.commit()
    return jsonify({'message': 'Вопрос удалён'})

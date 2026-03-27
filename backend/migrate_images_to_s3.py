"""
Миграция ссылок на изображения с /content-images/ на S3 Object Storage.
Запускать ОДИН РАЗ после:
  1. Загрузки изображений в S3
  2. flask db upgrade + seed.py + import_contenttests.py

Использование:
    S3_IMAGES_BASE_URL=https://s3.twcstorage.ru/d662cfa7-f28b-468b-ac1d-2ee6c10950a0/images python migrate_images_to_s3.py
"""
import os
import sys
import copy
from app import create_app, db
from app.models.question import Question

OLD_PREFIX = '/content-images/'
NEW_BASE = os.environ.get('S3_IMAGES_BASE_URL', '').rstrip('/')

if not NEW_BASE:
    print("ERROR: Установи переменную S3_IMAGES_BASE_URL")
    print("Пример: S3_IMAGES_BASE_URL=https://s3.twcstorage.ru/d662cfa7-f28b-468b-ac1d-2ee6c10950a0/images")
    sys.exit(1)


def migrate_value(value):
    """Рекурсивно заменяет /content-images/ на S3 URL в любой структуре."""
    if isinstance(value, str):
        if OLD_PREFIX in value:
            return value.replace(OLD_PREFIX, NEW_BASE + '/'), True
        return value, False
    elif isinstance(value, list):
        changed = False
        new_list = []
        for item in value:
            new_item, item_changed = migrate_value(item)
            new_list.append(new_item)
            if item_changed:
                changed = True
        return new_list, changed
    elif isinstance(value, dict):
        changed = False
        new_dict = {}
        for k, v in value.items():
            new_v, v_changed = migrate_value(v)
            new_dict[k] = new_v
            if v_changed:
                changed = True
        return new_dict, changed
    else:
        return value, False


app = create_app()

with app.app_context():
    questions = Question.query.all()
    total = len(questions)
    migrated_count = 0
    examples = []

    print(f"Найдено {total} вопросов в БД.")
    print(f"  Замена: {OLD_PREFIX}* -> {NEW_BASE}/*")
    print()

    for q in questions:
        if not q.content:
            continue

        new_content, changed = migrate_value(q.content)

        if changed:
            q.content = new_content
            migrated_count += 1
            if len(examples) < 3:
                img = new_content.get('image', '(inline в тексте)')
                examples.append(f"  question #{q.id}: {img}")

    if migrated_count > 0:
        print(f"Обновляем {migrated_count} вопросов...")
        for ex in examples:
            print(ex)
        print()

        db.session.commit()
        print(f"Готово! Обновлено {migrated_count} из {total} вопросов.")
    else:
        print("Вопросов с /content-images/ не найдено.")
        print("Возможно, миграция уже выполнена или данные ещё не импортированы.")

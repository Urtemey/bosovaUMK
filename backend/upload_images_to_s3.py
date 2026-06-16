"""
Массовая загрузка изображений из contenttests/images/ в S3 Object Storage.

Это «шаг 1», который требует migrate_images_to_s3.py: сначала кладём файлы
в бакет, потом миграция переписывает ссылки в БД. Ключ объекта формируется
как images/<относительный путь>, что в точности совпадает со ссылками,
которые генерируют html_importer.py и migrate_images_to_s3.py
(S3_IMAGES_BASE_URL/<относительный путь>). Поэтому ссылки не ломаются.

Подпапки сохраняются (например images/img/foo.png).

Использование:
    cd backend
    # боевой прогон (читает ключи S3 из .env)
    python upload_images_to_s3.py
    # предпросмотр без загрузки: печатает «локальный путь -> ключ»
    python upload_images_to_s3.py --dry-run
    # не перезагружать уже существующие объекты
    python upload_images_to_s3.py --skip-existing
    # своя папка-источник
    python upload_images_to_s3.py --dir ../contenttests/images
"""
import argparse
import mimetypes
import os
import sys

from app import create_app
from app.services.s3_uploader import (
    _client,
    normalize_image_relpath,
    S3NotConfigured,
)

DEFAULT_IMAGES_DIR = os.path.join(
    os.path.dirname(__file__), '..', 'contenttests', 'images'
)


def iter_image_files(root: str):
    """Возвращает пары (абсолютный путь, относительный путь с прямыми слешами)."""
    for dirpath, _dirs, files in os.walk(root):
        for name in files:
            abs_path = os.path.join(dirpath, name)
            rel = os.path.relpath(abs_path, root).replace(os.sep, '/')
            yield abs_path, rel


def main():
    parser = argparse.ArgumentParser(description='Массовая загрузка изображений в S3')
    parser.add_argument('--dry-run', action='store_true', help='Только показать, что будет загружено')
    parser.add_argument('--skip-existing', action='store_true', help='Пропускать уже существующие объекты')
    parser.add_argument('--dir', default=DEFAULT_IMAGES_DIR, help='Папка-источник с изображениями')
    args = parser.parse_args()

    root = os.path.abspath(args.dir)
    if not os.path.isdir(root):
        print(f'ERROR: папка не найдена: {root}')
        sys.exit(1)

    files = sorted(iter_image_files(root), key=lambda x: x[1])
    total = len(files)
    print(f'Папка-источник: {root}')
    print(f'Найдено файлов: {total}')
    print(f'Ключи объектов: images/<относительный путь>')
    print()

    if total == 0:
        print('Нечего загружать.')
        return

    app = create_app()
    with app.app_context():
        bucket = app.config.get('S3_BUCKET')

        if args.dry_run:
            for abs_path, rel in files:
                rel_norm = normalize_image_relpath(rel)
                print(f'  {rel}  ->  images/{rel_norm}')
            print()
            print(f'[DRY RUN] Готово к загрузке: {total} файл(ов). Ничего не загружено.')
            return

        try:
            client = _client()
        except S3NotConfigured as e:
            print(f'ERROR: {e}')
            sys.exit(1)

        uploaded = 0
        skipped = 0
        errors = 0

        for i, (abs_path, rel) in enumerate(files, start=1):
            rel_norm = normalize_image_relpath(rel)
            key = f'images/{rel_norm}'

            if args.skip_existing:
                try:
                    client.head_object(Bucket=bucket, Key=key)
                    skipped += 1
                    if i % 50 == 0 or i == total:
                        print(f'  [{i}/{total}] пропущено (есть): {key}')
                    continue
                except Exception:
                    pass  # нет объекта — загружаем

            try:
                with open(abs_path, 'rb') as fh:
                    data = fh.read()
                content_type = mimetypes.guess_type(rel_norm)[0] or 'application/octet-stream'
                client.put_object(
                    Bucket=bucket,
                    Key=key,
                    Body=data,
                    ContentType=content_type,
                )
                uploaded += 1
                if i % 50 == 0 or i == total:
                    print(f'  [{i}/{total}] загружено: {key}')
            except Exception as e:
                errors += 1
                print(f'  ОШИБКА {key}: {e}')

        print()
        print('=== Итог ===')
        print(f'Загружено:   {uploaded}')
        print(f'Пропущено:   {skipped}')
        print(f'Ошибок:      {errors}')
        print(f'Всего:       {total}')
        if errors == 0:
            print()
            print('Готово. Теперь можно запустить migrate_images_to_s3.py,')
            print('чтобы переписать ссылки /content-images/ в БД на S3.')


if __name__ == '__main__':
    main()

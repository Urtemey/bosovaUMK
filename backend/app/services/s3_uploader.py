"""Загрузка изображений в S3-совместимое хранилище (timeweb).

Формат файла определяется по магическим байтам, а не по имени/MIME от клиента,
чтобы под видом картинки нельзя было залить произвольный файл.
"""

import os
import uuid
from functools import lru_cache
from urllib.parse import quote

from flask import current_app


class S3NotConfigured(Exception):
    """S3-ключи не заданы в окружении."""


class UnsupportedImage(Exception):
    """Файл не является поддерживаемым изображением."""


class UnsupportedFile(Exception):
    """Файл имеет недопустимое расширение."""


# Разрешённые расширения для файлов-вложений к условию задачи.
ALLOWED_FILE_EXTENSIONS = {
    'xlsx', 'xls', 'csv', 'txt', 'doc', 'docx',
    'pdf', 'rtf', 'odt', 'ods', 'zip', 'json', 'xml',
    'pptx', 'ppt',
}


def _detect(head: bytes):
    """Возвращает (ext, content_type) по сигнатуре файла или (None, None)."""
    if head[:3] == b'\xff\xd8\xff':
        return 'jpg', 'image/jpeg'
    if head[:8] == b'\x89PNG\r\n\x1a\n':
        return 'png', 'image/png'
    if head[:6] in (b'GIF87a', b'GIF89a'):
        return 'gif', 'image/gif'
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'webp', 'image/webp'
    return None, None


@lru_cache(maxsize=1)
def _client():
    cfg = current_app.config
    if not (cfg.get('S3_BUCKET') and cfg.get('S3_ACCESS_KEY') and cfg.get('S3_SECRET_KEY')):
        raise S3NotConfigured(
            'S3 не настроен: задайте S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY в .env'
        )
    import boto3
    from botocore.config import Config as BotoConfig
    return boto3.client(
        's3',
        endpoint_url=cfg['S3_ENDPOINT_URL'],
        region_name=cfg['S3_REGION'],
        aws_access_key_id=cfg['S3_ACCESS_KEY'],
        aws_secret_access_key=cfg['S3_SECRET_KEY'],
        config=BotoConfig(signature_version='s3v4'),
    )


def _public_base() -> str:
    """Корень бакета для публичных ссылок. URL объекта = {base}/{key},
    где key всегда несёт папку (images/… или files/…).

    Конвенция: S3_IMAGES_BASE_URL — корень бакета (без /images). Для
    устойчивости терпим устаревшее значение, оканчивающееся на /images:
    срезаем его, иначе ключ images/… дал бы двойной префикс /images/images/.
    """
    cfg = current_app.config
    base = cfg.get('S3_IMAGES_BASE_URL')
    if base:
        base = base.rstrip('/')
        if base.endswith('/images'):
            base = base[: -len('/images')]
        return base
    return f"{cfg['S3_ENDPOINT_URL'].rstrip('/')}/{cfg['S3_BUCKET']}"


def upload_image(data: bytes) -> str:
    """Загружает изображение в бакет и возвращает публичный URL.

    Бросает UnsupportedImage для неподдерживаемого формата
    и S3NotConfigured если ключи не заданы.
    """
    ext, content_type = _detect(data[:16])
    if ext is None:
        raise UnsupportedImage('Поддерживаются только JPG, PNG, GIF, WEBP')

    key = f"images/{uuid.uuid4().hex}.{ext}"
    client = _client()
    client.put_object(
        Bucket=current_app.config['S3_BUCKET'],
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return f"{_public_base()}/{key}"


def normalize_image_relpath(rel_path: str) -> str:
    """Приводит путь к виду относительно папки images/ (прямые слеши, без обхода).

    Принимает как 'foo.png', так и 'img/foo.png' или 'images/img/foo.png'
    (ведущий 'images/' срезается). Защищает от обхода каталогов ('..').
    Возвращает путь БЕЗ префикса images/ — например 'foo.png' или 'img/foo.png'.
    """
    rel = (rel_path or '').replace('\\', '/').lstrip('/')
    if rel.startswith('images/'):
        rel = rel[len('images/'):]
    parts = [p for p in rel.split('/') if p not in ('', '.', '..')]
    return '/'.join(parts)


def upload_content_image(data: bytes, rel_path: str, content_type: str | None = None) -> str:
    """Загружает изображение к условию в S3 по фиксированному ключу images/<rel_path>.

    В отличие от upload_image (случайное имя), здесь имя/подпапки СОХРАНЯЮТСЯ —
    ключ объекта совпадает со ссылками, которые формируют html_importer и
    migrate_images_to_s3 (S3_IMAGES_BASE_URL/<rel_path>), поэтому ссылки в БД
    не ломаются.

    content_type: если не задан — определяется по магическим байтам, затем по
    расширению, иначе application/octet-stream.

    Возвращает ключ объекта в бакете (например 'images/img/foo.png').
    Бросает UnsupportedImage если путь пуст, S3NotConfigured если ключи не заданы.
    """
    rel = normalize_image_relpath(rel_path)
    if not rel:
        raise UnsupportedImage('Пустое имя файла изображения')

    if content_type is None:
        _, detected = _detect(data[:16])
        if detected:
            content_type = detected
        else:
            import mimetypes
            content_type = mimetypes.guess_type(rel)[0] or 'application/octet-stream'

    key = f"images/{rel}"
    client = _client()
    client.put_object(
        Bucket=current_app.config['S3_BUCKET'],
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return key


def key_from_url(url: str) -> str | None:
    """Извлекает ключ объекта S3 из публичного URL.

    Ключи всегда несут папку (images/… или files/…), поэтому достаточно найти
    в URL '/images/' или '/files/' и взять всё начиная с этой папки. Работает
    при любом корне бакета. Возвращает None, если это не S3-ссылка (например,
    локальный /content-images/… отдаётся Flask, а не S3).
    """
    if not url or not isinstance(url, str):
        return None
    if not (url.startswith('http://') or url.startswith('https://')):
        return None
    url = url.split('?')[0].split('#')[0]
    for folder in ('/images/', '/files/'):
        idx = url.find(folder)
        if idx != -1:
            return url[idx + 1:]  # без ведущего слеша -> 'images/...' | 'files/...'
    return None


def delete_object(key: str) -> None:
    """Удаляет объект из бакета по ключу. Бросает S3NotConfigured / ошибки boto3."""
    if not key:
        return
    client = _client()
    client.delete_object(Bucket=current_app.config['S3_BUCKET'], Key=key)


def upload_file(data: bytes, filename: str) -> str:
    """Загружает произвольный файл-вложение в папку files/ бакета.

    Расширение определяется по имени файла и проверяется по белому списку.
    Файл отдаётся как attachment (Content-Disposition) с исходным именем,
    чтобы:
      - при скачивании сохранялось человекочитаемое (в т.ч. кириллическое) имя,
      - содержимое не рендерилось в браузере (html/svg не исполнятся).
    Возвращает публичный URL. Бросает UnsupportedFile / S3NotConfigured.
    """
    ext = os.path.splitext(filename)[1].lstrip('.').lower()
    if ext not in ALLOWED_FILE_EXTENSIONS:
        allowed = ', '.join(sorted(ALLOWED_FILE_EXTENSIONS))
        raise UnsupportedFile(f'Недопустимый тип файла. Разрешены: {allowed}')

    safe_name = os.path.basename(filename) or f'file.{ext}'
    disposition = f"attachment; filename*=UTF-8''{quote(safe_name)}"

    key = f"files/{uuid.uuid4().hex}.{ext}"
    client = _client()
    client.put_object(
        Bucket=current_app.config['S3_BUCKET'],
        Key=key,
        Body=data,
        ContentType='application/octet-stream',
        ContentDisposition=disposition,
    )
    return f"{_public_base()}/{key}"

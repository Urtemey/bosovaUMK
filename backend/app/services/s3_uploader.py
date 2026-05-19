"""Загрузка изображений в S3-совместимое хранилище (timeweb).

Формат файла определяется по магическим байтам, а не по имени/MIME от клиента,
чтобы под видом картинки нельзя было залить произвольный файл.
"""

import uuid
from functools import lru_cache

from flask import current_app


class S3NotConfigured(Exception):
    """S3-ключи не заданы в окружении."""


class UnsupportedImage(Exception):
    """Файл не является поддерживаемым изображением."""


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
    cfg = current_app.config
    base = cfg.get('S3_IMAGES_BASE_URL')
    if base:
        return base.rstrip('/')
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

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'postgresql://bozova:bozova@localhost:5432/bozova')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-dev-secret')
    JWT_ACCESS_TOKEN_EXPIRES = 3600  # 1 hour
    JWT_REFRESH_TOKEN_EXPIRES = 2592000  # 30 days

    # Лимит размера запроса (загрузка изображений). По умолчанию 8 МБ.
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_UPLOAD_BYTES', 8 * 1024 * 1024))

    # S3-совместимое хранилище (timeweb). Ключи задаются в .env на сервере.
    S3_ENDPOINT_URL = os.getenv('S3_ENDPOINT_URL', 'https://s3.twcstorage.ru')
    S3_REGION = os.getenv('S3_REGION', 'ru-1')
    S3_BUCKET = os.getenv('S3_BUCKET')
    S3_ACCESS_KEY = os.getenv('S3_ACCESS_KEY')
    S3_SECRET_KEY = os.getenv('S3_SECRET_KEY')
    # Базовый публичный URL для ссылок в БД. Если не задан — собирается
    # из endpoint + bucket (https://s3.twcstorage.ru/<bucket>).
    S3_IMAGES_BASE_URL = os.getenv('S3_IMAGES_BASE_URL')

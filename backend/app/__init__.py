import os
from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import Config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

# Absolute path to contenttests/images — works regardless of cwd
_IMAGES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'contenttests', 'images')
)


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    allowed_origins = os.getenv('CORS_ORIGINS', '*').split(',')
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}, r"/content-images/*": {"origins": allowed_origins}})
    jwt.init_app(app)

    from app.models import teacher, classroom, student, test, question, assignment, attempt, answer  # noqa: F401

    from app.routes.auth import auth_bp
    from app.routes.classrooms import classrooms_bp
    from app.routes.tests import tests_bp
    from app.routes.assignments import assignments_bp
    from app.routes.attempts import attempts_bp
    from app.routes.questions import questions_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(classrooms_bp, url_prefix='/api/classrooms')
    app.register_blueprint(tests_bp, url_prefix='/api/tests')
    app.register_blueprint(assignments_bp, url_prefix='/api/assignments')
    app.register_blueprint(attempts_bp, url_prefix='/api/attempts')
    app.register_blueprint(questions_bp, url_prefix='/api/questions')

    # Раздача изображений только для локальной разработки.
    # В продакшене S3_IMAGES_BASE_URL задан — ссылки ведут на S3 напрямую.
    if not os.getenv('S3_IMAGES_BASE_URL'):
        @app.route('/content-images/<path:filename>')
        def serve_content_image(filename):
            return send_from_directory(_IMAGES_DIR, filename)

    return app

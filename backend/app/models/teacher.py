from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app import db


class Teacher(db.Model):
    __tablename__ = 'teachers'

    id = db.Column(db.Integer, primary_key=True)
    login = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    display_name = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    classrooms = db.relationship('Classroom', backref='teacher', lazy='dynamic')
    tests = db.relationship('Test', backref='author', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'login': self.login,
            'display_name': self.display_name,
            'created_at': self.created_at.isoformat(),
        }

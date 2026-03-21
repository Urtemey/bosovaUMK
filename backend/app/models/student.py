import random
import string
from datetime import datetime
from app import db


class Student(db.Model):
    __tablename__ = 'students'

    id = db.Column(db.Integer, primary_key=True)
    display_name = db.Column(db.String(200), nullable=False)
    login = db.Column(db.String(20), unique=True, nullable=False)
    code = db.Column(db.String(20), nullable=False)
    classroom_id = db.Column(db.Integer, db.ForeignKey('classrooms.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    attempts = db.relationship('TestAttempt', backref='student', lazy='dynamic')

    @staticmethod
    def generate_login(length=7):
        chars = string.ascii_uppercase + string.digits
        return ''.join(random.choices(chars, k=length))

    @staticmethod
    def generate_code(length=6):
        return ''.join(random.choices(string.digits, k=length))

    def to_dict(self, include_credentials=False):
        data = {
            'id': self.id,
            'display_name': self.display_name,
            'classroom_id': self.classroom_id,
            'created_at': self.created_at.isoformat(),
        }
        if include_credentials:
            data['login'] = self.login
            data['code'] = self.code
        return data

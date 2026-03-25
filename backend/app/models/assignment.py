import uuid
from datetime import datetime
from app import db


class TestAssignment(db.Model):
    __tablename__ = 'test_assignments'

    id = db.Column(db.Integer, primary_key=True)
    test_id = db.Column(db.Integer, db.ForeignKey('tests.id'), nullable=False)
    classroom_id = db.Column(db.Integer, db.ForeignKey('classrooms.id'), nullable=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=True)
    share_link = db.Column(db.String(100), unique=True, nullable=True)
    settings_override = db.Column(db.JSON, default=dict)
    created_by = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    attempts = db.relationship('TestAttempt', backref='assignment', lazy='dynamic',
                                cascade='all, delete-orphan')

    def generate_share_link(self):
        self.share_link = uuid.uuid4().hex[:12]
        return self.share_link

    def to_dict(self):
        return {
            'id': self.id,
            'test_id': self.test_id,
            'classroom_id': self.classroom_id,
            'student_id': self.student_id,
            'share_link': self.share_link,
            'settings_override': self.settings_override,
            'created_at': self.created_at.isoformat(),
        }

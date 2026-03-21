from datetime import datetime
from app import db


class TestAttempt(db.Model):
    __tablename__ = 'test_attempts'

    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('test_assignments.id'), nullable=True)
    test_id = db.Column(db.Integer, db.ForeignKey('tests.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=True)
    anonymous_name = db.Column(db.String(200), nullable=True)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    finished_at = db.Column(db.DateTime, nullable=True)
    score_percent = db.Column(db.Float, nullable=True)
    is_finished = db.Column(db.Boolean, default=False)

    answers = db.relationship('Answer', backref='attempt', lazy='dynamic', cascade='all, delete-orphan')

    @property
    def duration_seconds(self):
        if self.finished_at and self.started_at:
            return int((self.finished_at - self.started_at).total_seconds())
        return None

    def to_dict(self, include_answers=False):
        data = {
            'id': self.id,
            'test_id': self.test_id,
            'student_id': self.student_id,
            'anonymous_name': self.anonymous_name,
            'started_at': (self.started_at.isoformat() + 'Z') if self.started_at else None,
            'finished_at': (self.finished_at.isoformat() + 'Z') if self.finished_at else None,
            'duration_seconds': self.duration_seconds,
            'score_percent': self.score_percent,
            'is_finished': self.is_finished,
        }
        if include_answers:
            data['answers'] = [a.to_dict() for a in self.answers]
        return data

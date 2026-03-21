from datetime import datetime
from app import db


class Test(db.Model):
    __tablename__ = 'tests'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(500), nullable=False)
    grade = db.Column(db.Integer, nullable=False)  # 5-11
    topic = db.Column(db.String(500), nullable=True)
    description = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True)
    is_published = db.Column(db.Boolean, default=False)
    settings = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    questions = db.relationship('Question', backref='test', lazy='dynamic',
                                cascade='all, delete-orphan', order_by='Question.order')
    assignments = db.relationship('TestAssignment', backref='test', lazy='dynamic')

    DEFAULT_SETTINGS = {
        'show_answer': False,
        'max_attempts': 1,
        'shuffle_questions': False,
        'shuffle_answers': False,
        'show_correct_answers': False,
        'show_score': True,
    }

    def get_settings(self):
        merged = dict(self.DEFAULT_SETTINGS)
        if self.settings:
            merged.update(self.settings)
        return merged

    def to_dict(self, include_questions=False):
        data = {
            'id': self.id,
            'title': self.title,
            'grade': self.grade,
            'topic': self.topic,
            'description': self.description,
            'is_published': self.is_published,
            'settings': self.get_settings(),
            'question_count': self.questions.count(),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
        if include_questions:
            data['questions'] = [q.to_dict() for q in self.questions]
        return data

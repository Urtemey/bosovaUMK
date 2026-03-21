from datetime import datetime
from app import db


class Classroom(db.Model):
    __tablename__ = 'classrooms'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    grade = db.Column(db.Integer, nullable=False)  # 5-11
    teacher_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    students = db.relationship('Student', backref='classroom', lazy='dynamic', cascade='all, delete-orphan')
    assignments = db.relationship('TestAssignment', backref='classroom', lazy='dynamic')

    def to_dict(self, include_students=False):
        data = {
            'id': self.id,
            'name': self.name,
            'grade': self.grade,
            'teacher_id': self.teacher_id,
            'student_count': self.students.count(),
            'created_at': self.created_at.isoformat(),
        }
        if include_students:
            data['students'] = [s.to_dict(include_credentials=True) for s in self.students]
        return data

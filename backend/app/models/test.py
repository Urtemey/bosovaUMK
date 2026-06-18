from datetime import datetime
from app import db

# Класс СПО не входит в школьную сетку 5-11 и хранится отдельным значением grade.
SPO_GRADE = 12

# Человекочитаемые подписи подразделов (БУ/УУ/ВПР/ОГЭ/ЕГЭ).
SECTION_LABELS = {
    'bu': 'БУ',
    'uu': 'УУ',
    'vpr': 'ВПР',
    'oge': 'ОГЭ',
    'ege': 'ЕГЭ',
}

# Какие подразделы допустимы для каждого класса. Классы без записи
# (5, 6, 10, СПО) не делятся на подразделы.
SECTIONS_BY_GRADE = {
    7: ('bu', 'uu', 'vpr'),
    8: ('bu', 'uu', 'vpr'),
    9: ('bu', 'uu', 'oge'),
    11: ('bu', 'uu', 'ege'),
}


def normalize_section(grade, section):
    """Возвращает section, если он допустим для класса grade, иначе None."""
    if not section:
        return None
    try:
        grade = int(grade)
    except (TypeError, ValueError):
        return None
    return section if section in SECTIONS_BY_GRADE.get(grade, ()) else None


class Test(db.Model):
    __tablename__ = 'tests'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(500), nullable=False)
    grade = db.Column(db.Integer, nullable=False)  # 5-11, 12 = СПО
    # Подраздел внутри класса (bu/uu/vpr/oge/ege) — см. SECTIONS_BY_GRADE.
    section = db.Column(db.String(8), nullable=True, index=True)
    topic = db.Column(db.String(500), nullable=True)
    description = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True)
    is_published = db.Column(db.Boolean, default=False)
    display_order = db.Column(db.Integer, nullable=False, default=0, index=True)
    settings = db.Column(db.JSON, default=dict)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    questions = db.relationship('Question', backref='test', lazy='dynamic',
                                cascade='all, delete-orphan', order_by='Question.order')
    assignments = db.relationship('TestAssignment', backref='test', lazy='dynamic',
                                   cascade='all, delete-orphan')
    attempts = db.relationship('TestAttempt', backref='test', lazy='dynamic',
                                cascade='all, delete-orphan')

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

    def to_dict(self, include_questions=False, include_correct=False):
        data = {
            'id': self.id,
            'title': self.title,
            'grade': self.grade,
            'section': self.section,
            'topic': self.topic,
            'description': self.description,
            'is_published': self.is_published,
            'display_order': self.display_order,
            'settings': self.get_settings(),
            'question_count': self.questions.count(),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
        if include_questions:
            data['questions'] = [q.to_dict(include_correct=include_correct) for q in self.questions]
        return data

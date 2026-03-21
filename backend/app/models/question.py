from app import db


class QuestionType:
    SINGLE_CHOICE = 'single_choice'
    MULTIPLE_CHOICE = 'multiple_choice'
    TEXT_INPUT = 'text_input'
    MATCHING = 'matching'
    DRAG_DROP = 'drag_drop'
    SELECT_LIST = 'select_list'

    ALL = [SINGLE_CHOICE, MULTIPLE_CHOICE, TEXT_INPUT, MATCHING, DRAG_DROP, SELECT_LIST]


class Question(db.Model):
    __tablename__ = 'questions'

    id = db.Column(db.Integer, primary_key=True)
    test_id = db.Column(db.Integer, db.ForeignKey('tests.id'), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0)
    question_type = db.Column(db.String(50), nullable=False)
    content = db.Column(db.JSON, nullable=False)
    correct_answer = db.Column(db.JSON, nullable=False)
    points = db.Column(db.Integer, default=1)

    answers = db.relationship('Answer', backref='question', lazy='dynamic')

    def to_dict(self, include_correct=False):
        data = {
            'id': self.id,
            'test_id': self.test_id,
            'order': self.order,
            'question_type': self.question_type,
            'content': self.content,
            'points': self.points,
        }
        if include_correct:
            data['correct_answer'] = self.correct_answer
        return data

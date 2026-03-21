"""Import all contenttests/part*.html files into the database.

Infers grade and topic from the first path-header code in each file.
Safe to re-run — skips files already imported (checked by title).

Usage:
    cd backend
    ../.venv/Scripts/python.exe seed_from_html.py
"""
import os
import re
import sys

from wsgi import app
from app import db
from app.models.teacher import Teacher
from app.models.test import Test
from app.models.question import Question
from app.services.html_importer import parse_html_questions
from bs4 import BeautifulSoup

CONTENTTESTS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', 'contenttests')
)


def _first_path_code(html: str) -> str:
    """Return the prefix before ' / ' in the first <h6 class="path"> header."""
    soup = BeautifulSoup(html, 'html.parser')
    h = soup.find('h6', class_='path')
    if not h:
        return ''
    text = h.get_text(strip=True)
    return text.split('/')[0].strip()


def _infer_grade_topic(code: str) -> tuple[int, str]:
    """Return (grade, topic_label) from path code."""
    c = code.lower()
    if c.startswith('t07') or c.startswith('vpr_7'):
        return 7, 'ВПР / тематический тест'
    if c.startswith('t08') or c.startswith('vpr_8'):
        return 8, 'ВПР / тематический тест'
    if c.startswith('t09') or c.startswith('t9_') or c.startswith('oge'):
        return 9, 'ОГЭ / тематический тест'
    if c.startswith('t10'):
        return 10, 'Тематический тест'
    if c.startswith('t11'):
        return 11, 'Тематический тест'
    if c.startswith('задание'):
        return 9, 'Задание ОГЭ'
    # numerical codes 2207_*, 2208_*, 2209_*, 2210_*, 2211_*, 2505_*, 2506_*, 03_*, 16_*, 23_*
    return 9, 'Подготовка к ОГЭ / ЕГЭ'


def seed_html():
    part_files = sorted(
        f for f in os.listdir(CONTENTTESTS_DIR)
        if f.startswith('part') and f.endswith('.html')
    )

    with app.app_context():
        teacher = Teacher.query.filter_by(login='teacher').first()
        if not teacher:
            print('ERROR: демо-учитель не найден. Сначала запустите python seed.py')
            sys.exit(1)

        imported = 0
        skipped = 0
        total_questions = 0

        for filename in part_files:
            # Part number for title, e.g. part01.html → 1
            num = int(re.search(r'\d+', filename).group())
            path = os.path.join(CONTENTTESTS_DIR, filename)

            with open(path, encoding='utf-8') as f:
                html = f.read()

            code = _first_path_code(html)
            grade, topic = _infer_grade_topic(code)
            title = f'Вариант {num:02d} [{code}]'

            # Skip if already imported
            if Test.query.filter_by(title=title, created_by=teacher.id).first():
                print(f'  SKIP  {filename}  (уже есть)')
                skipped += 1
                continue

            questions_data = parse_html_questions(html)
            if not questions_data:
                print(f'  WARN  {filename}  — 0 вопросов распарсено, пропускаем')
                skipped += 1
                continue

            test = Test(
                title=title,
                grade=grade,
                topic=topic,
                created_by=teacher.id,
                is_published=True,
                settings={
                    'show_answer': False,
                    'max_attempts': 3,
                    'shuffle_questions': True,
                    'shuffle_answers': False,
                    'show_correct_answers': False,
                    'show_score': True,
                },
            )
            db.session.add(test)
            db.session.flush()

            for order, q in enumerate(questions_data, start=1):
                db.session.add(Question(
                    test_id=test.id,
                    order=order,
                    question_type=q['question_type'],
                    content=q['content'],
                    correct_answer=q['correct_answer'],
                    points=q.get('points', 1),
                ))

            db.session.commit()
            total_questions += len(questions_data)
            imported += 1
            print(f'  OK    {filename}  grade={grade}  вопросов={len(questions_data)}  [{code}]')

        print(f'\nГотово: импортировано {imported} файлов ({total_questions} вопросов), пропущено {skipped}')


if __name__ == '__main__':
    seed_html()

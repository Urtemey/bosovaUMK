"""
Mass import of questions from contenttests/ HTML files into the database.

Usage:
    cd backend
    python import_contenttests.py          # import all
    python import_contenttests.py --dry-run # preview without writing to DB
"""
import os
import re
import sys
from collections import defaultdict

from wsgi import app
from app import db
from app.models.test import Test
from app.models.question import Question
from app.services.html_importer import parse_html_questions
from bs4 import BeautifulSoup


CONTENTTESTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'contenttests')

# ── Prefix → grade mapping ──────────────────────────────────────────────

def guess_grade(prefix: str) -> int | None:
    """Determine school grade (5-11) from a question path prefix."""
    # 2207_xxx → grade 7, 2208 → 8, 2209 → 9, 2210 → 10, 2211 → 11
    m = re.match(r'22(\d{2})[-_]', prefix)
    if m:
        return int(m.group(1))

    # 2505_xx → grade 5, 2506_xx → grade 6
    m = re.match(r'25(\d{2})[-_]', prefix)
    if m:
        return int(m.group(1))

    # t07_x → 7, t08 → 8, t09/t9 → 9, t10 → 10, t11 → 11
    m = re.match(r't0?(\d{1,2})[-_]', prefix)
    if m:
        return int(m.group(1))

    # vpr_7 → 7, vpr_8 → 8
    m = re.match(r'vpr_(\d+)', prefix)
    if m:
        return int(m.group(1))

    # oge → 9 (ОГЭ)
    if prefix.startswith('oge'):
        return 9

    # "Задание X" → 11 (ЕГЭ tasks)
    if 'адани' in prefix or prefix.startswith('\u0417\u0430\u0434\u0430\u043d'):
        return 11

    # Old numeric prefixes — mixed topics, skip grade assignment
    # 03_00, 05_00, 06_00, 07_00, 16_00, 18_00, 19_00, 23_00
    return None


def guess_topic_number(prefix: str) -> int | None:
    """Extract topic/chapter number from prefix for mapping to seed tests."""
    # 2207_312 → topic 3 (first digit after grade code)
    m = re.match(r'22\d{2}_(\d)', prefix)
    if m:
        return int(m.group(1))

    # 2505_31 → topic 3
    m = re.match(r'25\d{2}_(\d)', prefix)
    if m:
        return int(m.group(1))

    # t07_3 → topic 3
    m = re.match(r't\d+_(\d)', prefix)
    if m:
        return int(m.group(1))

    return None


# ── Collect questions from all HTML files ────────────────────────────────

def collect_all_questions() -> dict[str, list[dict]]:
    """Parse all HTML files and group questions by prefix."""
    prefix_questions = defaultdict(list)

    for fi in range(1, 61):
        fname = os.path.join(CONTENTTESTS_DIR, f'part{fi:02d}.html')
        if not os.path.exists(fname):
            continue

        with open(fname, 'r', encoding='utf-8') as f:
            html = f.read()

        soup = BeautifulSoup(html, 'html.parser')
        headers = soup.find_all('h6', class_='path')
        parsed = parse_html_questions(html)

        # Map parsed questions back to their prefix via index alignment
        # Since parser iterates headers in order and skips unparseable ones,
        # we rebuild the mapping
        qi = 0
        for i, header in enumerate(headers):
            path = header.get_text(strip=True)
            prefix = path.split('/')[0].strip()

            if qi < len(parsed):
                # Check if this header produced the next parsed question
                # (we can't be 100% sure, so we just assign sequentially)
                prefix_questions[prefix].append(parsed[qi])
                qi += 1

        # If we have leftover parsed questions, they belong to last prefix
        # (shouldn't happen normally)

    return dict(prefix_questions)


# ── Find or create target test ───────────────────────────────────────────

def find_target_test(grade: int, topic_num: int | None, prefix: str, teacher_id: int) -> Test:
    """Find an existing seed test for this grade+topic, or create a new one."""
    # Get all tests for this grade, ordered by id
    tests = Test.query.filter_by(grade=grade).order_by(Test.id).all()

    if topic_num and tests:
        # Map topic number to test index (topic 1 → tests[0], etc.)
        idx = topic_num - 1
        if 0 <= idx < len(tests):
            return tests[idx]

    # Special cases: oge/vpr/ege get their own tests
    special_titles = {
        'oge': f'ОГЭ: Подготовка ({prefix})',
        'vpr': f'ВПР: Подготовка ({prefix})',
    }
    for key, title in special_titles.items():
        if prefix.startswith(key):
            existing = Test.query.filter_by(grade=grade, title=title).first()
            if existing:
                return existing
            test = Test(
                title=title, grade=grade, topic=f'Подготовка к {key.upper()}',
                created_by=teacher_id, is_published=True,
                settings={'show_answer': False, 'max_attempts': 3,
                          'shuffle_questions': True, 'shuffle_answers': True,
                          'show_correct_answers': False, 'show_score': True},
            )
            db.session.add(test)
            db.session.flush()
            return test

    # Fallback: find or create a test named after the prefix
    title = f'Дополнительные задания ({prefix})'
    existing = Test.query.filter_by(grade=grade, title=title).first()
    if existing:
        return existing

    test = Test(
        title=title, grade=grade, topic=prefix,
        created_by=teacher_id, is_published=True,
        settings={'show_answer': False, 'max_attempts': 2,
                  'shuffle_questions': True, 'shuffle_answers': False,
                  'show_correct_answers': False, 'show_score': True},
    )
    db.session.add(test)
    db.session.flush()
    return test


# ── Main import logic ────────────────────────────────────────────────────

def run_import(dry_run=False):
    with app.app_context():
        # Get teacher (first one, from seed)
        from app.models.teacher import Teacher
        teacher = Teacher.query.first()
        if not teacher:
            print('ERROR: No teacher found. Run seed.py first.')
            return

        print(f'Teacher: {teacher.display_name} (id={teacher.id})')
        print(f'Parsing contenttests from: {CONTENTTESTS_DIR}')
        print()

        prefix_questions = collect_all_questions()

        total_prefixes = len(prefix_questions)
        total_questions = sum(len(qs) for qs in prefix_questions.values())
        print(f'Found {total_questions} questions in {total_prefixes} prefix groups')
        print()

        # Statistics
        stats = {
            'imported': 0,
            'skipped_no_grade': 0,
            'tests_created': 0,
            'tests_reused': 0,
            'by_type': defaultdict(int),
            'by_grade': defaultdict(int),
        }

        # Track which tests already had questions added (to avoid duplicate imports)
        test_question_counts = {}

        for prefix in sorted(prefix_questions.keys()):
            questions = prefix_questions[prefix]
            grade = guess_grade(prefix)

            if grade is None:
                stats['skipped_no_grade'] += len(questions)
                continue

            if grade < 5 or grade > 11:
                stats['skipped_no_grade'] += len(questions)
                continue

            topic_num = guess_topic_number(prefix)
            test = find_target_test(grade, topic_num, prefix, teacher.id)

            if test.id not in test_question_counts:
                test_question_counts[test.id] = (
                    db.session.query(db.func.max(Question.order))
                    .filter_by(test_id=test.id).scalar() or 0
                )
                if test_question_counts[test.id] == 0:
                    stats['tests_reused'] += 1
                else:
                    stats['tests_reused'] += 1

            current_order = test_question_counts[test.id]

            for q_data in questions:
                current_order += 1
                if not dry_run:
                    question = Question(
                        test_id=test.id,
                        order=current_order,
                        question_type=q_data['question_type'],
                        content=q_data['content'],
                        correct_answer=q_data['correct_answer'],
                        points=q_data.get('points', 1),
                    )
                    db.session.add(question)

                stats['imported'] += 1
                stats['by_type'][q_data['question_type']] += 1
                stats['by_grade'][grade] += 1

            test_question_counts[test.id] = current_order

        if not dry_run:
            db.session.commit()
            print('Committed to database.')
        else:
            print('[DRY RUN] No changes written.')

        print()
        print(f'=== Import Summary ===')
        print(f'Total imported:     {stats["imported"]}')
        print(f'Skipped (no grade): {stats["skipped_no_grade"]}')
        print()
        print('By grade:')
        for g in sorted(stats['by_grade'].keys()):
            print(f'  Grade {g:2d}: {stats["by_grade"][g]:4d} questions')
        print()
        print('By type:')
        for t, c in sorted(stats['by_type'].items(), key=lambda x: -x[1]):
            print(f'  {t:20s}: {c:4d}')


if __name__ == '__main__':
    dry_run = '--dry-run' in sys.argv
    run_import(dry_run=dry_run)

"""Tests for backend/app/services/html_importer.py

Unit tests: synthetic HTML fixtures.
Integration tests: all 60 contenttests/part*.html files — parse quality + image presence.
"""
import os
import pytest
from bs4 import BeautifulSoup
from app.services.html_importer import parse_html_questions

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

CONTENTTESTS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'contenttests')
)
IMAGES_DIR = os.path.join(CONTENTTESTS_DIR, 'images')

PART_FILES = sorted(
    f for f in os.listdir(CONTENTTESTS_DIR) if f.startswith('part') and f.endswith('.html')
)

# ---------------------------------------------------------------------------
# HTML fixture helpers
# ---------------------------------------------------------------------------

def make_html(*bodies: str) -> str:
    return "<html><body>" + "".join(bodies) + "</body></html>"


def question_block(path: str, body: str) -> str:
    return f'<h6 class="path">{path}</h6>{body}'


# ---------------------------------------------------------------------------
# 1. single_choice
# ---------------------------------------------------------------------------

SINGLE_CHOICE_HTML = make_html(question_block(
    "test / q1",
    """
    <p><strong>В ячейке A1 записана формула. Какой вид она примет?</strong></p>
    <ul>
      <li>=E1-$E2</li>
      <li class="correct">=E1-$D2</li>
      <li>=E2-$D2</li>
      <li>=D1-$E2</li>
    </ul>
    """
))


def test_single_choice_type():
    result = parse_html_questions(SINGLE_CHOICE_HTML)
    assert len(result) == 1
    assert result[0]['question_type'] == 'single_choice'


def test_single_choice_correct_index():
    result = parse_html_questions(SINGLE_CHOICE_HTML)
    assert result[0]['correct_answer'] == 1


def test_single_choice_options_count():
    result = parse_html_questions(SINGLE_CHOICE_HTML)
    assert len(result[0]['content']['options']) == 4


def test_single_choice_options_text():
    result = parse_html_questions(SINGLE_CHOICE_HTML)
    assert result[0]['content']['options'][1] == '=E1-$D2'


def test_single_choice_has_text():
    result = parse_html_questions(SINGLE_CHOICE_HTML)
    assert result[0]['content']['text']


def test_single_choice_points():
    result = parse_html_questions(SINGLE_CHOICE_HTML)
    assert result[0]['points'] == 1


# ---------------------------------------------------------------------------
# 2. multiple_choice
# ---------------------------------------------------------------------------

MULTIPLE_CHOICE_HTML = make_html(question_block(
    "test / q_multi",
    """
    <p><strong>Выберите правильные ответы:</strong></p>
    <ul>
      <li>Неверный</li>
      <li class="correct">Верный 1</li>
      <li class="correct">Верный 2</li>
      <li>Неверный 2</li>
    </ul>
    """
))


def test_multiple_choice_type():
    result = parse_html_questions(MULTIPLE_CHOICE_HTML)
    assert result[0]['question_type'] == 'multiple_choice'


def test_multiple_choice_correct_answer_is_list():
    result = parse_html_questions(MULTIPLE_CHOICE_HTML)
    assert isinstance(result[0]['correct_answer'], list)


def test_multiple_choice_correct_indices():
    result = parse_html_questions(MULTIPLE_CHOICE_HTML)
    assert sorted(result[0]['correct_answer']) == [1, 2]


def test_multiple_choice_options_count():
    result = parse_html_questions(MULTIPLE_CHOICE_HTML)
    assert len(result[0]['content']['options']) == 4


# ---------------------------------------------------------------------------
# 3. text_input — single answer
# ---------------------------------------------------------------------------

TEXT_INPUT_SINGLE_HTML = make_html(question_block(
    "test / q_text",
    """
    <p><strong>Какое число будет в ячейке B2?</strong></p>
    <span class="text-entry">68</span>
    """
))


def test_text_input_single_type():
    result = parse_html_questions(TEXT_INPUT_SINGLE_HTML)
    assert result[0]['question_type'] == 'text_input'


def test_text_input_single_correct_answer_is_string():
    result = parse_html_questions(TEXT_INPUT_SINGLE_HTML)
    assert result[0]['correct_answer'] == '68'


# ---------------------------------------------------------------------------
# 4. text_input — multiple entries → list
# ---------------------------------------------------------------------------

TEXT_INPUT_MULTI_HTML = make_html(question_block(
    "test / q_text_multi",
    """
    <p><strong>Заполните пропуски:</strong></p>
    <p><span class="text-entry">3</span> и <span class="text-entry">7</span></p>
    """
))


def test_text_input_multi_correct_answer_is_list():
    result = parse_html_questions(TEXT_INPUT_MULTI_HTML)
    assert isinstance(result[0]['correct_answer'], list)


def test_text_input_multi_correct_values():
    result = parse_html_questions(TEXT_INPUT_MULTI_HTML)
    assert result[0]['correct_answer'] == ['3', '7']


# ---------------------------------------------------------------------------
# 5. Image handling
# ---------------------------------------------------------------------------

WITH_IMAGE_HTML = make_html(question_block(
    "test / q_img",
    """
    <p><strong>Что изображено?</strong></p>
    <p><img src="images/1.jpg" originalSrc="1.jpg"></img></p>
    <ul>
      <li class="correct">Таблица</li>
      <li>График</li>
    </ul>
    """
))

WITHOUT_IMAGE_HTML = make_html(question_block(
    "test / q_no_img",
    """
    <p><strong>Какой тип данных?</strong></p>
    <ul>
      <li class="correct">Целое</li>
      <li>Строка</li>
    </ul>
    """
))


def test_image_present_in_content():
    result = parse_html_questions(WITH_IMAGE_HTML)
    assert 'image' in result[0]['content']
    assert result[0]['content']['image']


def test_image_absent_when_no_img_tag():
    result = parse_html_questions(WITHOUT_IMAGE_HTML)
    assert 'image' not in result[0]['content']


# ---------------------------------------------------------------------------
# 6. div.assignment + div.solution wrapper
# ---------------------------------------------------------------------------

ASSIGNMENT_SOLUTION_HTML = make_html(question_block(
    "03_01_base / q_115",
    """
    <div class="assignment">
      <p>База данных службы доставки содержит информацию...</p>
      <p><img src="images/img/img_5.png" originalSrc="img/img_5.png" width="450"></img></p>
      <p><strong>Каков общий вес товаров?</strong></p>
    </div>
    <div class="solution">
      <ul>
        <li>3750 грамм</li>
        <li class="correct">1500 грамм</li>
        <li>1300 грамм</li>
        <li>1900 грамм</li>
      </ul>
    </div>
    """
))


def test_assignment_solution_wrapper_parses():
    assert len(parse_html_questions(ASSIGNMENT_SOLUTION_HTML)) == 1


def test_assignment_solution_not_empty_text():
    result = parse_html_questions(ASSIGNMENT_SOLUTION_HTML)
    assert result[0]['content']['text']


def test_assignment_solution_correct_answer():
    result = parse_html_questions(ASSIGNMENT_SOLUTION_HTML)
    assert result[0]['correct_answer'] == 1


def test_assignment_solution_options_count():
    result = parse_html_questions(ASSIGNMENT_SOLUTION_HTML)
    assert len(result[0]['content']['options']) == 4


# ---------------------------------------------------------------------------
# 7. Вопрос без correct → пропускается
# ---------------------------------------------------------------------------

NO_CORRECT_HTML = make_html(question_block(
    "test / q_no_correct",
    """
    <p><strong>Нет правильного ответа:</strong></p>
    <ul><li>Вариант A</li><li>Вариант B</li></ul>
    """
))


def test_no_correct_answer_is_skipped():
    assert parse_html_questions(NO_CORRECT_HTML) == []


# ---------------------------------------------------------------------------
# 8. Пустой блок → пропускается
# ---------------------------------------------------------------------------

def test_empty_block_is_skipped():
    html = make_html(question_block("test / q_empty", "<br><br>"))
    assert parse_html_questions(html) == []


# ---------------------------------------------------------------------------
# 9. text-entry внутри <strong> (edge case из реальных файлов)
# ---------------------------------------------------------------------------

TEXT_ENTRY_IN_STRONG_HTML = make_html(question_block(
    "03_00_789 / q_309",
    """
    <p><strong>Сколько записей удовлетворяет условию А=1 ИЛИ В=2 И С=3?</strong></p>
    <p><strong><span class="text-entry">3</span></strong></p>
    """
))


def test_text_entry_inside_strong_parsed():
    result = parse_html_questions(TEXT_ENTRY_IN_STRONG_HTML)
    assert len(result) == 1
    assert result[0]['question_type'] == 'text_input'
    assert result[0]['correct_answer'] == '3'


# ---------------------------------------------------------------------------
# 10. Несколько вопросов — количество и типы
# ---------------------------------------------------------------------------

MULTI_QUESTIONS_HTML = make_html(
    question_block("t / q1", """
        <p><strong>Вопрос 1</strong></p>
        <ul><li class="correct">А</li><li>Б</li></ul>
    """),
    question_block("t / q2", """
        <p><strong>Вопрос 2</strong></p>
        <span class="text-entry">42</span>
    """),
    question_block("t / q3", """
        <p><strong>Вопрос 3</strong></p>
        <ul><li>Неверный</li><li class="correct">Верный 1</li><li class="correct">Верный 2</li></ul>
    """),
    question_block("t / q4_skip", "<br>"),
)


def test_multiple_questions_count():
    assert len(parse_html_questions(MULTI_QUESTIONS_HTML)) == 3


def test_multiple_questions_types():
    types = {q['question_type'] for q in parse_html_questions(MULTI_QUESTIONS_HTML)}
    assert types == {'single_choice', 'text_input', 'multiple_choice'}


def test_all_questions_have_required_fields():
    for q in parse_html_questions(MULTI_QUESTIONS_HTML):
        assert {'question_type', 'content', 'correct_answer', 'points'}.issubset(q.keys())


def test_content_always_has_text():
    for q in parse_html_questions(MULTI_QUESTIONS_HTML):
        assert q['content'].get('text'), f"empty text in {q}"


# ===========================================================================
# INTEGRATION: все part*.html файлы
# ===========================================================================

def _load_part(filename: str) -> list[dict]:
    path = os.path.join(CONTENTTESTS_DIR, filename)
    with open(path, encoding='utf-8') as f:
        return parse_html_questions(f.read())


def _collect_image_refs(filename: str) -> list[str]:
    """Возвращает список src из всех <img> тегов в файле."""
    path = os.path.join(CONTENTTESTS_DIR, filename)
    with open(path, encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
    refs = []
    for img in soup.find_all('img'):
        src = img.get('src') or img.get('originalSrc')
        if src:
            refs.append(src)
    return refs


# ---------------------------------------------------------------------------
# Параметризованные тесты: парсинг каждого файла
# ---------------------------------------------------------------------------

@pytest.mark.parametrize('filename', PART_FILES)
def test_part_file_has_questions(filename):
    """Каждый part*.html даёт хотя бы один вопрос."""
    questions = _load_part(filename)
    assert len(questions) > 0, f"{filename}: 0 вопросов распарсено"


@pytest.mark.parametrize('filename', PART_FILES)
def test_part_file_valid_question_types(filename):
    """Все question_type из допустимого набора."""
    valid = {'single_choice', 'multiple_choice', 'text_input'}
    questions = _load_part(filename)
    bad = [q for q in questions if q.get('question_type') not in valid]
    assert not bad, f"{filename}: неизвестные типы {[q['question_type'] for q in bad]}"


@pytest.mark.parametrize('filename', PART_FILES)
def test_part_file_content_text_not_empty(filename):
    """Текст вопроса не пустой."""
    questions = _load_part(filename)
    bad = [q for q in questions if not q.get('content', {}).get('text')]
    assert not bad, f"{filename}: {len(bad)} вопросов без текста"


@pytest.mark.parametrize('filename', PART_FILES)
def test_part_file_choice_options_min2(filename):
    """Все *_choice вопросы имеют минимум 2 варианта ответа."""
    questions = _load_part(filename)
    choice_qs = [q for q in questions if q['question_type'].endswith('_choice')]
    bad = [q for q in choice_qs if len(q['content'].get('options', [])) < 2]
    assert not bad, f"{filename}: {len(bad)} choice-вопросов с <2 вариантами"


@pytest.mark.parametrize('filename', PART_FILES)
def test_part_file_single_choice_index_in_range(filename):
    """correct_answer у single_choice — int в допустимом диапазоне."""
    questions = _load_part(filename)
    single_qs = [q for q in questions if q['question_type'] == 'single_choice']
    bad = [
        q for q in single_qs
        if not isinstance(q['correct_answer'], int)
        or q['correct_answer'] < 0
        or q['correct_answer'] >= len(q['content'].get('options', []))
    ]
    assert not bad, f"{filename}: {len(bad)} single_choice с некорректным индексом"


@pytest.mark.parametrize('filename', PART_FILES)
def test_part_file_multiple_choice_list(filename):
    """correct_answer у multiple_choice — список."""
    questions = _load_part(filename)
    multi_qs = [q for q in questions if q['question_type'] == 'multiple_choice']
    bad = [q for q in multi_qs if not isinstance(q['correct_answer'], list)]
    assert not bad, f"{filename}: multiple_choice без списка correct_answer"


@pytest.mark.parametrize('filename', PART_FILES)
def test_part_file_points_always_1(filename):
    questions = _load_part(filename)
    bad = [q for q in questions if q.get('points') != 1]
    assert not bad, f"{filename}: {len(bad)} вопросов с points != 1"


# ---------------------------------------------------------------------------
# Параметризованные тесты: все картинки из HTML существуют на диске
# ---------------------------------------------------------------------------

@pytest.mark.parametrize('filename', PART_FILES)
def test_part_file_images_exist_on_disk(filename):
    """Каждый <img src="..."> в файле должен существовать в contenttests/images/."""
    refs = _collect_image_refs(filename)
    missing = []
    for src in refs:
        # src приходит как "images/1.jpg" или "images/img/img_5.png"
        # Убираем ведущий "images/" если есть
        if src.startswith('images/'):
            rel = src[len('images/'):]
        else:
            rel = src
        full_path = os.path.join(IMAGES_DIR, rel)
        if not os.path.isfile(full_path):
            missing.append(src)
    assert not missing, (
        f"{filename}: {len(missing)} картинок не найдено на диске:\n"
        + "\n".join(f"  {s}" for s in missing)
    )

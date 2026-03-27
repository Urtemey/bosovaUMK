"""Parser for contenttests HTML format -> list of question dicts."""
import os
from bs4 import BeautifulSoup, NavigableString
import re

_S3_BASE = os.environ.get('S3_IMAGES_BASE_URL', '')
_IMG_PREFIX = _S3_BASE.rstrip('/') + '/' if _S3_BASE else _IMG_PREFIX


def parse_html_questions(html_content: str) -> list[dict]:
    """
    Parse contenttests HTML and return list of question dicts compatible with Question model.

    Formats detected:
    - single_choice: <ul> with exactly one <li class="correct">
    - multiple_choice: <ul> with multiple <li class="correct">
    - text_input: <span class="text-entry">answer</span>
    - matching: <table class="match-interaction-container"> with left/right pairs
    - ordering: <div class="order-simple-choice"> items in correct order
    - select_list: <span class="inline-choice"> with <span class="correct">
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    questions = []

    path_headers = soup.find_all('h6', class_='path')

    for i, header in enumerate(path_headers):
        elements = []
        current = header.next_sibling
        next_header = path_headers[i + 1] if i + 1 < len(path_headers) else None

        while current and current != next_header:
            # Stop if we hit the next h6.path (sometimes siblings are nested differently)
            if hasattr(current, 'name') and current.name == 'h6' and current.get('class') and 'path' in current.get('class', []):
                break
            elements.append(current)
            current = current.next_sibling

        block_html = ''.join(str(e) for e in elements)
        block = BeautifulSoup(block_html, 'html.parser')

        question_text = _extract_question_text(block)
        if not question_text:
            continue

        # Extract image
        img = block.find('img')
        image_src = img.get('src') or img.get('originalsrc') or img.get('originalSrc') if img else None
        if image_src and image_src.startswith('images/'):
            image_src = _IMG_PREFIX + image_src[len('images/'):]

        # Try each question type in order of specificity
        parsed = (
            _try_parse_matching(block, question_text, image_src) or
            _try_parse_ordering(block, question_text, image_src) or
            _try_parse_select_list(block, question_text, image_src) or
            _try_parse_text_input(block, question_text, image_src) or
            _try_parse_choice(block, question_text, image_src)
        )

        if parsed:
            questions.append(parsed)

    return questions


def _try_parse_matching(block, question_text, image_src) -> dict | None:
    """Parse matching: <table class="match-interaction-container"> with left/right divs."""
    table = block.find('table', class_='match-interaction-container')
    if not table:
        return None

    rows = table.find_all('tr')
    left_items = []
    right_items = []

    for row in rows:
        left_div = row.find('div', class_=lambda c: c and 'left' in c and 'simple-associable-choice' in c)
        right_div = row.find('div', class_=lambda c: c and 'right' in c and 'simple-associable-choice' in c)

        if left_div and right_div:
            left_text = left_div.get_text(strip=True)
            right_text = right_div.get_text(strip=True)
            if left_text and right_text:
                left_items.append(left_text)
                right_items.append(right_text)

    if not left_items:
        return None

    # correct_answer maps left index -> right index (rows are already matched)
    correct_answer = {str(i): str(i) for i in range(len(left_items))}

    content = {'text': question_text, 'left': left_items, 'right': right_items}
    if image_src:
        content['image'] = image_src

    return {
        'question_type': 'matching',
        'content': content,
        'correct_answer': correct_answer,
        'points': 1,
    }


def _try_parse_ordering(block, question_text, image_src) -> dict | None:
    """Parse ordering: <div class="order-simple-choice"> items."""
    order_divs = block.find_all('div', class_=lambda c: c and 'order-simple-choice' in c)
    if not order_divs:
        return None

    items = [div.get_text(strip=True) for div in order_divs if div.get_text(strip=True)]
    if len(items) < 2:
        return None

    # Items are in correct order in HTML; correct_answer is [0, 1, 2, ...]
    correct_answer = list(range(len(items)))

    content = {'text': question_text, 'items': items}
    if image_src:
        content['image'] = image_src

    return {
        'question_type': 'ordering',
        'content': content,
        'correct_answer': correct_answer,
        'points': 1,
    }


def _try_parse_select_list(block, question_text, image_src) -> dict | None:
    """Parse select_list: <span class="inline-choice"> with options and correct marked."""
    inline_choices = block.find_all('span', class_='inline-choice')
    if not inline_choices:
        return None

    dropdowns = []
    correct_answer = {}

    for idx, ic in enumerate(inline_choices):
        spans = ic.find_all('span', recursive=False)
        if not spans:
            continue

        options = [s.get_text(strip=True) for s in spans]
        correct_idx = None
        for j, s in enumerate(spans):
            if 'correct' in s.get('class', []):
                correct_idx = j
                break

        if correct_idx is None:
            continue

        dropdowns.append({'options': options, 'label': f'#{idx + 1}'})
        correct_answer[str(idx)] = str(correct_idx)

    if not dropdowns:
        return None

    # Try to extract the full HTML context for the question (tables, etc.)
    content = {'text': question_text, 'dropdowns': dropdowns}
    if image_src:
        content['image'] = image_src

    return {
        'question_type': 'select_list',
        'content': content,
        'correct_answer': correct_answer,
        'points': 1,
    }


def _try_parse_text_input(block, question_text, image_src) -> dict | None:
    """Parse text_input: <span class="text-entry">answer</span>."""
    text_entries = block.find_all('span', class_='text-entry')
    if not text_entries:
        return None

    answers = [te.get_text(strip=True) for te in text_entries if te.get_text(strip=True)]
    if not answers:
        return None

    content = {'text': question_text}
    if image_src:
        content['image'] = image_src

    correct = answers[0] if len(answers) == 1 else answers

    return {
        'question_type': 'text_input',
        'content': content,
        'correct_answer': correct,
        'points': 1,
    }


def _try_parse_choice(block, question_text, image_src) -> dict | None:
    """Parse single_choice / multiple_choice: <ul> with <li class="correct">."""
    ul = block.find('ul')
    if not ul:
        return None

    all_li = ul.find_all('li', recursive=False)
    if not all_li:
        return None

    options = [re.sub(r'\s+', ' ', _li_content(li)) for li in all_li]
    correct_indices = [j for j, li in enumerate(all_li) if 'correct' in li.get('class', [])]

    if not correct_indices:
        return None

    content = {'text': question_text, 'options': options}
    if image_src:
        content['image'] = image_src

    if len(correct_indices) == 1:
        return {
            'question_type': 'single_choice',
            'content': content,
            'correct_answer': correct_indices[0],
            'points': 1,
        }
    else:
        return {
            'question_type': 'multiple_choice',
            'content': content,
            'correct_answer': correct_indices,
            'points': 1,
        }


def _li_content(li) -> str:
    """Get li content, preserving img tags as HTML for rendering."""
    img = li.find('img')
    if img:
        src = img.get('src') or img.get('originalsrc') or ''
        if src.startswith('images/'):
            src = _IMG_PREFIX + src[len('images/'):]
        text = li.get_text(strip=True)
        if text:
            return f'{text} <img src="{src}">'
        return f'<img src="{src}">'
    return li.get_text(strip=True)


def _extract_question_text(block) -> str:
    """Extract question text as HTML (preserving formatting, images, tables).

    Returns the full HTML of all <p> and contextual elements before the answer area,
    but strips out answer elements (ul, text-entry, match-table, etc.).
    """
    # Collect text from <strong>, <p> tags
    strongs = block.find_all('strong')
    if strongs:
        parts = []
        for s in strongs:
            # Include surrounding paragraph context
            parent_p = s.find_parent('p')
            if parent_p:
                parts.append(parent_p.get_text(strip=True))
            else:
                parts.append(s.get_text(strip=True))
        # Deduplicate while preserving order
        seen = set()
        unique = []
        for p in parts:
            if p and p not in seen:
                seen.add(p)
                unique.append(p)
        text = ' '.join(unique)
        text = re.sub(r'\s+', ' ', text).strip()
        if text:
            return text

    # Fallback: all paragraph text (excluding answer spans)
    paragraphs = block.find_all('p')
    parts = []
    for p in paragraphs:
        # Skip paragraphs that only contain answer widgets
        if p.find('span', class_='text-entry') and not p.find(string=True, recursive=False):
            continue
        txt = p.get_text(strip=True)
        if txt:
            parts.append(txt)
    text = ' '.join(parts)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

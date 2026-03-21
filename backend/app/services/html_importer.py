"""Parser for contenttests HTML format -> list of question dicts."""
from bs4 import BeautifulSoup
import re


def parse_html_questions(html_content: str) -> list[dict]:
    """
    Parse contenttests HTML and return list of question dicts compatible with Question model.

    Formats detected:
    - single_choice: <ul> with exactly one <li class="correct">
    - multiple_choice: <ul> with multiple <li class="correct">
    - text_input: <span class="text-entry">answer</span>
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    questions = []

    # Find all path headers
    path_headers = soup.find_all('h6', class_='path')

    for i, header in enumerate(path_headers):
        # Get all elements between this header and the next
        elements = []
        current = header.next_sibling
        next_header = path_headers[i + 1] if i + 1 < len(path_headers) else None

        while current and current != next_header:
            elements.append(current)
            current = current.next_sibling

        # Build a mini soup from these elements
        block_html = ''.join(str(e) for e in elements)
        block = BeautifulSoup(block_html, 'html.parser')

        # Extract question text from <strong> tags or <p> tags
        question_text = _extract_question_text(block)
        if not question_text:
            continue

        # Extract image if present; normalize path to /content-images/<filename>
        img = block.find('img')
        image_src = img.get('src') or img.get('originalSrc') if img else None
        if image_src and image_src.startswith('images/'):
            image_src = '/content-images/' + image_src[len('images/'):]

        # Check for text_input type: <span class="text-entry">
        text_entries = block.find_all('span', class_='text-entry')
        if text_entries:
            answers = [te.get_text(strip=True) for te in text_entries if te.get_text(strip=True)]
            if answers:
                content = {'text': question_text}
                if image_src:
                    content['image'] = image_src
                correct = answers[0] if len(answers) == 1 else answers
                questions.append({
                    'question_type': 'text_input',
                    'content': content,
                    'correct_answer': correct,
                    'points': 1,
                })
            continue

        # Check for choice type: <ul> with <li>
        ul = block.find('ul')
        if ul:
            all_li = ul.find_all('li', recursive=False)

            if not all_li:
                continue

            options = [li.get_text(strip=True) for li in all_li]
            options = [re.sub(r'\s+', ' ', o) for o in options]

            correct_indices = [j for j, li in enumerate(all_li) if 'correct' in li.get('class', [])]

            if not correct_indices:
                continue

            content = {'text': question_text, 'options': options}
            if image_src:
                content['image'] = image_src

            if len(correct_indices) == 1:
                questions.append({
                    'question_type': 'single_choice',
                    'content': content,
                    'correct_answer': correct_indices[0],
                    'points': 1,
                })
            else:
                questions.append({
                    'question_type': 'multiple_choice',
                    'content': content,
                    'correct_answer': correct_indices,
                    'points': 1,
                })

    return questions


def _extract_question_text(block) -> str:
    """Extract question text: prefer text from <strong> tags, fallback to all <p> text."""
    # Collect all strong text
    strongs = block.find_all('strong')
    if strongs:
        text = ' '.join(s.get_text(strip=True) for s in strongs)
        text = re.sub(r'\s+', ' ', text).strip()
        if text:
            return text

    # Fallback: all paragraph text
    paragraphs = block.find_all('p')
    text = ' '.join(p.get_text(strip=True) for p in paragraphs)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

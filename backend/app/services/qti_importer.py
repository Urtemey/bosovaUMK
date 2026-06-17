"""Парсер IMS Content Package (QTI 2.1) из ZIP-архива -> список вопросов.

Архивы (DL_RES_*.zip) содержат:
  - imsmanifest.xml — оглавление: название теста и порядок вопросов
  - по папке на вопрос с файлом assessmentItem (*.xml) и картинками
  - LOM_resource.xml, Attributes.xml — метаданные (игнорируются)

Формат вопросов QTI 2.1 (assessmentItem):
  - choiceInteraction  -> single_choice / multiple_choice (по cardinality)
  - textEntryInteraction -> text_input
  - matchInteraction   -> matching
  - inlineChoiceInteraction -> select_list
  - orderInteraction   -> ordering
  - graphicGapMatchInteraction -> не поддерживается (пропускается)

Картинки, на которые ссылается вопрос (<img src="...">), лежат в архиве
рядом с XML. Они загружаются в S3 через переданный `uploader(data, filename)`
(возвращает публичный URL), а ссылки в HTML переписываются на этот URL —
поэтому ручная заливка изображений не нужна.

Выходные словари по форме совпадают с html_importer (те же content/
correct_answer), чтобы answer_checker и фронтенд работали без изменений.
"""
import io
import re
import posixpath
import warnings
import zipfile

from bs4 import BeautifulSoup

try:  # bs4 предупреждает, что XML разбирается html-парсером — это намеренно
    from bs4 import XMLParsedAsHTMLWarning
    warnings.filterwarnings('ignore', category=XMLParsedAsHTMLWarning)
except ImportError:
    pass


# Теги интерактивных элементов (BeautifulSoup с html.parser приводит имена
# тегов и атрибутов к нижнему регистру, поэтому ищем в нижнем регистре).
_INTERACTION_TAGS = [
    'choiceinteraction',
    'textentryinteraction',
    'matchinteraction',
    'inlinechoiceinteraction',
    'orderinteraction',
    'graphicgapmatchinteraction',
    'hottextinteraction',
    'gapmatchinteraction',
]


class QtiParseError(Exception):
    """Не удалось разобрать архив как QTI content package."""


def _soup(xml_bytes: bytes) -> BeautifulSoup:
    text = xml_bytes.decode('utf-8', errors='replace')
    return BeautifulSoup(text, 'html.parser')


def _collapse(text: str) -> str:
    return re.sub(r'\s+', ' ', text or '').strip()


def _inner_html(tag) -> str:
    """HTML содержимого тега (без самого тега), со схлопнутыми пробелами."""
    if tag is None:
        return ''
    html = ''.join(str(c) for c in tag.children)
    return _collapse(html)


# ─────────────────────────── манифест ───────────────────────────

def _read_name(zf: zipfile.ZipFile, name: str):
    try:
        return zf.read(name)
    except KeyError:
        return None


def _find_member(zf: zipfile.ZipFile, basename: str):
    """Ищет файл по имени без учёта регистра и пути."""
    target = basename.lower()
    for n in zf.namelist():
        if n.lower().endswith('/' + target) or n.lower() == target:
            return n
    return None


def _parse_manifest(zf: zipfile.ZipFile):
    """Возвращает (title, [hrefs...]) из imsmanifest.xml или (None, None)."""
    member = _find_member(zf, 'imsmanifest.xml')
    if not member:
        return None, None
    data = _read_name(zf, member)
    if not data:
        return None, None
    soup = _soup(data)

    title = None
    org = soup.find('organization')
    if org:
        t = org.find('title')
        if t:
            title = _collapse(t.get_text())

    # identifier ресурса -> href (путь к assessmentItem)
    resources = {}
    for res in soup.find_all('resource'):
        rid = res.get('identifier')
        href = res.get('href')
        if rid and href:
            resources[rid] = href

    # порядок вопросов задаётся <item identifierref="...">
    hrefs = []
    for item in soup.find_all('item'):
        ref = item.get('identifierref')
        if ref and ref in resources:
            hrefs.append(resources[ref])

    # запасной вариант: если items не дали ссылок — берём все href ресурсов
    if not hrefs:
        hrefs = [h for h in resources.values() if h.lower().endswith('.xml')]

    return title, hrefs


# ─────────────────────────── картинки ───────────────────────────

def _resolve_in_zip(zf: zipfile.ZipFile, basedir: str, src: str):
    """Находит реальное имя файла в архиве для относительной ссылки src."""
    src = (src or '').split('?')[0].split('#')[0]
    candidate = posixpath.normpath(posixpath.join(basedir, src)) if basedir else src
    candidate = candidate.lstrip('./')
    names = zf.namelist()
    if candidate in names:
        return candidate
    low = candidate.lower()
    for n in names:
        if n.lower() == low:
            return n
    # по одному только имени файла
    base = posixpath.basename(low)
    for n in names:
        if posixpath.basename(n.lower()) == base:
            return n
    return None


def _rewrite_images(item_soup, zf, basedir, uploader, stats, cache):
    """Загружает все <img> вопроса в S3 и переписывает src на публичный URL.

    Если загрузка невозможна (нет uploader / ошибка) — тег img удаляется,
    чтобы в вопросе не осталось битой ссылки. Обновляет stats и cache.
    """
    for img in item_soup.find_all('img'):
        src = img.get('src') or img.get('originalsrc') or ''
        if not src:
            img.decompose()
            continue
        if src.startswith('http://') or src.startswith('https://'):
            continue  # уже абсолютный URL
        if src in cache:
            img['src'] = cache[src]
            continue
        url = None
        if uploader is not None:
            member = _resolve_in_zip(zf, basedir, src)
            if member:
                try:
                    data = zf.read(member)
                    url = uploader(data, posixpath.basename(member))
                except Exception:
                    url = None
        if url:
            cache[src] = url
            img['src'] = url
            for attr in ('originalsrc', 'width', 'height'):
                if attr in img.attrs:
                    del img.attrs[attr]
            stats['uploaded'] += 1
        else:
            img.decompose()
            stats['failed'] += 1


# ─────────────────────── ответы (correctResponse) ───────────────────────

def _response_map(item_soup):
    """responseIdentifier -> (cardinality, [values...]) из responseDeclaration."""
    out = {}
    for rd in item_soup.find_all('responsedeclaration'):
        rid = rd.get('identifier')
        if not rid:
            continue
        card = (rd.get('cardinality') or 'single').lower()
        values = []
        cr = rd.find('correctresponse')
        if cr:
            for v in cr.find_all('value'):
                txt = _collapse(v.get_text())
                if txt:
                    values.append(txt)
        out[rid] = (card, values)
    return out


# ─────────────────────── парсеры по типам ───────────────────────

def _choice_text(choice) -> str:
    """Текст/HTML варианта ответа (с сохранением картинок)."""
    html = _inner_html(choice)
    return html


def _parse_choice(inter, item_body, responses):
    rid = inter.get('responseidentifier')
    card, correct_vals = responses.get(rid, ('single', []))

    choices = inter.find_all('simplechoice')
    if not choices:
        return None
    id_to_idx = {}
    options = []
    for idx, ch in enumerate(choices):
        cid = ch.get('identifier')
        if cid:
            id_to_idx[cid] = idx
        options.append(_choice_text(ch))

    correct_idx = [id_to_idx[v] for v in correct_vals if v in id_to_idx]
    if not correct_idx:
        return None

    text = _question_text(item_body)
    content = {'text': text, 'options': options}

    max_choices = inter.get('maxchoices')
    is_multiple = card == 'multiple' or (max_choices is not None and max_choices != '1')

    if is_multiple:
        return {
            'question_type': 'multiple_choice',
            'content': content,
            'correct_answer': sorted(correct_idx),
            'points': 1,
        }
    return {
        'question_type': 'single_choice',
        'content': content,
        'correct_answer': correct_idx[0],
        'points': 1,
    }


def _parse_text_entry(item_body, responses):
    inters = item_body.find_all('textentryinteraction')
    if not inters:
        return None
    answers = []
    for inter in inters:
        rid = inter.get('responseidentifier')
        _, vals = responses.get(rid, ('single', []))
        answers.extend(vals)
    answers = [a for a in answers if a]
    if not answers:
        return None

    text = _question_text(item_body)
    content = {'text': text}
    correct = answers[0] if len(answers) == 1 else answers
    return {
        'question_type': 'text_input',
        'content': content,
        'correct_answer': correct,
        'points': 1,
    }


def _parse_match(inter, item_body, responses):
    rid = inter.get('responseidentifier')
    _, correct_vals = responses.get(rid, ('multiple', []))

    sets = inter.find_all('simplematchset')
    if len(sets) < 2:
        return None

    def collect(s):
        ids, texts = {}, []
        for i, ch in enumerate(s.find_all('simpleassociablechoice')):
            cid = ch.get('identifier')
            if cid:
                ids[cid] = i
            texts.append(_collapse(ch.get_text()))
        return ids, texts

    left_ids, left_texts = collect(sets[0])
    right_ids, right_texts = collect(sets[1])
    if not left_texts or not right_texts:
        return None

    correct = {}
    for val in correct_vals:
        toks = val.split()
        if len(toks) != 2:
            continue
        a, b = toks
        # порядок токенов в паре может быть любым — определяем по принадлежности
        if a in left_ids and b in right_ids:
            correct[str(left_ids[a])] = str(right_ids[b])
        elif b in left_ids and a in right_ids:
            correct[str(left_ids[b])] = str(right_ids[a])
    if not correct:
        return None

    text = _question_text(item_body)
    content = {'text': text, 'left': left_texts, 'right': right_texts}
    return {
        'question_type': 'matching',
        'content': content,
        'correct_answer': correct,
        'points': 1,
    }


def _parse_order(inter, item_body, responses):
    rid = inter.get('responseidentifier')
    _, correct_vals = responses.get(rid, ('ordered', []))

    choices = inter.find_all('simplechoice')
    if len(choices) < 2:
        return None
    id_to_text = {}
    for ch in choices:
        cid = ch.get('identifier')
        if cid:
            id_to_text[cid] = _collapse(ch.get_text())

    ordered = [id_to_text[v] for v in correct_vals if v in id_to_text]
    if len(ordered) < 2:
        # нет валидного порядка — берём как есть
        ordered = [id_to_text[c.get('identifier')] for c in choices if c.get('identifier')]

    text = _question_text(item_body)
    content = {'text': text, 'items': ordered}
    return {
        'question_type': 'ordering',
        'content': content,
        'correct_answer': list(range(len(ordered))),
        'points': 1,
    }


def _parse_inline_choice(item_body, responses):
    inters = item_body.find_all('inlinechoiceinteraction')
    if not inters:
        return None

    dropdowns = []
    correct_answer = {}
    for idx, inter in enumerate(inters):
        rid = inter.get('responseidentifier')
        card, vals = responses.get(rid, ('single', []))
        if card == 'multiple':
            continue  # часть graphicGapMatch — пропускаем
        opts = inter.find_all('inlinechoice')
        if not opts:
            continue
        id_to_idx = {}
        options = []
        for j, o in enumerate(opts):
            oid = o.get('identifier')
            if oid:
                id_to_idx[oid] = j
            options.append(_collapse(o.get_text()))
        correct_idx = None
        for v in vals:
            if v in id_to_idx:
                correct_idx = id_to_idx[v]
                break
        if correct_idx is None:
            continue
        dropdowns.append({'options': options, 'label': f'#{len(dropdowns) + 1}'})
        correct_answer[str(len(dropdowns) - 1)] = str(correct_idx)

    if not dropdowns:
        return None

    text = _question_text(item_body)
    content = {'text': text, 'dropdowns': dropdowns}
    return {
        'question_type': 'select_list',
        'content': content,
        'correct_answer': correct_answer,
        'points': 1,
    }


def _question_text(item_body) -> str:
    """HTML условия вопроса: содержимое itemBody без интерактивных элементов."""
    copy = BeautifulSoup(str(item_body), 'html.parser')
    body = copy.find('itembody') or copy
    for tag_name in _INTERACTION_TAGS:
        for t in body.find_all(tag_name):
            t.decompose()
    # пустые обёртки <ul/> от редактора и т.п. оставляем как есть
    html = _inner_html(body)
    return html


# ─────────────────────── разбор одного вопроса ───────────────────────

def _parse_item(xml_bytes, zf, basedir, uploader, stats):
    soup = _soup(xml_bytes)
    item = soup.find('assessmentitem')
    if item is None:
        return None
    item_body = item.find('itembody')
    if item_body is None:
        return None

    # сперва заливаем картинки и переписываем ссылки во всём вопросе
    _rewrite_images(item, zf, basedir, uploader, stats, cache={})

    responses = _response_map(item)

    # порядок проверки — от специфичных к общим (как в html_importer)
    match = item_body.find('matchinteraction')
    if match:
        parsed = _parse_match(match, item_body, responses)
        if parsed:
            return parsed

    order = item_body.find('orderinteraction')
    if order:
        parsed = _parse_order(order, item_body, responses)
        if parsed:
            return parsed

    if item_body.find('inlinechoiceinteraction'):
        parsed = _parse_inline_choice(item_body, responses)
        if parsed:
            return parsed

    if item_body.find('textentryinteraction'):
        parsed = _parse_text_entry(item_body, responses)
        if parsed:
            return parsed

    choice = item_body.find('choiceinteraction')
    if choice:
        parsed = _parse_choice(choice, item_body, responses)
        if parsed:
            return parsed

    return None


# ─────────────────────────── публичный API ───────────────────────────

def parse_qti_zip(zip_bytes: bytes, uploader=None) -> dict:
    """Разбирает ZIP (IMS/QTI content package) в набор вопросов.

    uploader(data: bytes, filename: str) -> str|None — загружает картинку и
    возвращает публичный URL (или None при неудаче). Если None — картинки
    не сохраняются (теги img удаляются), вопросы всё равно импортируются.

    Возвращает: {
      'title': str|None,
      'questions': [ {question_type, content, correct_answer, points}, ... ],
      'images_uploaded': int,
      'images_failed': int,
      'unsupported': int,   # вопросов не удалось распознать
    }
    Бросает QtiParseError, если архив не похож на QTI.
    """
    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile as e:
        raise QtiParseError(f'Некорректный ZIP-архив: {e}')

    stats = {'uploaded': 0, 'failed': 0}

    with zf:
        title, hrefs = _parse_manifest(zf)

        # если манифеста нет — берём все xml, похожие на assessmentItem
        if not hrefs:
            hrefs = []
            for n in sorted(zf.namelist()):
                if not n.lower().endswith('.xml'):
                    continue
                if posixpath.basename(n).lower() in ('imsmanifest.xml', 'lom_resource.xml', 'attributes.xml'):
                    continue
                try:
                    head = zf.read(n)[:600].lower()
                except KeyError:
                    continue
                if b'assessmentitem' in head:
                    hrefs.append(n)

        if not hrefs:
            raise QtiParseError('В архиве не найдено вопросов QTI (assessmentItem)')

        questions = []
        unsupported = 0
        for href in hrefs:
            member = href if href in zf.namelist() else _resolve_in_zip(zf, '', href)
            if not member:
                unsupported += 1
                continue
            try:
                data = zf.read(member)
            except KeyError:
                unsupported += 1
                continue
            basedir = posixpath.dirname(member)
            try:
                parsed = _parse_item(data, zf, basedir, uploader, stats)
            except Exception:
                parsed = None
            if parsed:
                questions.append(parsed)
            else:
                unsupported += 1

    return {
        'title': title,
        'questions': questions,
        'images_uploaded': stats['uploaded'],
        'images_failed': stats['failed'],
        'unsupported': unsupported,
    }

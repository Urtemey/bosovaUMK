"""Рендер тестов в самодостаточный читаемый HTML (для скачивания / печати в PDF).

Документ содержит условия всех вопросов и правильные ответы (ключ для учителя).
Поддерживаются все типы вопросов из QuestionType.ALL. Картинки делаются
абсолютными (S3-URL уже абсолютны, локальные /content-images/... получают
префикс origin), чтобы изображения отображались при открытии сохранённого файла.
"""
import re
import html as _html

from app.models.question import QuestionType


class _Sub:
    """Лёгкий контейнер для рендера вложенного вопроса (free_form)."""
    def __init__(self, question_type, content, correct_answer):
        self.question_type = question_type
        self.content = content
        self.correct_answer = correct_answer


def _esc(value):
    return _html.escape('' if value is None else str(value))


def _absolutize(text, origin):
    """Префиксует относительные ссылки (src/href, начинающиеся с /) origin'ом."""
    if not text or not origin:
        return text or ''

    def repl(m):
        attr, url = m.group(1), m.group(2)
        return f'{attr}="{origin}{url}"'

    return re.sub(r'(src|href)="(/[^"]*)"', repl, text)


def _img(url, origin, max_width='320px'):
    if not url:
        return ''
    if url.startswith('/'):
        url = origin + url
    return (f'<div class="q-img"><img src="{_esc(url)}" '
            f'style="max-width:{max_width};border:1px solid #ddd;border-radius:6px"></div>')


def _pre_text(value):
    """Текст элемента с сохранением переносов и табуляции (для упорядочивания)."""
    return f'<span class="pre">{_esc(value)}</span>'


def _render_body(q, origin):
    qtype = q.question_type
    content = q.content or {}
    correct = q.correct_answer
    parts = []

    if content.get('image'):
        parts.append(_img(content['image'], origin))
    f = content.get('file')
    if isinstance(f, dict) and f.get('url'):
        url = f['url']
        if url.startswith('/'):
            url = origin + url
        parts.append(f'<p class="file">📎 <a href="{_esc(url)}">{_esc(f.get("name") or "файл")}</a></p>')

    if qtype in (QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE):
        options = content.get('options') or []
        imgs = content.get('option_images') or []
        if qtype == QuestionType.SINGLE_CHOICE:
            correct_set = {correct} if isinstance(correct, int) else set()
        else:
            correct_set = set(correct) if isinstance(correct, list) else set()
        items = []
        for i, opt in enumerate(options):
            ok = i in correct_set
            mark = '<span class="ok">✓</span>' if ok else '<span class="dim">○</span>'
            cls = ' class="correct"' if ok else ''
            img = _img(imgs[i], origin, '180px') if i < len(imgs) and imgs[i] else ''
            items.append(f'<li{cls}>{mark} {_esc(opt)}{img}</li>')
        parts.append(f'<ul class="opts">{"".join(items)}</ul>')

    elif qtype == QuestionType.TEXT_INPUT:
        answers = correct if isinstance(correct, list) else [correct]
        answers = [a for a in answers if a not in (None, '')]
        parts.append(f'<p class="ans"><b>Ответ:</b> {_esc(" / ".join(map(str, answers)))}</p>')

    elif qtype == QuestionType.MATCHING:
        left = content.get('left') or []
        right = content.get('right') or []
        limgs = content.get('left_images') or []
        rimgs = content.get('right_images') or []
        rows = []
        mapping = correct if isinstance(correct, dict) else {}
        for i, l in enumerate(left):
            ri = mapping.get(str(i), str(i))
            try:
                rval = right[int(ri)]
            except (ValueError, IndexError, TypeError):
                rval = ''
            limg = _img(limgs[i], origin, '120px') if i < len(limgs) and limgs[i] else ''
            try:
                rimg = _img(rimgs[int(ri)], origin, '120px') if rimgs[int(ri)] else ''
            except (ValueError, IndexError, TypeError):
                rimg = ''
            rows.append(f'<tr><td>{_esc(l)}{limg}</td><td>→</td><td>{_esc(rval)}{rimg}</td></tr>')
        parts.append(f'<table class="match">{"".join(rows)}</table>')

    elif qtype == QuestionType.DRAG_DROP:
        items = content.get('items') or []
        slots = content.get('slots') or []
        mapping = correct if isinstance(correct, dict) else {}
        rows = []
        for s, slot in enumerate(slots):
            ii = mapping.get(str(s))
            try:
                ival = items[int(ii)]
            except (ValueError, IndexError, TypeError):
                ival = ''
            rows.append(f'<tr><td>{_esc(slot)}</td><td>←</td><td class="correct">{_esc(ival)}</td></tr>')
        parts.append(f'<table class="match">{"".join(rows)}</table>')

    elif qtype == QuestionType.SELECT_LIST:
        rowsd = content.get('rows') or []
        options = content.get('options') or []
        mapping = correct if isinstance(correct, dict) else {}
        rows = []
        for r, row in enumerate(rowsd):
            oi = mapping.get(str(r))
            try:
                oval = options[int(oi)]
            except (ValueError, IndexError, TypeError):
                oval = ''
            rows.append(f'<tr><td>{_esc(row)}</td><td class="correct">{_esc(oval)}</td></tr>')
        parts.append(f'<table class="match">{"".join(rows)}</table>')

    elif qtype == QuestionType.ORDERING:
        items = content.get('items') or []
        imgs = content.get('item_images') or []
        order = correct if isinstance(correct, list) else list(range(len(items)))
        rows = []
        for n, idx in enumerate(order, start=1):
            try:
                val = items[int(idx)]
                img = _img(imgs[int(idx)], origin, '160px') if int(idx) < len(imgs) and imgs[int(idx)] else ''
            except (ValueError, IndexError, TypeError):
                val, img = '', ''
            rows.append(f'<li><b>{n}.</b> {_pre_text(val)}{img}</li>')
        parts.append(f'<ol class="ordering">{"".join(rows)}</ol>')

    elif qtype == QuestionType.CODE:
        lang = content.get('language') or 'python'
        starter = content.get('starter_code') or ''
        parts.append(f'<p class="dim">Язык: {_esc(lang)}</p>')
        if starter:
            parts.append(f'<pre class="code">{_esc(starter)}</pre>')
        cases = (correct or {}).get('test_cases') if isinstance(correct, dict) else None
        if isinstance(cases, list) and cases:
            rows = []
            for c in cases:
                rows.append(
                    f'<tr><td><code>{_esc(c.get("input"))}</code></td>'
                    f'<td><code>{_esc(c.get("expected_output"))}</code></td></tr>'
                )
            parts.append('<table class="cases"><tr><th>Ввод</th><th>Ожидаемый вывод</th></tr>'
                         + ''.join(rows) + '</table>')

    elif qtype == QuestionType.NUMBER_PAIRS:
        pairs = (correct or {}).get('pairs') if isinstance(correct, dict) else None
        if isinstance(pairs, list):
            txt = ', '.join(f'({_esc(p[0])}; {_esc(p[1])})' for p in pairs if isinstance(p, (list, tuple)) and len(p) == 2)
            parts.append(f'<p class="ans"><b>Пары:</b> {txt}</p>')

    elif qtype == QuestionType.IMAGE_FIELDS:
        fields = content.get('fields') or []
        cmap = correct if isinstance(correct, dict) else {}
        rows = []
        for n, fld in enumerate(fields, start=1):
            if not isinstance(fld, dict):
                continue
            accepted = cmap.get(fld.get('id'))
            if not isinstance(accepted, list):
                accepted = [accepted] if accepted not in (None, '') else []
            rows.append(f'<tr><td>Поле {n}</td><td class="correct">{_esc(" / ".join(map(str, accepted)))}</td></tr>')
        if rows:
            parts.append(f'<table class="match">{"".join(rows)}</table>')

    elif qtype == QuestionType.FREE_FORM:
        blocks = content.get('blocks') or []
        cmap = correct if isinstance(correct, dict) else {}
        for b in blocks:
            if not isinstance(b, dict):
                continue
            if b.get('type') == 'html':
                parts.append(f'<div class="ff-html">{_absolutize(b.get("html") or "", origin)}</div>')
            elif b.get('type') == 'question':
                spec = cmap.get(str(b.get('id'))) or {}
                sub = _Sub(b.get('question_type'), b.get('content') or {}, spec.get('value'))
                sub_text = _absolutize((b.get('content') or {}).get('text') or '', origin)
                try:
                    sub_body = _render_body(sub, origin)
                except Exception as e:  # noqa: BLE001
                    sub_body = f'<p class="dim">[ошибка: {_esc(e)}]</p>'
                parts.append(f'<div class="ff-q">{sub_text}{sub_body}</div>')
            elif b.get('type') == 'field':
                prompt = _esc(b.get('prompt') or '')
                spec = cmap.get(str(b.get('id'))) or {}
                value = spec.get('value')
                opts = b.get('options') or []
                if isinstance(value, list) and b.get('field_type') in ('single_choice', 'multiple_choice'):
                    chosen = []
                    for v in value:
                        try:
                            chosen.append(opts[int(v)])
                        except (ValueError, IndexError, TypeError):
                            pass
                    disp = ', '.join(map(str, chosen))
                elif isinstance(value, int) and b.get('field_type') == 'single_choice':
                    try:
                        disp = opts[value]
                    except (IndexError, TypeError):
                        disp = ''
                elif isinstance(value, list):
                    disp = ' / '.join(map(str, value))
                else:
                    disp = '' if value is None else str(value)
                parts.append(f'<p class="ans">{prompt} <b>{_esc(disp)}</b></p>')

    return ''.join(parts)


def _render_question(q, number, origin):
    text = _absolutize(q.content.get('text') or '', origin) if q.content else ''
    points = q.points or 1
    try:
        body = _render_body(q, origin)
    except Exception as e:  # noqa: BLE001 — один битый вопрос не должен ломать экспорт
        body = f'<p class="dim">[ошибка рендера вопроса: {_esc(e)}]</p>'
    return (
        f'<div class="q">'
        f'<div class="q-head"><span class="q-num">{number}</span>'
        f'<span class="q-pts">{points} б.</span></div>'
        f'<div class="q-text">{text}</div>'
        f'{body}</div>'
    )


_STYLE = """
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #1a1f25; line-height: 1.5; margin: 0; padding: 32px; max-width: 900px; margin: 0 auto; }
h1.test-title { font-size: 1.5rem; margin: 0 0 4px; }
.test-meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 8px; }
.test { page-break-after: always; }
.test:last-child { page-break-after: auto; }
.q { padding: 14px 0; border-top: 1px solid #e5e7eb; }
.q-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.q-num { background: #2b4c7e; color: #fff; font-weight: 700; border-radius: 6px; padding: 2px 10px; font-size: 0.875rem; }
.q-pts { color: #9ca3af; font-size: 0.8125rem; }
.q-text { margin-bottom: 8px; }
.q-text img, .ff-html img { max-width: 360px; height: auto; }
.q-img { margin: 8px 0; }
ul.opts { list-style: none; padding-left: 4px; margin: 6px 0; }
ul.opts li { margin: 3px 0; }
ul.opts li.correct { font-weight: 600; color: #1a7a44; }
.ok { color: #1a7a44; font-weight: 700; }
.dim { color: #9ca3af; }
.ans { margin: 6px 0; }
.correct { color: #1a7a44; font-weight: 600; }
table.match, table.cases { border-collapse: collapse; margin: 6px 0; }
table.match td { padding: 3px 10px; vertical-align: top; }
table.cases td, table.cases th { border: 1px solid #d1d5db; padding: 4px 10px; text-align: left; }
ol.ordering { margin: 6px 0; }
ol.ordering li { margin: 4px 0; list-style: none; }
.pre { white-space: pre-wrap; }
pre.code { background: #f6f4f0; padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 0.8125rem; }
.ff-q { padding: 4px 0 4px 12px; border-left: 2px solid #e5e7eb; margin: 6px 0; }
.file a { color: #2b4c7e; }
@media print { body { padding: 0; } }
"""


def render_tests_html(tests, origin=''):
    """tests — список объектов Test (с .questions). Возвращает HTML-строку."""
    origin = (origin or '').rstrip('/')
    sections = []
    for test in tests:
        questions = test.questions.all() if hasattr(test.questions, 'all') else list(test.questions)
        qhtml = ''.join(_render_question(q, i, origin) for i, q in enumerate(questions, start=1))
        meta = []
        from app.models.test import SECTION_LABELS, SPO_GRADE
        grade_label = 'СПО' if test.grade == SPO_GRADE else f'{test.grade} класс'
        meta.append(grade_label)
        if test.section:
            meta.append(SECTION_LABELS.get(test.section, test.section))
        if test.topic:
            meta.append(test.topic)
        sections.append(
            f'<div class="test">'
            f'<h1 class="test-title">{_esc(test.title)}</h1>'
            f'<div class="test-meta">{_esc(" · ".join(meta))} · вопросов: {len(questions)}</div>'
            f'{qhtml}</div>'
        )

    title = tests[0].title if len(tests) == 1 else f'Тесты ({len(tests)})'
    return (
        '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">'
        f'<title>{_esc(title)}</title><style>{_STYLE}</style></head>'
        f'<body>{"".join(sections)}</body></html>'
    )

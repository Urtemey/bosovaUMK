# boZoVa - Платформа тестирования по информатике (УМК Босова)

## Описание проекта
Веб-платформа для тематического тестирования по информатике на базе УМК "Информатика" Босова Л.Л. для 5-11 классов. Ориентирована на учителей и учеников, адаптивный дизайн (mobile-first).

## Технологический стек
- **Backend:** Python 3.14 / Flask 3.1, SQLAlchemy ORM, Flask-Migrate (Alembic), Flask-JWT-Extended
- **Frontend:** Next.js 16 (React 19), TypeScript, Tailwind CSS 4, CodeMirror 6
- **БД:** PostgreSQL 16 (docker-compose)
- **Тестирование:** pytest (backend), Jest + React Testing Library (frontend)
- **Окружение:** Python venv (`.venv/`), Node.js (frontend/node_modules)
- **Выполнение кода в браузере:** Pyodide (Python в WebAssembly)

## Запуск
```bash
# БД
docker-compose up -d

# Backend
cd backend
source ../.venv/Scripts/activate  # Windows: ..\.venv\Scripts\activate
pip install -r requirements.txt
flask db upgrade
python seed.py  # начальные данные (teacher/teacher123)
python import_contenttests.py  # импорт 2865 вопросов из contenttests/
flask run       # http://localhost:5000

# Frontend
cd frontend
npm install
npm run dev     # http://localhost:3000
```

## Структура проекта

```
backend/
├── config.py                    # Config class (DB URL, JWT settings)
├── wsgi.py                      # App entry point
├── seed.py                      # Seed data (тесты 5-11 классов + демо-учитель)
├── import_contenttests.py       # Массовый импорт вопросов из contenttests/ HTML
├── requirements.txt
├── migrations/                  # Alembic migrations
│   └── versions/
└── app/
    ├── __init__.py              # create_app(), db/migrate/jwt init, /content-images/ route
    ├── models/
    │   ├── teacher.py           # Teacher (login, password_hash, display_name)
    │   ├── classroom.py         # Classroom (name, grade 5-11, teacher_id)
    │   ├── student.py           # Student (display_name, auto login/code, classroom_id)
    │   ├── test.py              # Test (title, grade, topic, settings JSON, is_published)
    │   ├── question.py          # Question (type enum, content JSON, correct_answer JSON, points)
    │   ├── assignment.py        # TestAssignment (test_id, classroom_id, student_id, share_link)
    │   ├── attempt.py           # TestAttempt (assignment_id, student_id, score_percent)
    │   └── answer.py            # Answer (attempt_id, question_id, student_answer JSON, is_correct)
    ├── routes/
    │   ├── auth.py              # /api/auth/* (register, login, student-login, me, refresh)
    │   ├── classrooms.py        # /api/classrooms/* (CRUD + students batch)
    │   ├── tests.py             # /api/tests/* (CRUD + questions CRUD, cascade delete)
    │   ├── assignments.py       # /api/assignments/* (create, by-link, classroom list)
    │   └── attempts.py          # /api/attempts/* (start, answer, finish, get, journal)
    ├── services/
    │   ├── answer_checker.py    # Проверка ответов для всех 8 типов вопросов
    │   └── html_importer.py     # Парсер HTML вопросов из contenttests (BeautifulSoup)
    └── utils/

contenttests/                    # Исходные HTML-файлы с вопросами (part01-part60.html)
├── images/                      # 714 изображений к вопросам
└── part*.html                   # HTML с вопросами (парсятся html_importer.py)

frontend/src/
├── lib/
│   ├── api.ts                   # API клиент (authApi, classroomsApi, testsApi, assignmentsApi, attemptsApi)
│   └── auth.ts                  # AuthContext, localStorage helpers
├── components/
│   ├── layout/
│   │   ├── Header.tsx           # Desktop header + mobile top bar + mobile bottom nav
│   │   └── AuthProvider.tsx     # React context provider
│   ├── editor/
│   │   └── RichTextEditor.tsx   # Tiptap WYSIWYG (bold/italic/table/image/KaTeX)
│   ├── ui/
│   │   ├── HtmlContent.tsx      # Рендер HTML через dangerouslySetInnerHTML
│   │   └── Toast.tsx            # Toast-уведомления
│   └── questions/               # Компоненты вопросов
│       ├── SingleChoice.tsx     # Радиокнопки
│       ├── MultipleChoice.tsx   # Чекбоксы
│       ├── TextInput.tsx        # Текстовое поле / таблица ввода
│       ├── Matching.tsx         # Drag-and-drop соединение (left ↔ right)
│       ├── DragDrop.tsx         # Перетаскивание в ячейки
│       ├── SelectFromList.tsx   # Dropdown выбор (3 режима: dropdowns/rows/table)
│       ├── Ordering.tsx         # Упорядочивание перетаскиванием
│       └── CodeEditor.tsx       # Редактор кода (CodeMirror + Pyodide)
└── app/
    ├── globals.css              # Дизайн-система (CSS variables, компоненты)
    ├── layout.tsx               # Root layout (Nunito + Bitter fonts, AuthProvider, Header)
    ├── page.tsx                 # Главная — pills классов 5-11 → сетка карточек тестов
    ├── login/page.tsx           # Вход учителя
    ├── student-login/page.tsx   # Вход ученика (логин + код)
    ├── test/[id]/page.tsx       # Просмотр теста (превью 5 вопросов, кнопка "Начать" сверху)
    ├── attempt/[id]/page.tsx    # Прохождение теста (горизонтальная навигация сверху)
    ├── results/[id]/page.tsx    # Результаты попытки
    ├── share/[link]/page.tsx    # Доступ по ссылке
    ├── dashboard/
    │   ├── page.tsx             # Панель учителя — мои тесты
    │   ├── classrooms/page.tsx  # Управление классами
    │   ├── import/page.tsx      # Импорт тестов
    │   └── tests/[id]/edit/page.tsx  # Конструктор вопросов (все 8 типов)
    └── classroom/[id]/
        ├── page.tsx             # Класс: ученики, задания
        └── stats/[testId]/page.tsx  # Статистика по тесту
```

## Роли пользователей
- **Учитель:** создание классов, создание/редактирование тестов (конструктор вопросов), выдача заданий (классу/ученику/по ссылке), дублирование тестов, журнал результатов
- **Ученик:** прохождение тестов, просмотр результатов и неверных ответов (без правильных)

## Авторизация
Без персональных данных. Учитель: login + password. Ученик: auto-generated login (7 символов A-Z0-9) + code (6 цифр). Механизм как в Яндекс Учебнике. JWT (access 1h + refresh 30d, refresh включает role claim).

## Типы заданий (QuestionType) — 8 типов
1. **single_choice** — radio buttons (одиночный выбор)
2. **multiple_choice** — checkboxes (множественный выбор)
3. **text_input** — text input (одно поле или таблица), case-insensitive, допускает список правильных ответов
4. **matching** — drag-and-drop соединение элементов (left ↔ right), цветовые пары
5. **drag_drop** — перетаскивание элементов в ячейки
6. **select_list** — выбор из dropdown (3 режима: dropdowns с индивидуальными опциями, rows с общими опциями, таблица rows×columns)
7. **ordering** — упорядочивание элементов перетаскиванием или стрелками
8. **code** — программирование (CodeMirror + Pyodide для Python, тест-кейсы input/expected_output)

## Настройки теста (Test.settings JSON)
- `show_answer` (bool) — показывать ответ после ответа
- `max_attempts` (int) — количество попыток
- `shuffle_questions` (bool) — перемешивать вопросы
- `shuffle_answers` (bool) — перемешивать варианты ответов
- `show_correct_answers` (bool) — показывать правильные ответы
- `show_score` (bool) — показывать итоговый балл

## API Endpoints
```
POST   /api/auth/register          # Регистрация учителя
POST   /api/auth/login             # Вход учителя
POST   /api/auth/student-login     # Вход ученика
GET    /api/auth/me                # Текущий пользователь (JWT)
POST   /api/auth/refresh           # Обновить access token (с role claim)

GET    /api/classrooms             # Список классов учителя
POST   /api/classrooms             # Создать класс
GET    /api/classrooms/:id         # Получить класс
DELETE /api/classrooms/:id         # Удалить класс
POST   /api/classrooms/:id/students       # Добавить ученика
POST   /api/classrooms/:id/students/batch # Добавить учеников пакетом
DELETE /api/classrooms/:id/students/:sid  # Удалить ученика

GET    /api/tests                  # Каталог тестов (?grade=N)
GET    /api/tests/:id              # Получить тест с вопросами
GET    /api/tests/my               # Мои тесты (учитель)
POST   /api/tests                  # Создать тест
POST   /api/tests/:id/duplicate    # Дублировать тест
PUT    /api/tests/:id              # Обновить тест
DELETE /api/tests/:id              # Удалить тест (cascade: answers→attempts→assignments→questions)
POST   /api/tests/:id/questions    # Добавить вопрос
PUT    /api/tests/:id/questions/:qid  # Обновить вопрос
DELETE /api/tests/:id/questions/:qid  # Удалить вопрос (cascade: answers)

POST   /api/assignments            # Создать назначение
GET    /api/assignments/by-link/:link  # Получить по ссылке
GET    /api/assignments/classroom/:id  # Назначения для класса

POST   /api/attempts/start         # Начать попытку
POST   /api/attempts/:id/answer    # Отправить ответ
POST   /api/attempts/:id/finish    # Завершить попытку
GET    /api/attempts/:id           # Получить попытку
GET    /api/attempts/journal/:classroomId  # Журнал класса

GET    /content-images/:filename   # Изображения к вопросам (из contenttests/images/)
```

## Изображения к вопросам
- Хранятся в `contenttests/images/` (714 файлов)
- Backend обслуживает через `/content-images/:filename`
- Frontend проксирует через Next.js rewrites (`next.config.ts`)
- В БД хранятся как `content.image = "/content-images/filename.png"`
- 843 вопроса содержат изображения (text_input: 445, single_choice: 370, multiple_choice: 20, select_list: 8)

## Импорт вопросов из contenttests
- `backend/app/services/html_importer.py` — парсит HTML-файлы (BeautifulSoup)
- `backend/import_contenttests.py` — массовый импорт с группировкой по классам/темам
- Поддерживает: single_choice, multiple_choice, text_input, matching, ordering, select_list
- 2865 вопросов импортировано, 98.8% parse rate
- Маппинг префиксов к классам: `2207_*`→7, `2505_*`→5, `t07_*`→7, `oge*`→9, и т.д.

## Дизайн-система

### Принципы
- Не генерировать AI-slop: никаких бессмысленных подписей, декоративных SVG-иконок, pill-тегов с очевидной информацией
- Минималистично и функционально

### Шрифты
- **Nunito** (body, `--font-body`) — округлённый, дружелюбный
- **Bitter** (display, `--font-display`) — slab-serif, для заголовков
- НЕ Inter, НЕ Roboto, НЕ Space Grotesk

### CSS Variables (globals.css)
- Accent: `--color-accent` (#2b4c7e deep sapphire blue), `--color-accent-hover` (#3d6ba8)
- Copper CTA: `--color-amber` (#c87533), `.btn-cta`
- Surfaces: `--color-surface` (#fff), `--color-surface-2` (#f6f4f0), `--color-surface-3` (#eae7e1)
- Text: `--color-text-primary` (#1a1f25), `--color-text-secondary` (#4a5260), `--color-text-muted` (#8a9099)
- Semantic: `--color-ok` (#2b8a55), `--color-warn` (#c07b22), `--color-danger` (#c44133)
- Per-grade: `--color-g5` (#2b8a55) через `--color-g11` (#9b45b5)

### CSS-классы компонентов
- `.card`, `.card-lg` — карточки
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-cta`, `.btn-sm`, `.btn-lg`
- `.input`, `.input-mono`, `.label`
- `.t-display`, `.t-title`, `.t-subtitle`, `.t-body`, `.t-caption`, `.t-label`
- `.answer-option`, `.answer-option.selected`
- `.journal-table`, `.score-badge`, `.score-high/med/low`
- `.q-topnav`, `.q-topnav-btn`, `.q-topnav-scroll`, `.q-topnav-arrow` — горизонтальная навигация по вопросам (attempt page)
- `.q-map-overlay`, `.q-map-panel`, `.q-map-grid`, `.q-map-btn` — overlay карта вопросов
- `.grade-pill-btn` — кнопки выбора класса на главной
- `.test-card`, `.test-card-top`, `.test-card-body`, `.test-card-footer` — карточки тестов
- `.animate-fade-up`, `.stagger-1`…`.stagger-8` — staggered reveal
- `.skeleton` — shimmer при загрузке

## Навигация прохождения теста
- Горизонтальная полоса навигации сверху (как в Яндекс ЕГЭ)
- Скроллируемый ряд номеров вопросов, стрелки по краям
- Цвета: текущий (синий), сохранённый (зелёный), с ответом (голубой)
- Клавиатура: стрелки для навигации, M для карты вопросов
- Карта вопросов — модальный overlay

## Демо-данные
- Учитель: `teacher` / `teacher123`
- 177 тестов для классов 5-11 (seed + импорт из contenttests)
- ~5500 вопросов всех 8 типов в базе

## Ключевые файлы
- `CLAUDE.md` — этот файл
- `PLAN.md` — пошаговый план реализации (10 фаз)
- `projectinfo/` — ТЗ (2 PDF) и скриншоты Яндекс Учебника
- `docker-compose.yml` — PostgreSQL 16
- `backend/` — Flask API
- `frontend/` — Next.js приложение
- `contenttests/` — исходные HTML вопросы + изображения

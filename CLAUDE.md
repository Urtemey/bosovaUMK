# boZoVa - Платформа тестирования по информатике (УМК Босова)

## Описание проекта
Веб-платформа для тематического тестирования по информатике на базе УМК "Информатика" Босова Л.Л. для 5-11 классов. Ориентирована на учителей и учеников, адаптивный дизайн (mobile-first).

## Технологический стек
- **Backend:** Python 3.14 / Flask 3.1, SQLAlchemy ORM, Flask-Migrate (Alembic), Flask-JWT-Extended
- **Frontend:** Next.js 16 (React 19), TypeScript, Tailwind CSS 4
- **БД:** PostgreSQL 16 (docker-compose)
- **Тестирование:** pytest (backend), Jest + React Testing Library (frontend)
- **Окружение:** Python venv (`.venv/`), Node.js (frontend/node_modules)

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
├── requirements.txt
├── migrations/                  # Alembic migrations
│   └── versions/
└── app/
    ├── __init__.py              # create_app(), db/migrate/jwt init
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
    │   ├── tests.py             # /api/tests/* (CRUD + questions CRUD)
    │   ├── assignments.py       # /api/assignments/* (create, by-link, classroom list)
    │   └── attempts.py          # /api/attempts/* (start, answer, finish, get, journal)
    ├── services/
    │   └── answer_checker.py    # Проверка ответов для всех 6 типов вопросов
    └── utils/

frontend/src/
├── lib/
│   ├── api.ts                   # API клиент (authApi, classroomsApi, testsApi, assignmentsApi, attemptsApi)
│   └── auth.ts                  # AuthContext, localStorage helpers
├── components/
│   ├── layout/
│   │   ├── Header.tsx           # Desktop header + mobile top bar + mobile bottom nav
│   │   └── AuthProvider.tsx     # React context provider
│   └── questions/               # Компоненты вопросов
│       ├── SingleChoice.tsx
│       ├── MultipleChoice.tsx
│       ├── TextInput.tsx
│       ├── Matching.tsx
│       └── DragDrop.tsx
└── app/
    ├── globals.css              # Дизайн-система (CSS variables, компоненты)
    ├── layout.tsx               # Root layout (Inter font, AuthProvider, Header)
    ├── page.tsx                 # Главная — карточки классов 5-11 с раскрывающимися тестами
    ├── login/page.tsx           # Вход учителя
    ├── student-login/page.tsx   # Вход ученика (логин + код)
    ├── test/[id]/page.tsx       # Просмотр теста (содержимое, вопросы)
    ├── attempt/[id]/page.tsx    # Прохождение теста
    ├── results/[id]/page.tsx    # Результаты попытки
    ├── dashboard/page.tsx       # Панель учителя — мои тесты
    ├── dashboard/classrooms/page.tsx  # Управление классами
    └── classroom/[id]/page.tsx  # Конкретный класс (ученики, задания)
```

## Роли пользователей
- **Учитель:** создание классов, просмотр/редактирование тестов, выдача заданий (классу/ученику/по ссылке), журнал результатов
- **Ученик:** прохождение тестов, просмотр результатов и неверных ответов (без правильных)

## Авторизация
Без персональных данных. Учитель: login + password. Ученик: auto-generated login (7 символов A-Z0-9) + code (6 цифр). Механизм как в Яндекс Учебнике. JWT (access 1h + refresh 30d).

## Типы заданий (QuestionType)
1. **single_choice** — radio buttons (одиночный выбор)
2. **multiple_choice** — checkboxes (множественный выбор)
3. **text_input** — text input (одно поле или таблица), case-insensitive, допускает список правильных ответов
4. **matching** — drag-and-drop соединение элементов (left ↔ right)
5. **drag_drop** — перетаскивание элементов в ячейки
6. **select_list** — выбор из dropdown в ячейках

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
POST   /api/auth/refresh           # Обновить access token

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
PUT    /api/tests/:id              # Обновить тест
DELETE /api/tests/:id              # Удалить тест
POST   /api/tests/:id/questions    # Добавить вопрос
PUT    /api/tests/:id/questions/:qid  # Обновить вопрос
DELETE /api/tests/:id/questions/:qid  # Удалить вопрос

POST   /api/assignments            # Создать назначение
GET    /api/assignments/by-link/:link  # Получить по ссылке
GET    /api/assignments/classroom/:id  # Назначения для класса

POST   /api/attempts/start         # Начать попытку
POST   /api/attempts/:id/answer    # Отправить ответ
POST   /api/attempts/:id/finish    # Завершить попытку
GET    /api/attempts/:id           # Получить попытку
GET    /api/attempts/journal/:classroomId  # Журнал класса
```

## Дизайн-система

### Философия дизайна
Ориентир — **Яндекс Учебник**: чистый, светлый интерфейс с карточками, минималистичная навигация, pill-кнопки для выбора класса, цветные метки-теги. Но цветовая палитра — **своя** (синий accent #2563eb).

### Ключевые паттерны из Яндекс Учебника для нашей реализации:
- **Навигация:** фиксированный header с логотипом, навигацией и кнопками входа. На мобильных — bottom tab bar
- **Каталог:** pill-кнопки выбора класса (5-11), карточки тестов с цветными акцентами
- **Карточки:** белый фон, скругленные углы (10-14px), тонкая рамка, цветная полоска слева для обозначения класса
- **Типографика:** чёткая иерархия — display, title, subtitle, body, caption, label
- **Кнопки:** primary (синий), secondary (рамка), ghost (прозрачный), danger
- **Формы:** скруглённые inputs с focus ring
- **Журнал:** таблица с цветовыми бейджами (зелёный >70%, жёлтый 40-70%, красный <40%)
- **Скелетоны:** placeholder-блоки при загрузке

### CSS Variables (globals.css)
- Accent: `--color-accent` (#2563eb синий)
- Surfaces: `--color-surface` (белый), `--color-surface-2` (серо-голубой фон), `--color-surface-3`
- Text: `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`
- Semantic: `--color-ok` (зелёный), `--color-warn` (жёлтый), `--color-danger` (красный)
- Per-grade: `--color-g5` через `--color-g11` — цветные полоски для каждого класса

### CSS-классы компонентов
- `.card`, `.card-lg` — карточки
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-sm`, `.btn-lg` — кнопки
- `.input`, `.input-mono`, `.label` — формы
- `.t-display`, `.t-title`, `.t-subtitle`, `.t-body`, `.t-caption`, `.t-label` — типографика
- `.grade-strip`, `.grade-5`…`.grade-11` — акцентные полоски классов
- `.answer-option`, `.answer-option.selected` — варианты ответов
- `.journal-table`, `.score-badge`, `.score-high/med/low` — журнал
- `.q-btn`, `.q-btn.current/saved/answered` — навигация по вопросам
- `.tab-bar`, `.tab-btn` — вкладки
- `.spinner`, `.progress-bar` — индикаторы

## Журнал учителя
Табличный вид: строки — ученики, столбцы — тесты. В ячейках: время/результат%. Столбец "Средняя" — средний балл ученика.

## Структура контента
Главная: карточки классов (5-11) → список тестов по тематическому планированию → просмотр содержимого теста.

## Демо-данные (seed.py)
- Учитель: `teacher` / `teacher123`
- Тесты для классов 5-11 по тематическому планированию УМК Босова
- Примеры вопросов (4 типа) для теста 01 за 5 класс

## Ключевые файлы
- `CLAUDE.md` — этот файл
- `PLAN.md` — пошаговый план реализации (10 фаз)
- `projectinfo/` — ТЗ (2 PDF) и скриншоты Яндекс Учебника (image1-3.png)
- `docker-compose.yml` — PostgreSQL 16
- `backend/` — Flask API
- `frontend/` — Next.js приложение

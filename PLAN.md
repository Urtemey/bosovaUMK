# План реализации платформы boZoVa

## Фаза 1: Инфраструктура и базовая настройка

### 1.1 Инициализация проекта
- [x] Настроить Flask backend (`backend/`): структура папок, конфигурация, .env
- [x] Настроить Next.js frontend (`frontend/`): create-next-app с TypeScript + Tailwind
- [x] Настроить PostgreSQL, создать docker-compose (PostgreSQL + dev-окружение)
- [x] Настроить .gitignore, requirements.txt, package.json

### 1.2 Модели данных (SQLAlchemy)
- [x] `Teacher` — id, login, password_hash
- [x] `Classroom` — id, name, grade (5-11), teacher_id
- [x] `Student` — id, display_name, login (auto-generated), code (auto-generated), classroom_id
- [x] `Test` — id, title, grade, topic, created_by (teacher_id), settings (JSON)
- [x] `Question` — id, test_id, order, type (enum: single/multiple/input/matching/dragdrop), content (JSON), correct_answer (JSON), media
- [x] `TestAssignment` — id, test_id, classroom_id, student_id (nullable), share_link, settings_override (JSON), created_at
- [x] `TestAttempt` — id, assignment_id, student_id, started_at, finished_at, score_percent
- [x] `Answer` — id, attempt_id, question_id, student_answer (JSON), is_correct

- [x] Миграции через Flask-Migrate (Alembic)

---

## Фаза 2: Авторизация и управление классами

### 2.1 Авторизация учителя
- [x] Регистрация/вход учителя (login + password)
- [x] JWT-аутентификация (access + refresh tokens)
- [x] Middleware авторизации для защищенных endpoint-ов

### 2.2 Система классов (Яндекс-стиль)
- [x] API: создание класса (POST /api/classrooms)
- [x] Автогенерация логинов и кодов для учеников (без персональных данных)
- [x] API: добавление учеников в класс, генерация карточек с логином/кодом
- [x] API: вход ученика по логину + коду
- [x] Frontend: страница создания класса, список учеников, печать карточек

---

## Фаза 3: Каталог тестов и структура контента

### 3.1 Каталог по классам
- [x] API: CRUD для тестов (привязка к классу 5-11 и теме)
- [x] API: получение списка тестов по классу (GET /api/tests?grade=5)
- [x] Frontend: главная страница с плашками классов (5-11)
- [x] Frontend: при клике на класс — список тестов по тематическому планированию
- [x] Frontend: превью содержимого теста

### 3.2 Seed-данные
- [x] Заполнить начальный набор тестов по тематическому планированию для каждого класса (хотя бы структура/заголовки)

---

## Фаза 4: Типы заданий (ядро)

### 4.1 Компоненты вопросов (Frontend)
- [x] `SingleChoiceQuestion` — radio buttons, поддержка изображений в вариантах
- [x] `MultipleChoiceQuestion` — checkboxes
- [x] `TextInputQuestion` — поле ввода (одиночное + табличный вариант)
- [x] `MatchingQuestion` — drag-and-drop соединение линиями (левый-правый столбец)
- [x] `DragDropQuestion` — перетаскивание элементов в ячейки
- [x] `SelectFromListQuestion` — dropdown в ячейках таблицы

### 4.2 Логика проверки ответов (Backend)
- [x] Валидатор для каждого типа вопроса
- [x] Единый API проверки: POST /api/attempts/{id}/submit
- [x] Подсчет процента правильных ответов
- [x] Фиксация времени начала/окончания

### 4.3 Навигация по вопросам
- [x] Sidebar с номерами вопросов (1, 2, 3...N)
- [x] Кнопка "Подтвердить ответ"
- [x] Цветовая индикация: отвеченные / текущий / пропущенные

---

## Фаза 5: Прохождение теста (ученик)

### 5.1 Интерфейс прохождения
- [x] Страница теста: вопрос + навигация + таймер
- [x] Последовательное прохождение вопросов
- [x] Сохранение промежуточных ответов (на случай разрыва соединения)
- [x] Кнопка завершения теста

### 5.2 Результаты ученика
- [x] Страница результатов: процент, время начала/окончания, длительность
- [x] Список вопросов с цветовой индикацией (зеленый = верно, красный = неверно)
- [x] Просмотр неверно выполненных заданий (БЕЗ показа правильных ответов)

---

## Фаза 6: Журнал учителя

### 6.1 Табличное представление
- [x] API: получение результатов класса по всем тестам
- [x] Frontend: таблица-журнал (строки=ученики, столбцы=тесты)
- [x] Ячейки: время/процент с цветовой кодировкой (зеленый >70%, желтый 40-70%, красный <40%)
- [x] Столбец "Средняя" — средний балл ученика
- [x] Прокрутка по горизонтали для большого количества тестов

---

## Фаза 7: Выдача заданий

### 7.1 Через платформу
- [x] API: Выдача теста всему классу
- [x] API: Выдача теста отдельному ученику
- [x] API: Настройки при выдаче (перемешивание, попытки, показ ответов и т.д.)
- [x] Frontend: UI выдачи теста классу/ученику из страницы теста (модальное окно)
- [x] Frontend: список выданных заданий в классе (вкладка "Задания")

### 7.2 По прямой ссылке
- [x] API: Генерация уникальной ссылки на тест (без регистрации)
- [x] API: Получение теста по ссылке
- [x] Frontend: страница прохождения теста по ссылке `/share/[link]` (анонимно или с вводом имени)
- [x] Frontend: копирование ссылки для учителя (кнопка "Копировать")

---

## Фаза 8: Редактор тестов (учитель)

### 8.1 Rich-text редактор условий
- [x] Интеграция TipTap для форматирования (жирный, курсив, подчеркивание, зачёркивание)
- [x] Поддержка формул (KaTeX) — алгебра логики, множества
- [x] Создание таблиц внутри условия
- [x] Вставка изображений (по URL)
- [x] Компонент HtmlContent для рендера rich-text в вопросах

### 8.2 Конструктор вопросов
- [x] UI для создания каждого типа вопроса (все 6 типов)
- [x] Указание правильных ответов
- [x] Предпросмотр вопроса (как видит ученик)
- [ ] Drag-and-drop сортировка вопросов в тесте (реализованы кнопки вверх/вниз)

### 8.3 Быстрое редактирование
- [x] Inline-редактирование существующих тестов
- [x] Дублирование теста (backend + frontend)
- [ ] Импорт вопросов

---

## Фаза 9: Адаптивный дизайн и полировка

### 9.1 Mobile-first
- [x] Адаптивная верстка всех страниц
- [ ] Touch-friendly drag-and-drop на мобильных
- [ ] Тестирование на разных разрешениях

### 9.2 UX-полировка
- [ ] Анимации и переходы
- [x] Loading states и skeleton screens
- [x] Обработка ошибок и пустых состояний
- [x] Уведомления (toast) — ToastProvider, showToast на всех ключевых страницах

---

## Фаза 10: Тестирование и деплой

### 10.1 Тесты
- [ ] Unit-тесты backend (pytest): модели, API endpoints, логика проверки
- [ ] Unit-тесты frontend (Jest): компоненты вопросов, формы
- [ ] E2E тесты: полный цикл (создание теста -> выдача -> прохождение -> результаты)

### 10.2 Деплой
- [ ] Dockerfile для backend и frontend
- [ ] CI/CD pipeline
- [ ] Продакшн-конфигурация (gunicorn, nginx)

---

## Фаза 11: Деплой и инфраструктура

### 11.1 Облачное хранилище изображений

Изображения вопросов нужно хранить во внешнем облаке (загрузка из редактора → постоянный URL).
Требование: доступность из РФ без VPN.

**Варианты (все работают в РФ):**

| Сервис | Бесплатно | Стоимость | Примечание |
|---|---|---|---|
| **Timeweb S3** | 5 GB | ~150 ₽/50 GB | S3-совместимый, русский саппорт, низкий latency |
| **Selectel Object Storage** | — | ~1.5 ₽/GB/мес | S3-совместимый, дата-центры в РФ, CDN |
| **VK Cloud (Mail.ru) S3** | 5 GB | ~2 ₽/GB/мес | S3-совместимый, CDN, CORS поддержка |
| **Яндекс Object Storage** | — | ~2.1 ₽/GB/мес | S3-совместимый, CDN, надёжно, но без бесплатного tier |

**Рекомендация: Timeweb S3** — если деплой и так на Timeweb, то единый провайдер,
минимальный latency, S3-совместимый API (boto3 / `@aws-sdk/client-s3`).

**Реализация:**
- [ ] Backend: endpoint `POST /api/media/upload` (multipart) → загружает файл в S3, возвращает публичный URL
- [ ] Backend: `app/services/storage.py` — обёртка над boto3 (S3-совместимый client)
- [ ] Frontend: в редакторе TipTap заменить "вставить по URL" на кнопку "Загрузить файл" → upload → вставить URL
- [ ] `.env`: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL`
- [ ] `docker-compose.override.yml`: для локальной разработки — MinIO (S3-совместимый, docker)

### 11.2 Деплой

**Схема:**
```
Браузер → Cloudflare → Timeweb (Next.js, порт 3000 за nginx)
                     → VPS (Flask/gunicorn, порт 5000 за nginx)
                     → Timeweb S3 (изображения, публичный bucket)
                     → VPS PostgreSQL (или Timeweb managed DB)
```

**Frontend (Next.js → Timeweb):**
- [ ] `next.config.ts`: `output: 'standalone'` для docker-деплоя
- [ ] `Dockerfile` (frontend): multi-stage build, Node 20-alpine
- [ ] nginx конфиг: reverse proxy на 3000, gzip, cache для статики

**Backend (Flask → VPS):**
- [ ] `Dockerfile` (backend): Python 3.12-slim, gunicorn
- [ ] `gunicorn.conf.py`: workers = 2*(CPU)+1, worker_class gevent
- [ ] nginx конфиг: reverse proxy на 5000, HTTPS, rate limiting
- [ ] `.env.production`: все секреты, `DATABASE_URL`, `S3_*`, `JWT_SECRET_KEY`
- [ ] `flask db upgrade` в entrypoint или отдельный init-container

**docker-compose (production-like):**
- [ ] Единый `docker-compose.prod.yml`: frontend + backend + nginx + (опционально postgres)

### 11.3 Cloudflare и безопасность

**Cloudflare в РФ:**
Cloudflare работает из России — их edge-серверы доступны напрямую, услуги не заблокированы.
Нет проблем ни с Free, ни с Pro планом. DNS, CDN, SSL — всё работает.

**Что подключить:**
- [ ] Перенести DNS домена на Cloudflare (free tier достаточно)
- [ ] SSL/TLS: Full (strict) — Cloudflare ↔ сервер тоже по HTTPS (self-signed cert на сервере)
- [ ] **WAF rules** (free tier): защита от SQLi, XSS, сканеров
- [ ] **Rate limiting**: `/api/auth/*` — max 10 req/min per IP (защита от брутфорса логинов)
- [ ] **Bot Fight Mode**: включить (free)
- [ ] `ALLOWED_ORIGINS` в Flask CORS: только домен через Cloudflare, не `"*"`
- [ ] HTTP Security Headers (через nginx или Cloudflare Transform Rules):
  - `Strict-Transport-Security: max-age=31536000`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] JWT-секреты: минимум 32 байта случайных символов, ротация через env

---

## Приоритеты
1. **MVP (Фазы 1-5):** ~~Базовый функционал~~ **ГОТОВО**
2. **Core (Фазы 6-7):** ~~Журнал + выдача~~ **ГОТОВО**
3. **Advanced (Фазы 8-9):** ~~Редактор~~ **ГОТОВО**, полировка — в основном готова
4. **Production (Фаза 10):** Тесты, деплой
5. **Infrastructure (Фаза 11):** Облако (Timeweb S3/MinIO), Cloudflare, production-деплой

# db/

Подготовка к версии 5.8 (см. `docs/ROADMAP-5.8.md`, `docs/DB-MIGRATION-5.8.md`). **В приложении сейчас не используется.**

- `migrations/001_init.sql` — таблицы облака, правила доступа, триггер профиля, лимит переписки.
- `migrations/002_records_sync.sql` — синхронизация по записям (`records`, `documents`).

Применять по порядку на тестовом проекте Supabase (SQL Editor). Каждая миграция записывает себя в `schema_migrations`.

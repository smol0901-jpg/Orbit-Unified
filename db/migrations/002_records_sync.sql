-- Контур · миграция 002 · синхронизация данных по записям. Для версии 5.8. Применять после 001.

-- Одна таблица для всех типов записей: встречи, задачи, маршруты, контакты и т. д.
-- id — текст (локальные идентификаторы uid() не являются UUID).
create table if not exists public.records (
  owner      uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in (
               'lesson','club','bus','note','homework','goal','person','holiday','daylog','event','reminder',
               'script','habit','knowledge')),
  id         text not null,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,                       -- «надгробие»: запись удалена, но клиентам нужно об этом узнать
  primary key (owner, kind, id)
);
create index if not exists records_owner_updated on public.records (owner, updated_at);

-- Документы целиком: настройки, профиль, память агента, отметки «что взять».
create table if not exists public.documents (
  owner      uuid not null references auth.users(id) on delete cascade,
  name       text not null check (name in ('settings','profile','packChecks','agent-memory')),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner, name)
);

-- updated_at ставит сервер при каждом изменении (клиентским часам не доверяем)
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch   before update on public.records   for each row execute function public.touch_updated_at();
drop trigger if exists documents_touch on public.documents;
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();

alter table public.records   enable row level security;
alter table public.documents enable row level security;
create policy records_own   on public.records   for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy documents_own on public.documents for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- Забрать изменения с момента последней синхронизации:
--   select * from records where owner = auth.uid() and updated_at > :since order by updated_at;
-- Физическая очистка «надгробий» старше 90 дней (запускать по расписанию):
--   delete from records where deleted_at < now() - interval '90 days';

insert into public.schema_migrations (version) values ('002') on conflict do nothing;

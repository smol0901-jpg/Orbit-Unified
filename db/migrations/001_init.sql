-- Контур · миграция 001 · базовая схема облака (под js/orbit/cloud.js). Для версии 5.8. СУБД: Postgres (Supabase).
-- Применять на ТЕСТОВОМ проекте; перед боевым — проверить политики двумя тестовыми пользователями.

create table if not exists public.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);

-- ───────── профили ─────────
-- публичная часть: видна всем вошедшим (поиск друзей)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '',
  last_seen  timestamptz,
  created_at timestamptz not null default now()
);
-- приватная часть: только владелец (state — резервная копия состояния целиком, push_sub — подписка на уведомления)
create table if not exists public.profile_private (
  id       uuid primary key references auth.users(id) on delete cascade,
  state    jsonb,
  push_sub text
);

-- ───────── переписка с агентом ─────────
create table if not exists public.chat_messages (
  id      bigint generated always as identity primary key,
  uid     uuid not null references auth.users(id) on delete cascade,
  role    text not null check (role in ('user', 'bot')),
  content text not null,
  at      timestamptz not null default now(),
  bytes   integer generated always as (octet_length(content)) stored
);
create index if not exists chat_messages_uid_at on public.chat_messages (uid, at desc);

-- ───────── общая стена ─────────
create table if not exists public.wall_posts (
  id         bigint generated always as identity primary key,
  author     uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) <= 4000),
  kind       text not null default 'user' check (kind in ('user', 'bot')),
  created_at timestamptz not null default now()
);
create index if not exists wall_posts_created on public.wall_posts (created_at desc);

-- ───────── друзья ─────────
create table if not exists public.friendships (
  id         bigint generated always as identity primary key,
  requester  uuid not null references auth.users(id) on delete cascade,
  addressee  uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (requester, addressee),
  check (requester <> addressee)
);

-- ───────── личные сообщения ─────────
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  sender     uuid not null references auth.users(id) on delete cascade,
  recipient  uuid not null references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) <= 4000),
  read       boolean not null default false,
  created_at timestamptz not null default now(),
  check (sender <> recipient)
);
create index if not exists messages_pair on public.messages (sender, recipient, created_at);

-- ───────── расписания (cron + push) ─────────
create table if not exists public.script_jobs (
  id          uuid primary key default gen_random_uuid(),
  uid         uuid not null references auth.users(id) on delete cascade,
  script_id   text,
  name        text not null default '',
  cron        text not null default '',
  at          timestamptz,
  days        integer[] not null default '{}',
  time_of_day text not null default '',
  push_title  text not null default '',
  push_body   text not null default '',
  enabled     boolean not null default true,
  last_run    timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists script_jobs_uid on public.script_jobs (uid, enabled);

-- ───────── автоматическое создание профиля при регистрации ─────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  insert into public.profile_private (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ───────── лимит переписки: оставить не более p_cap байт самых новых сообщений текущего пользователя ─────────
create or replace function public.prune_chat_messages(p_cap bigint default 104857600) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then return 0; end if;
  with ranked as (
    select id, sum(bytes) over (order by at desc, id desc) as running
    from public.chat_messages where uid = auth.uid()
  ), del as (
    delete from public.chat_messages where id in (select id from ranked where running > p_cap) returning 1
  ) select count(*) into n from del;
  return n;
end $$;
revoke all on function public.prune_chat_messages(bigint) from public;
grant execute on function public.prune_chat_messages(bigint) to authenticated;

-- ───────── безопасность строк (RLS) ─────────
alter table public.profiles        enable row level security;
alter table public.profile_private enable row level security;
alter table public.chat_messages   enable row level security;
alter table public.wall_posts      enable row level security;
alter table public.friendships     enable row level security;
alter table public.messages        enable row level security;
alter table public.script_jobs     enable row level security;

create policy profiles_read    on public.profiles for select to authenticated using (true);
create policy profiles_insert  on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update  on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy private_all      on public.profile_private for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy chat_select      on public.chat_messages for select to authenticated using (uid = auth.uid());
create policy chat_insert      on public.chat_messages for insert to authenticated with check (uid = auth.uid());
create policy chat_delete      on public.chat_messages for delete to authenticated using (uid = auth.uid());

create policy wall_read        on public.wall_posts for select to authenticated using (true);
create policy wall_insert      on public.wall_posts for insert to authenticated with check (author = auth.uid());
create policy wall_delete      on public.wall_posts for delete to authenticated using (author = auth.uid());

create policy friends_select   on public.friendships for select to authenticated using (requester = auth.uid() or addressee = auth.uid());
create policy friends_insert   on public.friendships for insert to authenticated with check (requester = auth.uid() and status = 'pending');
create policy friends_update   on public.friendships for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid());
create policy friends_delete   on public.friendships for delete to authenticated using (requester = auth.uid() or addressee = auth.uid());

create policy dm_select        on public.messages for select to authenticated using (sender = auth.uid() or recipient = auth.uid());
create policy dm_insert        on public.messages for insert to authenticated with check (
  sender = auth.uid() and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = auth.uid() and f.addressee = recipient) or (f.addressee = auth.uid() and f.requester = recipient))
  ));
create policy dm_mark_read     on public.messages for update to authenticated using (recipient = auth.uid()) with check (recipient = auth.uid());
-- менять можно только отметку «прочитано»
revoke update on public.messages from authenticated;
grant  update (read) on public.messages to authenticated;
-- статус дружбы тоже: принять/отклонить может только адресат, остальные поля менять нельзя
revoke update on public.friendships from authenticated;
grant  update (status) on public.friendships to authenticated;

create policy jobs_all         on public.script_jobs for all to authenticated using (uid = auth.uid()) with check (uid = auth.uid());

insert into public.schema_migrations (version) values ('001') on conflict do nothing;

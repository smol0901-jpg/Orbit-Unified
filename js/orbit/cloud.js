/* Контур 5.4 · CLOUD — Supabase (по желанию): аккаунт, подтверждение e-mail, синхронизация переписки до 100 МБ,
   друзья, личные сообщения, общая стена (агент обучается на стене и пишет по просьбе), cron + push через Edge Function.
   ⚠ Возможны сбои: в некоторых регионах/сетях супабейс может не работать без ВПН. */
(function () {
  'use strict';
  const O = window.Orbit = window.Orbit || {};
  const E = O.engine, ic = O.ic;
  const esc = s => (O.esc ? O.esc(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  const C = () => O.core(), S = () => C().state, $ = id => document.getElementById(id);
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const CFG_KEY = 'orbit-sb-config-v1', SESS_KEY = 'orbit-sb-session-v1', OUTB_KEY = 'orbit-sb-outbox-v1';
  const MB = 1048576, CHAT_CAP = 100 * MB;          // до 100 МБ переписки в БД
  const LOCAL_MSG_CAP = 300;                          // локальная память агента — 300 сообщений
  const NET_HINT = 'Возможны сбои: Supabase в некоторых сетях не доступен без ВПН. Все данные при этом сохраняются локально.';

  const Cl = O.cloud = {
    sb: null, user: null, session: null, online: false, lastSyncAt: 0, lastError: '', wallLoaded: false, dmLoaded: false
  };

  /* ───── конфигурация и сессия (не чувствительные — анон key публичный по дизайну Supabase) ───── */
  const cfg = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (e) { return null; } };
  const setCfg = c => { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {} };
  const getSess = () => { try { return JSON.parse(localStorage.getItem(SESS_KEY) || 'null'); } catch (e) { return null; } };
  const setSess = s => { try { if (s) localStorage.setItem(SESS_KEY, JSON.stringify(s)); else localStorage.removeItem(SESS_KEY); } catch (e) {} };
  Cl.cfg = cfg;
  Cl.enabled = () => !!cfg();
  Cl.logged = () => !!(Cl.user && Cl.user.id);
  Cl.statusLine = () => {
    if (!Cl.enabled()) return 'Облако не подключено (агент помнит 300 сообщений локально)';
    if (!Cl.logged()) return 'Облако настроено — нужен вход';
    return (Cl.online ? 'Облако: онлайн' : 'Облако: офлайн (работаем локально)') + ' · ' + (Cl.user.email || '');
  };

  /* ───── загрузка SDK (браузер, UMD глобальная) ───── */
  let sdkPromise = null;
  function loadSdk() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('Не удалось загрузить Supabase SDK (нет сети? Нужен ВПН?)')), 15000);
      const s = document.createElement('script');
      s.src = CDN; s.async = true;
      s.onload = () => { clearTimeout(t); res(window.supabase); };
      s.onerror = () => { clearTimeout(t); rej(new Error('Supabase SDK не загрузился: проверьте сеть' + (/^(ru|by)$/i.test(Intl.DateTimeFormat().resolvedOptions().timeZone.split('/')[0]) ? ' — возможно, нужен ВПН' : ''))); };
      document.head.appendChild(s);
    });
    return sdkPromise;
  }
  async function client() {
    if (Cl.sb) return Cl.sb;
    const c = cfg(); if (!c) throw new Error('Супабейс не подключён');
    const sb = await loadSdk();
    Cl.sb = sb.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'orbit-sb-auth' } });
    try {
      const { data } = await Cl.sb.auth.getSession();
      if (data && data.session) { Cl.session = data.session; Cl.user = data.session.user; Cl.online = true; }
    } catch (e) {}
    return Cl.sb;
  }
  async function withTimeout(p, ms) {
    return await Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Таймаут сети к Supabase — возможны сбои, нужен ВПН?')), ms))]);
  }
  async function api(fnLabel, fn) {
    try {
      const cl = await client();
      const r = await withTimeout(fn(cl), 12000);
      if (r && r.error) throw new Error(r.error.message || 'Ошибка Supabase');
      Cl.online = true; Cl.lastError = '';
      return r;
    } catch (e) {
      Cl.online = false; Cl.lastError = (e && e.message) || String(e);
      console.warn('[cloud]', fnLabel, Cl.lastError);
      throw e;
    }
  }

  /* ───── SQL схема (вставляется один раз в Supabase → SQL Editor) ───── */
  Cl.SQL_SCHEMA = `-- Контур · Cloud: чат-память, друзья, ЛС, стена, расписания сценариев (RLS включена)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text default '', created_at timestamptz default now(), last_seen timestamptz default now());
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  uid uuid not null references auth.users on delete cascade,
  role text not null, content text not null, at timestamptz default now());
create index if not exists chat_uid_at on public.chat_messages (uid, at desc);
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users on delete cascade,
  addressee uuid not null references auth.users on delete cascade,
  status text not null default 'pending', created_at timestamptz default now(),
  unique (requester, addressee));
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null references auth.users on delete cascade,
  recipient uuid not null references auth.users on delete cascade,
  body text not null, read boolean default false, created_at timestamptz default now());
create index if not exists msg_pair on public.messages (sender, recipient, created_at);
create table if not exists public.wall_posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references auth.users on delete cascade,
  body text not null, kind text default 'user', created_at timestamptz default now());
create table if not exists public.script_jobs (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null references auth.users on delete cascade,
  script_id text not null, name text default '', cron text default '',
  at timestamptz, days int[] default '{}', time_of_day text default '',
  push_title text default '', push_body text default '', enabled boolean default true,
  last_run timestamptz, next_run timestamptz);
alter table public.profiles enable row level security;
alter table public.chat_messages enable row level security;
alter table public.friendships enable row level security;
alter table public.messages enable row level security;
alter table public.wall_posts enable row level security;
alter table public.script_jobs enable row level security;
create policy "profile self" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "profile read friends" on public.profiles for select using (true);
create policy "chat own" on public.chat_messages for all using (auth.uid() = uid) with check (auth.uid() = uid);
create policy "friends req" on public.friendships for all using (auth.uid() = requester or auth.uid() = addressee) with check (auth.uid() = requester);
create policy "dm own" on public.messages for all using (auth.uid() = sender or auth.uid() = recipient) with check (auth.uid() = sender);
create policy "wall read" on public.wall_posts for select using (true);
create policy "wall write" on public.wall_posts for insert with check (auth.uid() = author);
create policy "jobs own" on public.script_jobs for all using (auth.uid() = uid) with check (auth.uid() = uid);`;

  Cl.SQL_EDGE = `-- Edge Function для cron (Supabase → Functions → New "agent-push") + Scheduler:
-- import { serve } from "https://deno.land/std/http/server.ts";
-- Deno.cron("contour-scripts", "*/5 * * * *", async () => {
--   const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
--   const { data: jobs } = await sb.from('script_jobs')
--     .select('*').eq('enabled', true).lte('next_run', new Date().toISOString());
--   for (const j of jobs || []) {
--     await sb.from('script_jobs').update({ last_run: new Date().toISOString() }).eq('id', j.id);
--     // доставляем сообщение самому себе: приложение на другом устройстве подтянет из chat_messages
--     await sb.from('chat_messages').insert({ uid: j.uid, role: 'bot', content: '⏰ Сценарий «' + j.name + '»: ' + (j.push_body || 'запущен') });
--     // web-push: fetch(VAPID_ENDPOINT, {...}) — подписку присылает sw.js при подключении облака
--   }
-- });`;

  /* ───── регистрация / вход / подтверждение почты ───── */
  Cl.signUp = async function (email, password, name) {
    const r = await api('signup', cl => cl.auth.signUp({ email, password, options: { data: { name: name || '' } } }));
    if (r.data.user) {
      Cl.user = r.data.user;
      if (r.data.session) { Cl.session = r.data.session; setSess(exportSess(r.data.session)); }
      else Cl.pendingConfirmEmail = email;
    }
    return r;
  };
  Cl.confirmSent = () => !!Cl.pendingConfirmEmail;
  Cl.resend = () => api('resend', cl => cl.auth.resend({ type: 'signup', email: Cl.pendingConfirmEmail || (Cl.user && Cl.user.email) || '' }));
  Cl.signIn = async function (email, password) {
    const r = await api('signin', cl => cl.auth.signInWithPassword({ email, password }));
    if (r.data.session) { Cl.session = r.data.session; Cl.user = r.data.user; setSess(exportSess(r.data.session)); await ensureProfile(); startRealtime(); }
    return r;
  };
  Cl.signOut = async function () {
    try { if (Cl.sb) await Cl.sb.auth.signOut(); } catch (e) {}
    Cl.user = null; Cl.session = null; setSess(null); stopRealtime();
  };
  function exportSess(s) { return { token: s.access_token, refresh: s.refresh_token, exp: s.expires_at }; }
  Cl.restore = async function () {
    const c = cfg(); if (!c) return false;
    try {
      const cl = await client();
      const { data } = await cl.auth.getSession();
      if (data && data.session && data.session.user) {
        Cl.session = data.session; Cl.user = data.session.user; Cl.online = true;
        setSess(exportSess(data.session)); startRealtime(); pullChat(true).catch(() => {});
        return true;
      }
      const st = getSess();
      if (st && st.token && (!st.exp || st.exp * 1000 > Date.now())) {
        try { const { data: u } = await cl.auth.getUser(st.token); if (u && u.user) { Cl.user = u.user; Cl.online = true; startRealtime(); return true; } } catch (e) {}
      }
    } catch (e) { Cl.lastError = e.message; }
    return false;
  };
  async function ensureProfile() {
    if (!Cl.user) return;
    try {
      await api('profile', cl => cl.from('profiles').upsert({ id: Cl.user.id, name: (Cl.user.user_metadata && Cl.user.user_metadata.name) || S().profile.name || '', last_seen: new Date().toISOString() }, { onConflict: 'id' }));
    } catch (e) {}
  }

  /* ───── чат: полная переписка в БД (до 100 МБ), локально — окно 300 ───── */
  const encMsg = m => ({ uid: Cl.user.id, role: m.role === 'user' ? 'user' : 'bot', content: String(m.text || '').slice(0, 8000), at: new Date(m.at || Date.now()).toISOString() });
  const decMsg = r => ({ role: r.role === 'user' ? 'user' : 'bot', text: String(r.content || ''), at: Date.parse(r.at) || Date.now() });
  async function pushBatch(rows) {
    if (!rows.length) return;
    await api('pushChat', cl => cl.from('chat_messages').insert(rows));
  }
  Cl.pushMsg = async function (m) {
    if (!Cl.logged()) return;
    try { await pushBatch([encMsg(m)]); }
    catch (e) { enqueue({ t: 'msg', m }); }
  };
  async function pullChat(replace) {
    if (!Cl.logged()) return 0;
    const A = O.assistant; if (!A) return 0;
    const r = await api('pullChat', cl => cl.from('chat_messages').select('role,content,at').eq('uid', Cl.user.id).order('at', { ascending: false }).limit(4000));
    const rows = ((r && r.data) || []).slice().reverse().map(decMsg);
    if (replace && rows.length) {
      A.msgs = rows.slice(-LOCAL_MSG_CAP);
      if (O.work && O.work.saveMem) { const mem = O.work.loadMem(); mem.msgs = rows.slice(-LOCAL_MSG_CAP); O.work.saveMem(mem); }
      A.render(false);
    }
    Cl.lastSyncAt = Date.now();
    return rows.length;
  }
  Cl.pullChat = pullChat;
  Cl._api = api;   // для cron.js и других модулей
  /* загрузка заданий cron из облака (после логина): локальные id сверяются со script_jobs */
  Cl.pullJobs = async function () {
    if (!Cl.logged() || !O.cron) return 0;
    const r = await api('jobs', cl => cl.from('script_jobs').select('*').eq('uid', Cl.user.id).eq('enabled', true));
    const rows = (r && r.data) || [], have = new Set(O.cron.list().map(j => j.script_id || j.id));
    let added = 0;
    for (const row of rows) {
      if (have.has(row.script_id)) continue;
      O.cron.add({ name: row.name || 'Задание', kind: row.time_of_day ? ((row.days || []).length ? 'weekly' : 'daily') : 'once',
        time: row.time_of_day || '08:00', days: row.days, cmd: row.push_body || 'что дальше', scriptId: row.script_id,
        pushTitle: row.push_title, pushBody: row.push_body });
      added++;
    }
    return added;
  };
  Cl.syncNow = async function () {
    if (!Cl.logged()) throw new Error('Войдите в облако');
    const outb = flushOutbox();
    await Promise.all([outb, pushAllMissing(), pullChat(false)]);
    Cl.lastSyncAt = Date.now();
    syncStateBlob().catch(() => {});
    Cl.pullJobs().catch(() => {});
    return true;
  };
  async function pushAllMissing() {
    const A = O.assistant; if (!A || !A.msgs) return;
    const r = await api('recentCloud', cl => cl.from('chat_messages').select('at').eq('uid', Cl.user.id).order('at', { ascending: false }).limit(1000));
    const have = new Set(((r && r.data) || []).map(x => Math.floor(Date.parse(x.at) / 1000)));
    const missing = A.msgs.filter(m => !have.has(Math.floor((m.at || 0) / 1000))).map(encMsg);
    // режем сверху по объёму, чтобы суммарно ≤ 100 МБ
    let bytes = JSON.stringify(missing).length, cut = 0;
    while (bytes > CHAT_CAP && cut < missing.length - 1) { bytes -= (missing[cut].content || '').length + 64; cut++; }
    await pushBatch(missing.slice(cut));
  }
  /* основной стейт приложения тоже едет в облако (через profiles.state, если колонка есть) */
  async function syncStateBlob() {
    try {
      const s = JSON.parse(JSON.stringify(S()));
      (s.notes || []).forEach(n => { delete n.audio; }); if (s.profile) s.profile.photo = '';
      const blob = JSON.stringify(s);
      if (blob.length > 4.5 * MB) return; // слишком большое — только чат
      await api('state', cl => cl.from('profiles').update({ state: blob, last_seen: new Date().toISOString() }).eq('id', Cl.user.id));
    } catch (e) { /* колонки state может не быть — не критично */ }
  }
  Cl.pullState = async function () {
    const r = await api('pullState', cl => cl.from('profiles').select('state').eq('id', Cl.user.id).single());
    const blob = r && r.data && r.data.state;
    if (!blob) return false;
    try { C().setState(JSON.parse(blob)); C().toast('Данные загружены из облака'); return true; } catch (e) { return false; }
  };

  /* ───── outbox: очередь на случай сбоя сети / отсутствия ВПН ───── */
  const readOutb = () => { try { return JSON.parse(localStorage.getItem(OUTB_KEY) || '[]'); } catch (e) { return []; } };
  const writeOutb = l => { try { localStorage.setItem(OUTB_KEY, JSON.stringify(l.slice(-500))); } catch (e) {} };
  function enqueue(item) { const l = readOutb(); l.push(item); writeOutb(l); }
  Cl.enqueueWall = body => enqueue({ t: 'wall', body });
  Cl.enqueueDm = (to, body) => enqueue({ t: 'dm', to, body });
  async function flushOutbox() {
    const l = readOutb(); if (!l.length || !Cl.logged()) return;
    const rest = [];
    for (const it of l) {
      try {
        if (it.t === 'msg') await pushBatch([encMsg(it.m)]);
        else if (it.t === 'wall') await api('wallOut', cl => cl.from('wall_posts').insert({ author: Cl.user.id, body: it.body, kind: 'user' }));
        else if (it.t === 'dm') await api('dmOut', cl => cl.from('messages').insert({ sender: Cl.user.id, recipient: it.to, body: it.body }));
      } catch (e) { rest.push(it); }
    }
    writeOutb(rest);
  }
  setInterval(() => { if (Cl.logged()) flushOutbox().catch(() => {}); }, 60000);

  /* ───── друзья ───── */
  Cl.friends = [];
  Cl.invitesIn = []; Cl.invitesOut = [];
  Cl.searchUsers = async function (q) {
    const r = await api('search', cl => cl.from('profiles').select('id,name,last_seen').neq('id', Cl.user.id).limit(20));
    const n = E.N(q || '');
    return ((r && r.data) || []).filter(p => !n || E.N(p.name || '').includes(n) || (p.id || '').startsWith(n)).slice(0, 10);
  };
  Cl.addFriend = async function (idOrEmail) {
    let id = idOrEmail;
    if (/@/.test(idOrEmail)) {
      const r = await api('byEmail', cl => cl.from('profiles').select('id').limit(1)); // email не в profiles — ищем через поиск
      const list = await Cl.searchUsers(''); id = (list.find(p => p.id === idOrEmail) || {}).id;
      if (!id) throw new Error('Не нашёл пользователя по e-mail. Попросите его имя из профиля или ID.');
      void r;
    }
    await api('friendAdd', cl => cl.from('friendships').insert({ requester: Cl.user.id, addressee: id, status: 'pending' }));
    Cl.loadFriends().catch(() => {});
  };
  Cl.respondInvite = async function (id, accept) {
    await api('friendResp', cl => cl.from('friendships').update({ status: accept ? 'accepted' : 'declined' }).eq('id', id));
    Cl.loadFriends().catch(() => {});
  };
  Cl.loadFriends = async function () {
    const r = await api('friends', cl => cl.from('friendships').select('*').or(`requester.eq.${Cl.user.id},addressee.eq.${Cl.user.id}`));
    const rows = (r && r.data) || [];
    Cl.invitesIn = rows.filter(x => x.addressee === Cl.user.id && x.status === 'pending');
    Cl.invitesOut = rows.filter(x => x.requester === Cl.user.id && x.status === 'pending');
    const ids = [...new Set(rows.filter(x => x.status === 'accepted').map(x => x.requester === Cl.user.id ? x.addressee : x.requester))];
    Cl.friends = [];
    for (const id of ids) {
      try { const p = await api('fprof', cl => cl.from('profiles').select('id,name,last_seen').eq('id', id).single()); if (p && p.data) Cl.friends.push(p.data); } catch (e) {}
    }
    return Cl.friends;
  };

  /* ───── личные сообщения ───── */
  Cl.dms = {};
  Cl.sendDm = async function (toId, body) {
    try {
      await api('dm', cl => cl.from('messages').insert({ sender: Cl.user.id, recipient: toId, body: String(body).slice(0, 4000) }));
    } catch (e) { Cl.enqueueDm(toId, body); C().toast('Отправлено в очередь: нет связи с облаком'); }
    (Cl.dms[toId] = Cl.dms[toId] || []).push({ me: true, body, at: Date.now() });
  };
  Cl.loadDm = async function (peerId) {
    const r = await api('dmList', cl => cl.from('messages').select('sender,body,created_at').or(`sender.eq.${peerId},recipient.eq.${peerId}`).order('created_at', { ascending: true }).limit(500));
    Cl.dms[peerId] = ((r && r.data) || []).map(x => ({ me: x.sender === Cl.user.id, body: x.body, at: Date.parse(x.created_at) }));
    try { await api('dmRead', cl => cl.from('messages').update({ read: true }).eq('sender', peerId).eq('recipient', Cl.user.id).eq('read', false)); } catch (e) {}
    return Cl.dms[peerId];
  };

  /* ───── общая стена (агент читает её для обучения и пишет по просьбе) ───── */
  Cl.wall = [];
  Cl.loadWall = async function () {
    const r = await api('wall', cl => cl.from('wall_posts').select('author,body,kind,created_at').order('created_at', { ascending: false }).limit(200));
    Cl.wall = ((r && r.data) || []).slice().reverse();
    Cl.wallLoaded = true;
    return Cl.wall;
  };
  Cl.postWall = async function (body, kind) {
    kind = kind || 'user';
    try {
      await api('wallPost', cl => cl.from('wall_posts').insert({ author: Cl.user.id, body: String(body).slice(0, 4000), kind }));
    } catch (e) { Cl.enqueueWall(body); C().toast('Стена: сообщение в очереди (нет связи / нужен ВПН?)'); }
    Cl.wall.push({ author: Cl.user.id, body: String(body).slice(0, 4000), kind, created_at: new Date().toISOString() });
  };
  /* обучение: выжимка стены в заметки памяти агента */
  Cl.learnFromWall = async function () {
    if (!Cl.wall.length) await Cl.loadWall().catch(() => {});
    const notes = Cl.wall.slice(-50).map(p => (p.kind === 'bot' ? '🤖' : '👥') + ' ' + String(p.body).slice(0, 140));
    if (!notes.length) return 0;
    if (O.work && O.work.loadMem) {
      const mem = O.work.loadMem();
      mem.facts = (mem.facts || []).concat([{ t: 'Общая стена (' + new Date().toLocaleDateString('ru-RU') + '):\n' + notes.join('\n'), at: Date.now() }]).slice(-60);
      O.work.saveMem(mem);
    }
    return notes.length;
  };

  /* ───── realtime (каналы могут быть отключены на бесплатном проекте — не критично) ───── */
  let chans = [];
  function stopRealtime() { chans.forEach(c => { try { Cl.sb && Cl.sb.removeChannel(c); } catch (e) {} }); chans = []; }
  function startRealtime() {
    if (!Cl.sb || !Cl.user) return;
    stopRealtime();
    try {
      const w = Cl.sb.channel('wall-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wall_posts' }, () => { Cl.loadWall().then(() => Cl.uiRefresh()).catch(() => {}); }).subscribe();
      const d = Cl.sb.channel('dm-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient=eq.${Cl.user.id}` }, p => {
        const b = p.new || {};
        (Cl.dms[b.sender] = Cl.dms[b.sender] || []).push({ me: false, body: b.body, at: Date.parse(b.created_at) || Date.now() });
        O.notify.show('Личное сообщение', String(b.body || '').slice(0, 80), 'dm' + b.sender);
        Cl.uiRefresh();
      }).subscribe();
      chans.push(w, d);
    } catch (e) {}
  }
  Cl.uiRefresh = function () {
    try { if (C().tab === 'cloud' && O.cloudPanelRender) O.cloudPanelRender(); } catch (e) {}
  };

  /* ───── push-подписка для серверного cron (Web Push через VAPID, ключ задаётся в конфиге) ───── */
  Cl.subscribePush = async function () {
    const c = cfg(); if (!c || !c.vapidPub || !('PushManager' in window)) return null;
    try {
      const reg = await navigator.serviceWorker.getRegistration(); if (!reg) return null;
      const url = c.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBuf(c.vapidPub) });
      await api('pushSub', cl => cl.from('profiles').update({ push_sub: JSON.stringify(sub) }).eq('id', Cl.user.id)).catch(() => {});
      return sub;
    } catch (e) { return null; }
  };
  function b64ToBuf(b64) { const s = b64.replace(/-/g, '+').replace(/_/g, '/'); const pad = s + '==='.slice((s.length + 3) % 4); const bin = atob(pad); return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer; }

  /* ══════════════ UI панели «Облако» ══════════════ */
  let view = 'home', dmPeer = null;
  Cl.setCfgDraft = function (url, key, vapid) { setCfg({ url, key, vapidPub: vapid }); Cl.sb = null; };
  Cl.wizardHtml = function () {
    const c = cfg() || {};
    return `<div class="cl-card o-ad-card"><h4>Подключение к Supabase</h4>
      <p class="o-note">${ic('info', 13)} Это дополнительная функция по желанию. Без облака агент работает полностью локально (память 300 сообщений).
      При подключении: аккаунт создаёте сами (e-mail + пароль), подтверждаете письмо — и агент запоминает <b>всю переписку до 100 МБ</b>, все данные синхронизируются, заходить можно с любого устройства.
      <br><b>⚠ Возможны сбои:</b> в некоторых случаях Supabase не работает без ВПН. Очередь (outbox) сохранит сообщения до восстановления связи.</p>
      <div class="form-group"><label>Project URL</label><input class="input" id="sb-url" value="${esc(c.url || '')}" placeholder="https://xxxx.supabase.co"></div>
      <div class="form-group"><label>anon / public key</label><input class="input" id="sb-key" value="${esc(c.key || '')}" placeholder="eyJ..."></div>
      <div class="form-group"><label>VAPID public key (для push от cron — необязательно)</label><input class="input" id="sb-vapid" value="${esc(c.vapidPub || '')}"></div>
      <div class="o-segs"><button class="o-btn" data-cl="save-cfg">Сохранить и проверить</button>
      <button class="o-btn ghost" data-cl="show-sql">SQL для схемы БД</button></div>
      <pre id="sb-sql" class="cl-sql hidden">${esc(Cl.SQL_SCHEMA)}</pre></div>`;
  };
  Cl.authHtml = function () {
    return `<div class="cl-card o-ad-card"><h4>Аккаунт Контур Cloud</h4>
      <p class="muted">Создайте аккаунт: e-mail + свой пароль → подтвердите письмо на почте → вся переписка и данные поедут в облако.</p>
      ${Cl.confirmSent() ? `<p class="o-note">✅ Аккаунт создан. Откройте почту <b>${esc(Cl.pendingConfirmEmail)}</b> и подтвердите регистрацию, затем войдите ниже. <button class="o-chip" data-cl="resend">Отправить письмо ещё раз</button></p>` : ''}
      <div class="form-group"><label>E-mail</label><input class="input" id="sb-email" type="email" autocomplete="email"></div>
      <div class="form-group"><label>Пароль (придумайте сами, минимум 6 символов)</label><input class="input" id="sb-pass" type="password" autocomplete="new-password"></div>
      <div class="form-group"><label>Имя в профиле</label><input class="input" id="sb-name" placeholder="Как вас видеть друзьям"></div>
      <div class="o-segs"><button class="o-btn pri" data-cl="signup">Создать аккаунт</button><button class="o-btn" data-cl="signin">Войти</button></div>
      <p id="sb-auth-msg" class="muted"></p></div>`;
  };
  Cl.homeHtml = function () {
    const s = S().settings || {};
    return `<div class="cl-card o-ad-card"><h4>${esc(Cl.user.email || 'Аккаунт')}</h4>
      <p class="muted">${esc(Cl.statusLine())} · ошибок в очереди: ${readOutb().length}</p>
      <div class="o-segs">
        <button class="o-btn" data-cl="sync">Синхронизировать сейчас</button>
        <button class="o-btn ghost" data-cl="pull-state">Загрузить данные с другого устройства</button>
        <button class="o-btn ghost" data-cl="view:friends">Друзья</button>
        <button class="o-btn ghost" data-cl="view:wall">Стена</button>
        <button class="o-btn ghost" data-cl="view:cron">Расписания + push</button>
        <button class="o-btn danger ghost" data-cl="signout">Выйти из облака</button>
      </div>
      <label class="o-sw" style="margin-top:10px"><input type="checkbox" data-sk="cloudAutoSync"${s.cloudAutoSync !== false ? ' checked' : ''}><i></i><span>Авто-синхронизация переписки каждые 2 минуты</span></label>
      <label class="o-sw" style="margin-top:6px"><input type="checkbox" data-sk="cloudAgentWall"${s.cloudAgentWall !== false ? ' checked' : ''}><i></i><span>Разрешить агенту читать стену для обучения и писать на неё по моей просьбе</span></label>
      </div>`;
  };
  Cl.friendsHtml = function () {
    const f = Cl.friends.map(p => `<div class="cl-row"><b>${esc(p.name || 'Без имени')}</b><small>${esc((p.id || '').slice(0, 8))}</small>
      <span><button class="o-chip" data-cl="dm:${p.id}">Написать</button><button class="o-chip" data-cl="ask-wall:${p.id}">Попросить агента написать другу</button></span></div>`).join('') || '<p class="muted">Пока нет друзей.</p>';
    const inv = Cl.invitesIn.map(i => `<div class="cl-row"><small>Приглашение от ${esc((i.requester || '').slice(0, 8))}</small><span><button class="o-chip" data-cl="acc:${i.id}">Принять</button><button class="o-chip" data-cl="rej:${i.id}">Отклонить</button></span></div>`).join('');
    return `<div class="cl-card o-ad-card"><h4>Добавить в друзья</h4>
      <div class="form-group row"><input class="input" id="sb-fq" placeholder="Имя друга или его ID"><button class="o-btn" data-cl="find">Найти</button></div>
      <div id="sb-fres"></div></div>
      <div class="cl-card o-ad-card"><h4>Приглашения</h4>${inv || '<p class="muted">Новых приглашений нет.</p>'}</div>
      <div class="cl-card o-ad-card"><h4>Мои друзья (${Cl.friends.length})</h4>${f}</div>`;
  };
  Cl.dmHtml = function () {
    const p = Cl.friends.find(x => x.id === dmPeer) || { id: dmPeer, name: 'Друг' };
    const msgs = (Cl.dms[dmPeer] || []).map(m => `<div class="o-m ${m.me ? 'me' : 'bot'}" style="max-width:80%;align-self:${m.me ? 'flex-end' : 'flex-start'}">${esc(m.body)}</div>`).join('');
    return `<div class="cl-card o-ad-card"><h4>${ic('message', 16)} ${esc(p.name || 'Диалог')}</h4>
      <button class="o-chip" data-cl="view:friends">← Друзья</button>
      <div class="cl-dm" id="cl-dm-list">${msgs || '<p class="muted">Сообщений пока нет.</p>'}</div>
      <div class="o-segs" style="margin-top:8px"><input class="input" id="sb-dm-text" placeholder="Личное сообщение…" style="flex:1"><button class="o-btn pri" data-cl="dm-send:${dmPeer}">Отправить</button></div>
      <p class="muted">Агент может отправить сообщение другу, если вы попросите его в чате: «отправь [имя] привет».</p></div>`;
  };
  Cl.wallHtml = function () {
    const names = {}; Cl.friends.concat([{ id: Cl.user.id, name: S().profile.name || 'Вы' }]).forEach(p => names[p.id] = p.name || 'Участник');
    const posts = Cl.wall.slice(-40).reverse().map(p => `<div class="cl-row cl-post ${p.kind === 'bot' ? 'cl-bot' : ''}">
      <b>${p.kind === 'bot' ? '🤖 Агент' : esc(names[p.author] || 'Участник')}</b><small>${new Date(p.created_at).toLocaleString('ru-RU')}</small>
      <p>${esc(p.body)}</p></div>`).join('') || '<p class="muted">Стена пуста.</p>';
    return `<div class="cl-card o-ad-card"><h4>Общая стена сообщества</h4>
      <p class="muted">Стену контролирует агент: он читает её для обучения и может публиковать по вашей просьбе («опубликуй на стене …»). Агентские посты помечены 🤖.</p>
      <div class="o-segs"><input class="input" id="sb-wall-text" placeholder="Что написать на стену?" style="flex:1"><button class="o-btn pri" data-cl="wall-post">Опубликовать</button></div>
      ${posts}</div>`;
  };
  Cl.cronHtml = function () {
    const jobs = O.cron ? O.cron.list() : [];
    return `<div class="cl-card o-ad-card"><h4>Cron и push-уведомления</h4>
      <p class="muted">Сценарии из редактора можно поставить на расписание. Пока приложение открыто — срабатывает локально; при подключённом облаке задание уходит в таблицу script_jobs, серверный cron (Edge Function + Scheduler) будит вас push-уведомлением даже с закрытым приложением.</p>
      <div class="o-segs"><button class="o-btn" data-cl="push-ask">Разрешить уведомления</button><button class="o-btn ghost" data-cl="push-sub">Подписаться на серверный push</button><button class="o-btn ghost" data-cl="show-edge">Код Edge Function</button></div>
      <pre id="sb-edge" class="cl-sql hidden">${esc(Cl.SQL_EDGE)}</pre>
      <div id="cl-jobs">${jobs.map(j => `<div class="cl-row"><b>${esc(j.name)}</b><small>${esc(j.cronText || j.cron || (j.at ? new Date(j.at).toLocaleString('ru-RU') : ''))}${j.pushTitle ? ' · 🔔 push' : ''} · ${j.enabled ? 'вкл' : 'выкл'}</small>
        <span><button class="o-chip" data-cr="toggle:${j.id}">⏯</button><button class="o-chip" data-cr="del:${j.id}">✕</button></span></div>`).join('') || '<p class="muted">Заданий нет. Добавьте в редакторе сценариев блок «🗓 Расписание» или кнопкой ниже.</p>'}</div>
      <div class="o-segs" style="margin-top:8px">
        <input class="input" id="cr-name" placeholder="Название" style="flex:1">
        <select class="input" id="cr-kind"><option value="daily">Каждый день в</option><option value="weekly">По дням недели в</option><option value="once">Один раз (дата+время)</option></select>
        <input class="input" id="cr-time" type="time" value="08:00">
        <input class="input" id="cr-date" type="date" style="display:none">
        <input class="input" id="cr-cmd" placeholder="Команда агенту (например: что взять завтра)" style="flex:1">
        <label class="o-sw"><input type="checkbox" id="cr-push"><i></i><span>Push-уведомление</span></label>
        <button class="o-btn pri" data-cl="cron-add">＋ Добавить задание</button>
      </div></div>`;
  };
  O.cloudPanelRender = function () {
    const root = $('cloud-root'); if (!root) return;
    const head = `<div class="cl-tabs">${[['home', '☁️ Облако'], ['friends', '👥 Друзья'], ['wall', '🧱 Стена'], ['cron', '⏰ Cron']].map(([v, l]) => `<button class="o-chip${view === v ? ' on' : ''}" data-cl="view:${v}">${l}</button>`).join('')}</div>`;
    let body = '';
    if (!Cl.enabled()) body = Cl.wizardHtml();
    else if (!Cl.logged()) body = Cl.wizardHtml() + Cl.authHtml();
    else if (view === 'home') body = Cl.homeHtml();
    else if (view === 'friends') body = Cl.friendsHtml();
    else if (view === 'dm') body = Cl.dmHtml();
    else if (view === 'wall') body = Cl.wallHtml();
    else if (view === 'cron') body = Cl.cronHtml();
    root.innerHTML = body + head;
    const kind = $('cr-kind'); if (kind) kind.onchange = () => { const d = $('cr-date'); if (d) d.style.display = kind.value === 'once' ? '' : 'none'; };
  };
  function renderTab() {
    const root = $('cloud-root'); if (!root) return;
    O.cloudPanelRender();
  }
  document.addEventListener('click', async e => {
    const cr = e.target.closest('[data-cr]');
    if (cr && O.cron) {
      const [a, id] = cr.dataset.cr.split(':');
      if (a === 'toggle') O.cron.toggle(id);
      else if (a === 'del') O.cron.del(id);
      O.cloudPanelRender && O.cloudPanelRender();
      return;
    }
    const b = e.target.closest('[data-cl]'); if (!b) return;
    const act = b.dataset.cl, [a, arg] = [act.split(':')[0], act.split(':')[1]];
    const msgEl = () => $('sb-auth-msg');
    try {
      if (a === 'save-cfg') {
        const url = $('sb-url').value.trim(), key = $('sb-key').value.trim(), vapid = ($('sb-vapid') || {}).value || '';
        if (!/^https:\/\/.+/.test(url) || key.length < 20) { C().toast('Проверьте URL (https://…supabase.co) и anon key'); return; }
        Cl.setCfgDraft(url, key, vapid.trim()); Cl.sb = null;
        C().toast('Конфиг сохранён, проверяю связь…');
        try { await client(); C().toast('✓ Supabase отвечает'); } catch (err) { C().toast('⚠ ' + err.message, 6000); }
        O.cloudPanelRender();
      } else if (a === 'show-sql') { const p = $('sb-sql'); if (p) p.classList.toggle('hidden'); }
      else if (a === 'show-edge') { const p = $('sb-edge'); if (p) p.classList.toggle('hidden'); }
      else if (a === 'signup') {
        const em = $('sb-email').value.trim(), pw = $('sb-pass').value, nm = ($('sb-name') || {}).value || '';
        if (!/.+@.+\..+/.test(em) || (pw || '').length < 6) { if (msgEl()) msgEl().textContent = 'Нужен корректный e-mail и пароль от 6 символов.'; return; }
        if (msgEl()) msgEl().textContent = 'Создаю аккаунт…';
        await Cl.signUp(em, pw, nm.trim());
        if (msgEl()) msgEl().textContent = Cl.confirmSent() ? 'Аккаунт создан! Проверьте почту и подтвердите регистрацию.' : 'Готово — вошли в облако. Запускаю первую синхронизацию…';
        if (Cl.logged()) { Cl.syncNow().catch(() => {}); }
        O.cloudPanelRender();
      } else if (a === 'resend') { await Cl.resend().catch(() => {}); C().toast('Письмо отправлено повторно'); }
      else if (a === 'signin') {
        const em = $('sb-email').value.trim(), pw = $('sb-pass').value;
        if (msgEl()) msgEl().textContent = 'Вход…';
        await Cl.signIn(em, pw);
        C().toast('В облаке ✓'); Cl.syncNow().catch(() => {}); O.cloudPanelRender();
      } else if (a === 'signout') { await Cl.signOut(); view = 'home'; O.cloudPanelRender(); C().toast('Вы вышли из облака (локальные данные целы)'); }
      else if (a === 'sync') { b.textContent = 'Синхронизация…'; try { await Cl.syncNow(); C().toast('Синхронизировано ✓'); } catch (err) { C().toast('Сбой: ' + err.message + '. Данные в очереди, повторим автоматически.', 6000); } b.textContent = 'Синхронизировать сейчас'; }
      else if (a === 'pull-state') { try { await Cl.pullState(); } catch (err) { C().toast('Не удалось: ' + err.message); } }
      else if (a === 'view') { view = arg; if (arg === 'friends') Cl.loadFriends().catch(() => {}).finally(() => O.cloudPanelRender()); if (arg === 'wall' && !Cl.wallLoaded) Cl.loadWall().catch(() => {}).finally(() => O.cloudPanelRender()); O.cloudPanelRender(); }
      else if (a === 'find') {
        const q = $('sb-fq').value.trim(); const res = $('sb-fres');
        res.innerHTML = '<p class="muted">Ищу…</p>';
        try { const list = await Cl.searchUsers(q); res.innerHTML = list.length ? list.map(p => `<div class="cl-row"><b>${esc(p.name || 'Без имени')}</b><small>${esc(p.id.slice(0, 8))}</small><button class="o-chip" data-cl="addf:${p.id}">＋ В друзья</button></div>`).join('') : '<p class="muted">Никого не нашёл. Пользователь должен зарегистрироваться в облаке.</p>'; }
        catch (err) { res.innerHTML = '<p class="muted">' + esc(err.message) + '</p>'; }
      }
      else if (a === 'addf') { await Cl.addFriend(arg); C().toast('Приглашение отправлено'); Cl.loadFriends().catch(() => {}).finally(O.cloudPanelRender); }
      else if (a === 'acc') { await Cl.respondInvite(arg, true); C().toast('Теперь вы друзья'); }
      else if (a === 'rej') { await Cl.respondInvite(arg, false); }
      else if (a === 'dm') { dmPeer = arg; view = 'dm'; Cl.loadDm(arg).catch(() => {}).finally(() => O.cloudPanelRender()); }
      else if (a === 'dm-send') { const t = $('sb-dm-text'); if (t && t.value.trim()) { await Cl.sendDm(arg, t.value.trim()); t.value = ''; O.cloudPanelRender(); } }
      else if (a === 'ask-wall') { C().switchTab('agent'); setTimeout(() => O.assistant.send('отправь личное сообщение другу ' + (($('sb-fq') || {}).value || '') + ': привет! это агент'), 80); }
      else if (a === 'wall-post') { const t = $('sb-wall-text'); if (t && t.value.trim()) { await Cl.postWall(t.value.trim()); t.value = ''; O.cloudPanelRender(); } }
      else if (a === 'push-ask') { const ok = await O.notify.ask(); C().toast(ok ? 'Уведомления разрешены' : 'Бразер запретил уведомления'); }
      else if (a === 'push-sub') { const s = await Cl.subscribePush(); C().toast(s ? 'Серверный push активен' : 'Не удалось: нужен VAPID key в конфиге и установленное PWA'); }
      else if (a === 'cron-add') {
        const name = ($('cr-name') || {}).value || 'Задание', kind = ($('cr-kind') || {}).value, time = ($('cr-time') || {}).value || '08:00';
        const date = ($('cr-date') || {}).value, cmd = ($('cr-command') || $('cr-cmd') || {}).value || 'что дальше', push = !!($('cr-push') || {}).checked;
        const job = O.cron.add({ name, kind, time, date, cmd, pushTitle: 'Контур', pushBody: cmd, cloud: Cl.logged() });
        if (Cl.logged()) { try { await api('job', cl => cl.from('script_jobs').insert({ uid: Cl.user.id, script_id: job.id, name: job.name, cron: job.cron || '', at: job.at ? new Date(job.at).toISOString() : null, days: job.days || [], time_of_day: job.time || '', push_title: push ? 'Контур' : '', push_body: push ? cmd : '', enabled: true })); } catch (err) { C().toast('Локально добавил; в облако не ушло: ' + err.message); } }
        O.cloudPanelRender();
      }
    } catch (err) {
      console.error('cloud', err);
      C().toast('Сбой облака: ' + ((err && err.message) || err) + ' — ' + NET_HINT, 7000);
      if (msgEl()) msgEl().textContent = (err && err.message) || String(err);
    }
  });
  document.addEventListener('change', e => {
    const el = e.target; if (!el.closest || !el.closest('#cloud-root')) return;
    if (el.dataset.sk) { const s = S(); s.settings[el.dataset.sk] = el.checked; C().save(); }
  });

  /* ───── авто-синхронизация ───── */
  setInterval(() => {
    const st = (S().settings || {});
    if (!Cl.logged() || st.cloudAutoSync === false) return;
    if (!Cl.online && !navigator.onLine) return;
    Cl.syncNow().catch(() => {});
  }, 120000);

  Cl.init = async function () {
    if (Cl.enabled()) { const ok = await Cl.restore().catch(() => false); if (ok) { await ensureProfile(); } }
  };
})();

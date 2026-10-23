/* Контур 5.7 · ПАМЯТЬ И ХРАНИЛИЩЕ: сколько занято, лимит объёма, автоочистка второстепенного, защита от очистки браузером, сброс кэша.
   Место хранения браузер выбирает сам (localStorage + IndexedDB + кэш файлов); приложение может ограничить свой объём и освободить память.
   Основные данные (встречи, задачи, контакты, сценарии…) автоочисткой НЕ удаляются. Подробнее: docs/STORAGE.md */
(function () {
  'use strict';
  const O = window.Orbit = window.Orbit || {};
  const C = () => O.core && O.core(), S = () => (C() && C().state) || {}, esc = s => (O.esc ? O.esc(s) : String(s == null ? '' : s));
  const MB = 1048576, SNAPK = 'orbit-snapshots-v1';
  const fmt = b => (b >= MB ? (b / MB).toFixed(b >= 10 * MB ? 0 : 1) + ' МБ' : b >= 1024 ? Math.round(b / 1024) + ' КБ' : (b | 0) + ' Б');
  /* группы ключей localStorage: «moi» — наши, other — чужие приложения на этом же адресе (не считаем в лимит и не трогаем) */
  const GROUPS = [
    { id: 'main', label: 'Основные данные (встречи, задачи, контакты, заметки)', re: /^orbit-planner-v3$/, own: true },
    { id: 'chat', label: 'Переписка и память агента', re: /^orbit-memory-v\d+$/, own: true },
    { id: 'scen', label: 'Сценарии, привычки, расписания', re: /^orbit-(scripts|habits|cron|flow-seed)/, own: true },
    { id: 'snap', label: 'Резервные копии', re: /^orbit-(snapshots|planner-backup)/, own: true },
    { id: 'ff', label: 'Блок-схемы (FlowForge)', re: /^(ff|flowforge)/i, own: true },
    { id: 'calc', label: 'Калькулятор (настройки)', re: /^(cfg|cifra)/, own: true },
    { id: 'misc', label: 'Прочие настройки Контура', re: /^orbit-/, own: true }
  ];
  const lsBytes = (k, v) => (String(k).length + String(v == null ? '' : v).length) * 2;
  const HAS_ST = typeof Storage !== 'undefined', rawSet = HAS_ST ? Storage.prototype.setItem : function () {};

  /* ───── IndexedDB (история калькулятора, обучение агента) ───── */
  const dbExists = async name => { try { return !!(indexedDB && indexedDB.databases && (await indexedDB.databases()).some(d => d.name === name)); } catch (e) { return false; } };
  const openDB = name => new Promise(res => { try { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) { /* БД не существует — не создаём */ } }; } catch (e) { res(null); } });
  async function idbStats(name, store) {
    if (!(await dbExists(name))) return { bytes: 0, n: 0 };
    const db = await openDB(name); if (!db || !db.objectStoreNames.contains(store)) { if (db) db.close(); return { bytes: 0, n: 0 }; }
    return new Promise(res => {
      let bytes = 0, n = 0; const tx = db.transaction(store, 'readonly');
      tx.objectStore(store).openCursor().onsuccess = e => { const c = e.target.result; if (c) { n++; try { bytes += JSON.stringify(c.value).length * 2; } catch (x) { /* пропуск */ } if (n < 20000) c.continue(); } };
      tx.oncomplete = () => { db.close(); res({ bytes, n }); }; tx.onerror = () => { db.close(); res({ bytes, n }); };
    });
  }
  /* оставить только keep самых новых записей (ключ по возрастанию = старее) */
  async function idbTrim(name, store, keep) {
    const st = await idbStats(name, store); if (st.n <= keep) return 0;
    const db = await openDB(name); if (!db) return 0;
    return new Promise(res => {
      let drop = st.n - keep, done = 0; const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).openCursor().onsuccess = e => { const c = e.target.result; if (c && drop > 0) { c.delete(); drop--; done++; c.continue(); } };
      tx.oncomplete = () => { db.close(); res(done); }; tx.onerror = () => { db.close(); res(done); };
    });
  }
  async function cacheStats() {
    if (typeof caches === 'undefined') return { bytes: 0, n: 0 };
    let bytes = 0, n = 0;
    try { for (const k of await caches.keys()) { const c = await caches.open(k); for (const rq of await c.keys()) { const r = await c.match(rq); if (r) { const b = await r.clone().blob(); bytes += b.size; n++; } } } } catch (e) { /* не критично */ }
    return { bytes, n };
  }

  /* ───── измерение ───── */
  async function measure(withCache) {
    const groups = {}; GROUPS.forEach(g => { groups[g.id] = { id: g.id, label: g.label, bytes: 0 }; }); groups.other = { id: 'other', label: 'Другие приложения на этом адресе (не трогаем)', bytes: 0 };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i), b = lsBytes(k, localStorage.getItem(k)), g = GROUPS.find(x => x.re.test(k));
      groups[g ? g.id : 'other'].bytes += b;
    }
    const calc = await idbStats('raschet', 'h'), know = await idbStats('orbit-agent-v1', 'knowledge');
    groups.calc.bytes += calc.bytes; groups.calc.n = calc.n; groups.chat.bytes += know.bytes;
    let audio = 0; try { (S().notes || []).forEach(n => { if (n.audio) audio += String(n.audio).length * 2; }); } catch (e) { /* нет заметок */ }
    const own = GROUPS.reduce((s, g) => s + groups[g.id].bytes, 0);
    const out = { groups: Object.values(groups), own, audio, calcN: calc.n, at: Date.now() };
    if (withCache) out.cache = await cacheStats();
    return out;
  }

  /* ───── очистка ───── */
  const readSnaps = () => { try { return JSON.parse(localStorage.getItem(SNAPK) || '[]'); } catch (e) { return []; } };
  function trimSnaps(keep) { const l = readSnaps(); if (l.length <= keep) return 0; const before = (localStorage.getItem(SNAPK) || '').length * 2; if (keep <= 0) localStorage.removeItem(SNAPK); else rawSet.call(localStorage, SNAPK, JSON.stringify(l.slice(0, keep))); return before - (localStorage.getItem(SNAPK) || '').length * 2; }
  function trimChat(keep) { const A = O.assistant; if (!A || !A.trimHistory) return 0; return A.trimHistory(keep) || 0; }
  /* лестница: от самого безобидного к более ощутимому; основные данные в ней не участвуют */
  const LADDER = [
    ['старые резервные копии', () => trimSnaps(3)], ['старая переписка с агентом', () => trimChat(150)], ['история калькулятора', () => idbTrim('raschet', 'h', 300)],
    ['резервные копии', () => trimSnaps(1)], ['переписка с агентом', () => trimChat(50)], ['история калькулятора', () => idbTrim('raschet', 'h', 30)],
    ['переписка с агентом', () => trimChat(10)], ['все резервные копии', () => trimSnaps(0)]
  ];
  const cfg = () => (S().settings = S().settings || {});
  const limitBytes = () => (cfg().storageCap === true ? Math.max(5, +cfg().storageLimitMB || 50) * MB : 0);
  let last = { freed: 0, steps: [], over: false, at: 0 };
  async function enforce(opt) {
    const lim = (opt && opt.limit) || limitBytes(); if (!lim) { last = { freed: 0, steps: [], over: false, at: Date.now() }; return last; }
    let m = await measure(), steps = [];
    if (m.own > lim) {
      for (const [name, fn] of LADDER) {
        let r = 0; try { r = await fn(); } catch (e) { r = 0; }
        if (r > 0) steps.push(name);
        m = await measure(); if (m.own <= lim * 0.9) break;
      }
    }
    last = { freed: 0, steps, over: m.own > lim, own: m.own, lim, at: Date.now() };
    if (steps.length && C() && C().toast) C().toast('Освобождена память: ' + [...new Set(steps)].join(', '), 4500);
    if (last.over && C() && C().toast && !(opt && opt.quiet)) C().toast('Основные данные (' + fmt(m.own) + ') больше лимита ' + fmt(lim) + '. Увеличьте лимит или удалите ненужное.', 6000);
    if (box()) refresh();
    return last;
  }
  /* аварийно: браузер отказал в записи (QuotaExceeded) — освобождаем второстепенное и повторяем запись один раз */
  function emergency(key) {
    let freed = 0; try { freed += trimSnaps(key === SNAPK ? 0 : 1); } catch (e) { /* ничего */ }
    if (!freed && !/^orbit-memory/.test(key)) { try { freed += trimChat(50) ? 1 : 0; } catch (e) { /* ничего */ } }
    if (freed && C() && C().toast) C().toast('Память браузера заполнена — удалил старые копии/переписку', 5000);
    return freed > 0;
  }
  let guard = false;
  if (HAS_ST) Storage.prototype.setItem = function (k, v) {
    try { return rawSet.call(this, k, v); }
    catch (e) { if (this !== localStorage || guard || !/quota/i.test((e.name || '') + (e.message || ''))) throw e; guard = true; try { if (emergency(String(k))) return rawSet.call(this, k, v); } finally { guard = false; } throw e; }
  };

  async function clearCache() {
    try { for (const k of await caches.keys()) await caches.delete(k); } catch (e) { /* нет кэша */ }
    try { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (e) { /* нет SW */ }
    if (C() && C().toast) C().toast('Кэш сброшен — перезагружаю…'); setTimeout(() => location.reload(), 600);
  }
  async function persist() {
    try { const ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; snap.persisted = ok; if (C() && C().toast) C().toast(ok ? 'Данные защищены от автоочистки браузером' : 'Браузер не дал защиту (на iPhone — установите приложение на экран «Домой»)', 5000); } catch (e) { /* не поддерживается */ }
    refresh();
  }

  /* ───── интерфейс (раздел «Память и хранилище» в настройках) ───── */
  let snap = { m: null, est: null, persisted: null, busy: false, at: 0 }, armed = '', armT = 0;
  const box = () => document.getElementById('st-box');
  async function refresh(force) {
    if (snap.busy || (!force && Date.now() - snap.at < 2500)) return; snap.busy = true;
    try {
      snap.m = await measure(true);
      try { snap.est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch (e) { snap.est = null; }
      try { snap.persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (e) { snap.persisted = null; }
    } finally { snap.busy = false; snap.at = Date.now(); }
    const b = box(); if (b) b.outerHTML = statsHtml();
  }
  function statsHtml() {
    const m = snap.m;
    if (!m) return '<div id="st-box" class="o-set"><small>Считаю занятое место…</small></div>';
    const cache = m.cache ? m.cache.bytes : 0, lim = limitBytes(), est = snap.est, pct = lim ? Math.min(100, Math.round(m.own / lim * 100)) : (est && est.quota ? Math.min(100, Math.round(m.own / est.quota * 100)) : 0);
    const rows = m.groups.filter(g => g.bytes > 0 || g.id === 'main').map(g => `<li><span>${esc(g.label)}${g.id === 'calc' && m.calcN ? ' · записей: ' + m.calcN : ''}</span><b>${fmt(g.bytes)}</b></li>`).join('');
    return `<div id="st-box" class="o-set"><label>Занято данными Контура: <b>${fmt(m.own)}</b>${lim ? ' из ' + fmt(lim) + ' (лимит)' : ' · без ограничений'}</label>
      <div class="st-bar"><i style="width:${pct}%"></i></div>
      <ul class="st-list">${rows}<li><span>Кэш приложения (файлы для работы без сети)</span><b>${fmt(cache)}${m.cache ? ' · ' + m.cache.n + ' файлов' : ''}</b></li></ul>
      ${m.audio ? `<small>Из основных данных голосовые заметки (аудио): ${fmt(m.audio)}</small>` : ''}
      <small>${est && est.quota ? 'Весь сайт в браузере: ' + fmt(est.usage || 0) + ' из ~' + fmt(est.quota) + ' доступных.' : 'Браузер не сообщает общий размер.'}
      Защита от очистки браузером: <b>${snap.persisted === true ? 'включена ✓' : snap.persisted === false ? 'не включена' : 'неизвестно'}</b>.</small>
      ${last.steps && last.steps.length ? `<small>Последняя автоочистка: ${esc([...new Set(last.steps)].join(', '))}.</small>` : ''}${last.over ? '<small style="color:#e5484d">Основные данные больше лимита — автоочистка не удаляет их; увеличьте лимит.</small>' : ''}</div>`;
  }
  function html() { setTimeout(() => refresh(), 0); return statsHtml(); }
  const btn2 = (key, label, ask) => `<button class="o-btn ghost sm${armed === key ? ' warn' : ''}" data-sact="st-do:${key}"${armed === key ? ' style="background:#e5484d;color:#fff"' : ''}>${armed === key ? esc(ask || 'Точно? Нажмите ещё раз') : esc(label)}</button>`;
  function actions() {
    return `<div class="o-set"><small>Место хранения выбирает браузер: данные лежат на этом устройстве внутри браузера. Приложение может ограничить свой объём, освободить память и попросить браузер не удалять данные.</small>
      <div class="o-segs" style="flex-wrap:wrap;gap:6px">
        <button class="o-btn ghost sm" data-sact="st-enforce">Освободить место сейчас</button>
        <button class="o-btn ghost sm" data-sact="st-persist">Защитить данные от очистки браузером</button>
        <button class="o-btn ghost sm" data-sact="st-recalc">Пересчитать</button>
        <button class="o-btn ghost sm" data-sact="export-all">Сохранить копию в файл</button></div>
      <label style="margin-top:10px">Очистить вручную</label>
      <div class="o-segs" style="flex-wrap:wrap;gap:6px">${btn2('chat', 'История чата с агентом')}${btn2('snap', 'Резервные копии')}${btn2('calc', 'История калькулятора')}${btn2('cache', 'Сбросить кэш приложения', 'Точно? Нужен интернет для повторной загрузки')}</div>
      <small>Сброс кэша удаляет только файлы приложения для работы без сети; ваши данные остаются. После него приложение перезагрузится и скачает файлы заново.</small></div>`;
  }
  async function act(a, p) {
    if (a === 'st-recalc') return refresh(true);
    if (a === 'st-persist') return persist();
    if (a === 'st-enforce') {
      const lim = limitBytes(), m = await measure();
      const r = await enforce({ limit: lim || Math.max(1, m.own - 1), quiet: true });
      if (C() && C().toast && !(r.steps && r.steps.length)) C().toast('Освобождать нечего: второстепенных данных нет', 3500);
      return refresh(true);
    }
    if (a === 'st-do') {
      if (armed !== p) { armed = p; clearTimeout(armT); armT = setTimeout(() => { armed = ''; if (O.renderSettings) O.renderSettings(); }, 4000); if (O.renderSettings) O.renderSettings(); return; }
      armed = ''; clearTimeout(armT);
      if (p === 'cache') return clearCache();
      if (p === 'chat' && O.assistant && O.assistant.clearChat) O.assistant.clearChat();
      if (p === 'snap') trimSnaps(0);
      if (p === 'calc') await idbTrim('raschet', 'h', 0);
      if (C() && C().toast) C().toast('Очищено');
      if (O.renderSettings) O.renderSettings(); return refresh(true);
    }
  }

  /* ───── запуск ───── */
  document.addEventListener('change', e => { const k = e.target && e.target.dataset && e.target.dataset.sk; if (k === 'storageCap' || k === 'storageLimitMB') setTimeout(() => enforce(), 80); });
  setTimeout(() => { try { if (cfg().storageLimitMB == null) cfg().storageLimitMB = 50; enforce({ quiet: true }); } catch (e) { /* не критично */ } }, 4000);
  setInterval(() => { try { enforce({ quiet: true }); } catch (e) { /* не критично */ } }, 120000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { try { enforce({ quiet: true }); } catch (e) { /* не критично */ } } });

  O.storage = { measure, enforce, emergency, clearCache, persist, refresh, html, actions, act, fmt, GROUPS, limitBytes, trimSnaps, idbTrim };
})();

/* Контур 5.4 · СЦЕНАРИИ-ГРАФЫ: исполнитель блок-схем агента.
   Сценарий = граф { nodes:[{id,type,text,ag:{b,…}}], edges:[{from,to,label}] } — формат совместим с FlowForge.
   Блоки: начало/конец · сообщение · команда агента (любая фраза из каталога навыков) · «Сегодня», «Задачи», «Планы»,
   «Напоминания», «Правки» · «Показать отчёт» · ветвление «Да/Нет» (по условию или вопросом пользователю).
   Что собрано блоками — выводится ОДНИМ сообщением-отчётом в чат. Подробнее: docs/SCENARIO-GRAPH.md */
(function () {
  'use strict';
  const O = window.Orbit = window.Orbit || {};
  const esc = s => (O.esc ? O.esc(s) : String(s == null ? '' : s));
  const E = () => O.engine, S = () => (O.core ? O.core().state : {}) || {};
  const N = s => (E() && E().N ? E().N(s) : String(s || '').toLowerCase().replace(/ё/g, 'е'));
  const MAX_STEPS = 300, MAX_VISITS = 25;
  const YES = /^(да|yes|true|\+|✓|истина)$/i, NO = /^(нет|no|false|-|✗|ложь)$/i;
  const dayStr = d => d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  /* ───── палитра блоков (для редакторов; «команда агента» покрывает весь каталог навыков) ───── */
  const BLOCKS = {
    start: { label: 'Начало', cat: 'flow' }, end: { label: 'Конец', cat: 'flow' },
    say: { label: 'Сообщение', cat: 'flow', hint: 'Текст в отчёте' },
    cmd: { label: 'Команда агента', cat: 'agent', hint: 'Любая фраза, как в чате' },
    day: { label: 'Сегодня', cat: 'data', hint: 'Встречи и блоки дня' },
    tasks: { label: 'Задачи', cat: 'data', hint: 'Просроченные, на сегодня, на неделю' },
    plans: { label: 'Планы', cat: 'data', hint: 'Завтра и цели' },
    reminders: { label: 'Напоминания', cat: 'data', hint: 'Просроченные и ближайшие' },
    edits: { label: 'Правки', cat: 'data', hint: 'Что менял агент' },
    report: { label: 'Показать отчёт', cat: 'flow' },
    decision: { label: 'Условие Да/Нет', cat: 'flow' }
  };
  const list = () => Object.keys(BLOCKS).map(k => Object.assign({ b: k }, BLOCKS[k]));

  /* ───── блоки-данные: возвращают раздел отчёта { title, rows:[{time,title,meta,warn}], alerts } ───── */
  const DATA = {
    day(ctx) {
      const s = S(), e = E(), now = ctx.now, nm = e.nowMin(now), ev = e.eventsOn(s, now), title = 'Сегодня · ' + dayStr(now);
      if (ev.holiday) return { title, rows: [{ title: 'Выходной / отпуск' + (ev.holiday.title ? ': ' + ev.holiday.title : '') }] };
      const rows = ev.list.map(x => ({ time: x.start + '–' + x.end, title: x.title, meta: [x.place, x.s <= nm && x.e > nm ? 'идёт сейчас' : x.e <= nm ? 'прошло' : ''].filter(Boolean).join(' · ') }));
      return { title, rows: rows.length ? rows : [{ title: 'Встреч на сегодня нет' }] };
    },
    tasks(ctx) {
      const g = E().hwGroups(S(), ctx.now), open = g.overdue.length + g.today.length + g.tomorrow.length + g.week.length + g.later.length, rows = [], alerts = [];
      const add = (arr, tag, warn) => arr.slice(0, 5).forEach(h => rows.push({ time: tag, title: h.title || h.name || 'Задача', meta: h.subject || '', warn }));
      add(g.overdue, 'просрочено', true); add(g.today, 'сегодня'); add(g.tomorrow, 'завтра'); add(g.week, 'неделя');
      if (g.overdue.length) alerts.push('просрочено задач: ' + g.overdue.length);
      return { title: 'Задачи · открыто ' + open, rows: rows.length ? rows.slice(0, 10) : [{ title: open ? 'Срочного нет, остальное без срока' : 'Открытых задач нет ✓' }], alerts };
    },
    plans(ctx) {
      const s = S(), e = E(), rows = [], tm = e.eventsOn(s, e.addDays(ctx.now, 1));
      rows.push(tm.holiday ? { time: 'завтра', title: 'Выходной / отпуск' } : tm.list.length ? { time: 'завтра', title: tm.list.length + ' в плане, первая в ' + tm.list[0].start, meta: tm.list[0].title } : { time: 'завтра', title: 'Встреч нет' });
      (s.goals || []).filter(x => (x.progress || 0) < 100).sort((a, b) => (a.deadline || '9').localeCompare(b.deadline || '9')).slice(0, 3)
        .forEach(x => rows.push({ time: x.deadline ? 'до ' + x.deadline : 'цель', title: x.title || x.name || 'Цель', meta: (x.progress || 0) + '%' }));
      return { title: 'Планы', rows };
    },
    reminders(ctx) {
      const rem = (S().reminders || []).filter(r => !r.done).sort((a, b) => (a.at || '').localeCompare(b.at || '')), t = ctx.now.getTime(), alerts = [];
      const over = rem.filter(r => r.at && new Date(r.at).getTime() < t), soon = rem.filter(r => !r.at || new Date(r.at).getTime() >= t).slice(0, 5);
      const fm = r => r.at ? new Date(r.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      const rows = over.slice(0, 5).map(r => ({ time: fm(r), title: r.text, meta: 'просрочено', warn: true })).concat(soon.map(r => ({ time: fm(r), title: r.text })));
      if (over.length) alerts.push('просрочено напоминаний: ' + over.length);
      return { title: 'Напоминания · активных ' + rem.length, rows: rows.length ? rows : [{ title: 'Нет активных напоминаний ✓' }], alerts };
    },
    edits() {
      const h = (O.actions && O.actions.recent) ? O.actions.recent(5) : [], fm = ts => { try { return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
      return { title: 'Правки агента', rows: h.length ? h.map(x => ({ time: fm(x.at), title: x.label })) : [{ title: 'Изменений через агента пока нет' }] };
    }
  };

  /* ───── условия ───── */
  function cond(c, ctx) {
    const s = S(), now = ctx.now, di = (now.getDay() + 6) % 7, mins = now.getHours() * 60 + now.getMinutes();
    if (c.k === 'weekday') return c.v === 'off' ? di > 4 : di <= 4;
    if (c.k === 'hw') return (s.homework || []).some(h => !h.done);
    if (c.k === 'overdue') return E().hwGroups(s, now).overdue.length > 0 || (s.reminders || []).some(r => !r.done && r.at && new Date(r.at) < now);
    if (c.k === 'reminders') return (s.reminders || []).some(r => !r.done);
    if (c.k === 'meetings') return E().eventsOn(s, now).list.length > 0;
    if (c.k === 'time') { const p = String(c.at || '12:00').split(':'), x = +p[0] * 60 + +p[1]; return c.v === 'after' ? mins >= x : mins < x; }
    return null;
  }
  /* из текста ромба: «Есть открытые задачи?», «Сегодня выходной?», «После 18:00?» */
  function inferCond(text) {
    const n = N(text); let m;
    if (/выходн/.test(n)) return { k: 'weekday', v: 'off' };
    if (/будн|рабоч\S* день/.test(n)) return { k: 'weekday', v: 'work' };
    if (/просроч/.test(n)) return { k: 'overdue' };
    if (/напомин/.test(n)) return { k: 'reminders' };
    if (/задач|дз|домашк/.test(n)) return { k: 'hw' };
    if (/встреч|расписани|занят/.test(n)) return { k: 'meetings' };
    if ((m = n.match(/(после|до)\s*(\d{1,2})[:.](\d{2})/))) return { k: 'time', v: m[1] === 'после' ? 'after' : 'before', at: m[2].padStart(2, '0') + ':' + m[3] };
    return null;
  }

  /* ───── отчёт ───── */
  const rowHtml = r => `<div class="o-acard-row"><div class="o-acard-time">${esc(r.time || '')}</div><div class="o-acard-body"><div class="o-acard-title">${r.warn ? '⚠️ ' : ''}${esc(r.title)}</div>${r.meta ? `<div class="o-acard-meta">${esc(r.meta)}</div>` : ''}</div></div>`;
  const cardHtml = sc => `<div class="o-acard" data-type="report"><div class="o-acard-h">${esc(sc.title)}</div>${(sc.rows || []).map(rowHtml).join('')}${(sc.cards || []).join('')}</div>`;
  function flush(ctx) {
    if (!ctx.sections.length) return null;
    const A = O.assistant, alerts = [...new Set(ctx.alerts)], seen = new Set(), buttons = [];
    ctx.sections.forEach(sc => (sc.buttons || []).forEach(b => { if (b && b.act && !seen.has(b.act)) { seen.add(b.act); buttons.push(b); } }));
    const msg = { role: 'bot', at: Date.now(), intent: 'flow', text: '📋 ' + (ctx.name || 'Отчёт') + ' · ' + dayStr(ctx.now) + (alerts.length ? '\n⚠️ Внимание: ' + alerts.join('; ') : '\n✓ Срочного нет'), cards: ctx.sections.map(cardHtml), buttons: buttons.slice(0, 6) };
    ctx.sections = [];
    if (A && A.msgs) { A.msgs.push(msg); if (A.render) A.render(true); }
    ctx.message = msg;
    return msg;
  }

  /* ───── исполнение узла ───── */
  const kindOf = n => (n.ag && n.ag.b) || (n.type === 'decision' ? 'decision' : n.type === 'terminal' ? 'terminal' : 'say');
  async function exec(n, ctx, outs) {
    const A = O.assistant, k = kindOf(n), ag = n.ag || {}, text = ag.text != null ? ag.text : n.text || '';
    if (DATA[k]) { const r = DATA[k](ctx); ctx.sections.push({ title: ag.title || r.title, rows: r.rows }); (r.alerts || []).forEach(a => ctx.alerts.push(a)); return outs; }
    if (k === 'say') { if (text.trim()) ctx.sections.push({ title: ag.title || '', rows: [{ title: text.replace(/\{\{(\w+)\}\}/g, (m, v) => ctx.vars[v] != null ? ctx.vars[v] : '') }] }); return outs; }
    if (k === 'cmd') {
      const sec = { title: ag.title || text, rows: [], cards: [], buttons: [] };
      const replies = A && A.quiet ? await A.quiet(text) : [];
      replies.forEach(r => { String(r.text || '').split('\n').filter(Boolean).forEach(l => sec.rows.push({ title: l })); (r.cards || []).forEach(c => sec.cards.push(c)); (r.buttons || []).forEach(b => sec.buttons.push(b)); });
      if (!replies.length) sec.rows.push({ title: 'Не удалось выполнить «' + text + '»', warn: true });
      ctx.sections.push(sec); return outs;
    }
    if (k === 'report') { flush(ctx); return outs; }
    if (k === 'terminal' || k === 'start' || k === 'end') return k === 'end' ? [] : outs;
    if (k === 'decision') {
      const c = ag.cond || inferCond(n.text || ''); let yes = c ? cond(c, ctx) : null;
      if (yes == null) { yes = A && A.askYesNo ? await A.askYesNo(n.text || ag.text || 'Продолжить?') : true; if (yes == null) { ctx.stopped = true; return []; } }
      const pick = outs.find(e => (yes ? YES : NO).test(String(e.label || '').trim()));
      if (!pick) { ctx.sections.push({ title: '', rows: [{ title: '↳ «' + (n.text || 'Условие') + '» — ' + (yes ? 'Да' : 'Нет') + ': ветки нет, сценарий завершён' }] }); return []; }
      return [pick];
    }
    return outs;
  }

  /* ───── запуск графа ───── */
  async function run(graph, opts) {
    opts = opts || {};
    const ctx = { name: opts.name, now: new Date(), vars: {}, sections: [], alerts: [], steps: 0, visits: {}, warn: [], stopped: false, message: null };
    const check = validate(graph); if (!check.ok) { ctx.warn = check.errors; ctx.error = check.errors[0]; const A = O.assistant; if (A && A.msgs) { A.msgs.push({ role: 'bot', text: 'Сценарий не запущен: ' + check.errors[0], cards: [], buttons: [] }); A.render && A.render(true); } return ctx; }
    const nodes = new Map(graph.nodes.map(n => [n.id, n])), outs = {}, hasIn = new Set();
    graph.edges.forEach(e => { (outs[e.from] = outs[e.from] || []).push(e); hasIn.add(e.to); });
    const start = graph.nodes.find(n => n.ag && n.ag.b === 'start') || graph.nodes.find(n => n.type === 'terminal' && !hasIn.has(n.id)) || graph.nodes.find(n => !hasIn.has(n.id)) || graph.nodes[0];
    const stack = [start.id];
    while (stack.length && !ctx.stopped) {
      if (++ctx.steps > MAX_STEPS) { ctx.warn.push('превышен лимит шагов (' + MAX_STEPS + ')'); break; }
      const n = nodes.get(stack.pop()); if (!n) continue;
      if ((ctx.visits[n.id] = (ctx.visits[n.id] || 0) + 1) > MAX_VISITS) { ctx.warn.push('цикл на блоке «' + (n.text || n.id) + '» остановлен'); continue; }
      if (opts.onStep) { try { opts.onStep(n.id); } catch (e) { /* подсветка не критична */ } }
      if (opts.delay) await new Promise(r => setTimeout(r, opts.delay));
      let next;
      try { next = await exec(n, ctx, outs[n.id] || []); } catch (e) { ctx.warn.push('ошибка в блоке «' + (n.text || n.id) + '»: ' + (e.message || e)); ctx.sections.push({ title: '', rows: [{ title: 'Ошибка в блоке «' + (n.text || n.id) + '»', warn: true }] }); next = []; }
      for (let i = next.length - 1; i >= 0; i--) stack.push(next[i].to);
    }
    if (ctx.warn.length) ctx.sections.push({ title: 'Предупреждения', rows: ctx.warn.map(w => ({ title: w, warn: true })) });
    flush(ctx);
    return ctx;
  }

  function validate(g) {
    const errors = [];
    if (!g || !Array.isArray(g.nodes) || !g.nodes.length) return { ok: false, errors: ['в схеме нет блоков'] };
    const ids = new Set(g.nodes.map(n => n.id));
    (g.edges || []).forEach(e => { if (!ids.has(e.from) || !ids.has(e.to)) errors.push('связь ведёт в несуществующий блок'); });
    g.edges = g.edges || [];
    return { ok: !errors.length, errors };
  }

  /* ───── FlowForge → сценарий ───── */
  function inferBlock(n) {
    const t = n.text || '', A = O.assistant, x = N(t);
    if (n.ag && n.ag.b) return n.ag;
    if (n.type === 'terminal') return { b: /конец|заверш|финиш|стоп|готово|end/i.test(t) ? 'end' : 'start' };
    if (n.type === 'decision') return { b: 'decision', text: t };
    if (/^(отч[её]т|показать отч[её]т|вывести отч[её]т)/.test(x)) return { b: 'report' };
    if (A && A.knows && A.knows(t)) return { b: 'cmd', text: t };
    if (/задач|дз|домашк/.test(x)) return { b: 'tasks' };
    if (/напомин/.test(x)) return { b: 'reminders' };
    if (/правк|изменени/.test(x)) return { b: 'edits' };
    if (/план|цел[иь]|завтра/.test(x)) return { b: 'plans' };
    if (/сегодня|встреч|расписани|мой день/.test(x)) return { b: 'day' };
    return { b: 'say', text: t };
  }
  function fromScheme(doc, name) {
    const nodes = (doc.nodes || []).map(n => { const o = { id: String(n.id), type: n.type || 'process', text: n.text || '' }; if (n.x != null) { o.x = n.x; o.y = n.y; } o.ag = n.ag && n.ag.b ? JSON.parse(JSON.stringify(n.ag)) : inferBlock(o); return o; });
    const edges = (doc.edges || []).map(e => ({ from: String(e.from), to: String(e.to), label: e.label || '' }));
    return { nodes, edges, meta: { source: 'flowforge', name: name || '' } };
  }
  function toScheme(g) {
    return { format: 'flowforge', version: '2.8', nodes: g.nodes.map(n => { const o = { id: n.id, type: n.type || 'process', text: n.text || (n.ag && (n.ag.text || (BLOCKS[n.ag.b] || {}).label)) || '' }; if (n.x != null) { o.x = n.x; o.y = n.y; } if (n.ag) o.ag = n.ag; if (n.color) o.color = n.color; return o; }),
      edges: g.edges.map((e, i) => ({ id: 'e' + (i + 1), from: e.from, to: e.to, label: e.label || undefined })), groups: [] };
  }
  /* проекты FlowForge (тот же origin, localStorage.ffProj) */
  function schemes() {
    try { const pj = JSON.parse(localStorage.getItem('ffProj') || '{}'); return Object.keys(pj).map(id => ({ id, name: pj[id].n || id, t: pj[id].t || 0, doc: pj[id].d })).filter(p => p.doc && Array.isArray(p.doc.nodes)).sort((a, b) => b.t - a.t); } catch (e) { return []; }
  }
  function openInFlowForge(g, name, meta) {
    const core = O.core && O.core(); if (!core) return false;
    core.switchTab('flow');
    const post = () => { const fr = document.getElementById('flow-frame'); if (fr && fr.contentWindow) fr.contentWindow.postMessage({ t: 'ff-open', name: name || 'Сценарий', doc: Object.assign(toScheme(g), { agent: meta || { name: name || 'Сценарий' } }) }, location.origin); };
    const fr = document.getElementById('flow-frame');
    if (fr && fr.contentDocument && fr.contentDocument.readyState === 'complete' && fr.contentWindow.location.href !== 'about:blank') setTimeout(post, 150);
    else if (fr) fr.addEventListener('load', () => setTimeout(post, 500), { once: true });
    return true;
  }

  /* ───── шаблоны ───── */
  const chain = (blocks, name) => {
    const nodes = [{ id: 's', type: 'terminal', text: 'Начало', ag: { b: 'start' } }];
    blocks.forEach((b, i) => nodes.push({ id: 'b' + (i + 1), type: 'process', text: b.text || (BLOCKS[b.b] || {}).label || '', ag: b }));
    nodes.push({ id: 'e', type: 'terminal', text: 'Конец', ag: { b: 'end' } });
    return { nodes, edges: nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id, label: '' })), meta: { name } };
  };
  const TEMPLATES = {
    'day-report': { name: 'Отчёт дня', trigger: { kind: 'phrase', text: 'отчёт дня' }, build: () => chain([
      { b: 'day', text: 'Сегодня и встречи' }, { b: 'tasks', text: 'Задачи' }, { b: 'plans', text: 'Планы' }, { b: 'reminders', text: 'Проверить напоминания' },
      { b: 'cmd', text: 'когда автобус домой', title: 'Маршруты' }, { b: 'edits', text: 'Правки' }, { b: 'report', text: 'Показать отчёт' }], 'Отчёт дня') }
  };
  const template = id => (TEMPLATES[id] ? TEMPLATES[id].build() : null);

  O.flow = { BLOCKS, list, DATA, TEMPLATES, template, run, validate, fromScheme, toScheme, schemes, openInFlowForge, inferCond, cond };
})();

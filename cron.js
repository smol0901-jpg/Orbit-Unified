/* Контур · API карточек агента: живые контейнеры, pin, контекст экрана, проактив */
(function () {
  'use strict';
  const O = window.Orbit = window.Orbit || {};
  const STORE_KEY = 'contour-agent-cards';
  const PROACTIVE_KEY = 'contour-proactive-log';

  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function C() { return window.OrbitCore || {}; }
  function S() { return (C().S && C().S()) || {}; }

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{"pinned":[],"live":{}}'); }
    catch (e) { return { pinned: [], live: {} }; }
  }
  function saveStore(st) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (e) {}
  }

  /* ─── Screen context ─── */
  function screenContext() {
    const core = C();
    const tab = (core.tab || core.currentTab || document.body.getAttribute('data-tab') || 'today');
    const s = S();
    const E = O.engine;
    const now = new Date();
    const ctx = {
      tab,
      at: now.toISOString(),
      agentOpen: tab === 'agent',
      today: null,
      next: null,
      tasksOpen: 0,
      goals: 0,
      reminds: 0,
      focus: !!(s.settings && s.settings.focusMode),
      lastDiagram: O._lastDiagram ? { type: O._lastDiagram.type, title: O._lastDiagram.title } : null,
      lastScheme: O._lastSchemePng ? { name: O._lastSchemePng.name } : null,
      docks: {
        calc: !!(O.inline && O.inline.dock && O.inline.dock.open),
        flow: !!(O.inline && O.inline.flowDock && O.inline.flowDock.open),
        pomo: !!(O.inline && O.inline.pomoDock && O.inline.pomoDock.open)
      }
    };
    try {
      if (E && E.eventsOn) {
        const ev = E.eventsOn(s, now);
        const list = (ev && ev.list) || [];
        const nm = E.nowMin ? E.nowMin(now) : (now.getHours() * 60 + now.getMinutes());
        ctx.today = list.map(e => ({
          title: e.title || e.name || e.subject || 'Событие',
          start: e.s, end: e.e, type: e.type
        }));
        const upcoming = list.filter(e => (e.e || e.s) > nm);
        ctx.next = upcoming[0] ? {
          title: upcoming[0].title || upcoming[0].name || upcoming[0].subject,
          start: upcoming[0].s, end: upcoming[0].e
        } : null;
      }
      ctx.tasksOpen = (s.homework || []).filter(h => !h.done).length;
      ctx.goals = (s.goals || []).length;
      ctx.reminds = (s.reminds || s.reminders || []).length;
    } catch (e) { console.warn('screenContext', e); }
    return ctx;
  }

  function contextSummary(ctx) {
    ctx = ctx || screenContext();
    const parts = [];
    parts.push('Экран: ' + (ctx.tab || '?'));
    if (ctx.next) {
      const t = Math.floor((ctx.next.start || 0) / 60) + ':' + String((ctx.next.start || 0) % 60).padStart(2, '0');
      parts.push('Дальше: ' + ctx.next.title + ' · ' + t);
    } else if (ctx.today && ctx.today.length) {
      parts.push('Сегодня событий: ' + ctx.today.length);
    } else {
      parts.push('Событий на сегодня нет');
    }
    if (ctx.tasksOpen) parts.push('Открытых задач: ' + ctx.tasksOpen);
    if (ctx.goals) parts.push('Целей: ' + ctx.goals);
    if (ctx.docks.calc) parts.push('Открыт калькулятор');
    if (ctx.docks.flow) parts.push('Открыты схемы');
    if (ctx.docks.pomo) parts.push('Помидор');
    if (ctx.lastDiagram) parts.push('Диаграмма: ' + (ctx.lastDiagram.title || ctx.lastDiagram.type));
    return parts.join(' · ');
  }

  /* ─── Card model ─── */
  /**
   * card: {
   *   id, type: 'proactive'|'live'|'object'|'info',
   *   title, body (html or text), live, pin,
   *   data, actions: [{label, act}],
   *   updated
   * }
   */
  function normalize(card) {
    card = Object.assign({
      id: uid(), type: 'info', title: '', body: '', live: false, pin: false,
      data: {}, actions: [], updated: Date.now()
    }, card || {});
    if (!card.id) card.id = uid();
    return card;
  }

  function cardHtml(card) {
    card = normalize(card);
    const acts = (card.actions || []).map(a =>
      `<button type="button" class="o-chip" data-ag="${esc(a.act)}">${esc(a.label)}</button>`
    ).join('');
    const pinBtn = `<button type="button" class="o-chip o-chip-muted" data-ag="ag:card-pin:${esc(card.id)}">${card.pin ? '📌 Закреплено' : 'Закрепить'}</button>`;
    const liveBadge = card.live ? '<span class="o-card-live">live</span>' : '';
    return `<div class="o-glass-card o-live-card" data-card-id="${esc(card.id)}" data-card-type="${esc(card.type)}">
      <div class="o-glass-h">
        <span>${esc(card.title || 'Карточка')}</span>
        ${liveBadge}
      </div>
      <div class="o-card-body">${card.body || ''}</div>
      <div class="o-m-b" style="padding:8px 12px 12px;display:flex;flex-wrap:wrap;gap:6px">
        ${acts}${pinBtn}
      </div>
    </div>`;
  }

  function pushCard(card, opts) {
    opts = opts || {};
    card = normalize(card);
    const st = loadStore();
    if (card.live) {
      st.live[card.id] = card;
      saveStore(st);
    }
    if (card.pin) {
      st.pinned = (st.pinned || []).filter(id => id !== card.id).concat([card.id]);
      saveStore(st);
    }
    const html = cardHtml(card);
    const A = O.assistant;
    const text = opts.text || card.title || 'Карточка';
    if (A && A.push) {
      A.push({
        role: 'bot',
        text,
        cards: [html],
        cardId: card.id,
        buttons: (card.actions || []).slice(0, 4).map(a => ({ label: a.label, act: a.act }))
      }, { panel: 'chat' });
    }
    return card;
  }

  function update(id, patch) {
    const st = loadStore();
    let card = st.live[id];
    if (!card) {
      // try find in DOM only update
      card = normalize(Object.assign({ id }, patch));
    } else {
      card = normalize(Object.assign({}, card, patch, { id, updated: Date.now() }));
      st.live[id] = card;
      saveStore(st);
    }
    const el = document.querySelector('[data-card-id="' + id + '"]');
    if (el) {
      const fresh = cardHtml(card);
      const wrap = document.createElement('div');
      wrap.innerHTML = fresh;
      const neu = wrap.firstElementChild;
      if (neu) el.replaceWith(neu);
    }
    return card;
  }

  function pin(id, on) {
    const st = loadStore();
    const want = on !== false;
    st.pinned = st.pinned || [];
    if (want) {
      if (!st.pinned.includes(id)) st.pinned.push(id);
    } else {
      st.pinned = st.pinned.filter(x => x !== id);
    }
    if (st.live[id]) {
      st.live[id].pin = want;
      st.live[id].updated = Date.now();
    }
    saveStore(st);
    update(id, { pin: want });
    if (C().toast) C().toast(want ? 'Карточка закреплена' : 'Откреплено');
    return want;
  }

  function pinnedCards() {
    const st = loadStore();
    return (st.pinned || []).map(id => st.live[id]).filter(Boolean);
  }

  /* ─── Object actions from context ─── */
  function objectActions(ctx) {
    ctx = ctx || screenContext();
    const acts = [];
    if (ctx.next) {
      acts.push({
        label: 'К следующему',
        act: 'cmd:что дальше',
        obj: { kind: 'event', title: ctx.next.title }
      });
    }
    if (ctx.tasksOpen) {
      acts.push({ label: 'Задачи', act: 'cmd:что задано', obj: { kind: 'tasks' } });
    }
    if (ctx.docks.calc) {
      acts.push({ label: 'Закрыть калькулятор', act: 'ag:close-calc', obj: { kind: 'dock', id: 'calc' } });
    }
    if (ctx.docks.flow) {
      acts.push({ label: 'Закрыть схемы', act: 'ag:close-flow', obj: { kind: 'dock', id: 'flow' } });
    }
    if (ctx.lastDiagram) {
      acts.push({ label: 'Диаграмма', act: 'tab:diagrams', obj: { kind: 'diagram' } });
    }
    acts.push({ label: 'Что на экране', act: 'cmd:что на экране', obj: { kind: 'meta' } });
    return acts;
  }

  function contextCard() {
    const ctx = screenContext();
    const summary = contextSummary(ctx);
    const lines = [];
    lines.push('<p class="o-glass-p">' + esc(summary) + '</p>');
    if (ctx.today && ctx.today.length) {
      lines.push('<table class="glass-table"><tbody>');
      ctx.today.slice(0, 6).forEach(e => {
        const t0 = Math.floor((e.start || 0) / 60) + ':' + String((e.start || 0) % 60).padStart(2, '0');
        lines.push('<tr><td>' + esc(t0) + '</td><td>' + esc(e.title) + '</td></tr>');
      });
      lines.push('</tbody></table>');
    }
    return pushCard({
      type: 'object',
      title: 'Контекст экрана',
      body: lines.join(''),
      live: true,
      data: ctx,
      actions: objectActions(ctx).slice(0, 5).map(a => ({ label: a.label, act: a.act }))
    }, { text: 'Вот что вижу по экрану и дню.' });
  }

  /* ─── Proactive day card ─── */
  function proactiveLog() {
    try { return JSON.parse(localStorage.getItem(PROACTIVE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function markProactive(slot) {
    const log = proactiveLog();
    const day = new Date().toISOString().slice(0, 10);
    log[day] = log[day] || {};
    log[day][slot] = Date.now();
    // keep 14 days
    Object.keys(log).sort().slice(0, -14).forEach(k => delete log[k]);
    try { localStorage.setItem(PROACTIVE_KEY, JSON.stringify(log)); } catch (e) {}
  }
  function alreadyProactive(slot) {
    const log = proactiveLog();
    const day = new Date().toISOString().slice(0, 10);
    return !!(log[day] && log[day][slot]);
  }

  function buildProactive(slot) {
    const ctx = screenContext();
    const h = new Date().getHours();
    slot = slot || (h < 12 ? 'morning' : (h >= 17 ? 'evening' : 'day'));
    const title = slot === 'morning' ? 'Утро · план дня' : (slot === 'evening' ? 'Вечер · итог' : 'Сейчас · фокус');
    const parts = [];
    if (slot === 'morning') {
      parts.push('<p class="o-glass-p">Доброе утро. Краткий план без лишнего шума.</p>');
    } else if (slot === 'evening') {
      parts.push('<p class="o-glass-p">Вечерняя сводка. Можно закрыть день спокойно.</p>');
    } else {
      parts.push('<p class="o-glass-p">Срез на сейчас.</p>');
    }
    if (ctx.next) {
      const t = Math.floor(ctx.next.start / 60) + ':' + String(ctx.next.start % 60).padStart(2, '0');
      parts.push('<p class="o-glass-p"><b>Дальше:</b> ' + esc(ctx.next.title) + ' · ' + t + '</p>');
    } else {
      parts.push('<p class="o-glass-p">Ближайших событий в расписании нет.</p>');
    }
    if (ctx.today && ctx.today.length) {
      parts.push('<p class="o-glass-p">Сегодня в календаре: <b>' + ctx.today.length + '</b></p>');
    }
    if (ctx.tasksOpen) {
      parts.push('<p class="o-glass-p">Открытых задач: <b>' + ctx.tasksOpen + '</b></p>');
    }
    if (slot === 'evening' && ctx.tasksOpen) {
      parts.push('<p class="o-glass-p">Имеет смысл закрыть 1–2 задачи или перенести на завтра.</p>');
    }
    if (slot === 'morning' && !ctx.next && !ctx.tasksOpen) {
      parts.push('<p class="o-glass-p">Лёгкое утро — можно поставить помидор или добавить цель.</p>');
    }
    const actions = [
      { label: 'Что дальше', act: 'cmd:что дальше' },
      { label: 'Задачи', act: 'cmd:что задано' },
      { label: 'Помидор', act: 'cmd:помидор' }
    ];
    if (slot === 'evening') {
      actions.push({ label: 'Что было', act: 'cmd:что было сегодня' });
    }
    return {
      type: 'proactive',
      title,
      body: parts.join(''),
      live: true,
      pin: false,
      data: { slot, ctx },
      actions
    };
  }

  function maybeProactive(opts) {
    opts = opts || {};
    const st = (S().settings || {});
    if (st.agentProactive === false) return null;
    const h = new Date().getHours();
    let slot = null;
    if (h >= 5 && h < 11) slot = 'morning';
    else if (h >= 17 && h < 23) slot = 'evening';
    else if (opts.force) slot = h < 17 ? 'day' : 'evening';
    else return null;
    if (!opts.force && alreadyProactive(slot)) return null;
    const card = buildProactive(slot);
    markProactive(slot);
    return pushCard(card, { text: card.title });
  }

  function tickLive() {
    // обновление live-карточек контекста / proactive по data.refresh
    const st = loadStore();
    Object.keys(st.live || {}).forEach(id => {
      const c = st.live[id];
      if (!c || !c.live) return;
      if (c.type === 'object' && c.title === 'Контекст экрана') {
        const ctx = screenContext();
        const summary = contextSummary(ctx);
        let body = '<p class="o-glass-p">' + esc(summary) + '</p>';
        if (ctx.today && ctx.today.length) {
          body += '<table class="glass-table"><tbody>';
          ctx.today.slice(0, 6).forEach(e => {
            const t0 = Math.floor((e.start || 0) / 60) + ':' + String((e.start || 0) % 60).padStart(2, '0');
            body += '<tr><td>' + esc(t0) + '</td><td>' + esc(e.title) + '</td></tr>';
          });
          body += '</tbody></table>';
        }
        update(id, { body, data: ctx, actions: objectActions(ctx).slice(0, 5).map(a => ({ label: a.label, act: a.act })) });
      }
    });
  }

  O.cards = {
    screenContext,
    contextSummary,
    contextCard,
    push: pushCard,
    update,
    pin,
    pinnedCards,
    cardHtml,
    objectActions,
    maybeProactive,
    buildProactive,
    tickLive
  };

  // лёгкий тик раз в 60с если агент открыт
  setInterval(() => {
    try {
      if (document.body.getAttribute('data-tab') === 'agent') O.cards.tickLive();
    } catch (e) {}
  }, 60000);
})();

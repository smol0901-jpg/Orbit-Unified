/* Контур · Журнал действий + отчёт сессии без открытой вкладки Агент */
(function () {
  'use strict';
  const O = window.Orbit = window.Orbit || {};
  const KEY = 'contour-action-log';
  const DEFAULT_MAX_KB = 3072; // 3 МБ

  function C() { return window.OrbitCore || O.core && O.core() || {}; }
  function settings() {
    try {
      const s = (C().S && C().S()) || (O.core && O.core().state) || {};
      return (s.settings || {});
    } catch (e) { return {}; }
  }
  function maxBytes() {
    const st = settings();
    if (st.debugLogUnlimited) return Infinity;
    const kb = st.debugLogMaxKb;
    if (kb === 0 || kb === '0') return Infinity;
    const n = +(kb != null ? kb : DEFAULT_MAX_KB);
    return Math.max(64, n) * 1024;
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (e) { return []; }
  }
  function save(arr) {
    let list = arr || [];
    const lim = maxBytes();
    if (lim !== Infinity) {
      while (list.length > 1) {
        const size = new Blob([JSON.stringify(list)]).size;
        if (size <= lim) break;
        list = list.slice(Math.ceil(list.length * 0.15)); // срезать ~15% старых
      }
      // если одна огромная запись — оставить пусто
      if (new Blob([JSON.stringify(list)]).size > lim) list = list.slice(-5);
    } else if (list.length > 2000) {
      list = list.slice(-1500);
    }
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {
      // quota — срезать жёстко
      try { localStorage.setItem(KEY, JSON.stringify(list.slice(-20))); } catch (e2) {}
    }
  }

  function log(entry) {
    const row = Object.assign({
      at: new Date().toISOString(),
      kind: 'tap',
      act: '',
      label: '',
      result: 'ok',
      detail: ''
    }, entry || {});
    const arr = load();
    arr.push(row);
    save(arr);
    // тост только для явных действий в агенте, не для nav
    if (row.kind === 'nav') return row;
    if (row.kind === 'settings' && /^st-|^brand/.test(row.act)) return row;
    try {
      const quiet = settings().debugLogToast === false;
      if (quiet) return row;
      if (row.kind === 'msg') return row; // сообщения без тоста
      const el = document.getElementById('ag-action-toast');
      if (el && row.kind === 'tap' && /^cmd:|^ag:|^tab:calc|^tab:flow|^tab:diagrams|^tab:agent/.test(row.act)) {
        el.textContent = (row.label || row.act) + (row.result === 'ok' ? ' → ok' : ' → ' + row.result);
        el.classList.add('on');
        clearTimeout(log._t);
        log._t = setTimeout(() => el.classList.remove('on'), 1800);
      }
    } catch (e) {}
    return row;
  }

  function clear() { save([]); }
  function list(n) {
    const arr = load();
    return n ? arr.slice(-n) : arr.slice();
  }
  function fmtLine(r) {
    const t = (r.at || '').replace('T', ' ').slice(0, 19);
    return '[' + t + '] ' + (r.kind || 'tap') + '  ' + (r.act || '') +
      (r.label ? '  «' + r.label + '»' : '') +
      '  → ' + (r.result || 'ok') +
      (r.detail ? '  (' + r.detail + ')' : '');
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** Сообщения из памяти агента (не требует открытой вкладки) */
  function getMessages() {
    try {
      if (O.assistant && O.assistant.msgs && O.assistant.msgs.length) {
        return O.assistant.msgs.slice();
      }
    } catch (e) {}
    try {
      if (O.work && O.work.loadMem) {
        const mem = O.work.loadMem();
        if (mem && mem.msgs && mem.msgs.length) return mem.msgs.slice();
      }
    } catch (e) {}
    try {
      const raw = localStorage.getItem('orbit-agent-mem') || localStorage.getItem('contour-agent-mem');
      if (raw) {
        const mem = JSON.parse(raw);
        if (mem && mem.msgs) return mem.msgs;
      }
    } catch (e) {}
    return [];
  }

  function msgToHtml(m) {
    const role = m.role === 'user' ? 'user' : 'bot';
    const time = m.at ? new Date(m.at).toLocaleString('ru-RU') : '';
    let body = '';
    if (m.text) body += '<div class="txt">' + esc(m.text) + '</div>';
    if (m.cards && m.cards.length) {
      body += m.cards.map(c => '<div class="card-wrap">' + c + '</div>').join('');
    }
    if (m.buttons && m.buttons.length) {
      body += '<div class="btns">' + m.buttons.map(b =>
        '<span class="chip">' + esc(b.label || b.act || '') + '</span>'
      ).join('') + '</div>';
    }
    if (m.intent) body += '<div class="intent">intent: ' + esc(m.intent) + '</div>';
    return '<div class="bubble ' + role + '"><div class="meta">' + esc(role) + ' · ' + esc(time) + '</div>' + body + '</div>';
  }

  /** Визуал из памяти + опционально live DOM если агент открыт */
  async function captureVisual() {
    const msgs = getMessages();
    let fromMem = '';
    if (msgs.length) {
      fromMem = msgs.map(msgToHtml).join('\n');
    }
    const root = document.getElementById('ag-msgs');
    if (root && root.children.length) {
      const clone = root.cloneNode(true);
      clone.querySelectorAll('iframe').forEach(el => {
        const ph = document.createElement('div');
        ph.className = 'iframe-ph';
        ph.textContent = '[виджет: ' + (el.title || el.id || 'iframe') + ']';
        el.replaceWith(ph);
      });
      clone.querySelectorAll('button').forEach(b => b.setAttribute('disabled', 'disabled'));
      return '<p class="meta">Снимок открытой ленты + данные из памяти (' + msgs.length + ' сообщ.)</p>' +
        '<div class="live">' + clone.innerHTML + '</div>' +
        (fromMem ? '<h3>Реконструкция из памяти</h3><div class="mem">' + fromMem + '</div>' : '');
    }
    if (fromMem) {
      return '<p class="meta">Лента собрана из памяти агента (вкладка Агент не нужна). Сообщений: ' + msgs.length + '</p>' +
        '<div class="mem">' + fromMem + '</div>';
    }
    return '<p class="meta">Пока нет сообщений в памяти агента. Напишите что-нибудь в Агенте — и выгрузка подтянет историю сама.</p>';
  }

  function buildReport() {
    const A = O.assistant;
    const actions = list();
    const ver = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '') || '';
    const msgs = getMessages();
    const lines = msgs.map(m => {
      const t = new Date(m.at || Date.now()).toISOString();
      const role = m.role === 'user' ? 'USER' : 'BOT';
      return '[' + t + '] ' + role + ': ' + String(m.text || '').replace(/\n/g, ' ');
    });
    return {
      version: ver,
      exportedAt: new Date().toISOString(),
      actions,
      chatText: lines.join('\n'),
      messages: msgs.map(m => ({
        role: m.role, text: m.text, at: m.at, intent: m.intent,
        hasCards: !!(m.cards && m.cards.length),
        buttons: (m.buttons || []).map(b => b.label || b.act)
      })),
      logBytes: new Blob([JSON.stringify(actions)]).size,
      logLimitKb: maxBytes() === Infinity ? 0 : Math.round(maxBytes() / 1024)
    };
  }

  async function buildHtmlReport() {
    const data = buildReport();
    const visual = await captureVisual();
    const actionLines = (data.actions || []).map(fmtLine).join('\n');
    const css = `body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#0b0f1a;color:#e2e8f0;font-size:14px;line-height:1.45}
h1{font-size:1.25rem}h2{font-size:1.05rem;margin:20px 0 8px;border-bottom:1px solid #334155;padding-bottom:4px}
.meta{color:#94a3b8;font-size:.85rem}pre{white-space:pre-wrap;background:#121826;padding:12px;border-radius:12px;font-size:12px;border:1px solid #1e293b}
.bubble{margin:10px 0;padding:10px 12px;border-radius:12px;border:1px solid #334155;background:#0f172a}
.bubble.user{border-color:#6366f1}.bubble.bot{border-color:#22c55e}
.chip{display:inline-block;padding:4px 10px;margin:2px;border-radius:999px;background:#1e293b;font-size:12px}
.intent{font-size:11px;color:#64748b;margin-top:6px}
.card-wrap{margin-top:8px}.iframe-ph{padding:10px;background:#1e293b;border-radius:8px;color:#94a3b8}
img,svg{max-width:100%;height:auto}
@media print{body{background:#fff;color:#111}pre,.bubble{background:#f8fafc;color:#111;border-color:#cbd5e1}}`;
    return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><title>Contour session</title><style>${css}</style></head><body>
<h1>Контур · отчёт сессии</h1>
<p class="meta">v${esc(data.version)} · ${esc(data.exportedAt)} · сообщ. ${data.messages.length} · действий ${data.actions.length} · журнал ~${Math.round((data.logBytes||0)/1024)} КБ (лимит ${data.logLimitKb || '∞'} КБ)</p>
<h2>1. Журнал действий</h2><pre>${esc(actionLines || '(пусто)')}</pre>
<h2>2. Переписка (текст)</h2><pre>${esc(data.chatText || '(пусто)')}</pre>
<h2>3. Лента (из памяти / экрана)</h2>${visual}
</body></html>`;
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  async function exportJson() {
    const data = buildReport();
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'contour-session-' + Date.now() + '.json');
    log({ kind: 'export', act: 'session-json', result: 'ok' });
  }
  async function exportTxt() {
    const data = buildReport();
    const body = ['Contour session', 'v' + data.version, data.exportedAt, '', '=== ACTIONS ===', ...(data.actions||[]).map(fmtLine), '', '=== CHAT ===', data.chatText||''].join('\n');
    downloadBlob(new Blob([body], { type: 'text/plain;charset=utf-8' }), 'contour-session-' + Date.now() + '.txt');
    log({ kind: 'export', act: 'session-txt', result: 'ok' });
  }
  async function exportHtml() {
    const html = await buildHtmlReport();
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), 'contour-session-' + Date.now() + '.html');
    log({ kind: 'export', act: 'session-html', result: 'ok' });
  }
  async function exportPdf() {
    const html = await buildHtmlReport();
    const w = window.open('', '_blank');
    if (!w) {
      await exportHtml();
      if (C().toast) C().toast('Скачан HTML — откройте и Печать → PDF');
      return;
    }
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 400);
    log({ kind: 'export', act: 'session-pdf', result: 'ok' });
  }

  function installClickProbe() {
    if (installClickProbe._on) return;
    installClickProbe._on = true;
    document.addEventListener('click', (e) => {
      try {
        const ag = e.target.closest('[data-ag]');
        if (ag) {
          log({
            kind: 'tap',
            act: ag.getAttribute('data-ag') || '',
            label: (ag.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
            result: 'ok',
            detail: 'data-ag'
          });
          return;
        }
        const sa = e.target.closest('[data-sact]');
        if (sa) {
          log({
            kind: 'settings',
            act: sa.getAttribute('data-sact') || '',
            label: (sa.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
            result: 'ok'
          });
          return;
        }
        const tab = e.target.closest('[data-tab]');
        if (tab && (tab.classList.contains('nav-btn') || tab.closest('.main-nav,.rail-nav'))) {
          // только в журнал, без тоста
          log({
            kind: 'nav',
            act: 'tab:' + tab.getAttribute('data-tab'),
            label: (tab.querySelector('.nav-l') || tab).textContent.replace(/\s+/g, ' ').trim().slice(0, 40),
            result: 'ok'
          });
        }
      } catch (err) {}
    }, true);
  }

  function ensureToast() {
    if (document.getElementById('ag-action-toast')) return;
    const t = document.createElement('div');
    t.id = 'ag-action-toast';
    t.className = 'ag-action-toast';
    t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);
  }

  O.sessionReport = {
    log, clear, list, fmtLine, buildReport, buildHtmlReport,
    exportJson, exportTxt, exportHtml, exportPdf,
    installClickProbe, ensureToast, getMessages, maxBytes
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { installClickProbe(); ensureToast(); });
  } else {
    installClickProbe();
    ensureToast();
  }
})();

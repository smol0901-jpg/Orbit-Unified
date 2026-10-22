/* Контур 5.8.10 · Режим концентрации + расширенный Помидор (таймер, звук, агент) */
(function () {
  const O = window.Orbit = window.Orbit || {};
  const C = () => O.core(), S = () => (C() && C().state) || {};
  const st = () => (S().settings || {});

  const DEFAULTS = {
    focusMode: false,
    focusHide: ['rail', 'more', 'share', 'insights', 'week', 'goals', 'pack'],
    focusKeep: ['today', 'agent', 'tasks', 'schedule'],
    pomoFocusMin: 25,
    pomoBreakMin: 5,
    pomoLongMin: 15,
    pomoCycles: 4,
    pomoSound: true,
    offlineMode: 'auto' // auto | full | minimal
  };

  function cfg() {
    const s = st();
    return {
      focusMin: Math.max(1, Math.min(180, +(s.pomoFocusMin || DEFAULTS.pomoFocusMin))),
      breakMin: Math.max(1, Math.min(60, +(s.pomoBreakMin || DEFAULTS.pomoBreakMin))),
      longMin: Math.max(5, Math.min(60, +(s.pomoLongMin || DEFAULTS.pomoLongMin))),
      cycles: Math.max(2, Math.min(8, +(s.pomoCycles || DEFAULTS.pomoCycles))),
      sound: s.pomoSound !== false,
      offline: s.offlineMode || DEFAULTS.offlineMode
    };
  }

  /* ─── звук окончания фазы ─── */
  function beep(kind) {
    if (!cfg().sound) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = kind === 'break' ? 520 : kind === 'long' ? 440 : 660;
      g.gain.value = 0.08;
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      o.stop(ctx.currentTime + 0.5);
      setTimeout(() => ctx.close(), 600);
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate(kind === 'focus' ? [40, 40, 40] : [80]); } catch (e) {}
  }

  /* ─── Помидор ─── */
  function ensurePomo() {
    O.ui = O.ui || {};
    if (!O.ui.pomodoro) {
      const c = cfg();
      O.ui.pomodoro = { state: 'idle', left: c.focusMin * 60, totalSec: c.focusMin * 60, cycle: 0, total: 0, paused: false, _t: null };
    }
    return O.ui.pomodoro;
  }

  function tick() {
    const p = ensurePomo();
    if (p.paused || p.state === 'idle') return;
    p.left--;
    if (p.left <= 0) {
      const c = cfg();
      if (p.state === 'focus') {
        p.cycle++; p.total++;
        beep('focus');
        if (p.cycle % c.cycles === 0) { p.state = 'long'; p.left = c.longMin * 60; p.totalSec = p.left; }
        else { p.state = 'break'; p.left = c.breakMin * 60; p.totalSec = p.left; }
        try { if (O.notify && O.notify.show) O.notify.show('Помидор', p.state === 'long' ? 'Длинный перерыв' : 'Перерыв ' + c.breakMin + ' мин'); } catch (e) {}
      } else {
        beep(p.state);
        p.state = 'focus'; p.left = c.focusMin * 60; p.totalSec = p.left;
        try { if (O.notify && O.notify.show) O.notify.show('Помидор', 'Снова фокус ' + c.focusMin + ' мин'); } catch (e) {}
      }
    }
    if (O.renderDash) O.renderDash();
    updateFocusBadge();
  }

  O.pomo = {
    start(mins) {
      const c = cfg(), p = ensurePomo();
      const m = Math.max(1, Math.min(180, +(mins || c.focusMin)));
      p.state = 'focus'; p.left = m * 60; p.totalSec = p.left; p.paused = false;
      if (p._t) clearInterval(p._t);
      p._t = setInterval(tick, 1000);
      if (O.renderDash) O.renderDash();
      updateFocusBadge();
      return { ok: true, msg: 'Помидор ' + m + ' мин запущен.' };
    },
    pause() {
      const p = ensurePomo();
      if (p.state === 'idle') return { ok: false, msg: 'Помидор не запущен.' };
      p.paused = !p.paused;
      if (O.renderDash) O.renderDash();
      updateFocusBadge();
      return { ok: true, msg: p.paused ? 'Пауза.' : 'Продолжаем.' };
    },
    reset() {
      const p = ensurePomo(), c = cfg();
      if (p._t) { clearInterval(p._t); p._t = null; }
      p.state = 'idle'; p.left = c.focusMin * 60; p.totalSec = p.left; p.paused = false;
      if (O.renderDash) O.renderDash();
      updateFocusBadge();
      return { ok: true, msg: 'Помидор сброшен.' };
    },
    status() {
      const p = ensurePomo();
      const mm = String(Math.floor(p.left / 60)).padStart(2, '0');
      const ss = String(p.left % 60).padStart(2, '0');
      return { state: p.state, left: p.left, label: mm + ':' + ss, total: p.total || 0, cycle: p.cycle || 0 };
    }
  };

  /* ─── Режим концентрации ─── */
  function applyFocusMode(on) {
    const app = document.getElementById('app') || document.body;
    app.classList.toggle('focus-mode', !!on);
    const btn = document.getElementById('btn-focus-mode');
    if (btn) {
      btn.classList.toggle('on', !!on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = on ? 'Выйти из концентрации' : 'Режим концентрации';
    }
    try {
      const s = S();
      if (s && s.settings) { s.settings.focusMode = !!on; if (C() && C().save) C().save(); }
    } catch (e) {}
    updateFocusBadge();
  }

  O.focusMode = {
    toggle() {
      const on = !(document.getElementById('app') || document.body).classList.contains('focus-mode');
      applyFocusMode(on);
      if (on) {
        const until = st().focusUntil;
        if (until && /^\d{1,2}:\d{2}$/.test(until)) {
          // авто-выход по времени
          const [h, m] = until.split(':').map(Number);
          const now = new Date(), end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
          if (end <= now) end.setDate(end.getDate() + 1);
          const ms = end - now;
          if (O._focusTimer) clearTimeout(O._focusTimer);
          O._focusTimer = setTimeout(() => applyFocusMode(false), ms);
        } else if (+st().focusTimerMin > 0) {
          if (O._focusTimer) clearTimeout(O._focusTimer);
          O._focusTimer = setTimeout(() => applyFocusMode(false), +st().focusTimerMin * 60000);
        }
      } else if (O._focusTimer) { clearTimeout(O._focusTimer); O._focusTimer = null; }
      return on;
    },
    isOn() { return (document.getElementById('app') || document.body).classList.contains('focus-mode'); },
    apply: applyFocusMode
  };

  function updateFocusBadge() {
    const badge = document.getElementById('focus-badge');
    if (!badge) return;
    const p = O.ui && O.ui.pomodoro;
    if (p && p.state !== 'idle') {
      const mm = String(Math.floor(p.left / 60)).padStart(2, '0');
      const ss = String(p.left % 60).padStart(2, '0');
      badge.textContent = mm + ':' + ss;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  /* ─── Offline preload ─── */
  O.offline = {
    async preload(mode) {
      mode = mode || cfg().offline;
      if (!('caches' in window) || !navigator.serviceWorker) return { ok: false, msg: 'Service Worker недоступен.' };
      try {
        const reg = await navigator.serviceWorker.ready;
        const keys = await caches.keys();
        const cache = await caches.open(keys.find(k => k.startsWith('contour-')) || keys[0] || 'contour-offline');
        const urls = ['./', './index.html', './manifest.json', './version.json', './css/styles.css', './css/orbit4.css',
          './js/app.js', './js/orbit/assistant.js', './js/orbit/dash.js', './js/orbit/focus.js',
          './cifra/index.html', './flowforge/index.html'];
        if (mode === 'full') {
          urls.push('./js/qrcode.js', './js/jsQR.js', './js/xlsx.mini.min.js', './cifra/css/style.css', './flowforge/css/style.css',
            './cifra/js/app.js', './flowforge/js/app.js');
        }
        let n = 0;
        for (const u of urls) {
          try { await cache.add(u); n++; } catch (e) {}
        }
        return { ok: true, msg: 'Прогружено файлов: ' + n + ' (режим ' + mode + '). Можно работать офлайн.' };
      } catch (e) {
        return { ok: false, msg: 'Не удалось прогрузить: ' + (e.message || e) };
      }
    },
    mode() { return cfg().offline; }
  };

  /* ─── init UI ─── */
  function mount() {
    const actions = document.querySelector('.header-actions');
    if (actions && !document.getElementById('btn-focus-mode')) {
      const btn = document.createElement('button');
      btn.className = 'icon-btn';
      btn.id = 'btn-focus-mode';
      btn.title = 'Режим концентрации';
      btn.setAttribute('aria-label', 'Концентрация');
      btn.innerHTML = '<span data-ic="target" data-s="20"></span><span id="focus-badge" class="focus-badge" hidden></span>';
      btn.onclick = () => {
        const on = O.focusMode.toggle();
        if (C() && C().toast) C().toast(on ? 'Режим концентрации' : 'Обычный режим');
      };
      const theme = document.getElementById('btn-theme');
      if (theme) actions.insertBefore(btn, theme);
      else actions.appendChild(btn);
      if (O.ic && window.Orbit && Orbit.kit) { /* icons filled by boot */ }
    }
    if (st().focusMode) applyFocusMode(true);
    // restore pomo interval if was running (session only)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else setTimeout(mount, 50);

  // CSS inject
  if (!document.getElementById('focus-mode-css')) {
    const style = document.createElement('style');
    style.id = 'focus-mode-css';
    style.textContent = `
      .focus-mode .rail { display: none !important; }
      .focus-mode .tab-bar button:not([data-tab="today"]):not([data-tab="agent"]):not([data-tab="tasks"]):not([data-tab="schedule"]) { display: none !important; }
      .focus-mode #tab-more, .focus-mode #tab-share, .focus-mode #tab-kanban,
      .focus-mode #tab-pack, .focus-mode #tab-diary, .focus-mode #tab-contacts { display: none !important; }
      .focus-mode .o-w-insights, .focus-mode .o-w-week, .focus-mode .o-w-goals, .focus-mode .o-w-pack { display: none !important; }
      .focus-mode .app-main { max-width: 720px; margin: 0 auto; }
      .focus-mode #btn-focus-mode.on { color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); }
      .focus-badge { position: absolute; bottom: 2px; right: 2px; font-size: 9px; font-weight: 700; background: var(--accent); color: var(--on-accent, #fff); border-radius: 6px; padding: 0 3px; line-height: 1.3; }
      #btn-focus-mode { position: relative; }
      .o-pomo-presets { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      .o-pomo-presets button { font-size: .75rem; }
      .o-share-sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
      .o-share-sheet .o-ch { text-align: center; padding: 12px 8px; border-radius: 14px; background: var(--bg-card); border: 1px solid var(--border); }
      .o-share-sheet .o-ch b { display: block; margin-top: 4px; font-size: .85rem; }
      .o-share-sheet .o-ch small { color: var(--text-muted); font-size: .7rem; }
      .o-qr-box { text-align: center; padding: 12px; }
      .o-qr-box canvas, .o-qr-box img { max-width: 220px; margin: 0 auto; display: block; border-radius: 12px; }
    `;
    document.head.appendChild(style);
  }
})();

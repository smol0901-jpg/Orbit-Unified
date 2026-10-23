/* Контур 4 · ЗАПУСК — маршрутизация экранов, установка (PWA), обновления, импорт по ссылке и «Поделиться в Контур», приветствие */
(function () {
  const O = window.Orbit = window.Orbit || {}, E = O.engine, ic = O.ic, esc = O.esc;
  const C = () => O.core(), S = () => C().state, $ = id => document.getElementById(id);
  const TITLES = { today: 'Сегодня', schedule: 'Расписание', kanban: 'Канбан', pack: 'Сборы', buses: 'Транспорт', agent: 'Ассистент', tasks: 'Задачи', diary: 'Журнал', notes: 'Заметки', contacts: 'Контакты', share: 'Обмен', calc: 'Калькулятор', flow: 'Схемы', settings: 'Настройки', more: 'Ещё', profile: 'Профиль' };

  O.render = tab => {
    switch (tab) {
      case 'today': O.renderDash(); return true;
      case 'buses': O.renderBuses(); return true;
      case 'contacts': O.renderContacts(); return true;
      case 'more': O.renderMore(); return true;
      case 'agent':
        O.assistant.render(true);
        try {
          setTimeout(() => {
            if (O.cards && O.cards.maybeProactive) O.cards.maybeProactive({});
            if (O.onboard && O.onboard.maybeSuggest) O.onboard.maybeSuggest();
          }, 500);
        } catch (e) {}
        return true;
      case 'diagrams': return true;
      case 'share': O.share.render(); return true;
      case 'settings': O.renderSettings(); return true;
    }
    return false;
  };
  O.onTab = tab => {
    O.habits.rec('tab:' + tab, TITLES[tab] || tab);
    const t = $('top-title'); if (t) t.textContent = tab === 'today' ? O.brand().name : (TITLES[tab] || '');
    if (tab !== 'share') O.share && O.share.stopScan();
    document.body.setAttribute('data-tab', tab);
    const more = ['kanban', 'pack', 'tasks', 'diary', 'notes', 'share', 'settings', 'profile', 'more'];
    document.querySelectorAll('.nav-btn[data-tab="more"]').forEach(b => b.classList.toggle('active', more.includes(tab)));
  };
  document.addEventListener('orbit:look', () => { const t = $('top-title'); if (t && C().tab === 'today') t.textContent = O.brand().name; });

  /* ───── установка как приложение ───── */
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; if (C().tab === 'more') O.renderMore(); });
  window.addEventListener('appinstalled', () => { deferred = null; C().toast('Приложение установлено'); });
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  O.canInstall = () => !standalone() && (!!deferred || ios);
  O.install = async () => {
    if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; return; }
    C().openModal('Установка на iPhone / iPad', `<ol class="o-steps"><li>Откройте приложение в <b>Safari</b>.</li><li>Нажмите «Поделиться» ${ic('share', 16)} внизу экрана.</li><li>Выберите <b>«На экран “Домой”»</b>.</li></ol><p class="o-muted">Приложение будет работать офлайн и открываться как обычное.</p>`);
  };

  /* ───── обновления Service Worker ───── */
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    // прежние версии регистрировали отдельные воркеры для калькулятора и схем — они стирали кэш Контура; убираем их
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => { if (/\/(cifra|flowforge)\/$/.test(r.scope)) r.unregister(); })).catch(() => {});
    navigator.serviceWorker.register('sw.js').then(reg => {
      const ask = w => { const t = $('toast'); C().toast('Доступна новая версия — нажмите, чтобы обновить', 12000); t.onclick = () => { w.postMessage('SKIP_WAITING'); t.onclick = null; }; };
      if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); }); });
      setInterval(() => reg.update().catch(() => {}), 3600 * 1000);
    }).catch(() => {});
    // перезагружаем только при ОБНОВЛЕНИИ (уже был контроллер), но не при первой установке — иначе закроются открытые формы
    const hadController = !!navigator.serviceWorker.controller; let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
  }

  /* ───── входящий импорт: ссылка #import=… и «Поделиться в Контур» (share_target) ───── */
  async function incoming() {
    const go = new URLSearchParams(location.search).get('go');
    if (go) { history.replaceState(null, '', location.pathname); if (go === 'free') { C().switchTab('agent'); setTimeout(() => O.assistant.send('я освободился'), 120); } else C().switchTab(go); }
    const h = location.hash;
    if (h.startsWith('#import=')) { const p = decodeURIComponent(h.slice(8)); history.replaceState(null, '', location.pathname + location.search); C().switchTab('share'); O.share.importText(p); return; }
    if (/[?&]shared=1/.test(location.search) && 'caches' in window) {
      try { const c = await caches.open('contour-share'), r = await c.match('/shared.contour'); if (r) { const t = await r.text(); await c.delete('/shared.contour'); history.replaceState(null, '', location.pathname); C().switchTab('share'); O.share.importText(t); } } catch (e) {}
    }
    if ('launchQueue' in window) launchQueue.setConsumer(async p => { if (p.files && p.files[0]) { const f = await p.files[0].getFile(); C().switchTab('share'); O.share.importText(await f.text()); } });
  }

  /* ───── приветствие (первый запуск) ───── */
  function welcome() {
    const s = S(); if (localStorage.getItem('orbit-welcome-v4') || s.lessons.length || s.profile.name) return;
    const core = C();
    core.openModal('Добро пожаловать!', `<p class="o-muted">Выберите оформление — его можно сменить в Настройках в любой момент.</p>
      <div class="form-row"><div class="form-group"><label>Как вас зовут</label><input class="input" id="wl-name" autocomplete="given-name"></div><div class="form-group"><label>Должность</label><input class="input" id="wl-cls" placeholder="Например, руководитель продукта"></div></div>
      <div class="o-brands" id="wl-brands">${O.brandList().map(b => `<button type="button" class="o-brand${b.id === (s.settings.brand || 'orbit') ? ' on' : ''}" data-wb="${b.id}"><span class="o-brand-logo">${O.logo(b.id, 38)}</span><b>${esc(b.name)}</b><small>${esc(b.style)}</small></button>`).join('')}</div>`,
      `<button class="btn btn-secondary" id="wl-ex">С примером</button><button class="btn btn-primary" id="wl-go">Начать</button>`);
    $('wl-brands').onclick = e => { const b = e.target.closest('[data-wb]'); if (!b) return; s.settings.brand = b.dataset.wb; core.save(); core.applyTheme(); document.querySelectorAll('#wl-brands .o-brand').forEach(x => x.classList.toggle('on', x === b)); };
    const fin = ex => {
      const name = $('wl-name').value.trim(), cls = $('wl-cls').value.trim(), brand = core.state.settings.brand || 'orbit';
      localStorage.setItem('orbit-welcome-v4', '1'); core.closeModal();
      if (ex) core.loadExample();                      // пример заменяет данные — выбранные имя, должность и бренд возвращаем
      const t = core.state; if (name) t.profile.name = name; if (cls) t.profile.className = cls; t.settings.brand = brand;
      core.save(); core.applyTheme(); core.render();
    };
    $('wl-go').onclick = () => fin(false); $('wl-ex').onclick = () => fin(true);
  }

  /* ───── горячие клавиши (ПК) ───── */
  document.addEventListener('keydown', e => {
    if (e.target.matches && e.target.matches('input,textarea,select,[contenteditable]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); C().switchTab('agent'); setTimeout(() => { const i = $('ag-in'); i && i.focus(); }, 80); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { 1: 'today', 2: 'schedule', 3: 'buses', 4: 'agent', 5: 'contacts' }; if (map[e.key]) C().switchTab(map[e.key]);
  });

  /* ───── кнопки шапки ───── */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-top]'); if (!t) return; const a = t.dataset.top;
    if (a === 'theme') { const st = S().settings, order = ['dark', 'light', 'amoled', 'auto'], i = order.indexOf(st.theme); st.theme = order[(i + 1) % order.length]; C().save(); C().applyTheme(); C().toast('Тема: ' + ({ dark: 'тёмная', light: 'светлая', amoled: 'AMOLED', auto: 'как в системе' })[st.theme]); }
    else if (a === 'sos') O.openSOS();
    else C().switchTab(a);
  });

  function start() {
    const c = C(); if (!c) return setTimeout(start, 50);
    document.querySelectorAll('[data-ic]').forEach(e => e.innerHTML = O.ic(e.dataset.ic, +e.dataset.s || 22));
    c.applyTheme(); c.render(); O.onTab(c.tab); incoming(); setTimeout(welcome, 400);
    const sos = $('btn-sos'); if (sos) sos.hidden = S().settings.sosEnabled === false;
    document.addEventListener('orbit:look', () => { const b = $('btn-sos'); if (b) b.hidden = S().settings.sosEnabled === false; });
    window.OrbitReady = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

/* FlowForge → агент: схема JSON / PNG (карточка в контейнере чата) */
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data || e.data.t !== 'ff-to-agent') return;
  try {
    const O = window.Orbit, A = O && O.assistant;
    const name = e.data.name || 'Схема';
    const goAgent = () => {
      try {
        if (A) A.panel = 'chat';
        if (O.core && O.core().switchTab) O.core().switchTab('agent');
        setTimeout(() => { try { A && A.render && A.render(true); } catch (err) {} }, 80);
      } catch (err) {}
    };
    if (e.data.kind === 'json' && e.data.doc) {
      O._lastScheme = { name, doc: e.data.doc, at: Date.now() };
      const n = (e.data.doc.nodes || []).length;
      const msg = {
        role: 'bot',
        text: 'Схема «' + name + '» из FlowForge (' + n + ' блоков).',
        cards: ['<div class="o-glass-card o-scheme-card"><div class="o-glass-h"><span>Схема · JSON</span><em>' + n + '</em></div><div class="o-glass-body" style="padding:12px 14px"><p class="o-glass-p"><b>' + String(name).replace(/</g,'&lt;') + '</b></p><p class="o-glass-p" style="color:var(--text-muted);font-size:.8rem">Документ в памяти агента. Откройте редактор или поделитесь.</p></div></div>'],
        buttons: [
          { label: 'Открыть в редакторе', act: 'tab:flow' },
          { label: 'Поделиться', act: 'cmd:поделись схемой' }
        ]
      };
      if (A && A.push) A.push(msg, { panel: 'chat' });
      else if (A && A.msgs) { A.msgs.push(Object.assign({ at: Date.now() }, msg)); }
      goAgent();
      if (O.core && O.core().toast) O.core().toast('Схема «' + name + '» в агенте');
    } else if (e.data.kind === 'png' && e.data.dataUrl) {
      O._lastSchemePng = { name, dataUrl: e.data.dataUrl, at: Date.now() };
      const safeAlt = String(name).replace(/"/g, '&quot;').replace(/</g, '&lt;');
      const card = '<div class="o-glass-card o-scheme-card"><div class="o-glass-h"><span>Схема · PNG</span></div><div class="o-scheme-png"><img src="' + e.data.dataUrl + '" alt="' + safeAlt + '"/></div><p class="o-scheme-cap"><b>' + safeAlt + '</b></p></div>';
      const msg = {
        role: 'bot',
        text: 'PNG схемы «' + name + '» — превью в карточке ниже.',
        cards: [card],
        buttons: [
          { label: 'Скачать PNG', act: 'cmd:скачай схему png' },
          { label: 'Поделиться', act: 'cmd:поделись схемой' },
          { label: 'В редактор', act: 'tab:flow' }
        ]
      };
      if (A && A.push) A.push(msg, { panel: 'chat' });
      else if (A && A.msgs) { A.msgs.push(Object.assign({ at: Date.now() }, msg)); }
      goAgent();
      if (O.core && O.core().toast) O.core().toast('PNG схемы в агенте');
    }
  } catch (err) { console.error('ff-to-agent', err); }
});

})();
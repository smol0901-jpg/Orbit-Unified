/* Контур 5 · НАСТРОЙКИ, РЕЗЕРВНЫЕ КОПИИ, УВЕДОМЛЕНИЯ */
(function () {
  const O = window.Orbit = window.Orbit || {}, E = O.engine, ic = O.ic, esc = O.esc;
  const C = () => O.core(), S = () => C().state, $ = id => document.getElementById(id);

  /* ───── резервные копии (локально, последние 5) ───── */
  const SK = 'orbit-snapshots-v1';
  const readSnaps = () => { try { return JSON.parse(localStorage.getItem(SK) || '[]'); } catch (e) { return []; } };
  O.backup = {
    list: readSnaps,
    snapshot(label) {
      try {
        const s = JSON.parse(JSON.stringify(S())); (s.notes || []).forEach(n => { delete n.audio; });
        if (s.profile) s.profile.photo = '';
        const list = readSnaps(); list.unshift({ at: Date.now(), label: label || 'вручную', data: s }); list.length = Math.min(list.length, 5);
        localStorage.setItem(SK, JSON.stringify(list)); return true;
      } catch (e) { const l = readSnaps(); l.length = Math.min(l.length, 2); try { localStorage.setItem(SK, JSON.stringify(l)); } catch (_) {} return false; }
    },
    restore(i) { const x = readSnaps()[i]; if (!x) return; O.backup.snapshot('перед восстановлением'); C().setState(x.data); C().toast('Копия восстановлена'); },
    auto() { const st = S().settings; if (st.autoBackup === false) return; const l = readSnaps(); if (!l.length || Date.now() - l[0].at > 864e5) O.backup.snapshot('авто'); }
  };
  let bt = null; O.onSave = () => { clearTimeout(bt); bt = setTimeout(() => O.backup.auto(), 2500); };

  /* ───── уведомления ───── */
  const NK = 'orbit-notified-v1';
  const done = () => { try { return new Set(JSON.parse(localStorage.getItem(NK) || '[]')); } catch (e) { return new Set(); } };
  const mark = k => { const d = done(); d.add(k); try { localStorage.setItem(NK, JSON.stringify([...d].slice(-200))); } catch (e) {} };
  O.notify = {
    ok: () => 'Notification' in window && Notification.permission === 'granted',
    async ask() { if (!('Notification' in window)) return false; if (Notification.permission === 'default') await Notification.requestPermission(); return Notification.permission === 'granted'; },
    async show(title, body, tag) {
      C().toast(title + (body ? ': ' + body : ''), 6000); O.vibrate([60, 40, 60]);
      if (!O.notify.ok()) return;
      try { const reg = await navigator.serviceWorker?.getRegistration(); const o = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }; if (reg) reg.showNotification(title, o); else new Notification(title, o); } catch (e) {}
    }
  };
  const quiet = (st, nm) => { const a = E.toMin(st.quietFrom || '22:00'), b = E.toMin(st.quietTo || '07:00'); return a > b ? (nm >= a || nm < b) : (nm >= a && nm < b); };
  O.tick = function () {
    const s = S(), st = s.settings, now = new Date(), nm = E.nowMin(now), ds = E.dateStr(now);
    (s.reminders || []).forEach(r => { if (!r.done && r.at && new Date(r.at) <= now && !done().has('r' + r.id)) { mark('r' + r.id); O.notify.show('Напоминание', r.text, 'r' + r.id); } });
    if (st.notifyLeave) {
      const lead = +st.notifyLead || 10, ev = E.eventsOn(s, now);
      if (ev.list.length && !ev.holiday && !quiet(st, nm)) {
        const les = ev.list.filter(e => e.type !== 'event'), first = les[0], p = E.planSchool(s, now);
        if (p.options[0] && nm < first.s) { const t = p.options[0].leaveBy - lead, k = 'L' + ds + 's'; if (nm >= t && nm <= t + 3 && !done().has(k)) { mark(k); O.notify.show('Пора собираться', `Автобус №${p.options[0].number} в ${p.options[0].time}, выйти в ${E.fmt(p.options[0].leaveBy)}`, k); } }
        const lastE = Math.max(...les.map(e => e.e)), h = E.planHome(s, now, { freeAt: lastE });
        if (h.options[0]) { const t = lastE - lead, k = 'L' + ds + 'h'; if (nm >= t && nm <= t + 3 && !done().has(k)) { mark(k); O.notify.show('Скоро домой', `После встреч (${E.fmt(lastE)}) лучший автобус №${h.options[0].number} в ${h.options[0].time}`, k); } }
      }
    }
    if (st.notifyHw && nm >= 18 * 60 && nm < 18 * 60 + 4) { const g = E.hwGroups(s, now), n = g.today.length + g.tomorrow.length + g.overdue.length, k = 'H' + ds; if (n && !done().has(k)) { mark(k); O.notify.show('Задачи', `Невыполнено на ближайшие дни: ${n}`, k); } }
    if (O.ui.free && Date.now() - O.ui.free.at > 40 * 60000) O.ui.free = null;
  };

  /* ───── схема настроек ───── */
  const seg = (k, opts) => ({ t: 'seg', k, opts });
  const SECTIONS = [
    { id: 'look', title: 'Бренд и стиль', icon: 'palette', items: [
      { t: 'note', text: '<b>Бренд</b> — название, логотип, цвета, форма и имя агента. <b>Тема</b> (светлая/тёмная) работает в любом бренде.' },
      { t: 'brand' },
      { t: 'seg', k: 'theme', label: 'Тема', hint: 'Тёмная — ночной вид · Светлая — дневной · AMOLED — чисто чёрный фон (экономит батарею на OLED-экранах) · Как в системе — по настройке телефона', opts: [['dark', 'Тёмная'], ['light', 'Светлая'], ['amoled', 'AMOLED'], ['auto', 'Как в системе']] },
      { t: 'accent', label: 'Цвет акцента', hint: 'Меняет только главный цвет кнопок и подсветки; остальное остаётся как у бренда. Вернуть цвет бренда — кнопка «Как у бренда»' },
      { t: 'seg', k: 'font', label: 'Шрифт', opts: [['system', 'Как у бренда'], ['sans', 'Обычный'], ['rounded', 'Округлый'], ['serif', 'С засечками'], ['mono', 'Моно'], ['readable', 'Читаемый']] },
      { t: 'range', k: 'textScale', label: 'Размер текста', min: 85, max: 140, step: 5, unit: '%' },
      { t: 'range', k: 'radius', label: 'Скругление углов', min: 4, max: 28, step: 1, unit: 'px', hint: '14 — как задумал бренд' },
      { t: 'toggle', k: 'glass', label: 'Эффект стекла и свечения' },
      { t: 'seg', k: 'motion', label: 'Анимации', opts: [['full', 'Все'], ['auto', 'Как в системе'], ['reduced', 'Меньше'], ['off', 'Выкл']] },
      { t: 'toggle', k: 'contrast', label: 'Высокий контраст', on: 'high', off: 'normal' }] },
    { id: 'dash', title: 'Главный экран', icon: 'home', items: [{ t: 'widgets' }] },
    { id: 'school', title: 'Рабочий день', icon: 'school', items: [
      { t: 'num', k: 'lessonDuration', label: 'Длина встречуа, мин', min: 20, max: 120 }, { t: 'num', k: 'breakDuration', label: 'Пауза, мин', min: 0, max: 60 },
      { t: 'time', k: 'dayStart', label: 'Начало рабочего дня' },
      { t: 'num', k: 'exitMin', label: 'На выход с работы после встречи, мин', min: 0, max: 40, hint: 'Одежда, гардероб, выход — учитывается при расчёте автобуса' },
      { t: 'num', k: 'arriveBefore', label: 'Быть на работе заранее, мин', min: 0, max: 30 }] },
    { id: 'bus', title: 'Автобусы', icon: 'bus', items: [
      { t: 'num', k: 'rideDefault', label: 'Время в пути по умолчанию, мин', min: 1, max: 120 }, { t: 'num', k: 'showBuses', label: 'Сколько рейсов показывать', min: 1, max: 8 }] },
    { id: 'agent', title: 'Агент', icon: 'sparkle', items: [
      { t: 'note', text: 'Под строкой ввода в чате агента — быстрые кнопки.\n• ВЫКЛ (по умолчанию): 4–5 кнопок по ситуации (Что дальше, Задачи, Помощь…).\n• ВКЛ: расширенный набор — Цели, Помидор, QR, Расписание, Калькулятор, Схемы, Память…\nОткройте вкладку Агент после переключения, чтобы увидеть разницу.' },
      { t: 'toggle', k: 'agentProactive', label: 'Проактивные карточки дня', hint: 'Утро/вечер — одна умная сводка в агенте (не чаще 1–2 раз в день).' },
      { t: 'toggle', k: 'agentOnboard', label: 'Обучение 14 дней', hint: 'Подсказки «что умеет агент» и кнопка совета. По умолчанию ВКЛ для новых.' },
      { t: 'note', text: 'Справка: в агенте «обучи меня» / «что умеешь». Раздел помощи ниже в «Поддержка».' },
      { t: 'toggle', k: 'agentChipCats', label: 'Расширенные кнопки в чате (категории)', hint: 'Выкл = мало кнопок. Вкл = много кнопок под полем ввода.' },
      { t: 'range', k: 'agentMemCap', label: 'Память чата (сообщений)', min: 0, max: 5000, step: 50, unit: '', hint: '0 = без лимита. По умолчанию 300. Сколько последних реплик хранить локально.' },
      { t: 'toggle', k: 'agentSuggest', label: 'Учиться на привычках и подсказывать' },
      { t: 'seg', k: 'agentAutonomy', label: 'Изменения данных', opts: [['smart', 'Делать сразу + «Отменить»'], ['ask', 'Спрашивать «Да/Нет»']] },
      { t: 'toggle', k: 'voice', label: 'Голосовой ввод (если поддерживается)' },
      { t: 'toggle', k: 'agentAiPrompt', label: 'Промпт для нейросети при непонимании' },
      { t: 'toggle', k: 'llmEnabled', label: 'Запросы к нейросети по API' },
      { t: 'llmwizard' },
      { t: 'llmprov' },
      { t: 'text', k: 'llmEndpoint', label: 'API Endpoint', hint: 'Полный URL вида …/chat/completions', prov: ['custom'] },
      { t: 'pass', k: 'llmKey', label: 'API Key', prov: ['grok', 'deepseek', 'claude', 'openai', 'custom'] },
      { t: 'text', k: 'llmModel', label: 'Модель', hint: 'GigaChat, grok-2-latest, deepseek-chat, claude-…' },
      { t: 'text', k: 'llmClientId', label: 'GigaChat Client ID', prov: ['giga'] },
      { t: 'pass', k: 'llmClientSecret', label: 'GigaChat Client Secret', prov: ['giga'] },
      { t: 'pass', k: 'llmAuthKey', label: 'GigaChat Authorization Key (base64, опционально)', prov: ['giga'] },
      { t: 'text', k: 'llmScope', label: 'GigaChat Scope', hint: 'GIGACHAT_API_PERS', prov: ['giga'] },
      { t: 'text', k: 'llmProxy', label: 'Proxy URL (CORS)', hint: 'Оставьте ПУСТО. Только если есть свой сервер: https://your-proxy.example.com  (НЕ api.giga.chat)', prov: ['giga', 'custom'] },
      { t: 'agentmem' }] },
    { id: 'sos', title: 'Контакты и SOS', icon: 'sos', items: [
      { t: 'toggle', k: 'sosEnabled', label: 'Показывать кнопку SOS' }, { t: 'text', k: 'sosNumber', label: 'Номер экстренной службы', hint: '112 работает по всей России и с телефона без SIM' }] },
    { id: 'notify', title: 'Уведомления', icon: 'bell', items: [
      { t: 'toggle', k: 'notifyLeave', label: 'Напоминать, когда выходить на автобус', perm: true },
      { t: 'num', k: 'notifyLead', label: 'За сколько минут напомнить', min: 1, max: 60 },
      { t: 'toggle', k: 'notifyHw', label: 'Вечером напомнить про задачу (18:00)', perm: true },
      { t: 'time', k: 'quietFrom', label: 'Тихие часы с' }, { t: 'time', k: 'quietTo', label: 'до' },
      { t: 'note', text: 'Уведомления приходят, пока приложение открыто или установлено и не выгружено из памяти. Для гарантированных push нужен сервер.' },
      { t: 'btn', id: 'test-notify', label: 'Проверить уведомление' }] },
    { id: 'storage', title: 'Память и хранилище', icon: 'refresh', items: [
      { t: 'storage' },
      { t: 'toggle', k: 'storageCap', on: true, off: false, label: 'Ограничить объём данных Контура' },
      { t: 'range', k: 'storageLimitMB', label: 'Лимит данных', min: 5, max: 500, step: 5, unit: ' МБ', hint: 'При превышении Контур сам удаляет второстепенное: старые копии, старую переписку, историю калькулятора. Встречи, задачи, контакты и сценарии не удаляются никогда.' },
      { t: 'storageact' }] },
    { id: 'data', title: 'Данные и копии', icon: 'refresh', items: [{ t: 'toggle', k: 'autoBackup', label: 'Автокопия раз в сутки (последние 5)' }, { t: 'snaps' }] },
    { id: 'focus', title: 'Концентрация и Помидор', icon: 'target', items: [
      { t: 'note', text: 'Концентрация (кнопка ◎ в шапке): скрывает лишние вкладки и боковое меню, оставляет Сегодня / Агент / Задачи / Расписание. На ПК контент по центру на всю ширину.' },
      { t: 'toggle', k: 'focusMode', label: 'Включать концентрацию при запуске приложения' },
      { t: 'note', text: 'Что оставить на экране в режиме концентрации (остальное скрывается):' },
      { t: 'focus-keep' },
      { t: 'num', k: 'focusTimerMin', label: 'Авто-выход из концентрации (мин)', min: 0, max: 240, hint: '0 — не выходить автоматически' },
      { t: 'text', k: 'focusUntil', label: 'Выйти из концентрации в указанное время', hint: 'Формат ЧЧ:ММ, например 18:00. Пусто — не использовать' },
      { t: 'note', text: 'Помидор (команда «помидор» в агенте или виджет на Сегодня): таймер фокуса с кольцом. Длительности ниже — для пресетов и авто-циклов.' },
      { t: 'num', k: 'pomoFocusMin', label: 'Длительность фокуса (мин)', min: 5, max: 120, hint: 'Классика — 25' },
      { t: 'num', k: 'pomoBreakMin', label: 'Короткий перерыв (мин)', min: 1, max: 30, hint: 'Обычно 5' },
      { t: 'num', k: 'pomoLongMin', label: 'Длинный перерыв (мин)', min: 5, max: 60, hint: 'После нескольких циклов, обычно 15' },
      { t: 'num', k: 'pomoCycles', label: 'Циклов до длинного перерыва', min: 2, max: 8, hint: 'Обычно 4' },
      { t: 'toggle', k: 'pomoSound', label: 'Звук и вибрация в конце фазы' },
      { t: 'toggle', k: 'pomoOnDash', label: 'Показывать виджет помидора на «Сегодня»', hint: 'Если выкл. — только из агента' }
    ]},
    { id: 'offline', title: 'Офлайн и кэш', icon: 'download', items: [
      { t: 'seg', k: 'offlineMode', label: 'Режим прогрузки', opts: [['auto', 'Авто'], ['full', 'Полный'], ['minimal', 'Минимальный']], hint: 'Полный — схемы и калькулятор тоже в кэше' },
      { t: 'btn', id: 'offline-preload', label: 'Прогрузить приложение для офлайн' }
    ]},
    { id: 'support', title: 'Поддержка и выгрузка', icon: 'info', items: [
      { t: 'note', text: 'Выгрузка переписки с агентом — для поиска сбоев. Обратная связь уходит на Chef40rever@ro.ru с темой Contour.' },
      { t: 'support' }
    ]},
    { id: 'faq', title: 'Как настроить (справка)', icon: 'help', items: [
      { t: 'faq' }
    ]},
    { id: 'author', title: 'Автор и продукты', icon: 'users', items: [
      { t: 'author' }
    ]},
    { id: 'about', title: 'О приложении', icon: 'info', items: [{ t: 'about' }] }
  ];
  const open = new Set(['look']);

  const item = (it, st) => {
    const v = st[it.k];
    switch (it.t) {
      case 'brand': return `<div class="o-brands">${O.brandList().map(b => `<button class="o-brand${(st.brand || 'contour') === b.id ? ' on' : ''}" data-sact="brand:${b.id}"><span class="o-brand-logo">${O.logo(b.id, 40)}</span><b>${esc(b.name)}</b><small>${esc(b.style)}</small><em>Агент: ${esc(b.agent)}</em></button>`).join('')}</div>`;
      case 'seg': return `<div class="o-set"><label>${it.label}</label>${it.hint ? `<small>${it.hint}</small>` : ''}<div class="o-segs">${it.opts.map(([x, l]) => `<button class="o-chip${(v === undefined ? it.opts[0][0] : v) === x ? ' on' : ''}" data-sk="${it.k}" data-sv="${x}">${l}</button>`).join('')}</div></div>`;
      case 'accent': return `<div class="o-set"><label>${it.label}</label>${it.hint ? `<small>${it.hint}</small>` : ''}<div class="o-sw-row">${O.ACCENTS.map(([n, c]) => `<button class="o-dot${(st.accentCustom || '').toLowerCase() === c ? ' on' : ''}" style="--c:${c}" data-sk="accentCustom" data-sv="${c}" aria-label="${n}"></button>`).join('')}<input type="color" class="o-colorin" data-sk="accentCustom" value="${/^#[0-9a-f]{6}$/i.test(st.accentCustom || '') ? st.accentCustom : '#8b5cf6'}" aria-label="Свой цвет"><button class="o-chip" data-sk="accentCustom" data-sv="">Как у бренда</button></div></div>`;
      case 'range': {
        let show = v;
        if (it.k === 'agentMemCap') {
          if (v == null || v === '') show = 300;
          show = (+show === 0) ? 'без лимита' : (show + (it.unit || ''));
        } else show = (v ?? '') + (it.unit || '');
        const val = it.k === 'agentMemCap' ? (v == null || v === '' ? 300 : v) : (v ?? it.min);
        return `<div class="o-set"><label>${it.label} <b data-range-k="${it.k}">${show}</b></label>${it.hint ? `<small>${it.hint}</small>` : ''}<input type="range" data-sk="${it.k}" min="${it.min}" max="${it.max}" step="${it.step || 1}" value="${val}"></div>`;
      }
      case 'toggle': { const on = it.on !== undefined ? v === it.on : v !== false && !!(v === undefined ? true : v); return `<label class="o-sw"><input type="checkbox" data-sk="${it.k}" data-on="${it.on ?? ''}" data-off="${it.off ?? ''}" ${it.perm ? 'data-perm="1"' : ''}${on ? ' checked' : ''}><i></i><span>${it.label}</span></label>`; }
      case 'num': return `<div class="o-set row"><label>${it.label}</label><input class="input o-num" type="number" inputmode="numeric" data-sk="${it.k}" min="${it.min}" max="${it.max}" value="${v ?? ''}">${it.hint ? `<small>${it.hint}</small>` : ''}</div>`;
      case 'time': return `<div class="o-set row"><label>${it.label}</label><input class="input o-num" type="time" data-sk="${it.k}" value="${esc(v || '')}"></div>`;
      case 'text': return `<div class="o-set row"><label>${it.label}</label><input class="input o-num" data-sk="${it.k}" value="${esc(v ?? '')}">${it.hint ? `<small>${it.hint}</small>` : ''}</div>`;
      case 'llmwizard': {
        const st = S().settings || {};
        const on = !!st.llmEnabled;
        const prov = st.llmProvider || 'custom';
        const pname = (O.llmProviders && O.llmProviders[prov] && O.llmProviders[prov].name) || prov;
        return `<div class="o-set o-llm-wizard">
          <label>Мастер нейросети</label>
          <small>По шагам: включить → провайдер → ключи → проверка. Подскажет, что именно не так.</small>
          <div class="o-wiz-steps" id="llm-wiz-steps">
            <div class="o-wiz-s"><span>1</span> Включите API сверху</div>
            <div class="o-wiz-s"><span>2</span> Выберите провайдер (сейчас: <b>${esc(pname)}</b>)</div>
            <div class="o-wiz-s"><span>3</span> ${(() => { const P = (O.llmProviders || {})[prov] || {}; if (P.noKey || P.free) return 'Ключ не нужен — можно сразу проверять'; if (prov === 'giga') return 'Заполните Client ID и Secret ниже (Proxy оставьте пустым)'; if (prov === 'custom') return 'Укажите Endpoint и API Key ниже'; return 'Вставьте API Key ниже'; })()}</div>
            <div class="o-wiz-s"><span>4</span> Нажмите «Проверить подключение»</div>
          </div>
          <div class="o-wiz-actions">
            <button type="button" class="o-btn" data-sact="llm-test">${ic('sparkle',16)} Проверить подключение</button>
          </div>
          <div id="llm-test-result" class="o-llm-test-result hidden" aria-live="polite"></div>
        </div>`;
      }
      case 'llmprov': {
        const prov = st.llmProvider || 'custom';
        const list = (O.llmProviders && Object.values(O.llmProviders)) || [];
        return `<div class="o-set"><label>Провайдер нейросети</label><div class="o-segs">${list.map(p => `<button type="button" class="o-chip${prov === p.id ? ' on' : ''}" data-sact="llmprov:${p.id}">${p.name}</button>`).join('')}</div>
          <small>${(O.llmProviders && O.llmProviders[prov] && O.llmProviders[prov].hint) || ''}</small></div>`;
      }
      case 'pass': return `<div class="o-set row"><label>${it.label}</label><input class="input o-num" type="password" data-sk="${it.k}" value="${esc(v ?? '')}" autocomplete="off" placeholder="sk-…">${it.hint ? `<small>${it.hint}</small>` : ''}</div>`;
      case 'note': return `<p class="o-note">${ic('info', 13)} ${it.text}</p>`;
      case 'btn': return `<button class="o-btn ghost" data-sact="${it.id}">${it.label}</button>`;
      case 'widgets': return `<div class="o-set"><label>Блоки главного экрана</label><small>Включайте нужные и меняйте порядок стрелками</small><ul class="o-wl">${O.widgetList().map((w, i, a) => `<li class="${w.on ? '' : 'off'}"><label class="o-sw"><input type="checkbox" data-sw="toggle:${w.id}"${w.on ? ' checked' : ''}><i></i><span>${esc(w.name)}</span></label><button class="o-ib" data-sw="up:${w.id}" ${i === 0 ? 'disabled' : ''} aria-label="Выше">${ic('chevD', 16)}</button><button class="o-ib" data-sw="down:${w.id}" ${i === a.length - 1 ? 'disabled' : ''} aria-label="Ниже">${ic('chevD', 16)}</button></li>`).join('')}</ul><button class="o-chip" data-sact="widgets-reset">Сбросить порядок</button></div>`;
      case 'agentmem': {
        const hb = O.habits.size();
        const st = S().settings || {};
        const cap = st.agentMemCap === 0 || st.agentMemCap === '0' ? 0 : (+st.agentMemCap || 300);
        const n = (O.assistant && O.assistant.msgs) ? O.assistant.msgs.length : 0;
        const capLab = cap === 0 ? 'без лимита' : String(cap);
        return `<div class="o-set"><small>В памяти чата: <b>${n}</b> из <b>${capLab}</b>. Привычек: ${hb}. Данные на этом устройстве.</small>
          <div class="o-segs"><button class="o-chip" data-sact="habits-clear">Забыть привычки</button><button class="o-chip" data-sact="agent-mem">Что помнит агент</button></div></div>`;
      }
      case 'snaps': { const l = O.backup.list(); return `<div class="o-set"><div class="o-segs"><button class="o-btn ghost sm" data-sact="snap-now">Сделать копию</button><button class="o-btn ghost sm" data-sact="export-all">Скачать всё (JSON)</button><button class="o-btn ghost sm" data-sact="import-all">Импорт</button></div><ul class="o-snaps">${l.map((x, i) => `<li><span>${new Date(x.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${esc(x.label)}</span><button class="o-chip" data-sact="snap-restore:${i}">Вернуть</button></li>`).join('') || '<li class="o-muted">Копий пока нет</li>'}</ul><button class="o-link danger" data-sact="reset">Сбросить все данные…</button></div>`; }
      case 'storage': return O.storage ? O.storage.html() : '';
      case 'storageact': return O.storage ? O.storage.actions() : '';
      case 'focus-keep': {
        const st = S().settings || {};
        const keep = st.focusKeep || ['today', 'agent', 'tasks', 'schedule'];
        const opts = [
          ['today', 'Сегодня'], ['schedule', 'Расписание'], ['buses', 'Автобус'],
          ['agent', 'Агент'], ['tasks', 'Задачи'], ['notes', 'Заметки'], ['calc', 'Калькулятор']
        ];
        return `<div class="o-set"><label>Элементы в концентрации</label>
          <div class="o-segs o-focus-keep">${opts.map(([id, lab]) =>
            `<button type="button" class="o-chip${keep.includes(id) ? ' on' : ''}" data-sact="focus-keep:${id}">${lab}</button>`
          ).join('')}</div>
          <small>Нажмите, чтобы показать или скрыть вкладку в режиме ◎</small></div>`;
      }
      case 'support': {
        return `<div class="o-set">
          <label>Отчёт без личных данных</label>
          <small>Версия, устройство, флаги настроек (без текста чата, без контактов и коммерции). Для быстрого разбора сбоя.</small>
          <div class="o-feedback-row">
            <button type="button" class="o-chip" data-sact="diag-report">Скачать отчёт</button>
            <button type="button" class="o-chip" data-sact="diag-mail">Отчёт на почту</button>
          </div>
        </div>
        <div class="o-set" style="margin-top:14px">
          <label>Переписка с агентом (по желанию)</label>
          <small>Только если нужно разобрать диалог. Может содержать ваши фразы — не отправляйте, если есть коммерческая/личная тайна.</small>
          <div class="o-feedback-row">
            <button type="button" class="o-chip" data-sact="export-chat-json">Скачать JSON</button>
            <button type="button" class="o-chip" data-sact="export-chat-txt">Скачать TXT</button>
            <button type="button" class="o-chip" data-sact="export-chat-mail">Переписка на почту</button>
          </div>
        </div>
        <div class="o-set" style="margin-top:14px">
          <label>Отчёт сессии (для разбора с разработчиком)</label>
          <small>Журнал и переписка подтягиваются <b>из памяти</b> — вкладку Агент открывать не нужно. HTML → «Печать → PDF». Может содержать личные данные.</small>
          <div class="o-set row" style="margin-top:8px"><label>Память журнала действий (КБ)</label>
            <input class="input o-num" type="range" min="0" max="8192" step="256" data-sk="debugLogMaxKb" value="${esc(String((S().settings||{}).debugLogMaxKb != null ? (S().settings||{}).debugLogMaxKb : 3072))}" />
            <small><b data-range-k="debugLogMaxKb">${esc(String((S().settings||{}).debugLogMaxKb != null ? (S().settings||{}).debugLogMaxKb : 3072))}</b> КБ · 0 = без лимита. По умолчанию 3072 (~3 МБ).</small></div>
          <div class="o-set row"><label>Тосты «кнопка → ok»</label>
            <button type="button" class="o-chip${(S().settings||{}).debugLogToast === false ? '' : ' on'}" data-sact="toggle-debug-toast">${(S().settings||{}).debugLogToast === false ? 'Выкл' : 'Вкл'}</button>
            <small>Переходы по вкладкам всегда без тоста, только в журнал.</small></div>
          <div class="o-feedback-row">
            <button type="button" class="o-chip" data-sact="session-json">JSON + действия</button>
            <button type="button" class="o-chip" data-sact="session-txt">TXT + действия</button>
            <button type="button" class="o-chip" data-sact="session-html">HTML (лента)</button>
            <button type="button" class="o-btn pri" data-sact="session-pdf">PDF (печать)</button>
          </div>
        </div>
        <div class="o-set" style="margin-top:14px">
          <label>Обратная связь + скриншот</label>
          <small>Тема письма всегда «Contour …». Скриншот: выберите файл — он скачается/откроется share; в письме укажите «см. вложение» и приложите вручную (почтовые клиенты на iOS/Android так надёжнее).</small>
          <select class="input" id="fb-kind" style="margin-top:8px">
            <option value="problem">Проблема / сбой</option>
            <option value="wish">Пожелание</option>
            <option value="agent">Агент</option>
            <option value="tab">Вкладка / экран</option>
            <option value="calc">Калькулятор</option>
            <option value="flow">Схемы FlowForge</option>
            <option value="other">Другое</option>
          </select>
          <textarea class="textarea o-feedback-area input" id="fb-text" placeholder="Опишите, что происходит или чего не хватает…"></textarea>
          <input type="file" id="fb-shot" accept="image/*,.png,.jpg,.jpeg,.webp,.heic,application/pdf" style="margin-top:8px;width:100%" />
          <div class="o-feedback-row">
            <button type="button" class="o-btn pri" data-sact="feedback-send">Письмо на Chef40rever@ro.ru</button>
            <button type="button" class="o-chip" data-sact="feedback-share">Поделиться (система)</button>
          </div>
        </div>`;
      }
      case 'faq': {
        return `<div class="o-set-faq">
          <details open><summary>Что такое «расширенные кнопки» в чате?</summary>
            <p>Настройки → <b>Агент</b> → <b>«Расширенные кнопки в чате»</b>.\n• <b>Выкл</b> — 4–5 кнопок (Что дальше, Задачи, Помощь…).\n• <b>Вкл</b> — много кнопок: Цели, Помидор, QR, Расписание, Калькулятор, Схемы, Память…\nПосле переключения откройте вкладку <b>Агент</b> — ряд под полем ввода изменится. Кнопка «+ ещё» ведёт сюда же.</p>
          </details>
          <details><summary>Память чата</summary>
            <p>Настройки → Агент → бегунок <b>Память чата</b>. 0 = без лимита, по умолчанию 300. В блоке «Что помнит агент» видно «N из M».</p>
          </details>
          <details><summary>Концентрация</summary>
            <p>Кнопка ◎ в верхней панели. Раздел <b>Концентрация и Помидор</b>: авто-выход по минутам или до времени ЧЧ:ММ. На ПК боковое меню скрывается, контент на всю ширину.</p>
          </details>
          <details><summary>Помидор</summary>
            <p>В агенте: «помидор» / «запусти помодоро 25». Длительности — в <b>Концентрация и Помидор</b>. Карточка в ленте чата, «Закрепить» — сверху.</p>
          </details>
          <details><summary>Схема в агент</summary>
            <p>В FlowForge отправьте схему в агент (JSON или PNG). В чате должна появиться стеклянная карточка с превью. Если нет — обновите кэш (версия в «О приложении»).</p>
          </details>
          <details><summary>Выгрузка и поддержка</summary>
            <p>Настройки → <b>Поддержка и выгрузка</b>: скачать переписку или написать на Chef40rever@ro.ru.</p>
          </details>
        </div>`;
      }
      case 'author': {
        return `<div class="o-set">
          <label>Автор FlowForge / Контура</label>
          <p class="o-note">Смолянинов Александр · ASV Prod</p>
          <div class="o-segs" style="flex-direction:column;align-items:stretch;gap:8px">
            <a class="o-btn" href="https://smol0901-jpg.github.io/Flowforge-2-3/" target="_blank" rel="noopener">${ic('flow',16)} Продукты</a>
            <a class="o-btn ghost" href="https://t.me/ASV_prod" target="_blank" rel="noopener">${ic('message',16)} Связь с автором</a>
            <a class="o-chip" href="https://github.com/smol0901-jpg" target="_blank" rel="noopener">GitHub</a>
            <a class="o-chip" href="https://dzen.ru/asv_prod" target="_blank" rel="noopener">Дзен</a>
            <a class="o-chip" href="https://vk.com/smolyaninovchef" target="_blank" rel="noopener">VK</a>
          </div>
          <small>Две отдельные кнопки: каталог продуктов и прямой контакт.</small>
        </div>`;
      }
      case 'about': { const b = O.brand(); return `<div class="o-about"><span data-brand-logo="54"></span><div><b>${esc(b.name)}</b> <em>v${C().version}</em><div class="o-muted">${esc(b.tag)}</div></div></div><div class="o-segs">${O.canInstall && O.canInstall() ? `<button class="o-btn" data-sact="install">${ic('download', 16)} Установить</button>` : ''}<button class="o-btn ghost" data-sact="update">${ic('refresh', 16)} Проверить обновление</button></div><p class="o-muted">Горячие клавиши: <kbd>Ctrl</kbd>+<kbd>K</kbd> — агент, <kbd>1</kbd>–<kbd>5</kbd> — разделы (на ПК).</p>`; }
    }
    return '';
  };

  function llmTune(i, st) {
    if (i.k !== 'llmKey' && i.k !== 'llmModel') return i;
    const prov = st.llmProvider || 'custom', P = (O.llmProviders || {})[prov] || {};
    if (i.k === 'llmKey') return Object.assign({}, i, { label: 'API Key' + (P.name ? ' · ' + P.name : '') });
    return Object.assign({}, i, { hint: P.models && P.models.length ? 'Например: ' + P.models.join(', ') : 'Название модели у вашего провайдера' });
  }
  O.renderSettings = function () {
    const root = $('settings-root'); if (!root) return; const st = S().settings;
    root.innerHTML = SECTIONS.map(sec => `<details class="o-sec" data-sec="${sec.id}"${open.has(sec.id) ? ' open' : ''}><summary>${ic(sec.icon, 20)}<b>${sec.title}</b>${ic('chevD', 16)}</summary><div class="o-sec-b">${sec.items.filter(i => !i.prov || i.prov.includes(st.llmProvider || 'custom')).map(i => item(llmTune(i, st), st)).join('')}</div></details>`).join('');
    O.look(st); document.querySelectorAll('#settings-root [data-brand-logo]').forEach(e => e.innerHTML = O.logo(O.brand().id, +e.dataset.brandLogo || 28));
  };

  function set(k, v) {
    const s = S(); s.settings[k] = v; C().save(); C().applyTheme();
    if (k === 'agentChipCats') {
      try {
        if (O.assistant && O.assistant.render) {
          O.assistant.panel = 'chat';
          O.assistant.render(true);
        }
        C().toast(v
          ? 'Расширенные кнопки ВКЛ — откройте Агент: Цели, Помидор, QR, Схемы…'
          : 'Короткий набор кнопок (выкл.) — только основные');
      } catch (e) {}
    }
  }
  async function sact(a, p) {
    const core = C(), s = S();
    if (a.startsWith('st-') && O.storage) return O.storage.act(a, p);
    if (a === 'offline-preload') {
      core.toast('Прогрузка…');
      const r = await (O.offline && O.offline.preload());
      core.toast((r && r.msg) || 'Готово');
      return;
    }
    if (a === 'brand') { set('brand', p); O.renderSettings(); core.toast('Бренд: ' + O.brands[p].name); }
    else if (a === 'widgets-reset') { set('widgets', null); O.renderSettings(); }
    else if (a === 'habits-clear') { O.habits.clear(); core.toast('Привычки очищены'); O.renderSettings(); }
    else if (a === 'agent-mem') O.assistant.ask('что ты помнишь');
    else if (a === 'export-chat-json' || a === 'export-chat-txt' || a === 'export-chat-mail') {
      try {
        const A = O.assistant;
        if (!A || !A.exportChat) { C().toast('Агент не готов'); return; }
        const ex = A.exportChat();
        const ver = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '') || '';
        if (a === 'export-chat-json') {
          const blob = new Blob([ex.json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url; link.download = 'contour-chat-' + Date.now() + '.json';
          link.click(); URL.revokeObjectURL(url);
          C().toast('JSON сохранён');
        } else if (a === 'export-chat-txt') {
          const blob = new Blob([ex.text], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url; link.download = 'contour-chat-' + Date.now() + '.txt';
          link.click(); URL.revokeObjectURL(url);
          C().toast('TXT сохранён');
        } else {
          const sub = encodeURIComponent('Contour ' + ver + ' — переписка агента / проблема');
          const body = encodeURIComponent(
            'Версия: ' + ver + '\\nСообщений: ' + ex.payload.count + '\\nДата: ' + ex.payload.exportedAt +
            '\\n\\n--- Переписка ---\\n' + ex.text.slice(0, 8000) +
            (ex.text.length > 8000 ? '\\n…(обрезано, приложите JSON)' : '')
          );
          location.href = 'mailto:Chef40rever@ro.ru?subject=' + sub + '&body=' + body;
        }
      } catch (e) { console.error(e); C().toast('Не удалось выгрузить'); }
    }
        else if (a === 'diag-report' || a === 'diag-mail') {
      try {
        const ver = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '') || (C().version || '');
        const st = S().settings || {};
        const safe = {
          app: 'Contour', version: ver, at: new Date().toISOString(),
          ua: navigator.userAgent || '', lang: navigator.language || '', online: navigator.onLine,
          viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
          flags: {
            agentChipCats: !!st.agentChipCats, agentMemCap: st.agentMemCap, theme: st.theme,
            llmProvider: st.llmProvider || null, offlineMode: st.offlineMode, focusMode: !!st.focusMode,
            pomoFocusMin: st.pomoFocusMin
          },
          note: 'Diagnostic only. No chat, contacts, or commercial data.'
        };
        const json = JSON.stringify(safe, null, 2);
        if (a === 'diag-report') {
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url; link.download = 'contour-diag-' + Date.now() + '.json';
          link.click(); URL.revokeObjectURL(url);
          C().toast('Отчёт сохранён (без личных данных)');
        } else {
          const sub = encodeURIComponent('Contour ' + ver + ' — диагностический отчёт');
          const body = encodeURIComponent('Без переписки и контактов.\n\n' + json);
          location.href = 'mailto:Chef40rever@ro.ru?subject=' + sub + '&body=' + body;
        }
      } catch (e) { C().toast('Не удалось собрать отчёт'); }
    }
        else if (a === 'toggle-debug-toast') {
      const st = S().settings || {};
      set('debugLogToast', st.debugLogToast === false ? true : false);
      O.renderSettings();
      C().toast((S().settings || {}).debugLogToast === false ? 'Тосты отладки выкл' : 'Тосты отладки вкл');
    }
    else if (a === 'focus-keep') {
      const id = String(p || '').trim();
      const st = S().settings || {};
      let keep = (st.focusKeep || ['today', 'agent', 'tasks', 'schedule']).slice();
      if (keep.includes(id)) keep = keep.filter(x => x !== id);
      else keep.push(id);
      if (!keep.length) keep = ['today'];
      set('focusKeep', keep);
      try { if (O.focusMode && O.focusMode.apply) O.focusMode.apply(O.focusMode.isOn && O.focusMode.isOn()); } catch (e) {}
      O.renderSettings();
    }
    else if (a === 'session-json' || a === 'session-txt' || a === 'session-html' || a === 'session-pdf') {
      (async () => {
        try {
          const SR = O.sessionReport;
          if (!SR) { C().toast('Модуль отчёта не загружен'); return; }
          C().toast('Готовлю отчёт…');
          if (a === 'session-json') await SR.exportJson();
          else if (a === 'session-txt') await SR.exportTxt();
          else if (a === 'session-html') await SR.exportHtml();
          else await SR.exportPdf();
          C().toast(a === 'session-pdf' ? 'Печать: «Сохранить как PDF»' : 'Отчёт сохранён');
        } catch (e) {
          console.error(e);
          C().toast('Не удалось собрать отчёт');
        }
      })();
    }
    else if (a === 'feedback-send') {
      try {
        const kind = (document.getElementById('fb-kind') || {}).value || 'problem';
        const text = ((document.getElementById('fb-text') || {}).value || '').trim();
        if (!text) { C().toast('Напишите сообщение'); return; }
        const ver = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '') || '';
        const labels = { problem: 'Проблема', wish: 'Пожелание', agent: 'Агент', tab: 'Вкладка', calc: 'Калькулятор', flow: 'Схемы', other: 'Другое' };
        const sub = encodeURIComponent('Contour ' + ver + ' — ' + (labels[kind] || kind));
        const body = encodeURIComponent(
          'Категория: ' + (labels[kind] || kind) + '\\nВерсия: ' + ver +
          '\\nУстройство: ' + (navigator.userAgent || '') +
          '\\n\\n' + text
        );
        location.href = 'mailto:Chef40rever@ro.ru?subject=' + sub + '&body=' + body;
        C().toast('Откройте почту; скриншот приложите вручную');
      } catch (e) { C().toast('Не удалось открыть почту'); }
    }
    else if (a === 'feedback-share') {
      (async () => {
        try {
          const text = ((document.getElementById('fb-text') || {}).value || '').trim() || 'Сообщение из Контура';
          const fileEl = document.getElementById('fb-shot');
          const shareData = { title: 'Contour feedback', text: text };
          if (fileEl && fileEl.files && fileEl.files[0] && navigator.canShare && navigator.canShare({ files: [fileEl.files[0]] })) {
            shareData.files = [fileEl.files[0]];
          }
          if (navigator.share) { await navigator.share(shareData); C().toast('Готово'); }
          else C().toast('Share недоступен — используйте письмо');
        } catch (e) {
          if (e && e.name === 'AbortError') return;
          C().toast('Не удалось поделиться');
        }
      })();
    }
    else if (a === 'llmprov') {
      if (O.llmApplyProvider) O.llmApplyProvider(p);
      else set('llmProvider', p);
      O.renderSettings();
      const names = { giga: 'GigaChat', grok: 'Grok', deepseek: 'DeepSeek', claude: 'Claude', openai: 'OpenAI', custom: 'Другая' };
      C().toast('Провайдер: ' + (names[p] || p) + (p === 'giga' ? ' · Proxy оставьте пустым' : ''));
    }
    else if (a === 'llm-wiz-giga') {
      set('llmEnabled', true);
      if (O.llmApplyProvider) O.llmApplyProvider('giga');
      else { set('llmProvider', 'giga'); set('llmEndpoint', 'https://api.giga.chat/v1/chat/completions'); set('llmModel', 'GigaChat'); }
      set('llmScope', 'GIGACHAT_API_PERS');
      const px = S().settings.llmProxy || '';
      if (px && /giga\.chat|sberbank/i.test(px)) set('llmProxy', '');
      O.renderSettings();
      C().toast('GigaChat: вставьте Client ID и Secret → «Проверить подключение»');
    }
    else if (a === 'llm-test') {
      const box = document.getElementById('llm-test-result');
      if (box) {
        box.classList.remove('hidden');
        box.innerHTML = '<p class="o-muted">Проверка по шагам…</p>';
      }
      if (!O.llmTest) { C().toast('Модуль llm.js не загружен — обновите страницу'); return; }
      try {
        const r = await O.llmTest();
        if (!box) { C().toast(r.summary); return; }
        const rows = (r.steps || []).map(s => {
          const icon = s.ok === true ? '✓' : (s.ok === false ? '✗' : '…');
          const cls = s.ok === true ? 'ok' : (s.ok === false ? 'bad' : '');
          return '<div class="o-test-step ' + cls + '"><b>' + icon + ' ' + esc(s.title) + '</b><span>' + esc(s.detail) + '</span></div>';
        }).join('');
        box.innerHTML = '<div class="o-test-sum ' + (r.ok ? 'ok' : 'bad') + '">' + (r.ok ? '✓ ' : '✗ ') + esc(r.summary) + '</div>' + rows;
        C().toast(r.ok ? 'Нейросеть работает' : 'Смотрите, какой шаг красный');
      } catch (e) {
        if (box) box.innerHTML = '<div class="o-test-sum bad">Сбой: ' + esc(e.message || e) + '</div>';
        C().toast('Сбой проверки');
      }
    }
    else if (a === 'snap-now') { O.backup.snapshot('вручную'); core.toast('Копия создана'); O.renderSettings(); }
    else if (a === 'snap-restore') { if (confirm('Вернуть эту копию? Текущие данные сохранятся отдельной копией.')) O.backup.restore(+p); }
    else if (a === 'export-all') O.download(new Blob([JSON.stringify(s)], { type: 'application/json' }), `contour-backup-${E.dateStr(new Date())}.json`);
    else if (a === 'import-all') { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,.orbit,application/json'; i.onchange = async () => { if (i.files[0]) O.share.importText(await i.files[0].text()); }; i.click(); }
    else if (a === 'reset') { if (confirm('Удалить ВСЕ данные приложения? Перед этим будет сделана копия.')) { O.backup.snapshot('перед сбросом'); core.setState({}); core.toast('Данные сброшены'); } }
    else if (a === 'install') O.install();
    else if (a === 'update') { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) { await reg.update(); core.toast(reg.waiting ? 'Обновление готово — перезапустите' : 'У вас последняя версия'); if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING'); } else core.toast('Обновления проверяются, когда приложение открыто по адресу сайта'); }
    else if (a === 'test-notify') { const ok = await O.notify.ask(); O.notify.show('Контур', ok ? 'Уведомления работают' : 'Разрешите уведомления в браузере', 'test'); }
  }
  document.addEventListener('click', e => {
    const r = e.target.closest('#settings-root'); if (!r) return;
    const sa = e.target.closest('[data-sact]'); if (sa) { const [a, ...p] = sa.dataset.sact.split(':'); sact(a, p.join(':')); return; }
    const sk = e.target.closest('button[data-sk]'); if (sk) { set(sk.dataset.sk, sk.dataset.sv === '' ? '' : (isNaN(+sk.dataset.sv) || /^#/.test(sk.dataset.sv) ? sk.dataset.sv : +sk.dataset.sv)); O.vibrate(6); O.renderSettings(); return; }
    const sw = e.target.closest('button[data-sw]'); if (sw) { const [a, id] = sw.dataset.sw.split(':'), l = O.widgetList(), i = l.findIndex(w => w.id === id), j = a === 'up' ? i - 1 : i + 1; if (j >= 0 && j < l.length) { [l[i], l[j]] = [l[j], l[i]]; set('widgets', l.map(({ id, on }) => ({ id, on }))); O.renderSettings(); } }
  });
  document.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('#settings-root details')) { d.open ? open.add(d.dataset.sec) : open.delete(d.dataset.sec); } }, true);
  document.addEventListener('change', async e => {
    const el = e.target; if (!el.closest || !el.closest('#settings-root')) return;
    if (el.dataset.sw) { const [, id] = el.dataset.sw.split(':'), l = O.widgetList(); l.find(w => w.id === id).on = el.checked; set('widgets', l.map(({ id, on }) => ({ id, on }))); O.renderSettings(); return; }
    const k = el.dataset.sk; if (!k) return;
    if (el.type === 'checkbox') { if (el.dataset.perm && el.checked) { const ok = await O.notify.ask(); if (!ok) C().toast('Разрешите уведомления в браузере, иначе они не появятся', 4000); } const on = el.dataset.on, off = el.dataset.off; set(k, on ? (el.checked ? on : off) : el.checked); }
    else if (el.type === 'range') set(k, +el.value);
    else if (el.type === 'number') set(k, +el.value);
    else set(k, el.value);
    if (el.type === 'range') O.renderSettings();
  });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.type === 'range' && el.closest && el.closest('#settings-root')) {
      const lab = el.parentElement.querySelector('label b');
      const k = el.dataset.sk;
      if (lab) {
        if (k === 'agentMemCap') lab.textContent = (+el.value === 0) ? 'без лимита' : el.value;
        else {
          const unit = (lab.textContent.match(/[^\d.-]+$/) || [''])[0];
          lab.textContent = el.value + unit;
        }
      }
      set(k, +el.value);
    }
    if (el.type === 'color' && el.closest && el.closest('#settings-root')) set('accentCustom', el.value);
  });
})();

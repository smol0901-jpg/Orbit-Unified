/* Контур 4.2.0 · АГЕНТ — вкладки (чат/быстрые/день/навыки), полный CRUD через Orbit.actions,
   live-подсказки, LLM API, защита SOS. Legacy-команды встреч — через мост. */
(function () {
  const O = window.Orbit = window.Orbit || {}, E = O.engine, ic = O.ic, esc = O.esc, N = E.N;
  const C = () => O.core(), S = () => C().state, $ = id => document.getElementById(id);
  const DAYF = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье'];
  const left = m => m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${m % 60 ? (m % 60) + ' мин' : ''}`.trim();
  let mem = (O.work && O.work.loadMem) ? O.work.loadMem() : { aliases: {}, notes: [], msgs: [], facts: [] };
  let undoStack = [], pending = {}, legacy = false, busy = false, wiz = null;
  const saveMem = () => { if (O.work && O.work.saveMem) O.work.saveMem(mem); };
  const A = O.assistant = {
    msgs: (mem.msgs || []).map(m => ({ role: m.role, text: m.text, at: m.at })),
    panel: 'chat'
  };
  A._undoPush = fn => { if (typeof fn === 'function') undoStack.push(fn); };
  const name = () => O.brand().agent;

  /* ───── разбор времени и дат ───── */
  const pad = n => String(n).padStart(2, '0');
  function timeIn(n) {
    let m;
    if ((m = n.match(/(?:^|\s)(?:в|к|после|до|около)\s*(\d{1,2})[:.\s](\d{2})(?!\d)/))) return { at: +m[1] * 60 + +m[2] };
    if ((m = n.match(/(?:^|\s)(?:в|к|после|около)\s*(\d{1,2})\s*(?:час[а-яёa-z0-9_]*|ч)(?:\s|$)/))) return { at: +m[1] * 60 };
    if (/через\s+полчаса/.test(n)) return { off: 30 };
    if (/через\s+(?:час|1 час)(?:\s|$)/.test(n)) return { off: 60 };
    if ((m = n.match(/через\s+(\d{1,3})\s*(мин[а-яёa-z0-9_]*|м(?![а-яёa-z0-9_]))/))) return { off: +m[1] };
    if ((m = n.match(/через\s+(\d{1,2})\s*(час[а-яёa-z0-9_]*|ч(?![а-яёa-z0-9_]))/))) return { off: +m[1] * 60 };
    return null;
  }
  function dayIn(n, now) {
    const idx = E.dayIdx(now);
    if (/послезавтра/.test(n)) return { d: E.addDays(now, 2), label: 'послезавтра' };
    if (/завтра/.test(n)) return { d: E.addDays(now, 1), label: 'завтра' };
    if (/сегодня|сейчас/.test(n)) return { d: now, label: 'сегодня' };
    const map = [['понедельник|(?:^|\\s)пн(?:\\s|$)', 0], ['вторник|(?:^|\\s)вт(?:\\s|$)', 1], ['сред[ауые]|(?:^|\\s)ср(?:\\s|$)', 2], ['четверг|(?:^|\\s)чт(?:\\s|$)', 3], ['пятниц|(?:^|\\s)пт(?:\\s|$)', 4], ['суббот|(?:^|\\s)сб(?:\\s|$)', 5], ['воскресен|(?:^|\\s)вс(?:\\s|$)', 6]];
    for (const [re, i] of map) if (new RegExp(re).test(n)) { const diff = (i - idx + 7) % 7; return { d: E.addDays(now, diff), label: DAYF[i] }; }
    return null;
  }

  /* ───── контакты ───── */
  const REL = [[/мам/, 'мам'], [/пап/, 'пап'], [/бабуш/, 'бабуш'], [/дедуш|(?:^|\s)деда/, 'дед'], [/брат/, 'брат'], [/сестр/, 'сестр'], [/тет[яеюи]/, 'тет'], [/дяд/, 'дяд'], [/учител/, 'учител'], [/классн/, 'классн'], [/тренер/, 'тренер'], [/друг|подруг/, 'друг']];
  function findPeople(q) {
    const s = S(), nq = N(q).trim(); if (!nq) return [];
    const key = nq.replace(/[^а-яa-z0-9 ]/g, '').trim();
    const al = mem.aliases[key]; if (al) { const p = s.people.find(x => x.id === al); if (p) return [p]; }
    for (const [re, stem] of REL) if (re.test(nq)) { const r = s.people.filter(p => N(p.relation).includes(stem) || N(p.name).includes(stem)); if (r.length) return r; }
    return s.people.filter(p => N(p.name).split(/\s+/).some(w => w.length > 2 && nq.includes(w.slice(0, Math.max(3, w.length - 2)))));
  }
  const phoneOf = p => O.digits(p.phone || p.phone2 || '');
  const smsHref = (p, text) => `sms:${phoneOf(p)}${/iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(text)}`;

  /* ───── карточки ───── */
  const busCard = (o, i, mode) => `<div class="o-bopt${i === 0 ? ' best' : ''}"><div class="o-bus-no">№${esc(o.number || '—')}</div><div class="o-bopt-b"><div class="o-bopt-t">${esc(o.time)}${i === 0 ? '<em>лучший</em>' : ''}</div><div class="o-bopt-m">Выйти в <b>${E.fmt(o.leaveBy)}</b> · запас ${left(Math.max(0, o.slack))} · ${mode === 'school' ? 'на работе' : 'дома'} ≈ ${E.fmt(o.arrive)}</div></div></div>`;
  const personCard = (p, text) => { const ph = phoneOf(p); return `<div class="o-pcard">${O.avatar(p, 46)}<div class="o-pcard-t"><b>${esc(p.name)}</b><span>${esc(p.relation || '')}${p.phone ? ' · ' + esc(p.phone) : ''}</span></div>${ph ? `<a class="o-act call" href="tel:${esc(ph)}" data-call="${p.id}">${ic('phone', 18)}<span>Позвонить</span></a><a class="o-act" href="${esc(smsHref(p, text || ''))}" data-call="${p.id}">${ic('message', 18)}<span>SMS</span></a>` : `<button class="o-btn ghost sm" data-act="person:${p.id}">Добавить номер</button>`}</div>`; };
  const evList = list => glassTable('Расписание', list.map(e => ({
    left: (e.start || '') + (e.end ? '–' + e.end : ''),
    title: e.title || '—',
    meta: e.place || ''
  })));
  /* Стеклянные карточки-таблицы для задач, целей, планов, напоминаний */
  function glassTable(title, rows, opts) {
    opts = opts || {};
    if (!rows || !rows.length) {
      return `<div class="o-glass-card"><div class="o-glass-h"><span>${esc(title)}</span></div><div class="o-glass-empty">${esc(opts.empty || 'Пусто')}</div></div>`;
    }
    const body = rows.map((r, i) => {
      const bar = r.pct != null ? `<div class="o-glass-bar"><i style="width:${Math.max(0, Math.min(100, +r.pct))}%"></i></div>` : '';
      return `<div class="o-glass-row" style="--i:${i}">
        <div class="o-glass-left">${esc(r.left || '')}</div>
        <div class="o-glass-main"><div class="o-glass-title">${esc(r.title || '')}</div>${r.meta ? `<div class="o-glass-meta">${esc(r.meta)}</div>` : ''}${bar}</div>
        ${r.right != null ? `<div class="o-glass-right">${esc(String(r.right))}</div>` : ''}
      </div>`;
    }).join('');
    return `<div class="o-glass-card"><div class="o-glass-h"><span>${esc(title)}</span>${opts.count != null ? `<em>${opts.count}</em>` : ''}</div><div class="o-glass-body">${body}</div></div>`;
  }

  A.glassTable = glassTable;
  /* Markdown-lite + стекло для любого многострочного ответа */
  function fmtBotText(text) {
    if (text == null || text === '') return '';
    let t = String(text);
    // если уже HTML-карточка — не трогаем
    if (/^\s*</.test(t) && /o-glass|o-help|o-pcard|o-acard/.test(t)) return t;
    const escH = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    // **bold**
    let html = escH(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const lines = html.split(/\n/);
    const multi = lines.length > 1 || t.length > 120 || /^[•\-\*]/.test(t.trim()) || t.includes('•');
    if (!multi) return html.replace(/\n/g, '<br>');
    // группируем: заголовок + список / абзацы
    let body = '', inList = false;
    lines.forEach(line => {
      const L = line.trim();
      if (/^([•\-\*]|\d+\.)\s+/.test(L)) {
        if (!inList) { body += '<ul class="o-glass-ul">'; inList = true; }
        body += '<li>' + L.replace(/^([•\-\*]|\d+\.)\s+/, '') + '</li>';
      } else {
        if (inList) { body += '</ul>'; inList = false; }
        if (!L) body += '<div class="o-glass-gap"></div>';
        else body += '<p class="o-glass-p">' + L + '</p>';
      }
    });
    if (inList) body += '</ul>';
    return '<div class="o-glass-md">' + body + '</div>';
  }
  A.fmtBotText = fmtBotText;



  /* ───── ответ: единый формат ───── */
  const R = (text, extra = {}) => Object.assign({ role: 'bot', text, cards: [], buttons: [] }, extra);
  const btn = (label, act) => ({ label, act });
  const sug = () => [btn('Что дальше', 'cmd:что дальше'), btn('Когда автобус домой', 'cmd:когда автобус домой'), callBtn()];

  /* изменение с подтверждением/отменой */
  function change(text, doFn, undoFn, extra) {
    const auto = (S().settings.agentAutonomy || 'smart') !== 'ask';
    if (auto) { doFn(); C().save(); C().render(); undoStack.push(undoFn); return R(text, { buttons: [btn('Отменить', 'ag:undo'), ...(extra || [])] }); }
    const id = Date.now().toString(36); pending[id] = { doFn, undoFn };
    return R('Выполнить? ' + text, { buttons: [btn('Да', 'ag:yes:' + id), btn('Нет', 'ag:no:' + id)] });
  }

  /* ───── облако: полная переписка в Supabase; локально — окно из настроек (agentMemCap, 0 = без лимита) ───── */
  const memPush = m => { try { if (O.cloud && O.cloud.logged()) O.cloud.pushMsg(m); } catch (e) {} };
  function memCap() {
    try {
      const v = +(S().settings && S().settings.agentMemCap);
      if (v === 0) return 0; // без лимита
      if (Number.isFinite(v) && v > 0) return Math.min(50000, Math.max(50, v));
    } catch (e) {}
    return 300;
  }
  function trimLocalMem() {
    try {
      if (!mem.msgs) mem.msgs = [];
      const cap = memCap();
      let arr = A.msgs.filter(x => x.role === 'user' || x.role === 'bot').map(x => ({ role: x.role, text: String(x.text || '').slice(0, 2000), at: x.at }));
      if (cap > 0) arr = arr.slice(-cap);
      mem.msgs = arr;
      saveMem();
    } catch (e) {}
  }
  const LOCAL_MEM_CAP = () => memCap(); // совместимость


  /* ───── интенты ───── */
  const INT = [];
  A._INT = INT;   // для тестов
  const on = (re, fn, name) => INT.push({ re, fn, name });

  // 00) сценарии пользователя (фраза-триггер или «запусти …»)
  on(/./, (t) => { const sc = O.scripts && O.scripts.match(t); if (!sc) return null; O.scripts.run(sc); return R('Запускаю сценарий «' + sc.name + '».'); }, 'script');

  // 00б) сценарий по своему названию («Давай по быстрому»): самый последний шанс перед «не понял», чтобы не перебивать встроенные команды
  on(/./, (t) => { const sc = O.scripts && O.scripts.matchName && O.scripts.matchName(t); if (!sc) return null; O.scripts.run(sc); return R('Запускаю сценарий «' + sc.name + '».'); }, 'script-name');

  // 0) экстренное
  on(/(^|\s)(sos|опасн|экстренн|скорую|полици[юя]|заблудил|потерял(ся|ась)|мне страшно|на помощь)/, () => {
    const s = S(), num = s.settings.sosNumber || '112', em = s.people.filter(p => p.phone && p.emergency);
    return R('Сохраняйте спокойствие. Для вызова ' + num + ' откройте SOS — там защита от случайного набора (два шага).', {
      cards: em.slice(0, 3).map(p => personCard(p, 'Мне нужна помощь')),
      buttons: [btn('Открыть SOS', 'sos'), btn('Экстренные контакты', 'tab:contacts')]
    });
  }, 'sos');

  // 0b) калькулятор CIFRA
  on(/(посчитай|вычисли|сколько\s*будет|калькулятор|cifra)|^[\d\(\.\-]\s*[\d\s+\-*/^().,πpie√sincotaqlg]+\s*=?\s*$/i, (t, n) => {
    if (/открой|открыть|перейди/.test(n)) { O.actions.go('calc'); return R('Открыл CIFRA Pro.', { buttons: [btn('Калькулятор', 'tab:calc')] }); }
    let expr = t.replace(/^(посчитай|вычисли|сколько\s*будет)\s*/i, '').replace(/[=\s]+$/,' ').trim();
    if (/^калькулятор|^cifra/.test(n) && !/[\d(]/.test(expr)) {
      if (O.inline && O.inline.openCalc) O.inline.openCalc({});
      else if (O.actions && O.actions.go) O.actions.go('calc');
      return R('Калькулятор в контейнере чата.', { buttons: [btn('Конвертер', 'cmd:калькулятор конвертер'), btn('Финансы', 'cmd:калькулятор финансы')] });
    }
    if (!expr || !/[\d(xπpie]/.test(expr)) return R('Напишите выражение, например: «посчитай 12*8+5» или «sqrt(144)».', { buttons: [btn('Открыть CIFRA', 'tab:calc')] });
    // Guard: телефоны, даты, процентные фразы — не выражения
    if (/^[\s+()\-]*\+?\d[\d\s()\-]{6,}\d\s*$/.test(expr) || /^\+?\d{10,15}$/.test(expr.replace(/[\s()\-]/g,''))) {
      return R('Это похоже на номер телефона, а не на математическое выражение. Напишите «посчитай 12*8», если нужен расчёт.');
    }
    if (/\d{1,2}[./]\d{1,2}([./]\d{2,4})?/.test(expr) && !/[\+\-\*\/^]/.test(expr)) {
      return R('Похоже на дату. Скажите «дней между 01.03 и 15.05» или «сколько дней до 31.12».');
    }
    if (/сколько\s+процент|какой\s+процент|%\s*от/i.test(t) && !/[\+\-\*\/]/.test(expr)) {
      // let specialized percent skills handle it; if we reached here, rephrase
      return R('Для процентов лучше: «сколько процентов 30 от 200» или «15% от 2000».');
    }
    const r = O.tools ? O.tools.calc(expr) : { ok: false, error: 'tools не загружен' };
    if (!r.ok) return R('Не смог посчитать «' + expr + '»: ' + (r.error || ''), { buttons: [btn('Открыть CIFRA', 'tab:calc')] });
    return R(r.expr + ' = **' + r.text + '**', { buttons: [btn('Открыть CIFRA', 'tab:calc'), btn('Ещё пример', 'cmd:посчитай sin(30)')] });
  }, 'calc');

  // 0b1) даты: дней между / до (fallback если inline не сработал)
  on(/^(?:сколько\s+)?(?:дней|дни)\s+между\s+(.+?)\s+и\s+(.+?)\s*\??$/i, (t, n) => {
    const m = n.match(/(?:дней|дни)\s+между\s+(.+?)\s+и\s+(.+?)$/);
    if (!m) return R('Формат: «дней между 01.03 и 15.05».');
    const parse = (str) => {
      str = str.trim();
      let x = str.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
      if (x) { let y = x[3] ? +x[3] : new Date().getFullYear(); if (y < 100) y += 2000; return new Date(y, +x[2]-1, +x[1]); }
      return null;
    };
    const a = parse(m[1]), b = parse(m[2]);
    if (!a || !b || isNaN(a) || isNaN(b)) return R('Не разобрал даты. Пример: «дней между 01.03 и 15.05».');
    const k = Math.abs(Math.round((b - a) / 864e5));
    return R('Между ' + m[1].trim() + ' и ' + m[2].trim() + ': ' + k + ' ' + O.plural(k, 'день', 'дня', 'дней') + '.');
  }, 'dates-between');
  on(/^(?:сколько\s+)?(?:дней|дни|осталось дней)\s+до\s+(.+?)\s*\??$/i, (t, n) => {
    const m = n.match(/(?:дней|дни|осталось дней)\s+до\s+(.+)$/);
    if (!m) return R('Формат: «сколько дней до 31.12».');
    const str = m[1].trim();
    let x = str.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
    if (!x) return R('Не разобрал дату. Пример: «сколько дней до 31.12».');
    let y = x[3] ? +x[3] : new Date().getFullYear(); if (y < 100) y += 2000;
    let d = new Date(y, +x[2]-1, +x[1]);
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!x[3] && d < today) d = new Date(y + 1, +x[2]-1, +x[1]);
    const k = Math.round((d - today) / 864e5);
    return R('До ' + str + ': ' + k + ' ' + O.plural(k, 'день', 'дня', 'дней') + '.');
  }, 'dates-until');

  // 0b2) маршруты: метро / работа / дом
  on(/(добавь\s+маршрут|маршрут\s+(?:из\s+)?дом|до\s+работы|метро\s+\S+)/i, (t, n) => {
    const mode = O.work.normalizeMode(n);
    const dir = (/дом/.test(n) && !/работ|офис/.test(n)) ? 'home' : O.work.normalizeDir(n);
    const times = (t.match(/\d{1,2}[:.]\d{2}/g) || []).map(x => x.replace('.', ':'));
    const lineM = t.match(/(?:метро|линии?|автобус\s*№?|№)\s*(?!\d{1,2}[:.]\d{2})([A-Za-zА-Яа-яёЁ0-9\-]{1,20})/i);
    const line = lineM ? lineM[1].trim() : '';
    let from = 'Дом', to = 'Работа';
    if (dir === 'home') { from = 'Работа'; to = 'Дом'; }
    if (dir === 'school') to = 'Работа';
    const modeLabel = (O.work.MODES && O.work.MODES[mode]) || mode;
    if (!times.length) {
      return R('Укажите время. Примеры:\n• добавь маршрут до работы метро 08:15 08:40\n• добавь маршрут домой автобус 537 18:20\n• добавь маршрут до работы пешком 08:50', {
        buttons: [
          btn('Метро → работа 08:30', 'cmd:добавь маршрут до работы метро 08:30'),
          btn('Автобус → дом 18:20', 'cmd:добавь маршрут домой автобус 18:20'),
          btn('Транспорт', 'tab:buses')
        ]
      });
    }
    O.work.addRoute(S(), {
      name: modeLabel + ' ' + to, from, to, dir, mode, line, times,
      walkMin: mode === 'walk' ? 0 : (mode === 'metro' ? 5 : 8),
      rideMin: mode === 'walk' ? 25 : (mode === 'metro' ? 30 : 20)
    });
    C().save(); C().render();
    return R('Маршрут: ' + modeLabel + (line ? ' «' + line + '»' : '') + ' · ' + from + ' → ' + to + '\nОтправления: ' + times.join(', '), {
      buttons: [btn('Транспорт', 'tab:buses'), btn('Когда выходить', 'cmd:когда выходить')]
    });
  }, 'route-add');

  // 0c) график
  on(/(график|нарисуй\s*(график|функц)?|plot|y\s*=)/i, (t, n) => {
    // не путать с диаграммами / занятостью
    if (/занят|свободн|диаграм|недел[яи]|pie|hist|гист|c4|journey|путь\s+польз/i.test(n)) return null;
    let expr = t.replace(/^(?:нарисуй|построй|покажи)?\s*(?:график\s*(?:функции)?|функци[юи]|plot)?\s*/i, '').replace(/^y\s*=\s*/i, '').trim();
    if (/^(?:недел|занят|диаграм)/i.test(expr)) return null;
    let xmin = -10, xmax = 10;
    const range = n.match(/от\s*(-?\d+(?:[.,]\d+)?)\s*до\s*(-?\d+(?:[.,]\d+)?)/);
    if (range) { xmin = +range[1].replace(',', '.'); xmax = +range[2].replace(',', '.'); expr = expr.replace(/от\s*-?\d.+$/i, '').trim(); }
    if (!expr || expr.length < 1) return R('Какую функцию нарисовать? Например: «график sin(x)» или «нарисуй y=x^2 от -5 до 5».');
    const g = O.tools ? O.tools.graph(expr, { xmin, xmax }) : { ok: false, error: 'tools не загружен' };
    if (!g.ok) return R('Не построил график: ' + (g.error || ''), { buttons: [btn('Калькулятор', 'tab:calc')] });
    return R('График y = ' + g.expr + (range ? ` (x ∈ [${xmin}; ${xmax}])` : ''), {
      cards: [g.svg],
      buttons: [btn('Открыть CIFRA', 'tab:calc'), btn('Ещё: cos(x)', 'cmd:график cos(x)')]
    });
  }, 'graph');

  // 0d) блок-схемы FlowForge — мастер на кнопках
  on(/(создай\s+(схему|блок[- ]?схему)|блок[- ]?схем|схема\s*:|flowchart|нарисуй\s*схему|мастер\s*схем)/i, (t, n) => {
    if (/открой|открыть/.test(n) && !/создай|нарисуй|схема\s*:|мастер/.test(n)) {
      O.actions.go('flow');
      return R('Открыл FlowForge Studio.', { buttons: [btn('Схемы', 'tab:flow')] });
    }
    // if user already gave full chain with -> open directly
    if (/->|→/.test(t) && t.length > 15) {
      const body = t.replace(/^(создай\s+(схему|блок[- ]?схему)|нарисуй\s*схему|блок[- ]?схем[аы]?|схема)\s*:?\s*/i, '').trim();
      const built = O.tools.buildScheme(body);
      O.tools.openScheme(built.doc, built.name);
      return R('Схема в редакторе (' + built.count + ' блоков).', {
        buttons: [btn('Открыть редактор', 'tab:flow'), btn('Новая схема', 'ag:wiz:start')]
      });
    }
    wiz = (O.work && O.work.wizardStart) ? O.work.wizardStart() : { step: 'template' };
    const T = (O.work && O.work.TEMPLATES) || {};
    const buttons = Object.keys(T).map(k => btn(T[k].label, 'ag:wiz:tpl:' + k));
    buttons.push(btn('Открыть пустой редактор', 'tab:flow'));
    return R('Мастер схемы. Выберите шаблон — дальше название и блоки кнопками. Готовая схема откроется в редакторе, не в чате.', {
      buttons
    });
  }, 'scheme');


  // 0e2) память: «что было вчера / на прошлой неделе»
  on(/(что\s*(было|говорили|обсуждали|делали)|вспомни|покажи\s*память|история\s*чат|что\s*мы\s*(писали|говорили)).*(вчера|сегодня|позавчера|недел|месяц)?|(вчера|на\s*прошлой\s*неделе|позавчера).*(что|говорил|писал|было)?/i, (t, n) => {
    const q = O.work ? O.work.queryMemory(mem, n || t) : { empty: true, count: 0, total: 0, lines: [], title: '' };
    if (q.empty) {
      return R('В памяти ' + (q.total || 0) + ' сообщений. За период «' + (q.title || 'запрос') + '» ничего не нашёл. Пишите в чат — лимит памяти настраивается.', {
        buttons: [btn('Что ты помнишь', 'cmd:что ты помнишь'), btn('Справка', 'cmd:помощь')]
      });
    }
    const rows = (q.lines || []).map(line => {
      const m = String(line).match(/^\s*[·•\-]?\s*(.+?)\s*[—–-]\s*(Вы|Орби|Бот|Агент)\s*:\s*([\s\S]+)$/i)
        || String(line).match(/^\s*(.+?)\s*[—–-]\s*(Вы|Орби)\s*:\s*([\s\S]+)$/i);
      if (m) return { left: m[1].trim(), title: m[3].trim(), meta: m[2] };
      return { left: '', title: String(line).replace(/^[·•\-]\s*/, ''), meta: '' };
    });
    return R('Память **' + (q.title || '') + '**: ' + q.count + ' сообщ. (в архиве ' + q.total + ').', {
      cards: [glassTable('Память · ' + (q.title || ''), rows, { count: q.count })],
      buttons: [btn('Сегодня', 'cmd:что было сегодня'), btn('Вчера', 'cmd:что было вчера'), btn('Прошлая неделя', 'cmd:что было на прошлой неделе')]
    });
  }, 'recall');

  // 0e) справка по инструментам
  on(/помощь\s*(инструмент|tools|калькулятор|схем|график)|что\s*умеешь\s*(счит|график|схем)/i, () => {
    return R((O.tools && O.tools.helpTools()) || 'Инструменты: калькулятор, графики, схемы.', {
      buttons: [btn('Калькулятор', 'tab:calc'), btn('Схемы', 'tab:flow'), btn('Помощь планера', 'cmd:помощь')]
    });
  }, 'tools-help');

  // 0e3) помощь / что умеешь / нейросеть
  on(/^(помощь|справка|что\s*умеешь|что\s*ты\s*умеешь|capabilities|help|нейросеть|llm|llm7|включить\s*ии|включи\s*нейро)/i, (t, n) => {
    const ready = O.llmReady && O.llmReady();
    const s = S().settings || {};
    const prov = s.llmProvider || '—';
    const skills = [
      { left: '🚌', title: 'Маршруты', meta: 'когда выходить, автобус домой' },
      { left: '✅', title: 'Задачи и встречи', meta: 'список, добавление, перенос' },
      { left: '🔔', title: 'Напоминания', meta: 'через N мин, список' },
      { left: '📞', title: 'Звонки и SMS', meta: 'позвони, напиши' },
      { left: '🔢', title: 'Калькулятор и графики', meta: 'в чате' },
      { left: '📐', title: 'Схемы FlowForge', meta: 'мастер в чате' },
      { left: '🧠', title: 'Память', meta: 'что было вчера / на неделе' },
      { left: '🍅', title: 'Помидор', meta: 'фокус, концентрация' },
    ];
    let foot = ready
      ? 'Нейросеть **включена** (провайдер: ' + prov + '). Можно спрашивать свободнее.'
      : 'Нейросеть выключена. Настройки → Агент → «Запросы к нейросети по API» (например LLM7).';
    return R('Мои навыки', {
      cards: [glassTable('Навыки', skills), '<div class="o-glass-md"><p class="o-glass-p">' + foot.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') + '</p></div>'],
      buttons: [
        btn('Что дальше', 'cmd:что дальше'),
        btn('Когда выходить', 'cmd:когда выходить'),
        btn('Помидор', 'cmd:помидор'),
        btn('Настройки агента', 'cmd:настройки агента')
      ]
    });
  }, 'help-full');



  // 1) «я освободился» → ближайший автобус ОТ СЕЙЧАС (или от указанного времени), не от конца уроков
  on(/(освобо[дж][а-яёa-z0-9_]*|закончил[а-яёa-z0-9_]*|заканчива[а-яёa-z0-9_]*|закончу|кончил|кончаю|отпустил[а-яёa-z0-9_]*|отпустят|выхожу из школы|выхожу со школы|иду домой|пора домой|свободен|свободна|уроки (всё|все))/, (t, n, now) => {
    const ti = timeIn(n), s = S(), nm = E.nowMin(now);
    // всегда от «сейчас», если не сказали «в 12:00» / «через 10 минут»
    const freeAt = ti ? (ti.at != null ? ti.at : nm + (ti.off || 0)) : nm;
    return homePlan(s, now, freeAt, !!ti);
  }, 'free');
  function familyContacts() {
    const s = S(), out = [], seen = new Set();
    const add = p => { if (p && p.id && !seen.has(p.id) && phoneOf(p)) { seen.add(p.id); out.push(p); } };
    for (const key of ['мама', 'папа', 'бабушка', 'дедушка']) {
      if (mem.aliases[key]) add(s.people.find(x => x.id === mem.aliases[key]));
      findPeople(key).forEach(add);
    }
    // по relation
    (s.people || []).forEach(p => {
      const r = E.N(p.relation || ''), nm = E.N(p.name || '');
      if (/мам|пап|бабуш|дедуш|родн/.test(r) || /мам|пап|бабуш|дедуш/.test(nm)) add(p);
    });
    // избранные / SOS
    (s.people || []).filter(p => p.fav || p.emergency).forEach(add);
    return out.slice(0, 4);
  }
  function homePlan(s, now, freeAt, explicit) {
    const nm = E.nowMin(now);
    const p = E.planHome(s, now, { freeAt });
    if (!(s.buses || []).length) return R('Автобусов пока нет. Добавьте маршрут — и я буду подбирать рейс под ваши встречи.', { buttons: [btn('Добавить автобус', 'tab:buses')] });
    O.lastPlan = { kind: 'home', freeAt, options: p.options };
    if (!p.options.length) return p.nextDay ? R(`С ${E.fmt(freeAt)} сегодня рейсов домой больше нет. Ближайший — ${DAYF[p.nextDay.dayIdx]} в ${p.nextDay.option.time} (№${p.nextDay.option.number}).`, { buttons: [btn('Все рейсы', 'tab:buses')] }) : R('Не нашёл рейсов домой после вашего времени. Проверьте направление «домой» и время рейсов.', { buttons: [btn('Открыть автобусы', 'tab:buses')] });
    const b = p.options[0], li = b.leaveBy - nm, waitBus = b.min - freeAt;
    const eta = `Я освободился, еду домой на №${b.number}, буду около ${E.fmt(b.arrive)}`;
    let txt = explicit ? `Освобождаешься в ${E.fmt(freeAt)}. ` : `Сейчас ${E.fmt(nm)}. `;
    txt += `Ближайший автобус домой — №${b.number} в ${b.time}. `;
    if (li > 0) txt += `Выйти к остановке в ${E.fmt(b.leaveBy)} — через ${left(li)}. `;
    else txt += 'Выходить нужно прямо сейчас! ';
    if (waitBus > 60) txt += `Раньше рейсов нет — ждать около ${left(waitBus)}. `;
    else txt += `Запас на сборы ${left(Math.max(0, b.slack))}. `;
    if (p.missed) txt += `Рейс ${p.missed.time} уже не успеть. `;
    txt += 'Предупредить родных?';
    const cards = p.options.slice(0, 3).map((o, i) => busCard(o, i, 'home'));
    const fam = familyContacts();
    fam.forEach(who => {
      const short = (who.name || '').split(' ')[0] || who.relation || 'контакт';
      cards.push(personCard(who, eta));
    });
    const btns = [btn('Следующий рейс', 'ag:next'), btn('Через 10 мин', 'cmd:я освобожусь через 10 минут')];
    if (fam[0]) btns.unshift(btn('Позвонить ' + ((fam[0].name || '').split(' ')[0] || 'родным'), 'cmd:позвони ' + (fam[0].name || fam[0].relation || 'маме')));
    if (!fam.length) btns.push(btn('Добавить контакт', 'tab:contacts'));
    return R(txt.trim(), { cards, buttons: btns });
  }

  // 2) автобусы
  on(/(автобус|маршрут|рейс|когда (ехать|выходить|выезжать)|во сколько (ехать|выходить)|успею ли|успею на)/, (t, n, now) => {
    const s = S(), nm = E.nowMin(now);
    if (!(s.buses || []).length) return R('Автобусов пока нет. Добавьте маршрут, и я посчитаю, когда выходить.', { buttons: [btn('Добавить автобус', 'tab:buses')] });
    const num = (n.match(/(?:№|номер|автобус)\s*(\d{1,3})/) || [])[1];
    if (num) { const l = E.nextBuses(s, now, { number: num, limit: 4 }); return l.length ? R(`Автобус №${num}: ближайшие рейсы ${l.map(x => x.time).join(', ')}. До остановки идти ${l[0].walk} мин — выйти в ${E.fmt(l[0].leaveBy)}.`, { cards: l.map((o, i) => busCard(o, i, 'home')) }) : R(`На сегодня рейсов №${num} больше нет.`, { buttons: [btn('Все рейсы', 'tab:buses')] }); }
    const ti = timeIn(n);
    const toSchool = /(в школу|на урок|к уроку|к первому|утром|на занят|на учёб)/.test(n), toHome = /(домой|из школы|после уроков|после школы)/.test(n);
    const ev = E.eventsOn(s, now).list, lastE = ev.length ? Math.max(...ev.map(e => e.e)) : null;
    if (/успею/.test(n) && ti && ti.at != null) {
      const deps = E.departures(s, now).filter(d => Math.abs(d.min - ti.at) <= 1); const d = deps[0];
      if (!d) return R(`Рейса в ${E.fmt(ti.at)} не нашёл. Ближайшие: ${E.nextBuses(s, now, { limit: 3 }).map(x => x.time).join(', ') || 'нет'}.`);
      const walk = Number(d.bus.walkMin) || 0, ready = nm + (toSchool ? 0 : E.cfg(s).exitMin) + walk, slack = d.min - ready;
      return R(slack >= 0 ? `Да, успеваешь на ${d.time} (№${d.bus.number}): запас ${left(slack)}. Выйти до ${E.fmt(d.min - walk)}.` : `Не успеть на ${d.time}: не хватает ${left(-slack)}. Следующий — ${(E.nextBuses(s, now, { limit: 5 }).find(x => x.min > d.min) || {}).time || 'нет'}.`);
    }
    if (toSchool || (!toHome && ev.length && nm < ev[0].s)) {
      let date = (lastE != null && nm > lastE) || !ev.length ? E.addDays(now, 1) : now, p = E.planSchool(s, date);
      for (let k = 2; !p.first && k <= 8; k++) { date = E.addDays(now, k); p = E.planSchool(s, date); }   // ближайший день с встречами
      if (!p.first) return R('В ближайшие дни встреч нет — на работу ехать не нужно.');
      if (!p.options.length) return R(`К ${p.first.start} ни один рейс не успевает${p.noBuses ? ' (нет рейсов на работу)' : ''}.`, { buttons: [btn('Открыть автобусы', 'tab:buses')] });
      const b = p.options[0]; O.lastPlan = { kind: 'school', options: p.options };
      const li = b.leaveBy - nm, dd = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5), day = dd <= 0 ? '' : dd === 1 ? 'Завтра ' : ['В понедельник ', 'Во вторник ', 'В среду ', 'В четверг ', 'В пятницу ', 'В субботу ', 'В воскресенье '][E.dayIdx(date)];
      return R(`${day}${day ? 'первая' : 'Первая'} встреча в ${p.first.start}. Лучший автобус — №${b.number} в ${b.time}: ${dd <= 0 && li > 0 ? `выйти в ${E.fmt(b.leaveBy)} (через ${left(li)})` : `выйти в ${E.fmt(b.leaveBy)}`}, на работе в ${E.fmt(b.arrive)}, запас ${left(b.slack)}.`, { cards: p.options.map((o, i) => busCard(o, i, 'school')), buttons: [btn('Следующий рейс', 'ag:next')] });
    }
    if (ti && ti.at != null) return homePlan(s, now, ti.at, true);
    return homePlan(s, now, lastE != null && nm < lastE ? lastE : nm, lastE != null && nm < lastE);
  }, 'bus');

  // 3) что сейчас / дальше
  on(/^(сейчас|дальше|потом|следующий|что там|сейчас урок|урок)$|(что (сейчас|дальше|следующ|потом|за урок)|какой (сейчас |следующий )?урок|следующий урок|где (я|мне) (сейчас|должен)|что у меня сейчас)/, (t, n, now) => {
    const nn = E.nowNext(S(), now), ev = E.eventsOn(S(), now);
    if (ev.holiday) return R(`Сейчас отпуск «${ev.holiday.name}». Встреч нет.`);
    if (!ev.list.length) return R('Сегодня встреч нет. Хорошего отдыха!');
    if (nn.current) return R(`Сейчас: ${nn.current.title}${nn.current.place ? ' (' + nn.current.place + ')' : ''} до ${nn.current.end}, осталось ${left(nn.left)}.${nn.next ? ` Дальше — ${nn.next.title} в ${nn.next.start}.` : ' Это последняя встреча на сегодня.'}`, { buttons: nn.next ? [] : [btn('Я освободился', 'cmd:я освободился')] });
    if (nn.next) return R(`Следующее: ${nn.next.title} в ${nn.next.start}${nn.next.place ? ', ' + nn.next.place : ''} — через ${left(nn.wait)}.`);
    return R('Встречи на сегодня закончились.', { buttons: [btn('Автобус домой', 'cmd:я освободился')] });
  }, 'now');

  // 4) расписание дня / планы / «что у меня» (НЕ создание встречи)
  on(/(когда|во сколько)\s+(закан|конч)[а-яёa-z0-9_]*\s+(уроки|занят[а-яёa-z0-9_]*|школа|день)|расписание\s+(на\s+)?(сегодня|завтра|послезавтра|\S+)|(что|какие)\s+(уроки\s+)?(сегодня|завтра|послезавтра|в (понедельник|вторник|среду|четверг|пятницу|субботу))|^уроки\s+(на\s+|в\s+)?(сегодня|завтра|послезавтра|понедельник|вторник|среду|четверг|пятницу|субботу)|(что|какие)\s+(у\s+меня\s+)?(планы?|дела|встреч[аиы]?|событи[яе]|расписание|на\s+день)|(что|какие)\s+у\s+меня\s+(завтра|сегодня|послезавтра|вечером)|планы?\s+на\s+(сегодня|завтра|послезавтра|вечер|день)|что\s+(завтра|сегодня)\s+(вечером|днём|утром)|какие\s+планы|что\s+по\s+планам|мой\s+день\s+(завтра|сегодня)/i, (t, n, now) => {
    // Не перехватывать явные команды добавления
    if (/(добавь|добавить|создай|создать|запиши|запланируй\s+встречу|новый\s+урок)/i.test(n)) return null;
    const day = dayIn(n, now) || { d: now, label: 'сегодня' };
    let list = E.eventsOn(S(), day.d).list || [];
    const wantEve = /вечер/i.test(n);
    const wantMorn = /утр/i.test(n);
    const wantDay = /днём|днем/i.test(n);
    if (wantEve) list = list.filter(e => {
      const m = String(e.start || '').match(/(\d{1,2})/);
      return m ? +m[1] >= 17 : true;
    });
    if (wantMorn) list = list.filter(e => {
      const m = String(e.start || '').match(/(\d{1,2})/);
      return m ? +m[1] < 12 : true;
    });
    if (wantDay) list = list.filter(e => {
      const m = String(e.start || '').match(/(\d{1,2})/);
      return m ? (+m[1] >= 12 && +m[1] < 17) : true;
    });
    const period = wantEve ? 'вечером' : wantMorn ? 'утром' : wantDay ? 'днём' : '';
    const label = day.label + (period ? ' ' + period : '');
    if (E.eventsOn(S(), day.d).holiday) return R(`На ${day.label} — отпуск «${E.eventsOn(S(), day.d).holiday.name}».`);
    if (!list.length) {
      return R(`На ${label} встреч нет.` + (period ? ' (по выбранному времени суток)' : ''), {
        buttons: [btn('Весь день', 'cmd:расписание на ' + day.label), btn('Добавить встречу', 'cmd:добавь встречу'), btn('Расписание', 'tab:schedule')]
      });
    }
    const end = Math.max(...list.map(e => e.e));
    if (/(закан|конч)/.test(n)) return R(`${day.label[0].toUpperCase() + day.label.slice(1)} встречи заканчиваются в ${E.fmt(end)}.`, { cards: [evList(list)], buttons: [btn('Маршрут после встреч', 'cmd:я освобожусь в ' + E.fmt(end))] });
    return R(`На ${label}: ${list.length} ${O.plural(list.length, 'встреча', 'встречи', 'встреч')}, с ${list[0].start} до ${E.fmt(end)}.`, {
      cards: [evList(list)],
      buttons: [btn('Что взять', 'cmd:что взять ' + day.label), btn('Расписание', 'tab:schedule'), btn('Добавить', 'cmd:добавь встречу')]
    });
  }, 'day');

  on(/^(?:обучи\s*меня|обучение|как\s+пользоваться|что\s+умеет\s+агент|справка\s+по\s+агенту)\s*$/i, () => {
    if (O.onboard && O.onboard.tipCard) { O.onboard.tipCard(); return R(''); }
    return R('Напишите «помощь» или откройте Настройки → Агент → Обучение.');
  }, 'onboard-tip');
  on(/^(?:выключи\s+обучение|отключи\s+обучение|без\s+обучения)\s*$/i, () => {
    if (O.onboard) O.onboard.disable();
    try { setSetting = null; const s = S(); if (s.settings) { s.settings.agentOnboard = false; C().save(); } } catch (e) {}
    return R('Обучение выключено. Включить снова: Настройки → Агент → «Обучение 14 дней».');
  }, 'onboard-off');
  on(/^(?:отмена|отмени|отменить|cancel|стоп)$/i, () => {
    try { if (typeof focusClear === 'function') focusClear(); } catch (e) {}
    try { if (O.inline && O.inline.scheme && O.inline.scheme.active) { /* leave scheme mode */ } } catch (e) {}
    return R('Ок, отменил. Чем помочь дальше?', { buttons: [btn('Помощь', 'cmd:помощь'), btn('Что дальше', 'cmd:что дальше')] });
  }, 'onboard-tip', 'onboard-off', 'cancel-cmd');

  on(/^(?:можешь\\s+что[- ]?то\\s+ещ[её]|что\\s+ещ[её]\\s+умеешь|нужен\\s+ответ|подскажи|как\\s+оно|как\\s+дела)\\s*[.?!'']*$/i, () => {
    return R('Могу: расписание и планы, задачи, напоминания, автобус, звонки, калькулятор, схемы, диаграммы, помидор. Спросите, например: «что у меня завтра вечером» или «круговая диаграмма».', {
      buttons: [btn('Помощь', 'cmd:помощь'), btn('Планы завтра', 'cmd:планы на завтра'), btn('Диаграммы', 'cmd:диаграммы')]
    });
  }, 'soft-help');

  on(/(?:какая\\s+)?погода|прогноз\\s+погоды|will\\s+it\\s+rain/i, () => {
    return R('Погоду в агенте пока не подключал. Могу: расписание, задачи, автобус, напоминания, диаграммы.', {
      buttons: [btn('Что дальше', 'cmd:что дальше'), btn('Задачи', 'cmd:что задано'), btn('Диаграммы', 'cmd:диаграммы')]
    });
  }, 'weather-soft');

  on(/(?:какие\\s+)?планы?\\s+(?:у\\s+меня\\s+)?на\\s+завтрашн\\S*(?:\\s+вечер\\S*)?|(?:что|какие)\\s+(?:у\\s+меня\\s+)?(?:на\\s+)?завтрашн\\S*\\s*(?:вечер\\S*)?|(?:что|какие)\\s+(?:планы?|дела)\\s+(?:у\\s+меня\\s+)?(?:на\\s+)?(?:завтра|сегодня)(?:шн\\S*)?(?:\\s+вечер\\S*)?/i, (t, n, now) => {
    const day = /сегодня/.test(n) && !/завтра/.test(n) ? { d: now, label: 'сегодня' } : { d: E.addDays(now, 1), label: 'завтра' };
    let list = E.eventsOn(S(), day.d).list || [];
    const wantEve = /вечер/.test(n);
    if (wantEve) list = list.filter(e => (e.s || 0) >= 17 * 60);
    if (!list.length) {
      return R(wantEve ? ('На ' + day.label + ' вечером встреч нет.') : ('На ' + day.label + ' встреч в расписании нет.'), {
        buttons: [btn('Расписание', 'tab:schedule'), btn('Задачи', 'cmd:что задано'), btn('Добавить', 'cmd:добавь встречу')]
      });
    }
    const rows = list.slice(0, 12).map(e => {
      const t0 = Math.floor((e.s || 0) / 60) + ':' + String((e.s || 0) % 60).padStart(2, '0');
      return { left: t0, title: e.title || e.subject || e.name || 'Событие', meta: e.end ? (Math.floor(e.e / 60) + ':' + String(e.e % 60).padStart(2, '0')) : '' };
    });
    return R((wantEve ? 'Вечер' : 'Планы') + ' на ' + day.label + ': **' + list.length + '**.', {
      cards: [glassTable('Планы · ' + day.label, rows, { count: list.length })],
      buttons: [btn('Расписание', 'tab:schedule'), btn('Задачи', 'cmd:что задано')]
    });
  }, 'cancel-cmd', 'plans-eve');


  // 5) звонок / SMS
  /* ───── быстрый звонок и «Мои команды»: всё настраивает пользователь, имён в коде нет ───── */
  const firstName = p => (p.name || '').split(' ')[0] || p.name;
  const favPerson = () => { const p = S().people.find(v => v.id === mem.favCall); return p && phoneOf(p) ? p : null; };
  const callBtn = () => { const f = favPerson(); return f ? btn('Позвонить ' + firstName(f), 'cmd:позвони ' + f.name) : btn('Позвонить', 'cmd:позвони'); };
  const myCmds = () => {
    const f = favPerson(), al = Object.entries(mem.aliases || {}), people = S().people;
    const lines = ['Быстрый звонок: ' + (f ? f.name : 'не выбран')];
    if (al.length) lines.push('Привязки: ' + al.map(([k, v]) => { const p = people.find(x => x.id === v); return '«' + k + '» → ' + (p ? p.name : '?'); }).join('; '));
    lines.push('Новая привязка: напишите «папа — это Олег» (имя из контактов).');
    return R(lines.join('\n'), { buttons: [btn(f ? 'Сменить быстрый звонок' : 'Выбрать быстрый звонок', 'cmd:быстрый звонок')].concat(f ? [btn('Убрать быстрый звонок', 'ag:favclear')] : [], al.map(([k]) => btn('Убрать «' + k + '»', 'ag:unalias:' + encodeURIComponent(k)))) });
  };
  on(/^(мои команды|мои привязки|привязки|быстрые команды)$/, () => myCmds(), 'mycmds');
  on(/^быстрый звонок\s*(.*)$/, (t, n) => {
    const q = ((n.match(/быстрый звонок\s*(.*)$/) || [])[1] || '').trim(), withP = S().people.filter(p => phoneOf(p));
    if (!withP.length) return R('Контактов с номерами нет. Добавьте близких.', { buttons: [btn('Добавить контакт', 'person:new')] });
    const list = q ? findPeople(q).filter(p => phoneOf(p)) : withP;
    if (q && !list.length) return R('Не нашёл «' + q + '» среди контактов с номером.', { buttons: [btn('Все контакты', 'tab:contacts')] });
    if (q && list.length === 1) { mem.favCall = list[0].id; saveMem(); return R('Быстрый звонок: ' + list[0].name + '. Кнопка «Позвонить ' + firstName(list[0]) + '» теперь звонит этому контакту.', { buttons: [btn('Мои команды', 'cmd:мои команды')] }); }
    return R('Кому звонить по кнопке «Позвонить»?', { buttons: list.slice(0, 8).map(p => btn(firstName(p) + (p.relation ? ' (' + p.relation + ')' : ''), 'ag:fav:' + p.id)) });
  }, 'favcall');

  /* ───── ФОКУС ДИАЛОГА: Кон помнит незаконченную команду и принимает уточнение следующими сообщениями ─────
     «позвонить» → «Кому?» → «Василию» → карточка звонка;  «запиши в заметке» → текст → «ещё?» → напоминание → подтверждение.
     Фокус проверяется первым в A.process (работает и для голоса), живёт 10 минут, «отмена» выходит. Подробнее — docs/AGENT-DIALOG.md */
  let focus = null;
  const FOCUS_TTL = 10 * 60000;
  const focusSet = (kind, data, fn, onCancel) => { focus = { kind, data: data || {}, fn, onCancel, exp: Date.now() + FOCUS_TTL }; };
  const focusClear = () => { focus = null; };
  const F_CANCEL = /^(отмена|отмени|отменить|стоп|стой|забудь|выйти|выход)$/;
  const F_DONE = /^(все|всё|хватит|достаточно|готово|больше ничего|больше нет|это все|это всё|закончил|закончила|дальше)$/;
  const F_NO = /^(нет|не надо|не нужно|не стоит|без напоминания|не напоминай|не нужно напоминать)$/;
  const F_YES = /^(да|ага|конечно|нужно|надо|давай|ок|окей|хорошо|подтверждаю|подтвердить|верно|все верно|сохрани|сохранить|согласен|согласна|напомни|напомнить)$/;
  const F_MORE = /^(еще|ещё|добавить еще|добавить ещё|дописать|добавь еще|добавь ещё)$/;
  /* «в 9», «в 9 вечера» без минут и слова «часов» (timeIn такое не понимает и молча ставил 8:00) */
  function timeBare(n) {
    const m = n.match(/(?:^|\s)(?:в|к)\s*(\d{1,2})(?=\s|$)(?!\s*(?:мин|раз|шт|человек|дн|день|недел|месяц|год|лет))(?:\s*(утра|вечера|дня|ночи))?/);
    if (!m) return null; let h = +m[1]; if (h > 23) return null;
    if ((m[2] === 'вечера' || m[2] === 'дня') && h < 12) h += 12; else if (m[2] === 'ночи' && h === 12) h = 0;
    return { at: h * 60 };
  }
  const tIn = n => timeIn(n) || timeBare(n);
  const cancelBtn = () => btn('Отмена', 'cmd:отмена');
  const fmtAt = at => at.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const stripWhen = s => s.replace(/через\s+(?:полчаса|час|\d+\s*\S+)/i, '').replace(/(?:^|\s)(?:в|к)\s*\d{1,2}[:.]\d{2}/i, '').replace(/(?:^|\s)(?:в|к)\s*\d{1,2}(?=\s|$)(?:\s*(?:утра|вечера|дня|ночи))?/i, ' ').replace(/(?:^|[^а-яёa-z0-9_])(послезавтра|завтра|сегодня)(?![а-яёa-z0-9_])/i, ' ').replace(/\s+/g, ' ').trim();
  function whenToDate(str, now) {
    const nn = N(str), ti = tIn(nn), day = dayIn(nn, now); if (!ti && !day) return null;
    let at = new Date(now);
    if (day) at = new Date(day.d);
    if (ti && ti.off != null) at = new Date(now.getTime() + ti.off * 60000);
    else if (ti && ti.at != null) { at.setHours(Math.floor(ti.at / 60), ti.at % 60, 0, 0); if (!day && at <= now) at = E.addDays(at, 1); }
    else at.setHours(8, 0, 0, 0);
    return at;
  }
  /* похоже ли сообщение на самостоятельную команду (тогда уточнение «не по теме» и фокус сбрасывается) */
  function looksLikeCommand(text) {
    sortInt(); const t = canon(String(text).trim()), n = N(t);
    return INT.some(it => it.name !== 'script' && it.name !== 'alias' && (n.match(it.re) || t.match(it.re)));
  }
  function focusStep(text) {
    if (!focus) return null;
    if (Date.now() > focus.exp) { const f0 = focus; focus = null; if (f0.onCancel) f0.onCancel(); return null; }
    const f = focus, n = N(text).trim().replace(/[.!?…]+$/, '').trim();
    if (F_CANCEL.test(n)) { focus = null; if (f.onCancel) f.onCancel(); return [R('Ок, отменил.')]; }
    // Жёсткий выход из мастера на самостоятельные команды (диаграммы, день, автобус…)
    const BREAK = /^(?:что\s+на\s+экране|сводка\s+дня|диаграмм|кругов|гист|занятост|c4|путь\s+пользовател|когда\s+(?:автобус|выходить)|я\s+освободился|что\s+дальше|что\s+задано|задачи\s+на|планы?\s+на|что\s+у\s+меня|помощь|что\s+ты\s+умеешь|калькулятор|помидор|qr\s+приложен)/i;
    if (BREAK.test(n) || BREAK.test(String(text).trim())) {
      focus = null;
      if (f.onCancel) try { f.onCancel(); } catch (e) {}
      return null;
    }
    let r = null;
    try { r = f.fn(String(text).trim(), n, f.data); } catch (e) { console.error('focus', f.kind, e); focus = null; return null; }
    if (!r) { if (focus === f) { focus = null; if (f.onCancel) f.onCancel(); } return null; }   // не по теме — обычная обработка
    if (r.intent === undefined) r.intent = 'focus:' + f.kind;
    return [r];
  }

  /* — «Кому позвонить / написать?» — */
  function whoFocus(verb, tries, text) {
    focusSet('who', { verb, tries }, (t, n) => {
      if (F_NO.test(n)) { focusClear(); return R(verb === 'sms' ? 'Ок, не пишу.' : 'Ок, не звоню.'); }
      // Имя — всё новое сообщение (trim), без хвостов старой команды
      let q = String(t).trim().replace(/^[«"']+|[»"']+$/g, '').trim();
      q = q.replace(/^(это|ему|ей|тому|той|кому)\s+/i, '').trim();
      if (!q) return R(verb === 'sms' ? 'Кому написать?' : 'Кому позвонить?', { buttons: [cancelBtn()] });
      if (findPeople(q).length) { focusClear(); return contact(q, verb, text); }
      if (looksLikeCommand(t) && !findPeople(q).length) return null;
      focusClear(); return contact(q, verb, text, tries);
    });
  }

  /* — «О чём / когда напомнить?» — */
  function remindFocus(what, when) {
    focusSet('remind', { what: what || '', when: when || '', tries: 0 }, (t, n, d) => {
      const has = !!(tIn(n) || dayIn(n, new Date()));
      if (F_NO.test(n) || /^(отмена|отмени)/.test(n)) { focusClear(); return R('Ок, не напоминаю.'); }
      const done = txt => { focusClear(); return understand(txt) || R('Не получилось создать напоминание.'); };
      // when уже задан как ISO — ждём только текст
      if (d.when && /^\d{4}-\d{2}/.test(String(d.when)) && !d.what) {
        const text = String(t).trim();
        if (!text || text.length < 1) return R('О чём напомнить?', { buttons: [cancelBtn()] });
        focusClear();
        const r = { id: C().uid(), text: text[0].toUpperCase() + text.slice(1), at: d.when, done: false };
        return change(`Напомню «${r.text}» ${new Date(d.when).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.`, () => { (S().reminders = S().reminders || []).push(r); O.notify && O.notify.ask(); }, () => { S().reminders = S().reminders.filter(x => x.id !== r.id); });
      }
      if (!d.what) {
        if (has && stripWhen(t).length > 1) return done('напомни ' + t);
        if (has) { d.when = t; return R('О чём напомнить?', { buttons: [cancelBtn()] }); }
        if (d.when) return done('напомни ' + d.when + ' ' + t);
        d.what = t; return R('Когда напомнить «' + t + '»? Например: «завтра в 9:00» или «через час».', { buttons: [cancelBtn()] });
      }
      if (has) return done('напомни ' + t + ' ' + d.what);
      if (looksLikeCommand(t)) return null;
      if (++d.tries > 2) { focusClear(); return null; }
      return R('Не понял время. Скажите, например, «завтра в 9:00» или «через 30 минут».', { buttons: [cancelBtn()] });
    });
  }

  /* — «Запиши в заметке»: текст → ещё → напоминание → подтверждение — */
  function noteWizard() {
    focusSet('note', { step: 'text', lines: [], at: null }, noteStep);
    return R('Что записать в заметку?', { buttons: [cancelBtn()] });
  }
  function noteSummary(d) {
    return R('Проверьте запись:\n' + d.lines.map(l => '• ' + l).join('\n') + '\n' + (d.at ? '🔔 Напомню: ' + fmtAt(d.at) : '🔕 Без напоминания') + '\nПодтверждаете?', { buttons: [btn('Подтверждаю', 'cmd:подтверждаю'), btn('Добавить ещё', 'cmd:добавить ещё'), cancelBtn()] });
  }
  function noteStep(t, n, d) {
    const ask = x => R(x, { buttons: [cancelBtn()] });
    if (d.step === 'text' || d.step === 'more') {
      if (F_DONE.test(n) || (d.step === 'more' && F_NO.test(n))) {
        if (!d.lines.length) return ask('Заметка пока пустая. Что записать?');
        d.step = 'remind';
        return R('Напомнить об этом? Скажите когда («завтра в 9:00», «через час») или «нет».', { buttons: [btn('Нет', 'cmd:нет'), cancelBtn()] });
      }
      if (d.step === 'more' && (F_YES.test(n) || F_MORE.test(n))) { d.step = 'text'; return ask('Что добавить?'); }
      d.lines.push(t.charAt(0).toUpperCase() + t.slice(1)); d.step = 'more';
      return R('Записал ✓ (' + d.lines.length + '). Ещё что-то записать? Пришлите текст или скажите «всё».', { buttons: [btn('Всё', 'cmd:всё'), cancelBtn()] });
    }
    if (d.step === 'remind' || d.step === 'when') {
      const at = whenToDate(t, new Date());
      if (at) { d.at = at; d.step = 'confirm'; return noteSummary(d); }
      if (F_NO.test(n) || F_DONE.test(n)) { d.at = null; d.step = 'confirm'; return noteSummary(d); }
      if (F_YES.test(n)) { d.step = 'when'; return ask('Когда напомнить? Например: «завтра в 9:00» или «через час».'); }
      return ask('Не понял время. Скажите, например, «завтра в 9:00» или «через час», либо «нет».');
    }
    if (F_MORE.test(n)) { d.step = 'text'; return ask('Что добавить?'); }
    if (F_NO.test(n)) { focusClear(); return R('Ок, ничего не сохранил.'); }
    if (F_YES.test(n)) return noteSave(d);
    return R('Скажите «подтверждаю», чтобы сохранить, «добавить ещё» или «отмена».', { buttons: [btn('Подтверждаю', 'cmd:подтверждаю'), btn('Добавить ещё', 'cmd:добавить ещё'), cancelBtn()] });
  }
  function noteSave(d) {
    focusClear();
    const r = O.actions.addNote(d.lines.join('\n'));
    if (!r || !r.ok) return R((r && r.msg) || 'Не удалось сохранить заметку.');
    let rem = null;
    if (d.at) { rem = { id: C().uid(), text: d.lines[0].slice(0, 80), at: d.at.toISOString(), done: false }; (S().reminders = S().reminders || []).push(rem); O.notify && O.notify.ask(); }
    C().save(); C().render();
    undoStack.push(() => { if (r.undo) r.undo(); if (rem) S().reminders = (S().reminders || []).filter(x => x.id !== rem.id); C().save(); C().render(); });
    return R('Готово ✓ Запись сохранена' + (rem ? ', напомню ' + fmtAt(d.at) : '') + '.', { buttons: [btn('Отменить', 'ag:undo'), btn('Заметки', 'tab:notes')] });
  }
  on(/^(?:добавь |создай |сделай |новая |новую |хочу )?(?:заметк[ауе]|запиши(?: в заметк[ауие])?|запиши заметку|в заметк[ауие])\s*[.!]*$/, () => noteWizard(), 'note-wizard');
  on(/^(?:добавь|создай|поставь|новая|новую)\s+(?:задачу|задача|дз|домашку|задание)\s*[.!]*$/, () => {
    focusSet('ask', {}, (t, n) => { focusClear(); if (F_NO.test(n)) return R('Ок, не добавляю.'); return understand('добавь задачу ' + t) || R('Не получилось добавить задачу.'); });
    return R('Какая задача? Напишите название (можно со сроком: «релиз до пятницы»).', { buttons: [cancelBtn()] });
  }, 'task-ask');

  on(/(позвонить|позвони|набери|дозвон[а-яёa-z0-9_]*|вызови|звонок)\s*(.*)/, (t, n) => { const q = n.replace(/^.*?(позвонить|позвони|набери|дозвон[а-яёa-z0-9_]*|вызови|звонок)\s*/, '').replace(/^(мне|пожалуйста)\s+/, ''); return contact(q, 'call'); }, 'call');
  on(/(напиши|отправь смс|смс|сообщи|напишу)\s+(.*)/, (t, n) => { const m = t.match(/(?:напиши|смс|сообщи)\s+(\S+)\s*[,:]?\s*(?:что\s+)?(.*)$/i); return contact(m ? m[1] : '', 'sms', m ? m[2] : ''); }, 'sms');
  function contact(q, verb, text, tries) {
    const s = S(), list = findPeople(q);
    if (!q.trim()) { const withP = s.people.filter(p => p.phone); if (withP.length) whoFocus(verb, 0, text); return withP.length ? R(verb === 'sms' ? 'Кому написать?' : 'Кому позвонить?', { buttons: withP.slice(0, 6).map(p => btn(p.name.split(' ')[0] + (p.relation ? ' (' + p.relation + ')' : ''), 'ag:pick:' + p.id + ':' + verb)) }) : R('Контактов с номерами нет. Добавьте близких.', { buttons: [btn('Добавить контакт', 'person:new')] }); }
    if (!list.length) { if ((tries || 0) < 2) whoFocus(verb, (tries || 0) + 1, text); return R(`Не нашёл «${q.trim()}» в контактах.`, { buttons: [btn('Добавить контакт', 'person:new'), btn('Все контакты', 'tab:contacts')] }); }
    if (list.length > 1) { pending.pickKey = N(q).replace(/[^а-яa-z0-9 ]/g, '').trim(); return R('Кому именно?', { buttons: list.slice(0, 6).map(p => btn(p.name + (p.relation ? ' · ' + p.relation : ''), 'ag:pick:' + p.id + ':' + verb)) }); }
    const p = list[0], eta = O.lastPlan && O.lastPlan.kind === 'home' && O.lastPlan.options[0] ? `Выехал домой на автобусе №${O.lastPlan.options[0].number}, буду примерно в ${E.fmt(O.lastPlan.options[0].arrive)}` : '';
    if (!phoneOf(p)) return R(`У контакта «${p.name}» нет номера.`, { buttons: [btn('Добавить номер', 'person:' + p.id)] });
    return R(verb === 'sms' ? `Сообщение для ${p.name}. Нажмите «SMS», чтобы отправить.` : `Нажмите, чтобы позвонить: ${p.name}.`, { cards: [personCard(p, text || eta)] });
  }

  // 6) домашка
  on(/^(добавь |запиши |новое |новая |задай |задать )?(дз|домашк[а-яёa-z0-9_]*|домашнее задание|задание)\s+(.+)/, (t, n, now) => {
    const bare = !/^(добавь |запиши |новое |новая |задай |задать )/i.test(t);
    const body0 = t.replace(/^(добавь |запиши |новое |новая |задай |задать )?(дз|домашк[а-яёa-z0-9_]*|домашнее задание|задание)\s+/i, '');
    if (bare && /^(на|до|к)\s+(завтра|послезавтра|сегодня|понедельник|вторник|сред|четверг|пятниц|суббот|воскресень|пн|вт|ср|чт|пт|сб|вс)/i.test(body0)) return null;   // «домашка на завтра» — это вопрос, а не добавление
    const body = body0.replace(/^по\s+/i, '');
    const words = body.split(/\s+/); let subj = null, used = 0;
    const first = C().resolveSubject(words[0]);
    if (first && C().SUBJECTS.includes(first)) {
      subj = first; used = 1; const sw = first.toLowerCase().split(' ');
      if (sw.length > 1 && words[1] && sw[1].startsWith(N(words[1]).slice(0, 3))) used = 2;   // «один на один», «созвон с клиентом»
    }
    let rest = words.slice(used).join(' ');
    const due = dayIn(N(rest), now), pr = /срочно|важно/.test(N(rest)) ? 'high' : 'medium';
    rest = rest.replace(/(?:^|\s)(?:до|на|к)\s+(?:послезавтра|завтра|сегодня|понедельник\S*|вторник\S*|сред\S*|четверг\S*|пятниц\S*|суббот\S*|воскресень\S*|пн|вт|ср|чт|пт|сб|вс)(?=\s|$|[.,;])/i, ' ').replace(/(?:^|\s)(срочно|важно)(?=\s|$|[.,;!])/ig, ' ').replace(/\s+/g, ' ').trim();
    // «задача релиз 2.4» / «задача Релиз»: слово из словаря тем — часть названия, если без него смысла почти нет
    if (subj && rest.replace(/[\d\s.§№,\-–]/g, '').length < 3) { rest = (words.slice(0, used).join(' ') + ' ' + rest).replace(/\s+/g, ' ').trim(); subj = null; }
    if (!rest) return R('Какая задача? Например: «добавь задачу релиз 2.4 до пятницы».');
    const h = { id: C().uid(), subject: subj || '', title: rest, due: due ? E.dateStr(due.d) : '', done: false, priority: pr };
    return change(`Задача${subj ? ' по теме «' + subj + '»' : ''}: ${rest}${due ? ', на ' + due.label : ''}${pr === 'high' ? ', важное' : ''}.`, () => S().homework.push(h), () => { const s = S(); s.homework = s.homework.filter(x => x.id !== h.id); });
  }, 'hw-add');
  on(/^(?:дз|домашк[а-яё]*|домашнее задание|задания?|что делать|задачи|мои задачи|список задач|открытые задачи|все задачи|что по задачам|есть задачи|какие задачи|задачи есть)\s*$/i, (t, n, now) => {
    const g = E.hwGroups(S(), now), list = [...g.overdue, ...g.today, ...g.tomorrow, ...g.week];
    if (!list.length) return R('Открытых задач нет.', { buttons: [btn('Добавить задачу', 'cmd:добавь задачу'), btn('Задачи', 'tab:tasks')] });
    return R(`Открытых задач: **${list.length}**.`, { cards: [glassTable('Задачи', list.slice(0, 10).map(h => ({ left: h.subject || '—', title: h.title || '', meta: h.due ? ('до ' + h.due.slice(8) + '.' + h.due.slice(5, 7)) : '' })), { count: list.length })], buttons: [btn('Открыть задачи', 'tab:tasks')] });
  }, 'hw-list');
  on(/(?:какие\s+)?(?:задачи|задания|дз|домашк[а-яё]*)\s+(?:на\s+)?(сегодня|завтра|послезавтра)|(?:что\s+)?(?:задано|по\s+задачам)(?:\s+на)?\s*(сегодня|завтра|послезавтра)?|что задано|домашк[а-яёa-z0-9_]*\s+на|дз\s+на|какое\s+дз|какая\s+домашка|какие\s+задачи/i, (t, n, now) => {
    const g = E.hwGroups(S(), now), day = dayIn(n, now); let list, label = day ? day.label : 'открытых';
    if (day) { const ds = E.dateStr(day.d); list = (S().homework || []).filter(h => !h.done && h.due === ds); if (!list.length && /завтра/.test(n)) list = g.tomorrow || []; if (!list.length && /сегодня/.test(n)) list = g.today || []; }
    else list = [...g.overdue, ...g.today, ...g.tomorrow, ...g.week];
    if (!list.length) return R(day ? `На **${day.label}** задач нет.` : 'Открытых задач нет.', { buttons: [btn('Добавить задачу', 'cmd:добавь задачу')] });
    return R(`Задачи (${label}): **${list.length}**.`, { cards: [glassTable('Задачи · ' + label, list.slice(0, 10).map(h => ({ left: h.subject || '—', title: h.title || '', meta: h.due ? ('до ' + h.due.slice(8) + '.' + h.due.slice(5, 7)) : '' })), { count: list.length })], buttons: [btn('Открыть задачи', 'tab:tasks')] });
  }, 'hw-list');
  on(/(сделал|сделала|выполнил[а-яёa-z0-9_]*|сдал[а-яёa-z0-9_]*)\s+(дз|домашк[а-яёa-z0-9_]*|задание)?\s*(по\s+)?(.*)/, (t, n) => {
    const q = n.replace(/^.*?(сделал[а-яёa-z0-9_]*|выполнил[а-яёa-z0-9_]*|сдал[а-яёa-z0-9_]*)\s+(дз|домашк[а-яёa-z0-9_]*|задание)?\s*(по\s+)?/, '').trim(), s = S();
    const pend = s.homework.filter(h => !h.done), subj = q ? C().resolveSubject(q) : null;
    const m = q ? pend.filter(h => N(h.subject) === N(subj) || N(h.title).includes(q)) : pend;
    if (!m.length) return R(q ? `Не нашёл открытую задачу по «${q}».` : 'Открытых задач нет.');
    if (m.length > 1) return R('Какую отметить?', { buttons: m.slice(0, 5).map(h => btn(`${h.subject || ''} ${h.title}`.trim().slice(0, 36), 'ag:done:' + h.id)) });
    const h = m[0]; return change(`Отмечу выполненным: ${h.subject ? h.subject + ' — ' : ''}${h.title}.`, () => { h.done = true; }, () => { h.done = false; });
  }, 'hw-done');

  // 7) напоминания
  on(/^(?:какие\s+)?(?:у\s+меня\s+)?(?:есть\s+)?напоминани[яе]\s*(?:есть)?\s*$/i, () => {
    const list = (S().reminders || []).filter(x => !x.done).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    if (!list.length) return R('Активных напоминаний нет. Скажите: «напомни через 30 мин купить хлеб».', { buttons: [btn('Напомнить', 'cmd:напомни')] });
    return R(`Напоминаний: **${list.length}**.`, { cards: [glassTable('Напоминания', list.slice(0, 12).map(x => {
      const d = x.at ? new Date(x.at) : null;
      const when = d ? d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
      return { left: when, title: x.text || '—', meta: '' };
    }), { count: list.length })] });
  }, 'remind-list');
  on(/^напомни[а-яёa-z0-9_]*\s*(?:мне)?\s*(.*)/, (t, n, now) => {
    let rest = t.replace(/^напомни[а-яёa-z0-9_]*\s*(?:мне)?\s*/i, ''); const ti = tIn(N(rest)), day = dayIn(N(rest), now);
    if (!ti && !day) { const what = rest.trim(); remindFocus(what, ''); return R(what ? 'Когда напомнить «' + what + '»? Например: «завтра в 9:00» или «через час».' : 'О чём напомнить?', { buttons: [cancelBtn()] }); }
    let at = new Date(now);
    if (day) at = new Date(day.d);
    if (ti && ti.off != null) at = new Date(now.getTime() + ti.off * 60000); else if (ti && ti.at != null) { at.setHours(Math.floor(ti.at / 60), ti.at % 60, 0, 0); if (!day && at <= now) at = E.addDays(at, 1); } else { at.setHours(8, 0, 0, 0); }
    rest = rest.replace(/через\s+(?:полчаса|час|\d+\s*\S+)/i, '').replace(/(?:^|\s)(?:в|к)\s*\d{1,2}[:.]\d{2}/i, '').replace(/(?:^|\s)(?:в|к)\s*\d{1,2}(?=\s|$)(?:\s*(?:утра|вечера|дня|ночи))?/i, ' ').replace(/(?:^|[^а-яёa-z0-9_])(послезавтра|завтра|сегодня)(?![а-яёa-z0-9_])/i, '').replace(/\s+/g, ' ').trim();
    if (!rest) {
      remindFocus('', at.toISOString());
      return R('О чём напомнить ' + at.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) + '?', { buttons: [cancelBtn()] });
    }
    const r = { id: C().uid(), text: rest[0].toUpperCase() + rest.slice(1), at: at.toISOString(), done: false };
    return change(`Напомню «${r.text}» ${at.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.`, () => { (S().reminders = S().reminders || []).push(r); O.notify && O.notify.ask(); }, () => { S().reminders = S().reminders.filter(x => x.id !== r.id); });
  }, 'remind');

  // 8) рюкзак
  on(/(что взять|что брать|рюкзак|сумк[аиуе]?\s+на|собрать (портфель|рюкзак))/, (t, n, now) => {
    const day = dayIn(n, now) || ((E.nowMin(now) >= 15 * 60) ? { d: E.addDays(now, 1), label: 'завтра' } : { d: now, label: 'сегодня' });
    const di = E.dayIdx(day.d);
    const r = (O.actions && O.actions.packFor) ? O.actions.packFor(di) : { msg: '—', rows: [] };
    const rows = r.rows || [];
    if (!rows.length) return R(`На ${day.label} вещей в списке нет. Укажите «что взять» в карточке встречи.`, { buttons: [btn('Встречи', 'tab:schedule')] });
    const card = `<div class="o-packs">${rows.map(row => `<button type="button" class="o-pk${row.done ? ' on' : ''}" data-ag="ag:pack:${di}:${encodeURIComponent(row.name)}">${ic('check', 13, 3)}${esc(row.name)}</button>`).join('')}</div>`;
    return R(`На ${day.label}: отметьте, что уже положили.`, { cards: [card], buttons: [btn('Открыть сборы', 'tab:pack')] });
  }, 'pack');

  // 9) настройки словами
  on(/(?:тем[ауы]?|режим)\s+(темн[а-яёa-z0-9_]*|светл[а-яёa-z0-9_]*|авто[а-яёa-z0-9_]*|amoled|амолед[а-яёa-z0-9_]*)|(?:темн[а-яёa-z0-9_]*|светл[а-яёa-z0-9_]*)\s+(?:тем[ауы]|режим)/, (t, n) => { const v = /светл/.test(n) ? 'light' : /авто/.test(n) ? 'auto' : /amoled|амол/.test(n) ? 'amoled' : 'dark'; return setting(`Тема: ${({ light: 'светлая', dark: 'тёмная', auto: 'как в системе', amoled: 'AMOLED' })[v]}.`, { theme: v }); }, 'theme');
  on(/(бренд|стиль|оформление|оболочк[а-яёa-z0-9_]*)\s+(контур[а-яёa-z0-9_]*|орбит[а-яёa-z0-9_]*|пульс[а-яёa-z0-9_]*|ритм|вектор[а-яёa-z0-9_]*|сланец|сланц[а-яёa-z0-9_]*|закат)/, (t, n) => { const id = /контур|орбит/.test(n) ? 'contour' : /пульс|ритм/.test(n) ? 'pulse' : /вектор/.test(n) ? 'vector' : 'slate'; return setting(`Оформление: «${O.brands[id].name}». Теперь меня зовут ${O.brands[id].agent}.`, { brand: id }); }, 'brand');
  on(/(крупн[а-яёa-z0-9_]*|больше|увелич[а-яёa-z0-9_]*)\s*(шрифт|текст)|шрифт\s*(крупн|больше)/, () => setting('Увеличил текст.', { textScale: Math.min(140, (+S().settings.textScale || 100) + 10) }), 'font+');
  on(/(мельч[а-яёa-z0-9_]*|меньше|уменьш[а-яёa-z0-9_]*)\s*(шрифт|текст)|шрифт\s*(мельч|меньше)/, () => setting('Уменьшил текст.', { textScale: Math.max(85, (+S().settings.textScale || 100) - 10) }), 'font-');
  on(/(?:до остановки|идти до остановки|иду до остановки)\s*(\d{1,2})\s*мин|(\d{1,2})\s*мин[а-яёa-z0-9_]*\s*(?:до остановки|иду до остановки)/, (t, n, now, m) => { const v = +(m[1] || m[2]), s = S(); if (!s.buses.length) return R('Сначала добавьте автобус.'); const prev = s.buses.map(b => b.walkMin); return change(`Время до остановки для всех маршрутов: ${v} мин.`, () => s.buses.forEach(b => b.walkMin = v), () => s.buses.forEach((b, i) => b.walkMin = prev[i])); }, 'walk');
  on(/(?:на выход|на сборы|собираюсь)\s*(\d{1,2})\s*мин|(\d{1,2})\s*мин[а-яёa-z0-9_]*\s*(?:на выход|на сборы)/, (t, n, now, m) => { const v = +(m[1] || m[2]); return setting(`Время на сборы после работы: ${v} мин. Учту при расчёте маршрутов.`, { exitMin: v }); }, 'exit');
  on(/^(настройки|открой настройки|параметры|оформление|стиль|тема)$/, () => {
    const card = (O.inline && O.inline.settingsCard) ? O.inline.settingsCard('look') : '';
    return R('Оформление и параметры — карточка ниже. Полный список: «Все настройки».', {
      cards: card ? [card] : [],
      buttons: [btn('Стиль', 'cmd:оформление'), btn('Агент', 'cmd:настройки агента'), btn('Все настройки', 'tab:settings')]
    });
  }, 'settings');
  on(/^(настройки\s+агента|агент\s+настройки)$/, () => {
    const card = (O.inline && O.inline.settingsCard) ? O.inline.settingsCard('agent') : '';
    return R('Параметры агента и помидора:', { cards: card ? [card] : [], buttons: [btn('Стиль', 'cmd:оформление'), btn('Все настройки', 'tab:settings')] });
  }, 'settings-agent');
  function setting(text, patch) { const s = S(), prev = {}; Object.keys(patch).forEach(k => prev[k] = s.settings[k]); return change(text, () => { Object.assign(s.settings, patch); C().applyTheme(); }, () => { Object.assign(s.settings, prev); C().applyTheme(); }); }

  // 10) обмен и навигация
  on(/(поделись|поделиться|отправь (расписание|данные|план)|экспорт|(?:^|[^a-zа-я])qr(?![a-z])|кюар|блютуз|bluetooth|передай (расписание|данные))/, () => R('Открываю обмен: можно по QR, файлом, через системное меню «Отправить» (Bluetooth, Nearby Share, AirDrop, мессенджеры) или кодом.', { buttons: [btn('Открыть обмен', 'tab:share'), btn('Только расписание', 'share:schedule')] }), 'share');
  on(/^(открой|покажи|перейди|перейти)\s+(на\s+)?(.+)/, (t, n) => {
    const map = [[/автобус/, 'buses'], [/расписан|урок|встреч/, 'schedule'], [/контакт|телефон/, 'contacts'], [/задач|домашк|дз/, 'tasks'], [/заметк/, 'notes'], [/дневник|журнал/, 'diary'], [/рюкзак|сумк|сборы/, 'pack'], [/канбан/, 'kanban'], [/настройк/, 'settings'], [/профил/, 'profile'], [/главн|сегодня|дашборд/, 'today'], [/обмен|поделит/, 'share'], [/калькулятор|cifra|счёт/, 'calc'], [/схем|flowforge|блоксхем/, 'flow']];
    const m = map.find(([re]) => re.test(n)); return m ? (C().switchTab(m[1]), R('Готово.')) : null;
  }, 'nav');

  // 11) память
  on(/^запомни[:,]?\s+(.+)/, (t) => { const f = t.replace(/^запомни[:,]?\s+/i, '').trim(); mem.notes.push({ t: f, at: Date.now() }); saveMem(); return R(`Запомнил: «${f}».`, { buttons: [btn('Что ты помнишь', 'cmd:что ты помнишь')] }); }, 'remember');
  on(/^(.+?)\s+(?:это|—|-)\s+(.+)$/, (t, n) => {
    const m = t.match(/^(мама|папа|бабушка|дедушка|брат|сестра)\s+(?:это|—|-)\s+(.+)$/i); if (!m) return null;
    const p = S().people.find(x => N(x.name).includes(N(m[2]).slice(0, 4))); if (!p) return R(`Не нашёл «${m[2]}» в контактах.`, { buttons: [btn('Добавить контакт', 'person:new')] });
    mem.aliases[N(m[1])] = p.id; saveMem(); return R(`Хорошо: «${m[1]}» — это ${p.name}. Теперь «позвони ${m[1].replace(/а$/, 'е')}» набирает её/его номер.`);
  }, 'alias');
  on(/(что ты помнишь|что ты знаешь обо мне|твоя память|покажи память)/, () => {
    const hab = O.habits.all().slice(0, 5), al = Object.entries(mem.aliases);
    const parts = []; if (al.length) parts.push('Контакты: ' + al.map(([k, v]) => { const p = S().people.find(x => x.id === v); return `«${k}» → ${p ? p.name : '?'}`; }).join('; ')); if (mem.notes.length) parts.push('Заметки: ' + mem.notes.slice(-5).map(x => x.t).join('; ')); if (hab.length) parts.push('Часто просите: ' + hab.map(h => `${h.label} (${h.count})`).join(', '));
    return R(parts.length ? parts.join('\n') : 'Пока почти ничего: я учусь на ваших частых действиях. Скажите «запомни…» или «мама — это Ирина».', { buttons: [btn('Забыть всё', 'ag:forget')] });
  }, 'memory');
  on(/^(забудь все|забудь всё|очисти память)/, () => R('Стереть память агента (привычки, заметки, связи контактов)?', { buttons: [btn('Да, забыть', 'ag:forget'), btn('Нет', 'ag:no:x')] }), 'forget');
  on(/^(отмени|отмена|верни назад|undo)$/i, () => {
    try {
      const u = undoStack.pop();
      if (!u) return R('Нет изменений для отмены.');
      u();
      try { C().save(); C().render(); } catch (e) {}
      return R('Отменено.');
    } catch (e) {
      console.error('undo', e);
      return R('Не удалось отменить. Нет изменений для отмены.');
    }
  }, 'undo');


  // Помидор — полная панель в агенте (как калькулятор)
  on(/^(?:начни|запусти|старт|включи)\s+(?:помидор[оа]?|помодор[оа]?|pomodoro|фокус(?:\s*режим)?)(?:\s+(\d{1,3})\s*(?:мин(?:ут[аы]?)?)?)?\s*$/i, (t, n, now, m) => {
    try {
      const mins = (m && m[1]) ? +m[1] : undefined;
      if (O.pomo) O.pomo.start(mins);
      const card = (O.inline && O.inline.pomoCard) ? O.inline.pomoCard() : '';
      return R(mins ? ('Помидор **' + mins + ' мин**. Карточка ниже — или «Закрепить».') : 'Помидор запущен. Карточка в ленте; «Закрепить» — сверху чата.', {
        cards: card ? [card] : [],
        buttons: [btn('Закрепить', 'cmd:закрепи помидор'), btn('Пауза', 'cmd:пауза помидор'), btn('Сброс', 'cmd:сброс помидор')]
      });
    } catch (e) {
      console.error('pomo-start', e);
      return R('Не удалось запустить помидор: ' + (e.message || e));
    }
  }, 'pomo-start');
  on(/^(?:помидор[оа]?|помодор[оа]?|pomodoro)\s*(\d{1,3})?\s*$/i, (t, n, now, m) => {
    try {
      const mins = (m && m[1]) ? +m[1] : undefined;
      if (mins && O.pomo) O.pomo.start(mins);
      const card = (O.inline && O.inline.pomoCard) ? O.inline.pomoCard() : '';
      return R(mins ? ('Помидор **' + mins + ' мин**.') : 'Карточка помидора. Старт / пресеты / «Закрепить».', {
        cards: card ? [card] : [],
        buttons: [btn('Старт 25', 'cmd:помидор 25'), btn('45 мин', 'cmd:помидор 45'), btn('Закрепить', 'cmd:закрепи помидор')]
      });
    } catch (e) {
      console.error('pomo-word', e);
      return R('Не удалось открыть помидор: ' + (e.message || e));
    }
  }, 'pomo-word');

  on(/^(?:пауза|продолжи(?:ть)?)\s*(?:помидор[оа]?|помодор[оа]?|фокус)?\s*$/i, () => {
    try {
      const r = O.pomo ? O.pomo.pause() : { ok: false, msg: 'Помидор не загружен' };
      if (O.inline && O.inline.openPomo) O.inline.openPomo({});
      return R(r.msg);
    } catch (e) { return R('Ошибка паузы.'); }
  }, 'pomo-pause');
  on(/^(?:сброс|останови|стоп)\s*(?:помидор[оа]?|помодор[оа]?|фокус)?\s*$/i, () => {
    try {
      const r = O.pomo ? O.pomo.reset() : { ok: false, msg: 'Помидор не загружен' };
      if (O.inline && O.inline.openPomo) O.inline.openPomo({});
      return R(r.msg);
    } catch (e) { return R('Ошибка сброса.'); }
  }, 'pomo-reset');
  on(/^(?:сколько\s+)?(?:помидор(?:ов)?|помодор(?:о)?)\s*(?:сегодня)?\s*$/i, () => {
    try {
      if (O.inline && O.inline.openPomo) O.inline.openPomo({});
      const st = O.pomo ? O.pomo.status() : { total: 0, label: '—', state: 'idle' };
      return R(st.state === 'idle'
        ? `Сегодня завершено: **${st.total}**. Панель помидора открыта в чате.`
        : `Сейчас ${st.state === 'focus' ? 'фокус' : 'перерыв'}: **${st.label}**. Всего сегодня: ${st.total}.`);
    } catch (e) { return R('Не удалось показать статус помидора.'); }
  }, 'pomo-status');
  on(/^(?:закрепи|закрепить|пин)\s*(?:помидор[оа]?|помодор[оа]?)?\s*$/i, () => {
    try {
      if (O.inline && O.inline.openPomo) O.inline.openPomo({});
      return R('Помидор закреплён сверху чата. Сверните или ✕, чтобы открепить.');
    } catch (e) { return R('Не удалось закрепить.'); }
  }, 'pomo-pin');

  on(/^(?:режим\s+)?концентрац\S*|focus\s*mode|не\s*отвлекай\s*$/i, () => {
    if (!O.focusMode) return R('Режим концентрации недоступен. Обновите страницу.');
    const on = O.focusMode.toggle();
    return R(on ? 'Режим концентрации: лишнее скрыто. Снова «концентрация» или кнопка сверху — выйти.' : 'Обычный режим.');
  }, 'focus-mode');

  function makeAppQrCard() {
    const url = (location.href || '').split('#')[0] || 'https://contour.app';
    const id = 'ag-qr-' + Date.now();
    // QR рисуется после render
    setTimeout(() => {
      try {
        const host = document.getElementById(id);
        if (!host || typeof qrcode === 'undefined') return;
        const qr = qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        host.innerHTML = qr.createSvgTag(5, 0);
        const svg = host.querySelector('svg');
        if (svg) { svg.style.width = '100%'; svg.style.maxWidth = '220px'; svg.style.height = 'auto'; }
      } catch (e) { console.error('qr', e); }
    }, 60);
    return `<div class="o-glass-card o-qr-card" data-share-payload="${esc(url)}">
      <div class="o-glass-h"><span>QR · приложение</span></div>
      <div class="o-qr-box" id="${id}"><p class="o-glass-p">Генерация…</p></div>
      <p class="o-scheme-cap"><small>${esc(url)}</small></p>
      <div class="o-m-b" style="padding:0 12px 12px;display:flex;flex-wrap:wrap;gap:6px">
        <button type="button" class="o-chip" data-ag="ag:share-text">Поделиться ссылкой</button>
        <button type="button" class="o-chip" data-ag="tab:share">Раздел Обмен</button>
      </div>
    </div>`;
  }
  on(/^(?:покажи\s+)?(?:qr|куар|кьюар)(?:\s+код)?(?:\s+(?:приложени[яе]|контур|app|на\s+приложени[ея]))?\s*$/i, () => {
    return R('QR-код приложения — наведите камеру другого телефона.', {
      cards: [makeAppQrCard()],
      buttons: [btn('Поделиться ссылкой', 'ag:share-text'), btn('Обмен', 'tab:share')]
    });
  }, 'qr-app');
  on(/^(?:подели(?:сь|ться)|share|qr|куар)\s*(.*)$/i, (t, n) => {
    const q = (n || '').replace(/^(?:подели(?:сь|ться)|share|qr|куар)\s*/i, '').trim();
    if (/прилож|app|контур|ссылк|^$/i.test(q) || !q) {
      return R('Ссылка и QR на Контур — в карточке. Можно сразу поделиться в мессенджер.', {
        cards: [makeAppQrCard()],
        buttons: [btn('Поделиться ссылкой', 'ag:share-text'), btn('Обмен', 'tab:share')]
      });
    }
    if (/схем/i.test(q)) {
      const png = O._lastSchemePng;
      if (png && png.dataUrl) {
        const card = `<div class="o-glass-card o-scheme-card"><div class="o-glass-h"><span>Схема · PNG</span></div><div class="o-scheme-png"><img src="${png.dataUrl}" alt=""/></div>
          <div class="o-m-b" style="padding:8px 12px 12px"><button type="button" class="o-chip" data-ag="ag:share-png">Поделиться PNG</button></div></div>`;
        return R('Последняя схема из агента.', { cards: [card], buttons: [btn('Поделиться PNG', 'ag:share-png')] });
      }
      return R('Сначала отправьте схему из FlowForge в агент (кнопка PNG / в агент).', { buttons: [btn('Схемы', 'tab:flow')] });
    }
    return R('Чем поделиться?', {
      cards: [makeAppQrCard()],
      buttons: [btn('QR приложения', 'cmd:qr приложения'), btn('Обмен', 'tab:share')]
    });
  }, 'share-sheet');


  // Диаграммы: круговая, гистограмма, занятость, состояния, journey, C4
  on(/(?:^|\s)(?:создай|нарисуй|построй|покажи|открой)?\s*(?:мне\s+)?(?:диаграмм[ауые]|diagrams?)(?:\s|$)|где\s+(?:посмотреть\s+)?диаграмм|диаграмм[аы]?\s+(?:занят|свободн|кругл|долей)/i, (t, n) => {
    let type = 'pie';
    if (/гист|столб|bar/i.test(n)) type = 'bar';
    else if (/занят|свободн|busy/i.test(n)) type = 'busy';
    else if (/состоян|state/i.test(n)) type = 'state';
    else if (/journey|путь\s+польз/i.test(n)) type = 'journey';
    else if (/\bc4\b|контекст/i.test(n)) type = 'c4';
    else if (/кругл|pie|долей/i.test(n)) type = 'pie';
    const doc = O.diagrams ? O.diagrams.fromAgentText(type) : null;
    // busy from schedule
    if (type === 'busy' && doc && O.engine) {
      try {
        const now = new Date();
        const list = O.engine.eventsOn(S(), now).list || [];
        if (list.length) {
          doc.blocks = list.slice(0, 8).map(e => ({
            label: e.title || e.subject || 'Событие',
            start: Math.floor((e.s || 0) / 60),
            end: Math.max(Math.floor((e.s || 0) / 60) + 1, Math.floor((e.e || e.s || 0) / 60)),
            kind: 'busy'
          }));
          doc.title = 'Занятость сегодня';
          if (O.diagrams.storeSave) O.diagrams.storeSave(doc);
        }
      } catch (e) {}
    }
    const card = doc && O.diagrams ? O.diagrams.cardFor(doc) : '';
    if (O.diagrams && O.diagrams.openEditor) {
      /* не уводим с агента сразу — карточка в чате */
    }
    return R('Диаграмма «' + (O.diagrams && O.diagrams.TYPES[type] ? O.diagrams.TYPES[type].title : type) + '» в карточке.', {
      cards: card ? [card] : [],
      buttons: [btn('Редактор', 'tab:diagrams'), btn('Круговая', 'cmd:круговая диаграмма'), btn('Занятость', 'cmd:диаграмма занятости')]
    });
  }, 'diagram-dash', 'diagram-pie-dash', 'diagram-bar-dash', 'diagrams-hub');

  on(/^(?:диаграмм[аы]?\s+)?(?:с\s+дашборда|из\s+дашборда|по\s+дашборду|из\s+данных|авто\s*диаграмм)\s*$/i, (t, n) => {
    if (!O.diagrams) return R('Модуль диаграмм не загружен.');
    const type = /гист|столб/.test(n) ? 'bar' : (/круг|pie|дол/.test(n) ? 'pie' : 'busy');
    const doc = O.diagrams.fromDashboard(type, { dayOffset: /завтра/.test(n) ? 1 : 0 });
    const card = O.diagrams.cardFor(doc);
    return R('Собрал диаграмму **из данных приложения** (расписание, задачи, цели).', {
      cards: [card],
      buttons: [
        btn('В редактор', 'ag:dg-edit:' + (doc.id || '')),
        btn('Круговая из данных', 'cmd:круговая с дашборда'),
        btn('Гистограмма недели', 'cmd:гистограмма с дашборда')
      ]
    });
  }, 'diagram-dash');
  on(/^(?:кругов(?:ая|ую)?\s+)?(?:с\s+дашборда|из\s+данных)\s*$/i, () => {
    const doc = O.diagrams.fromDashboard('pie', {});
    return R('Круговая по долям дня (встречи / задачи / цели / свободно).', {
      cards: [O.diagrams.cardFor(doc)],
      buttons: [btn('В редактор', 'ag:dg-edit:' + doc.id), btn('Занятость', 'cmd:диаграмма занятости')]
    });
  }, 'diagram-pie-dash');
  on(/^(?:гистограмм[аы]?\s+)?(?:с\s+дашборда|по\s+неделе|из\s+данных)\s*$/i, () => {
    const doc = O.diagrams.fromDashboard('bar', {});
    return R('Гистограмма событий по дням недели.', {
      cards: [O.diagrams.cardFor(doc)],
      buttons: [btn('В редактор', 'ag:dg-edit:' + doc.id)]
    });
  }, 'diagram-bar-dash');

  on(/(?:нарисуй|создай|построй|покажи)?\s*(?:кругов(ую|ая)\s*диаграмм|pie\s*chart|диаграмм[ау]\s*долей)/i, (t, n) => {
    if (!O.diagrams) return R('Модуль диаграмм не загружен.');
    const doc = /дашборд|данных|сегодня|авто/.test(n)
      ? O.diagrams.fromDashboard('pie', {})
      : O.diagrams.fromAgentText(t || 'pie');
    const card = O.diagrams.cardFor(doc);
    return R('Круговая диаграмма в карточке' + (doc.source === 'dashboard' ? ' (из данных дня)' : '') + '.', {
      cards: [card],
      buttons: [btn('В редактор', 'ag:dg-edit:' + doc.id), btn('Из дашборда', 'cmd:диаграмма с дашборда'), btn('Гистограмма', 'cmd:гистограмма')]
    });
  }, 'diagram-pie');
  on(/(?:нарисуй|создай|построй|покажи)?\s*(?:гистограмм[ауы]?|столбчат|bar\s*chart)/i, () => {
    const doc = O.diagrams ? O.diagrams.fromAgentText('bar') : null;
    const card = doc && O.diagrams ? O.diagrams.cardFor(doc) : '';
    return R('Гистограмма — в карточке.', {
      cards: card ? [card] : [],
      buttons: [btn('Редактор', 'tab:diagrams'), btn('Круговая', 'cmd:круговая диаграмма')]
    });
  }, 'diagram-bar');
  on(/(?:диаграмм[аы]?\s*)?(?:занятост|свободн(ого|ое)\s*врем|busy\s*time|загрузк[аи]\s*дня)/i, (t, n) => {
    if (!O.diagrams) return R('Модуль диаграмм не загружен.');
    const doc = O.diagrams.fromDashboard('busy', { dayOffset: /завтра/.test(n) ? 1 : 0 });
    const card = O.diagrams.cardFor(doc);
    return R('Занятость по **расписанию**' + (/завтра/.test(n) ? ' на завтра' : ' на сегодня') + '. Можно открыть в редакторе.', {
      cards: [card],
      buttons: [btn('В редактор', 'ag:dg-edit:' + doc.id), btn('С дашборда', 'cmd:диаграмма с дашборда'), btn('Круговая', 'cmd:круговая диаграмма')]
    });
  }, 'diagram-busy');
  on(/(?:диаграмм[аы]?\s*)?(?:состояний|state\s*machine|статусн)/i, () => {
    const doc = O.diagrams ? O.diagrams.fromAgentText('state') : null;
    const card = doc && O.diagrams ? O.diagrams.cardFor(doc) : '';
    return R('Диаграмма состояний.', {
      cards: card ? [card] : [],
      buttons: [btn('Редактор', 'tab:diagrams')]
    });
  }, 'diagram-state');
  on(/(?:путь\s*пользовател|user\s*journey|customer\s*journey|user\s*flow)/i, () => {
    const doc = O.diagrams ? O.diagrams.fromAgentText('journey') : null;
    const card = doc && O.diagrams ? O.diagrams.cardFor(doc) : '';
    return R('Путь пользователя (journey).', {
      cards: card ? [card] : [],
      buttons: [btn('Редактор', 'tab:diagrams')]
    });
  }, 'diagram-journey');
  on(/(?:c4|си4|контекстн(ая|ую)\s*диаграмм)/i, () => {
    const doc = O.diagrams ? O.diagrams.fromAgentText('c4') : null;
    const card = doc && O.diagrams ? O.diagrams.cardFor(doc) : '';
    return R('C4-контекст: система и окружение.', {
      cards: card ? [card] : [],
      buttons: [btn('Редактор', 'tab:diagrams')]
    });
  }, 'diagram-c4');



  // Контекст экрана + проактив
  on(/^(?:что\s+на\s+экране|контекст\s+экрана|что\s+ты\s+видишь|screen\s*context)\s*$/i, () => {
    if (O.cards && O.cards.contextCard) {
      O.cards.contextCard();
      return R(''); // карточка уже в ленте
    }
    return R('Контекст недоступен.');
  }, 'screen-ctx');
  on(/^(?:сводка\s+дня|план\s+утра|вечерн(яя|ий)\s+сводк|проактив)\s*$/i, () => {
    if (O.cards && O.cards.maybeProactive) {
      const c = O.cards.maybeProactive({ force: true });
      if (c) return R('');
    }
    return R('Сводка уже есть за этот слот сегодня — или включите «Проактивные карточки» в настройках агента.');
  }, 'proactive-force');


  // Где схема / открыть схемы / flowforge
  on(/^(?:где\s+схем[аы]?|открой\s+схем[уыа]|схем[аы]?|flowforge|блок[- ]?схем)\s*$/i, () => {
    try {
      if (O.inline && O.inline.openFlowInChat) O.inline.openFlowInChat();
    } catch (e) {}
    return R('FlowForge **в контейнере чата**. Мастер схем — текстом; полный экран — кнопкой.', {
      buttons: [btn('Мастер схем', 'cmd:мастер схем'), btn('Полный экран', 'tab:flow')]
    });
  }, 'where-scheme');

  on(/^(?:схема|scheme)\s*[:=]\s*([\s\S]+)/i, (t, n) => {
    return R('Схема получена. Могу открыть в редакторе.', {
      buttons: [btn('Открыть в FlowForge', 'tab:flow'), btn('Поделиться', 'cmd:поделись схемой')]
    });
  }, 'scheme-in');




  on(/^(алло|алё|але|ало|ау|эй|прив|привет|приветик|здравствуй[а-яёa-z0-9_]*|здорово|хай|hi|hello|ку|добрый (день|вечер)|доброе утро|доброй ночи)( (алло|алё|але|ало|орби|орбита))*$/, () => {
    const h = new Date().getHours();
    const hi = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    return R(hi + '! Я на связи. Скажи «я освободился» — подберу автобус, или «что дальше» — покажу день.', { buttons: sug() });
  }, 'hello');
  on(/^(как дела|как ты|спасибо|благодарю|пока|до свидания|ок|окей|ладно|хорошо)$/, (t, n) => {
    if (/^(пока|до свидания)/.test(n)) return R('Пока! Если что — я тут.');
    if (/^(спасибо|благодарю)/.test(n)) return R('Пожалуйста!');
    if (/^как/.test(n)) return R('Всё хорошо, работаю. Чем помочь?', { buttons: sug() });
    return R('Хорошо.', { buttons: sug() });
  }, 'smalltalk');

  /* ───── облако и сообщество: стена, друзья, личные сообщения, расписания (cron + push) ───── */
  on(/^(облако|cloud|синхронизация|синхронизируй( переписку)?|загрузи переписку из облака|выгрузи в облако)$/i, async () => {
    const Cl = O.cloud; if (!Cl || !Cl.enabled()) { C().switchTab('cloud'); return R('Облако ещё не подключено. Открыл раздел «Облако»: это дополнительная функция по желанию — вставьте адрес проекта Supabase.', { buttons: [btn('Раздел Облако', 'tab:cloud')] }); }
    if (!Cl.logged()) { C().switchTab('cloud'); return R('Нужно войти в аккаунт Контур Cloud (e-mail + пароль, которые вы сами придумали) — открыл раздел «Облако».', { buttons: [btn('Раздел Облако', 'tab:cloud')] }); }
    try { await Cl.syncNow(); return R('Синхронизировал ✓ Вся переписка (храню до 100 МБ) и данные в облаке — можно заходить с любого устройства.' + (Cl.online ? '' : ' Часть ушла в очередь: сеть сбоит, повторим автоматически.')); }
    catch (e) { return R('Сбой облака: ' + ((e && e.message) || e) + '. Возможны проблемы: иногда Supabase не работает без ВПН. Локально всё сохранено, ничего не потерялось.', { buttons: [btn('Раздел Облако', 'tab:cloud')] }); }
  }, 'cloud-sync');
  on(/(опубликуй|напиши на стену|пост на стену|добавь на стену)\s+([\s\S]{3,})/i, async (t, n) => {
    const Cl = O.cloud;
    const body = (n.match(/стен\w*[:\s—-]*([\s\S]+)$/i) || [, n])[1].trim();
    if (!Cl || !Cl.logged()) return R('Стена доступна только с подключённым облаком. Скажите «облако», чтобы настроить.', { buttons: [btn('Раздел Облако', 'tab:cloud')] });
    if (((S().settings || {}).cloudAgentWall) === false) return R('Вы запретили агенту писать на стену (раздел «Облако» → настройки).');
    await Cl.postWall(body, 'bot');
    return R('Опубликовал на общей стене от имени агента: «' + body.slice(0, 80) + '». Стену контролирую я: читаю её для обучения и помечаю свои посты 🤖.');
  }, 'wall-post');
  on(/(что нового на стене|покажи стену|открой стену|лент[ае]|читай стену|обучись со стены|выучи со стены)/i, async () => {
    const Cl = O.cloud; if (!Cl || !Cl.logged()) return R('Стена живёт в облаке — сначала подключите его (скажите «облако»).', { buttons: [btn('Раздел Облако', 'tab:cloud')] });
    try { await Cl.loadWall(); } catch (e) { return R('Не достучался до стены: ' + ((e && e.message) || e) + '. Нужен интернет, иногда — ВПН.'); }
    const posts = Cl.wall.slice(-6).reverse();
    const learned = await Cl.learnFromWall().catch(() => 0);
    return R((posts.length ? 'На стене свежее:\n' + posts.map(p => '• ' + String(p.body).slice(0, 90)).join('\n') : 'Стена пуста.') + (learned ? '\nЗаписал ' + learned + ' записей стены в свою память — учусь на вашем опыте.' : ''), { buttons: [btn('Открыть стену', 'tab:cloud'), btn('Что ты помнишь', 'cmd:что ты помнишь')] });
  }, 'wall-read');
  on(/(добавь в друзья|пригласи в друзья|найди друга)\s+(.+)/i, async (t, n) => {
    const Cl = O.cloud; if (!Cl || !Cl.logged()) return R('Друзья — функция облака. Подключите Supabase в разделе «Облако».', { buttons: [btn('Раздел Облако', 'tab:cloud')] });
    const q = (n.match(/(?:друз[ьяе]*|найди друга)\s*(?:[:\s]*)?(.*)$/i) || [, n])[1].trim() || n;
    try {
      const found = await Cl.searchUsers(q);
      if (!found.length) return R('Не нашёл такого пользователя в облаке. Он должен зарегистрироваться и подтвердить почту.');
      if (found.length > 1) return R('Кого именно добавить?', { buttons: found.slice(0, 6).map(p => btn(p.name || p.id.slice(0, 8), 'ag:cfriend:' + p.id)) });
      await Cl.addFriend(found[0].id);
      return R('Отправил приглашение: ' + (found[0].name || found[0].id.slice(0, 8)) + '. Как примет — сможете переписываться, и я передам другу сообщение по вашей просьбе.');
    } catch (e) { return R('Сбой поиска друзей: ' + ((e && e.message) || e) + ' (нет связи / нужен ВПН?)'); }
  }, 'cfriend');
  on(/(отправь|напиши|передай)( ему| ей)?( личное)? сообщени[ею]\s+(\S+)\s*[:,]?\s+(.+)/i, async (t, n) => {
    const Cl = O.cloud; if (!Cl || !Cl.logged()) return R('Личные сообщения — через облако. Подключите его в разделе «Облако».', { buttons: [btn('Раздел Облако', 'tab:cloud')] });
    const m = n.match(/сообщени[ею]\s+(\S+)\s*[:,]?\s+([\s\S]+)$/i) || [];
    const who = E.N(m[1] || ''), body = (m[2] || '').trim();
    if (!body) return R('Что передать? Пример: «отправь сообщение Анне привет, встретимся в 7».');
    const fr = Cl.friends.find(f => E.N(f.name || '').startsWith(who) || (f.id || '').startsWith(m[1]) || who && E.N(f.name || '') === who);
    if (!fr) return R('Такого друга пока нет в списке. Сначала: «добавь в друзья ' + (m[1] || '') + '».', { buttons: [btn('Друзья', 'tab:cloud')] });
    await Cl.sendDm(fr.id, body);
    return R('Передал ' + (fr.name || 'другу') + ': «' + body.slice(0, 80) + '».' + (Cl.online ? '' : ' Пока связи нет — стоит в очереди, отправлю сам.'));
  }, 'cdm');
  on(/(поставь|сделай|добавь|включи|запланируй)\s+(задание|сценарий|напоминание|расписание|cron)[\s\S]*/i, async (t, n) => {
    const tm = (n.match(/(?:каждый день |каждые день )?в\s+(\d{1,2}[:.]\d{2})/) || [])[1];
    if (!tm) return R('Укажите время. Пример: «поставь задание каждый день в 8:00 — что взять завтра».', { buttons: [btn('Cron и push', 'tab:cloud')] });
    const cmd = (n.match(/[—:-]\s*([\s\S]+)$/) || [])[1] || (n.split(/\d{1,2}[:.]\d{2}/)[1] || '').replace(/^[\s—:-]+/, '') || 'что дальше';
    const wd = (n.match(/по (пн|вт|ср|чт|пт|сб|вс|понедельник|вторник|сред[ау]|четверг|пятниц\w*|суббот\w*|воскресень\w*)/i) || [])[1];
    const dayMap = { пн: 0, пон: 0, понедельник: 0, вт: 1, втор: 1, вторник: 1, ср: 2, сред: 2, среду: 2, среда: 2, чт: 3, четвер: 3, четверг: 3, пт: 4, пятн: 4, пятницу: 4, пятница: 4, сб: 5, субб: 5, субботу: 5, суббота: 5, вс: 6, воскр: 6, воскресень: 6, воскресенье: 6 };
    const kind = wd ? 'weekly' : 'daily';
    const di = wd != null ? dayMap[E.N(wd)] : null;
    const job = O.cron && O.cron.add({ name: cmd.slice(0, 40), kind, time: tm.replace('.', ':'), days: di != null ? [di] : [0, 1, 2, 3, 4], cmd, pushTitle: 'Контур', pushBody: cmd, cloud: !!(O.cloud && O.cloud.logged()) });
    if (job && O.cloud && O.cloud.logged()) {
      try { await O.cloud._api('jobAdd', cl => cl.from('script_jobs').insert({ uid: O.cloud.user.id, script_id: job.id, name: job.name, cron: job.cron || '', at: null, days: job.days || [], time_of_day: job.time || '', push_title: 'Контур', push_body: cmd, enabled: true })); } catch (e) {}
    }
    return R('Готово: «' + cmd + '» — ' + (job ? job.cronText : '') + '. Если приложение закрыто, сервер разбудит вас push-уведомлением (когда облако онлайн).', { buttons: [btn('Мои расписания', 'tab:cloud'), btn('Отменить', 'ag:undo')] });
  }, 'cron-add');
  on(/^(мои расписания|что по расписанию|какие задания|список заданий|cron задания)$/, () => {
    const jobs = (O.cron && O.cron.list()) || [];
    if (!jobs.length) return R('Расписаний нет. Пример: «поставь задание каждый день в 8:00 — что взять завтра».', { buttons: [btn('Раздел Облако → Cron', 'tab:cloud')] });
    return R('Ваши задания:\n' + jobs.map(j => '• ' + j.name + ' — ' + j.cronText + (j.enabled ? '' : ' (выкл)') + (j.pushTitle ? ' 🔔' : '')).join('\n'), { buttons: [btn('Управлять', 'tab:cloud')] });
  }, 'cron-list');
  on(/^(статус облака|состояние синхронизации|cloud status)$/, () => {
    const Cl = O.cloud; if (!Cl) return R('Модуль облака не загружен.');
    return R(Cl.statusLine() + '. Последняя синхронизация: ' + (Cl.lastSyncAt ? new Date(Cl.lastSyncAt).toLocaleString('ru-RU') : 'ещё не выполнялась') + '. ⚠ Возможны сбои без ВПН — локальные данные всегда в безопасности.');
  }, 'cloud-status');

  /* ───── ~10.0: облако, стена, друзья, личные сообщения, cron+push — В РАЗРАБОТКЕ ─────
     Код правил ниже сохранён без изменений. Пока CLOUD_READY = false, они отвечают коротко и ничего не ломают.
     Как вернуть всё при старте ~10.0 — docs/CLOUD-STUBS.md (поиск по «CLOUD_READY»). */
  const CLOUD_READY = false;
  const CLOUD_SOON = 'Облако, стена, друзья и cron — в разработке, версия 5.8. Сейчас всё хранится локально на устройстве.';
  /* имя правила → слово-«замок»: если в тексте его нет, правило пропускается (чтобы «лента», «опубликуй», «отправь сообщение» не перехватывались зря) */
  const CLOUD_GATE = { 'cloud-sync': null, 'cloud-status': null, 'cron-list': null, 'cfriend': null, 'wall-post': /стен/, 'wall-read': /стен|облак/, 'cron-add': /задани|сценари|cron/, 'cdm': /личн/ };
  INT.forEach(it => {
    if (!Object.prototype.hasOwnProperty.call(CLOUD_GATE, it.name)) return;
    const orig = it.fn, gate = CLOUD_GATE[it.name];
    it.fn = function (t, n) { if (CLOUD_READY) return orig.apply(this, arguments); return (!gate || gate.test(n || t || '')) ? R(CLOUD_SOON) : null; };
  });

  on(/^(помощь|помоги мне|что (ты )?(умеешь|можешь)|команды)$/, () => {
    const skills = (O.actions && O.actions.SKILLS) || [];
    const byCat = {};
    skills.forEach(sk => { (byCat[sk.cat] || (byCat[sk.cat] = [])).push(sk); });
    const catTitle = { day: 'День', tasks: 'Задачи', schedule: 'Расписание', people: 'Люди', nav: 'Навигация', sos: 'SOS', tools: 'Инструменты' };
    const blocks = Object.keys(catTitle).map(c => {
      const list = byCat[c] || [];
      if (!list.length) return '';
      return '<li><b>' + catTitle[c] + '</b>: ' + list.slice(0, 4).map(s => '«' + esc((s.examples && s.examples[0]) || s.label) + '»').join(', ') + '</li>';
    }).filter(Boolean).join('');
    return R(`Я ${name()}. Команды из каталога навыков:`, {
      cards: [`<ul class="o-help">${blocks}<li>Вкладки сверху: <b>Быстрые</b>, <b>День</b>, <b>Правки</b>, <b>Навыки</b></li><li>«отмена» — откатить последнее изменение</li><li><b>Инструменты</b>: калькулятор, графики, мастер схем (кнопки), маршруты метро/работа</li><li><b>Память</b>: настраиваемый лимит — «что было вчера», «что было на прошлой неделе»</li></ul>`],
      buttons: [btn('Навыки', 'ag:panel:skills'), btn('Быстрые', 'ag:panel:quick'), ...sug()]
    });
  }, 'help');

  // ─── 4.2: навигация, ДР, заметки, цели, уроки через actions ───
  on(/^(открой|открыть|перейди|перейти|покажи раздел|раздел)\s+(.+)/, (t, n) => {
    const q = n.replace(/^(открой|открыть|перейди|перейти|покажи раздел|раздел)\s+/, '').trim();
    const map = { урок: 'schedule', встреч: 'schedule', расписан: 'schedule', автобус: 'buses', контакт: 'contacts', людей: 'contacts', задач: 'tasks', домашк: 'tasks', журнал: 'diary', дневник: 'diary', заметк: 'notes', настройк: 'settings', обмен: 'share', сумк: 'pack', рюкзак: 'pack', сборы: 'pack', маршрут: 'buses', транспорт: 'buses', сегодня: 'today', канбан: 'kanban', профил: 'profile', калькулятор: 'calc', cifra: 'calc', счёт: 'calc', схем: 'flow', flowforge: 'flow', блоксхем: 'flow' };
    let tab = null;
    for (const [k, v] of Object.entries(map)) if (q.includes(k)) { tab = v; break; }
    if (!tab) return R('Куда открыть?', { buttons: [btn('Встречи', 'tab:schedule'), btn('Калькулятор', 'tab:calc'), btn('Схемы', 'tab:flow'), btn('Настройки', 'tab:settings')] });
    O.actions.go(tab);
    return R('Открыл раздел.', { buttons: [btn('Ещё разделы', 'tab:more'), btn('Калькулятор', 'tab:calc'), btn('Схемы', 'tab:flow')] });
  }, 'go');

  on(/((?:ден[ьи]|дни)\s*рожден|ближайшие\s*др|(?:^|[^а-яёa-z0-9_])др(?![а-яёa-z0-9_])|именин)/, (t, n) => {
    if (/добав|поставь|запиш|у\s+\S+\s+\d|\d{1,2}[./-]\d{1,2}/.test(n)) {
      const m = t.match(/(?:др|день рождения|др\.?)\s+(.+?)\s+(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)/i) || t.match(/у\s+(\S+)\s+(\d{1,2}[./-]\d{1,2})/i);
      if (m) {
        const date = O.actions.parseDate(m[2]);
        if (!date) return R('Дата в формате ДД.ММ или ДД.ММ.ГГГГ.');
        const who = findPeople(m[1].replace(/^у\s+/i, ''));
        if (!who.length) return R(`Не нашёл «${m[1].replace(/^у\s+/i, '')}» в контактах.`, { buttons: [btn('Добавить контакт', 'person:new'), btn('Контакты', 'tab:contacts')] });
        if (who.length > 1) return R('Кому именно?', { buttons: who.slice(0, 6).map(p => btn(p.name, 'cmd:др ' + p.name + ' ' + m[2])) });
        const r = O.actions.setBirthday(who[0], date);
        if (r.candidates) return R(r.msg, { buttons: r.candidates.map(p => btn(p.name, 'cmd:др ' + p.name + ' ' + m[2])) });
        if (r.ok && r.undo) { undoStack.push(r.undo); return R(r.msg, { buttons: [btn('Отменить', 'ag:undo')] }); }
        return R(r.msg || 'Не вышло.');
      }
      return R('Например: «др мамы 12.03» или «день рождения у Ивана 01.05».');
    }
    const r = O.actions.upcomingBirthdays(45);
    if (!r.list.length) return R('Ближайших дней рождения нет. Добавьте ДР в контактах или скажите «др мамы 12.03».', { buttons: [btn('Контакты', 'tab:contacts')] });
    const lines = r.list.slice(0, 8).map(u => `• ${u.name} — ${u.delta === 0 ? 'сегодня' : u.delta === 1 ? 'завтра' : 'через ' + u.delta + ' дн.'}`);
    return R('Ближайшие ДР:\n' + lines.join('\n'), { buttons: [btn('Контакты', 'tab:contacts')] });
  }, 'bday');

  on(/^(?:добавь\s+)?(заметка|заметку|запиши|запиши заметку|note)\s+(.+)/i, (t, n, now, m) => {
    const text = (m && m[2]) || t.replace(/^(?:добавь\s+)?(заметка|заметку|запиши|запиши заметку|note)\s+/i, '');
    const r = O.actions.addNote(text.replace(/^(?:в|на)\s+заметк[ауие]\s*[:,—-]?\s*/i, '').trim());
    if (r.ok && r.undo) { undoStack.push(r.undo); return R(r.msg, { buttons: [btn('Отменить', 'ag:undo'), btn('Заметки', 'tab:notes')] }); }
    return R(r.msg);
  }, 'note');

  on(/^(?:какие\s+)?(?:мои\s+)?цел[иь]\s*$/i, () => {
    const _seenG = new Set(); const list = (S().goals || []).filter(x => (x.progress || 0) < 100).filter(x => { const k = String(x.title||'').toLowerCase(); if (_seenG.has(k)) return false; _seenG.add(k); return true; });
    if (!list.length) return R('Активных целей нет. Скажите: «цель выучить английский».', { buttons: [btn('Добавить цель', 'cmd:цель ')] });
    return R(`Целей: **${list.length}**.`, { cards: [glassTable('Цели', list.slice(0, 10).map(g => ({ left: (g.progress || 0) + '%', title: g.title || '', pct: g.progress || 0, meta: g.deadline ? ('срок ' + g.deadline) : '' })), { count: list.length })], buttons: [btn('Задачи', 'tab:tasks')] });
  }, 'goal-list');
  on(/^(?:добавь\s+)?(?:цель|новая цель)\s+(.+)/i, (t, n, now, m) => {
    const title = ((m && m[1]) || '').trim();
    if (!title) return R('Какая цель? Например: «цель выучить английский».');
    const r = O.actions.addGoal(title);
    if (r.ok && r.undo) { undoStack.push(r.undo); return R(r.msg, { buttons: [btn('Отменить', 'ag:undo'), btn('Задачи', 'tab:tasks')] }); }
    return R(r.msg);
  }, 'goal');

  // «добавь встречу Демо пн вт 9:00-9:40» — несколько дней, диапазон времени, предлоги (в JS (?![а-яёa-z0-9_]) не работает с кириллицей)
  const DW = { пн: 0, пон: 0, понедельник: 0, вт: 1, вторник: 1, ср: 2, среда: 2, среду: 2, чт: 3, четверг: 3, пт: 4, пятница: 4, пятницу: 4, сб: 5, суббота: 5, субботу: 5, вс: 6, воскресенье: 6 };
  on(/^(добавь|добавить|новый)\s+урок\s+(.+)/i, (t, n) => {
    const rest = N(t).replace(/^(добавь|добавить|новый)\s+урок\s+/, '');
    const times = (rest.match(/\d{1,2}[:.]\d{2}/g) || []).map(x => x.replace('.', ':').replace(/^(\d):/, '0$1:'));
    const days = [];
    const words = rest.replace(/\d{1,2}[:.]\d{2}/g, ' ').replace(/[,;]/g, ' ').split(/\s+/).filter(Boolean);
    const subj = [];
    words.forEach(w => { const r = w.match(/^([а-я]+)[-–]([а-я]+)$/); if (r && DW[r[1]] != null && DW[r[2]] != null) { for (let d = DW[r[1]], k = 0; k < 7; k++, d = (d + 1) % 7) { if (!days.includes(d)) days.push(d); if (d === DW[r[2]]) break; } } else if (DW[w] != null) { if (!days.includes(DW[w])) days.push(DW[w]); } else if (!/^(в|во|на|по|и|с|до|-|–)$/.test(w)) subj.push(w); });
    if (!days.length) { const d = O.actions.parseDay(rest, new Date()); if (d) { days.push(d.idx); const i = subj.indexOf(d.label); if (i >= 0) subj.splice(i, 1); } }
    let subject = subj.join(' ').trim();
    try { const rs = C().resolveSubject && C().resolveSubject(subject); if (rs) subject = rs; } catch (e) {}
    if (!subject || !days.length || !times.length) {
      return R('Формат: «добавь встречу Планёрка пн вт 9:30» или «… пн 9:30-10:00». Не хватает: ' + [!subject && 'темы', !days.length && 'дня', !times.length && 'времени'].filter(Boolean).join(', ') + '.', { buttons: [btn('Добавить встречу', 'cmd:добавь встречу'), btn('Встречи', 'tab:schedule')] });
    }
    const msgs = [], undos = [];
    days.forEach(d => { const r = O.actions.addLesson({ day: d, subject, start: times[0], end: times[1] }); msgs.push(r.msg); if (r.undo) undos.push(r.undo); });
    if (undos.length) { undoStack.push(() => undos.forEach(u => u())); return R(msgs.join('\n'), { buttons: [btn('Отменить', 'ag:undo'), btn('Расписание', 'tab:schedule')] }); }
    return R(msgs.join('\n'));
  }, 'lesson-add');
  on(/^добавь\s+(автобус|кружок|контакт)\s*$/, (t, n, now, m) => R({ 'автобус': 'Какой автобус? Скажи номер, направление и время: «добавь автобус 537 домой 12:52 13:40».', 'кружок': 'Скажи: «добавь блок Фокус ср 15:00».', 'контакт': 'Скажи: «добавь контакт Мама +79001234567».' }[m[1]], { buttons: [btn('Автобусы', 'tab:buses')] }), 'bus-add');

  on(/^(удали|удалить|очисти)\s+(расписание|уроки)\s+(на\s+)?(.+)/i, (t, n) => {
    const day = O.actions.parseDay(t, new Date());
    if (day == null) return R('Укажите день: «удали расписание на среду».');
    const auto = (S().settings.agentAutonomy || 'smart') !== 'ask';
    if (!auto) return R(`Удалить все встречи на ${day.label}?`, { buttons: [btn('Да, удалить', 'cmd:удали расписание на ' + day.label + ' !confirm'), btn('Нет', 'ag:noop')] });
    if (!/!confirm/.test(t) && !auto) { /* handled above */ }
    const r = O.actions.removeLessonsDay(day.idx);
    if (r.ok && r.undo) { undoStack.push(r.undo); return R(r.msg, { buttons: [btn('Отменить', 'ag:undo')] }); }
    return R(r.msg);
  }, 'lesson-del');

  /* ───── разбор «день / время / кабинет» в командах (кириллица-безопасно) ───── */
  const CYR = '[\\wа-яёА-ЯЁ]';
  const DAYWORD = '(?:понедельник' + CYR + '*|вторник' + CYR + '*|сред' + CYR + '*|четверг' + CYR + '*|пятниц' + CYR + '*|суббот' + CYR + '*|воскресень' + CYR + '*|пн|вт|ср|чт|пт|сб|вс|сегодня|завтра|послезавтра)';
  const DAYS_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const RE_DAYPHRASE = new RegExp('(?:^|\\s)(?:(?:на|в|во|к|по)\\s+)?' + DAYWORD + '(?=\\s|$|[.,;])', 'gi');
  const RE_TIMEPHRASE = /(?:^|\s)(?:(?:в|к|с|до|на)\s+)?\d{1,2}[:.]\d{2}(?=\s|$|[.,;])/g;
  function splitCmd(rest) {
    let txt = String(rest || '').trim(), room = '';
    const rm = txt.match(/(?:^|\s|,)(?:каб(?:инет)?\.?|ауд(?:итория)?\.?)\s*№?\s*([0-9a-zа-я\/-]+)/i);
    if (rm) { room = rm[1]; txt = txt.replace(rm[0], ' '); }
    txt = txt.replace(/\s[-—–]\s.*$/, ' ').replace(/\s*[-—–]\s*$/, ' ');
    const day = O.actions.parseDay(txt, new Date()), time = O.actions.parseTime(txt);
    txt = txt.replace(RE_DAYPHRASE, ' ').replace(RE_TIMEPHRASE, ' ').replace(/(?:^|\s)(?:на|в|к|с)(?=\s*$)/gi, ' ')
      .replace(/\s+/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '');
    return { day, time, room, text: txt };
  }
  const addMin = (t, m) => E.fmt((E.toMin(t) || 0) + m);
  const askOrDo = (t, q, doFn) => {
    const auto = (S().settings.agentAutonomy || 'smart') !== 'ask';
    if (auto || /!confirm\s*$/.test(t)) return doFn();
    return R(q, { buttons: [btn('Да, удалить', 'cmd:' + t.replace(/\s*!confirm\s*$/, '') + ' !confirm'), btn('Нет', 'ag:noop')] });
  };
  const undoReply = (r, extra) => {
    if (r.ok && r.undo) { undoStack.push(r.undo); return R(r.msg, { buttons: [btn('Отменить', 'ag:undo'), ...(extra || [])] }); }
    return R(r.msg || 'Не вышло.');
  };
  const subjOf = txt => { let x = String(txt || '').trim(); try { const rs = x && C().resolveSubject && C().resolveSubject(x); if (rs) x = rs; } catch (e) {} return x; };
  const stemOf = q => { const x = N(q).trim(); return x.length > 5 ? x.slice(0, -2) : x; };
  const sameSubj = (name, q) => { const a = N(name), b = N(q); return !!b && (a.includes(b) || b.includes(a) || a.includes(stemOf(b))); };

  on(/^(удали|удалить|убери|сотри)\s+урок(?![\wа-яё])\s*(.*)$/i, (t) => {
    const sp = splitCmd(t.replace(/^\S+\s+урок\s*/i, '').replace(/\s*!confirm\s*$/, ''));
    const q = subjOf(sp.text);
    if (!q) return R('Какую встречу удалить? Например: «удали встречу Демо пн».');
    let list = (S().lessons || []).filter(l => sameSubj(l.subject, q));
    if (sp.day) list = list.filter(l => l.day === sp.day.idx);
    if (sp.time) list = list.filter(l => l.start === sp.time);
    if (!list.length) return R(`Не нашёл встречу «${q}»${sp.day ? ' на ' + sp.day.label : ''}.`, { buttons: [btn('Встречи', 'tab:schedule')] });
    if (list.length > 1) return R('Какой именно?', { buttons: list.slice(0, 6).map(l => btn(`${l.subject} ${DAYS_SHORT[l.day]} ${l.start}`, `cmd:удали встречу ${l.subject} ${DAYS_SHORT[l.day]} ${l.start}`)) });
    const l = list[0];
    return askOrDo(t, `Удалить «${l.subject}» (${DAYS_SHORT[l.day]} ${l.start})?`, () => undoReply(O.actions.removeLesson(l.id)));
  }, 'lesson-rm');

  on(/^(перенес[\wа-яё]*|перемест[\wа-яё]*|сдвин[\wа-яё]*|перекин[\wа-яё]*)\s+(.+)/i, (t) => {
    let rest = t.replace(/^\S+\s+/, '').replace(/^(?:все\s+)?урок[\wа-яё]*\s+/i, '').trim();
    let from = null;
    const fm = rest.match(new RegExp('(?:^|\\s)с\\s+(' + DAYWORD + ')(?=\\s|$)', 'i'));
    if (fm) { from = O.actions.parseDay(fm[1], new Date()); rest = rest.replace(fm[0], ' '); }
    const sp = splitCmd(rest);
    const subj = subjOf(sp.text.replace(/(?:^|\s)урок[\wа-яё]*(?=\s|$)/gi, ' ').replace(/\s+/g, ' ').trim());
    if (!subj || (!sp.day && !sp.time)) return R('Формат: «перенеси демо на среду», «перенеси демо на пт 10:00» или «перенеси демо с пн на ср».');
    const r = O.actions.moveLesson(subj, sp.day ? sp.day.idx : null, sp.time || undefined, from ? from.idx : null);
    if (r.candidates) {
      const tail = (sp.day ? ' на ' + DAYS_SHORT[sp.day.idx] : '') + (sp.time ? ' ' + sp.time : '');
      return R(r.msg + ' Выбери:', { buttons: r.candidates.map(l => btn(`${l.subject} ${DAYS_SHORT[l.day]} ${l.start || ''}`, `cmd:перенеси ${l.subject} с ${DAYS_SHORT[l.day]}${tail}`)) });
    }
    return undoReply(r, [btn('Встречи', 'tab:schedule')]);
  }, 'lesson-move');

  on(/^(добавь|добавить|новый|создай|сделай|заведи)\s+кружок\s+(.+)/i, (t) => {
    const sp = splitCmd(t.replace(/^\S+\s+кружок\s+/i, ''));
    const name = sp.text.replace(/^[«"]|[»"]$/g, '');
    const miss = [!name && 'название', !sp.day && 'день', !sp.time && 'время'].filter(Boolean);
    if (miss.length) return R('Не хватает: ' + miss.join(', ') + '. Скажи так: «добавь блок фокус-работа ср 15:00».');
    return undoReply(O.actions.addClub({ day: sp.day.idx, name: name[0].toUpperCase() + name.slice(1), start: sp.time, end: addMin(sp.time, 60), place: sp.room }), [btn('Расписание', 'tab:schedule')]);
  }, 'club-add');

  on(/^(удали|удалить|убери|сотри)\s+кружок\s+(.+)/i, (t) => {
    const q = t.replace(/^\S+\s+кружок\s+/i, '').replace(/\s*!confirm\s*$/, '').trim();
    const list = (S().clubs || []).filter(c => sameSubj(c.name, q));
    if (!list.length) return R(`Не нашёл блок «${q}».`, { buttons: [btn('Расписание', 'tab:schedule')] });
    if (list.length > 1) return R('Какой именно?', { buttons: list.slice(0, 6).map(c => btn(`${c.name} ${DAYS_SHORT[c.day]} ${c.start}`, `cmd:удали блок ${c.name}`)) });
    const c = list[0];
    return askOrDo(t, `Удалить блок «${c.name}»?`, () => undoReply(O.actions.removeClub(c.id)));
  }, 'club-del');

  on(/^(добавь|добавить|новый|создай|сделай|заведи)\s+(автобус|маршрут|рейс)(?![\wа-яё])\s+(.+)$/i, (t) => {
    const rest = t.replace(/^\S+\s+\S+\s*/, '').trim();
    const times = (rest.match(/\d{1,2}[:.]\d{2}/g) || []).map(x => { const [h, m] = x.split(/[:.]/); return String(h).padStart(2, '0') + ':' + m; });
    let r2 = rest.replace(/\d{1,2}[:.]\d{2}/g, ' ');
    const grab = re => { const m = r2.match(re); if (m) r2 = r2.replace(m[0], ' '); return m ? +m[1] : null; };
    const walkMin = grab(/(?:идти|пешком|до остановки)\s*(\d{1,2})\s*мин[\wа-яё]*/i);
    const rideMin = grab(/(?:в пути|ехать|едет|еду|езды)\s*(\d{1,3})\s*мин[\wа-яё]*/i);
    let days = [];
    if (/по\s+будн|будни/i.test(r2)) { days = [0, 1, 2, 3, 4]; r2 = r2.replace(/по\s+будн[\wа-яё]*|будни/ig, ' '); }
    else if (/выходн/i.test(r2)) { days = [5, 6]; r2 = r2.replace(/по\s+выходн[\wа-яё]*|выходные/ig, ' '); }
    else {
      const dre = new RegExp('(?:^|\\s)(пн|вт|ср|чт|пт|сб|вс|понедельник' + CYR + '*|вторник' + CYR + '*|сред' + CYR + '*|четверг' + CYR + '*|пятниц' + CYR + '*|суббот' + CYR + '*|воскресень' + CYR + '*)(?=\\s|$|[.,;])', 'gi');
      (r2.match(dre) || []).forEach(w => { const d = O.actions.parseDay(w.trim(), new Date()); if (d && !days.includes(d.idx)) days.push(d.idx); });
      r2 = r2.replace(dre, ' ');
    }
    r2 = r2.replace(/каждый день/i, ' ');
    const dir = /школ|учёб|учеб|на урок/i.test(r2) ? 'school' : /дом/i.test(r2) ? 'home' : null;
    const nm = r2.match(/(?:^|[\s№])(\d{1,3}[а-яa-z]?)(?![\wа-яё])/i);
    const number = nm ? nm[1] : '';
    if (!number) return R('Какой номер у автобуса? Например: «добавь автобус 537 домой 12:52 13:40».');
    if (!times.length) return R(`Во сколько ходит №${number}? Например: «добавь автобус ${number} ${dir === 'school' ? 'на работу' : 'домой'} 12:52 13:40».`);
    const r = O.actions.addBus({ number, dir: dir || 'home', times, walkMin, rideMin, days: days.sort() });
    return undoReply(r, [btn('Автобусы', 'tab:buses'), btn('Когда автобус домой', 'cmd:когда автобус домой')]);
  }, 'bus-add');

  on(/^(удали|удалить|убери|сотри)\s+(автобус|маршрут)(?![\wа-яё])\s*(.*)$/i, (t) => {
    const q = t.replace(/^\S+\s+\S+\s*/, '').replace(/\s*!confirm\s*$/, '').trim();
    const buses = S().buses || [];
    if (!buses.length) return R('Автобусов нет.', { buttons: [btn('Автобусы', 'tab:buses')] });
    const lab = b => `№${b.number} ${E.busDir(b) === 'school' ? 'на работу' : 'домой'}`;
    const num = (q.match(/(\d{1,3}[а-яa-z]?)/i) || [])[1];
    let list = num ? buses.filter(b => String(b.number).toLowerCase() === num.toLowerCase()) : [];
    if (/школ/i.test(q)) list = list.filter(b => E.busDir(b) === 'school'); else if (/дом/i.test(q)) list = list.filter(b => E.busDir(b) === 'home');
    if (!list.length) return R(num ? `Автобус №${num} не нашёл.` : 'Какой автобус удалить?', { buttons: buses.slice(0, 6).map(b => btn(lab(b), 'cmd:удали автобус ' + lab(b).slice(1))) });
    if (list.length > 1) return R('Какой именно?', { buttons: list.slice(0, 6).map(b => btn(lab(b), 'cmd:удали автобус ' + lab(b).slice(1))) });
    const b = list[0];
    return askOrDo(t, `Удалить автобус №${b.number}?`, () => undoReply(O.actions.removeBus(b.id)));
  }, 'bus-del');

  on(/^(добавь|добавить|новый|создай|сделай|заведи)\s+(контакт|человека)(?![\wа-яё])\s+(.+)$/i, (t) => {
    let rest = t.replace(/^\S+\s+\S+\s*/, '').trim();
    const pm = rest.match(/\+?\d[\d\s()\-]{5,}\d/); let phone = '';
    if (pm) { phone = pm[0].trim(); rest = rest.replace(pm[0], ' '); }
    const name = rest.replace(/\s+/g, ' ').trim();
    if (!name) return R('Как зовут? Например: «добавь контакт Бабушка +7 999 123-45-67».', { buttons: [btn('Открыть форму', 'person:new')] });
    const REL_W = ['мама', 'папа', 'бабушка', 'дедушка', 'брат', 'сестра', 'тётя', 'дядя', 'тетя'];
    const relation = REL_W.includes(N(name)) ? name[0].toUpperCase() + name.slice(1).toLowerCase() : '';
    return undoReply(O.actions.addPerson({ name: name[0].toUpperCase() + name.slice(1), relation, phone }), [btn('Контакты', 'tab:contacts')]);
  }, 'person-add');

  on(/^(дневник|в дневник)\s+(.+)/i, (t, n, now, m) => {
    const text = (m && m[2]) || t.replace(/^(дневник|в дневник)\s+/i, '');
    const r = O.actions.addDiary(text.trim());
    if (r.ok && r.undo) { undoStack.push(r.undo); return R(r.msg, { buttons: [btn('Отменить', 'ag:undo'), btn('Журнал', 'tab:diary')] }); }
    return R(r.msg);
  }, 'diary');

  const PRI = ['script', 'sos', 'mycmds', 'favcall', 'help-full', 'pomo-start', 'pomo-word', 'pomo-pause', 'pomo-reset', 'pomo-status', 'pomo-pin', 'focus-mode', 'screen-ctx', 'proactive-force', 'diagrams-hub', 'diagram-pie', 'diagram-bar', 'diagram-busy', 'diagram-state', 'diagram-journey', 'diagram-c4', 'where-scheme', 'share-sheet', 'scheme-in', 'plans-eve', 'weather-soft', 'soft-help', 'note-wizard', 'task-ask', 'cloud-sync', 'cloud-status', 'cron-list', 'cfriend', 'wall-post', 'wall-read', 'cdm', 'cron-add', 'dates-between', 'dates-until', 'calc', 'route-add', 'graph', 'scheme', 'recall', 'tools-help', 'undo', 'remind', 'hw-add', 'hw-done', 'forget', 'remember', 'lesson-del', 'lesson-rm', 'lesson-move', 'lesson-add', 'club-del', 'club-add', 'bus-del', 'bus-add', 'person-add', 'diary', 'note', 'goal-list', 'goal', 'remind-list', 'settings', 'settings-agent', 'theme', 'memory', 'help', 'day', 'now', 'pack'];
  const sortInt = () => { if (INT._s) return; INT._s = 1; const w = n => { const i = PRI.indexOf(n); return i < 0 ? (n === 'alias' ? 999 : n === 'script-name' ? 998 : 500) : i; }; INT.sort((a, b) => w(a.name) - w(b.name)); };

  // синонимы глаголов: «создай/сделай/заведи автобус» = «добавь автобус», «убери/сотри» = «удали»
  function canon(t) {
    return t.replace(/^(?:хочу|надо|нужно|можешь|пожалуйста)?\s*(?:создай|создать|сделай|сделать|делай|заведи|завести|поставь|внеси|новый|новая|новое|\+)\s+(?=(?:автобус|урок|кружок|контакт|человека|дз|заметк|цель))/i, 'добавь ')
      .replace(/^(?:хочу|надо|нужно)?\s*добавить\s+(?=(?:автобус|урок|кружок|контакт))/i, 'добавь ')
      .replace(/^запиши\s+(?=(?:автобус|урок|кружок|контакт))/i, 'добавь ')
      .replace(/^(?:убери|сотри|вычеркни|удалить)\s+/i, 'удали ');
  }
  function understand(text) {
    sortInt();
    text = canon(text.trim());
    const t = text.trim(), n = N(t), now = new Date();
    for (const it of INT) { const m = n.match(it.re) || t.match(it.re); if (!m) continue; let r = null; try { r = it.fn(t, n, now, m); } catch (e) { console.error('agent', it.name, e); } if (r) { r.intent = it.name; return r; } }
    return null;
  }
  /* асинхронные интенты (облако): ждём Promise, если handler вернул его */
  async function understandAsync(text) {
    const r = understand(text);
    if (r && typeof r.then === 'function') { try { return await r; } catch (e) { console.error('agent async', e); return null; } }
    return r;
  }

  /* ───── API хранилища (js/orbit/storage.js): усечь/очистить историю чата ───── */
  A.trimHistory = keep => { const sz = () => JSON.stringify(mem.msgs || []).length * 2, before = sz(); if ((mem.msgs || []).length <= keep && A.msgs.length <= keep) return 0; mem.msgs = (mem.msgs || []).slice(-Math.max(0, keep)); A.msgs = A.msgs.slice(-Math.max(0, keep)); saveMem(); try { A.render(false); } catch (e) { /* не критично */ } return Math.max(0, before - sz()); };
  A.clearChat = () => { mem.msgs = []; A.msgs = []; saveMem(); try { A.render(false); } catch (e) { /* не критично */ } };

  /* ───── API для сценариев-графов (js/orbit/flow.js) ───── */
  /* выполнить команду «тихо»: без пузыря пользователя, ответы возвращаются, а не выводятся */
  A.quiet = async function (text) { try { const r = await understandAsync(spokenMath(String(text || ''))); return r ? [r] : []; } catch (e) { console.error('quiet', e); return []; } };
  A.knows = text => { try { return !!looksLikeCommand(text); } catch (e) { return false; } };
  /* вопрос «Да/Нет» посреди сценария: ждёт ответ пользователя (кнопка, текст, голос); null — отменил/не ответил */
  /* вопрос со свободным ответом посреди сценария: следующее сообщение пользователя (текст или голос) — это ответ; null — отмена */
  A.askText = q => new Promise(resolve => {
    try { const core = O.core && O.core(); if (core) { core.switchTab('agent'); A.panel = 'chat'; } } catch (e) { /* не критично */ }
    push(R(q, { buttons: [cancelBtn()] })); A.render(true);
    focusSet('ask-text', {}, t => { focusClear(); resolve(t); return R('Принято ✓'); }, () => resolve(null));
  });
  A.askYesNo = q => new Promise(resolve => {
    try { const core = O.core && O.core(); if (core) { core.switchTab('agent'); A.panel = 'chat'; } } catch (e) { /* не критично */ }
    push(R(q, { buttons: [btn('Да', 'cmd:да'), btn('Нет', 'cmd:нет'), cancelBtn()] })); A.render(true);
    focusSet('yn', {}, (t, n) => {
      if (F_YES.test(n)) { focusClear(); resolve(true); return R('Да ✓'); }
      if (F_NO.test(n)) { focusClear(); resolve(false); return R('Нет ✓'); }
      return R('Скажите «да» или «нет».', { buttons: [btn('Да', 'cmd:да'), btn('Нет', 'cmd:нет'), cancelBtn()] });
    }, () => resolve(null));
  });

  /* ───── карточки расписания / автобусов (из 3.23) ───── */
  function cardSchedule(items, header) {
    if (!items || !items.length) return '';
    const rows = items.map(it => `<div class="o-acard-row"><div class="o-acard-time">${esc(it.time || it.left || '')}</div><div class="o-acard-body"><div class="o-acard-title">${esc(it.title || it.name || '')}</div>${it.meta ? `<div class="o-acard-meta">${esc(it.meta)}</div>` : ''}</div></div>`).join('');
    return `<div class="o-acard" data-type="schedule">${header ? `<div class="o-acard-h">${esc(header)}</div>` : ''}${rows}</div>`;
  }
  function cardBuses(items, header) {
    if (!items || !items.length) return '';
    const rows = items.map(it => `<div class="o-acard-row"><div class="o-acard-time">${esc(it.time || it.left || '')}</div><div class="o-acard-body"><div class="o-acard-title">${esc(it.title || it.name || it.number || '')}</div>${it.meta ? `<div class="o-acard-meta">${esc(it.meta)}</div>` : ''}</div></div>`).join('');
    return `<div class="o-acard" data-type="buses">${header ? `<div class="o-acard-h">${esc(header)}</div>` : ''}${rows}</div>`;
  }

  /* ───── live-подсказки при наборе (из 3.23) ───── */
  let _liveTimer = null, _lastLive = '';
  function buildLiveSuggestions(raw) {
    const t = N(String(raw || ''));
    if (!t || t.length < 1 || legacy) return [];
    const out = [], seen = new Set();
    const push = (label, cmd, kind) => {
      const k = (cmd || '').toLowerCase();
      if (!k || seen.has(k) || out.length >= 8) return;
      seen.add(k); out.push({ label, cmd, kind: kind || 'catalog' });
    };
    // префиксы с 1–2 букв
    if (/^д/.test(t)) { push('Что задано', 'что задано', 'intent'); push('Добавить задачу', 'добавь задачу', 'intent'); push('Дни рождения', 'дни рождения', 'intent'); }
    if (/^а|^ав/.test(t)) { push('Автобусы домой', 'автобусы домой', 'intent'); push('Автобусы сейчас', 'автобусы сейчас', 'intent'); }
    if (/^у|^ур/.test(t)) { push('Расписание сегодня', 'расписание на сегодня', 'intent'); push('Добавить встречу', 'добавь встречу', 'intent'); }
    if (/^п|^по/.test(t)) { push('Позвонить', 'позвони', 'intent'); push('Помощь', 'помощь', 'intent'); push('Помидор', 'помидор', 'intent'); }
    if (/^пом|^поми|^помод/.test(t)) { push('Запусти помидор', 'запусти помодоро', 'intent'); push('Помидор 25', 'помидор 25', 'intent'); push('Помидор 45', 'помидор 45', 'intent'); }
    if (/^сх|^где\s*с/.test(t)) { push('Где схема', 'где схема', 'intent'); push('Открыть схемы', 'открой схемы', 'intent'); }
    if (/^я|^ос|^св/.test(t)) { push('Я освободился', 'я освободился', 'intent'); }
    if (/^ч|^чт/.test(t)) { push('Что дальше', 'что дальше', 'intent'); push('Что взять сегодня', 'что взять сегодня', 'intent'); push('Что задано', 'что задано', 'intent'); }
    if (/^н|^на/.test(t)) { push('Напомни', 'напомни через 30 минут', 'intent'); push('Настройки', 'открой настройки', 'intent'); }
    if (/^з|^за/.test(t)) { push('Заметка', 'заметка ', 'intent'); push('Что задано', 'что задано', 'intent'); }
    try {
      const subj = (C().resolveSubject && t.length >= 2) ? C().resolveSubject(t) : null;
      if (subj && C().SUBJECTS && C().SUBJECTS.includes(subj)) {
        push('+ ' + subj, 'добавь встречу ' + subj, 'subject');
        push(subj + ' сегодня', 'расписание на сегодня', 'subject');
        push('Что взять', 'что взять сегодня', 'subject');
      }
    } catch (e) {}
    const day = dayIn(t, new Date());
    if (day) {
      push('Расписание на ' + day.label, 'расписание на ' + day.label, 'day');
      push('Автобусы ' + day.label, 'автобусы ' + day.label, 'day');
    }
    if (/^доб|^добав|\+/.test(t)) {
      push('Добавить встречу', 'добавь встречу', 'intent');
      push('Добавить задачу', 'добавь задачу', 'intent');
      push('Добавить блок', 'добавь блок', 'intent');
    }
    if (/^удал|^очист|^убер/.test(t)) {
      push('Удалить день', 'удали день', 'intent');
      push('Очистить расписание', 'очисти расписание', 'intent');
    }
    if (/^авт|^рейс|^марш|^когда/.test(t)) {
      push('Автобусы сейчас', 'автобусы сейчас', 'intent');
      push('Автобусы домой', 'автобусы домой', 'intent');
      push('Автобусы на работу', 'автобусы на работу', 'intent');
      push('Когда выходить', 'когда выходить на работу', 'intent');
    }
    if (/^пров|^рюк|^что\s*вз/.test(t)) {
      push('Проверка дня', 'проверка дня', 'intent');
      push('Что взять сегодня', 'что взять сегодня', 'intent');
    }
    if (/^дз|^домаш|^задан/.test(t)) {
      push('Что задано', 'что задано', 'intent');
      push('Добавить задачу', 'добавь задачу', 'intent');
    }
    if (/^позв|^звон|^смс|^напиш|^маме|^папе/.test(t)) {
      push('Позвонить', 'позвони', 'intent');
      push('SMS', 'напиши смс', 'intent');
    }
    if (/^помо|^help|^как|^что\s*уме/.test(t)) push('Помощь', 'помощь', 'info');
    if (/\d+\s*[+\-*/]\s*\d+/.test(t) || /посчит|вычисл|sqrt|sin|cos/.test(t)) {
      push('Посчитать', (t.endsWith('=') ? t : t + '='), 'calc');
    }
    if (/^гр|^граф|^нарис/.test(t)) push('График sin(x)', 'график sin(x)', 'graph');
    if (/^сх|^блок|^создай\s*сх/.test(t)) push('Создать схему', 'создай схему Старт -> Процесс -> Конец', 'scheme');
    if (/^кал|^cifra|^открой\s*кал/.test(t)) push('Калькулятор', 'открой калькулятор', 'nav');
    if (/^открой\s*сх|^flow/.test(t)) push('Схемы', 'открой схемы', 'nav');
    // каталог навыков + привычки
    try {
      if (O.actions && O.actions.suggestFromCatalog) {
        O.actions.suggestFromCatalog(t).forEach(s => push(s.label, s.cmd, 'skill'));
      }
    } catch (e) {}
    try {
      A.chips().forEach(c => {
        const lab = (c.label || '').toLowerCase();
        if (lab.includes(t.slice(0, 4)) || t.split(/\s+/).some(w => w.length > 2 && lab.includes(w)))
          push(c.label, (c.act || '').replace(/^cmd:/, ''), 'preset');
      });
    } catch (e) {}
    return out;
  }
  function renderLiveChips(chips) {
    const el = $('ag-live');
    if (!el) return;
    const j = JSON.stringify(chips || []);
    if (j === _lastLive) return;
    _lastLive = j;
    if (!chips || !chips.length) { el.innerHTML = ''; el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = chips.map(c => `<button type="button" class="o-live-chip" data-kind="${esc(c.kind || '')}" data-ag="cmd:${esc(c.cmd)}">${esc(c.label)}</button>`).join('');
  }
  function onAgentInputLive(e) {
    clearTimeout(_liveTimer);
    const val = (e.target.value || '').trim();
    if (val.length < 1 || legacy) { renderLiveChips([]); return; }
    _liveTimer = setTimeout(() => renderLiveChips(buildLiveSuggestions(val)), 120);
  }

  /* ───── LLM API (OpenAI-совместимый, любая нейросеть) ───── */
  let llmDownUntil = 0;           // после сбоя нейросеть не дёргаем 5 минут
  A.llmLastError = '';
  async function callLlm(userText) {
    if (!O.llmReady || !O.llmReady()) return null;
    if (Date.now() < llmDownUntil) return null;
    let result;
    try { result = await O.llmChat(userText); } catch (e) { result = { ok: false, error: String((e && e.message) || e) }; }
    if (!result) return null;
    if (!result.ok) {
      // Нейросеть — запасной вариант: ошибку не показываем в чате, агент отвечает сам.
      A.llmLastError = result.error || 'ошибка';
      llmDownUntil = Date.now() + 5 * 60 * 1000;
      try { console.warn('[Контур] нейросеть недоступна:', A.llmLastError); } catch (e) {}
      return null;
    }
    llmDownUntil = 0; A.llmLastError = '';
    let content = String(result.text || '').trim();
    let parsed = null;
    try {
      const j = content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(j);
    } catch (e) {
      if (/^(добавь|удали|перенес|очист|позвони|напомни|дз |открой|тема )/i.test(content) && content.length < 160) {
        return R('[' + (result.provider || 'llm') + '] «' + content + '»', { buttons: [btn('Выполнить', 'cmd:' + content), btn('Отмена', 'ag:noop'), ...sug().slice(0, 2)] });
      }
      return R(content || 'Пустой ответ.', { buttons: sug() });
    }
    if (parsed && parsed.command && String(parsed.command).trim()) {
      const cmd = String(parsed.command).trim();
      return R((parsed.reply ? parsed.reply + '\n' : '') + 'Команда: «' + cmd + '»', {
        buttons: [btn('Выполнить', 'cmd:' + cmd), btn('Отмена', 'ag:noop'), ...sug().slice(0, 2)]
      });
    }
    if (parsed && parsed.reply) return R(String(parsed.reply), { buttons: sug() });
    return R('Нейросеть не предложила команду. Уточните.', { buttons: sug() });
  }

  /* Слой совместимости: новые слова рабочего словаря («встреча», «задача», «блок», «на работу») переводим во внутренние команды.
     Старые формулировки («урок», «дз», «кружок») по-прежнему понимаются. */
  const toLegacy = s => String(s)
    .replace(/(^|[^а-яёa-z0-9_])встреч(?:а|у|е|ей)(?![а-яё])/gi, '$1урок')
    .replace(/(^|[^а-яёa-z0-9_])встречи(?![а-яё])/gi, '$1уроки')
    .replace(/(^|[^а-яёa-z0-9_])встреч(?![а-яё])/gi, '$1уроков')
    .replace(/(^|[^а-яёa-z0-9_])(созвон[а-яё]*|совещани[а-яё]+|митинг[а-яё]*|планёрк[а-яё]+|планерк[а-яё]+|стендап[а-яё]*)(?=\s+(?:пн|вт|ср|чт|пт|сб|вс|понедельник|вторник|среда|среду|четверг|пятница|пятницу|суббота|субботу|воскресенье|\d))/gi, '$1$2')
    .replace(/(^|[^а-яёa-z0-9_])(добавь|добавить|новый|новая|новое|создай|создать|запиши|удали|удалить|убери|сотри|перенеси)\s+блок(?![а-яё-])/gi, (m, b, v) => b + v + ' кружок')
    .replace(/(^|[^а-яёa-z0-9_])(добавь|добавить|новая|новую|создай|создать|запиши|поставь|сделал|сделала|выполнил|выполнила|закрыл|закрыла|отметь|отметить|сдал)\s+задач[ауие](?![а-яё])/gi, (m, b, v) => b + v + ' дз')
    .replace(/^\s*(мои задачи|список задач|открытые задачи|все задачи|задачи|что по задачам|какие задачи)(?:\s+на\s+(сегодня|завтра))?\s*\??\s*$/i, (m, _, day) => day ? ('что задано на ' + day) : 'что задано')
    .replace(/^\s*что\s+у\s+нас\s+(завтра|сегодня|послезавтра)\s*\??\s*$/i, 'расписание на $1')
    .replace(/^\s*какие\s+цел[иь]\s*\??\s*$/i, 'цели')
    .replace(/^\s*цел[ьи]\s*\??\s*$/i, 'цели')
    .replace(/^\s*какие\s+напоминани[яе].*$/i, 'напоминания')
    .replace(/(^|[^а-яё])на работу(?![а-яё])/gi, '$1в школу').replace(/(^|[^а-яё])с работы(?![а-яё])/gi, '$1из школы')
    .replace(/(^|[^а-яё])после работы(?![а-яё])/gi, '$1после школы').replace(/(^|[^а-яё])в офис(?![а-яё])/gi, '$1в школу')
    .replace(/^\s*(журнал|в журнал)\s+/i, 'дневник ');
  A.toLegacy = toLegacy;
  /* «128 плюс 114 умножить на 66 посчитай», «22 × 13 + 16 делённое на 2 - 6 =» → «посчитай 128+114*66» */
  function spokenMath(text) {
    try {
      const V = window.CifraVoice; if (!V || !text) return text;
      if (/^\s*\d{1,2}\s*[:.]\s*\d{2}\s*$/.test(text)) return text;   // «10:30» — время, не деление
      const p = V.parse(text);
      if (p.unk.length || !p.expr || !/\d/.test(p.expr) || !/[+−×÷^%]|\(/.test(p.expr)) return text;
      return 'посчитай ' + p.expr.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/√/g, 'sqrt').replace(/∛/g, 'cbrt').replace(/π/g, 'pi');
    } catch (e) { return text; }
  }
  A.process = function (text) {
    try {
      { const fr = focusStep(text); if (fr) return fr; }
      { const sc = O.scripts && O.scripts.match && O.scripts.match(text); if (sc) { O.scripts.run(sc); return [R('Запускаю сценарий «' + sc.name + '».')]; } }
      // сначала текстовые навыки на исходной фразе («сколько процентов 30 от 200»), и только потом голосовой разбор выражений
      try { const pre0 = O.inline && O.inline.handle(text); if (pre0 && pre0.length) return pre0; } catch (e) { console.error('inline', e); }
      text = spokenMath(text);
      try { const pre = O.inline && O.inline.handle(text); if (pre && pre.length) return pre; } catch (e) { console.error('inline', e); }
      text = toLegacy(text);
      const c = C(), r = understand(text);
      if (r) { if (r.then) return r.then(rr => { if (rr) { if (c && c.legacyPending) c.legacyCancel(); legacy = false; rr.intent = rr.intent || 'cloud'; return [rr]; } return processSync(text); }); return [r]; }
      return processSync(text);
    } catch (e) {
      console.error('process', e);
      return [R('Сбой обработки: ' + (e && e.message ? e.message : e) + '. Попробуйте ещё раз.')];
    }
  };
  function processSync(text) {
    const c = C();
    // старый агент — только для команд про уроки/кружки/заметки или когда он ждёт ответ
    const n = N(text), LEG = /(добав|удал|убер|перенес|перемест|замен|измен|поменя|сдвин|созда|запиш|переимен|урок|кружок|заметк|окно|нагрузк|сколько|каникул|свободн[а-яёa-z0-9_]* врем|отмена|отмени)/;
    const words = n.split(/\s+/).slice(0, 2), subjHit = words.some(w => w.length > 2 && C().SUBJECTS.includes(C().resolveSubject(w))) && (dayIn(n, new Date()) || timeIn(n));
    if (!(c.legacyPending || LEG.test(n) || subjHit)) {
      // mark for possible LLM in send()
      return [{ role: 'bot', text: '', _needLlm: true, _raw: text }];
    }
    const out = c.legacyAgent(text), res = [];
    legacy = c.legacyPending;
    out.forEach(m => {
      const extra = { legacySubjects: !!m.subjects, copyPrompt: m.copyPrompt };
      if (m.card) extra.cards = [m.card];
      res.push(R(m.text, extra));
    });
    if (!res.length) res.push({ role: 'bot', text: '', _needLlm: true, _raw: text });
    else if (/(не понял|не знаю|не распознал)/i.test(res[res.length - 1].text) && !legacy) {
      res[res.length - 1]._needLlm = true;
      res[res.length - 1]._raw = text;
    }
    return res;
  };
  function push(m) {
    const entry = Object.assign({ at: Date.now() }, m);
    A.msgs.push(entry);
    { const _c = memCap(); if (_c > 0 && A.msgs.length > _c) A.msgs = A.msgs.slice(-_c); }
    if (O.work && O.work.pushMsg) O.work.pushMsg(mem, { role: entry.role, text: entry.text, at: entry.at });
    else { const _c = memCap(); mem.msgs = _c > 0 ? A.msgs.slice(-_c) : A.msgs.slice(); saveMem(); }
    if ((entry.role === 'user' || entry.role === 'bot') && entry.text) memPush({ role: entry.role, text: entry.text, at: entry.at });
  }
  /** Внешний API: положить сообщение в чат и отрисовать (схемы PNG/JSON из FlowForge и т.п.) */
  A.push = function (m, opts) {
    push(m);
    try {
      if (opts && opts.panel) A.panel = opts.panel;
      else A.panel = 'chat';
      A.render(true);
    } catch (e) { console.error('A.push render', e); }
  };
  A.exportChat = function () {
    const lines = (A.msgs || []).map(m => {
      const t = new Date(m.at || Date.now()).toISOString();
      const role = m.role === 'user' ? 'USER' : 'BOT';
      return '[' + t + '] ' + role + ': ' + String(m.text || '').replace(/\n/g, ' ');
    });
    const payload = {
      app: 'Contour',
      version: (window.APP_VERSION || (O.core && O.core().version) || ''),
      exportedAt: new Date().toISOString(),
      count: (A.msgs || []).length,
      messages: (A.msgs || []).map(m => ({
        role: m.role, text: m.text, at: m.at, intent: m.intent,
        cards: m.cards || [],
        buttons: m.buttons || []
      }))
    };
    return { text: lines.join('\n'), json: JSON.stringify(payload, null, 2), payload };
  };
  A.send = async function (text) {
    text = String(text || '').trim(); if (!text || busy) return; busy = true;
    try { await A._sendInner(text); } catch (e) { console.error('agent', e); } finally { busy = false; }
  };
  A._sendInner = async function (text) {
    push({ role: 'user', text }); renderLiveChips([]); A.render(true);
    if (O.motion() !== 'off') await new Promise(r => setTimeout(r, 160));
    let replies;
    try { replies = await A.process(text); } catch (e) { console.error(e); replies = [R('Что-то пошло не так. Попробуйте ещё раз.')]; }
    try {
      if (O.sessionReport && O.sessionReport.log) {
        const intents = (replies || []).map(r => r && r.intent).filter(Boolean).join(',') || 'unknown';
        O.sessionReport.log({ kind: 'msg', act: 'send', label: String(text).slice(0, 80), result: intents, detail: 'user→agent' });
      }
    } catch (e) {}
    // LLM fallback for unknown
    if (replies.length === 1 && replies[0]._needLlm) {
      const s = S().settings || {};
      if (O.llmReady && O.llmReady()) {
        A.render(true); // show typing via busy
        const llmR = await callLlm(replies[0]._raw || text);
        replies = [llmR || R('Не совсем понял «' + text + '». Я умею маршруты, звонки, задачи, напоминания и встречи — выбери:', { buttons: sug() })];
      } else {
        const aiPrompt = 'Ты помогаешь рабочему пространству «Контур». Пользователь написал: «' + text + '».\nПерефразируй в одну чёткую команду на русском.\nОтветь ТОЛЬКО текстом команды.';
        const showPrompt = s.agentAiPrompt !== false;
        replies = [R('Не понял «' + text + '». Я умею маршруты, звонки, задачи, напоминания и встречи.' + (showPrompt ? '\n\nМожно включить нейросеть в Настройках → Агент (любой OpenAI-совместимый API) или скопировать промпт:' : ''), {
          buttons: sug(),
          copyPrompt: showPrompt ? aiPrompt : undefined
        })];
      }
    }
    if (replies[0] && ['free', 'bus', 'now', 'day', 'call', 'sms', 'hw-list', 'pack'].includes(replies[0].intent)) O.habits.rec('cmd:' + text.toLowerCase().slice(0, 60), text.slice(0, 40));
    replies.forEach(m => { if (m && m.text !== undefined) push(m); });
    busy = false; A.render(true);
  };
  A.ask = text => { C().switchTab('agent'); setTimeout(() => A.send(text), 60); };

  /* кнопки внутри чата */
  function agAct(act) {
    if (/^ag:wiz:/.test(String(act || '')) && O.inline) { const out = O.inline.act(act); if (out && out.length) { out.forEach(push); A.render(true); return; } }
    const parts = String(act || '').split(':');
    const a = parts[1], x = parts[2], y = parts.slice(3).join(':');
    if (a === 'undo') { const u = undoStack.pop(); if (u) { u(); C().save(); C().render(); push(R('Отменено.')); } else push(R('Нечего отменять.')); }
    else if (a === 'yes') { const p = pending[x]; if (p) { p.doFn(); C().save(); C().render(); undoStack.push(p.undoFn); delete pending[x]; push(R('Готово.', { buttons: [btn('Отменить', 'ag:undo')] })); } }
    else if (a === 'noop') { /* ignore */ }
    else if (a === 'panel') { A.panel = x || 'chat'; A.render(false); return; }
    else if (a === 'cfriend') { if (!CLOUD_READY) { push(R(CLOUD_SOON)); } else { const Cl = O.cloud; if (Cl && Cl.logged()) { Cl.addFriend(y).then(() => { push(R('Приглашение отправлено ✓')); Cl.loadFriends().catch(() => {}); }).catch(e => push(R('Сбой: ' + ((e && e.message) || e)))); } } }
    else if (a === 'pack') {
      const day = +x, item = y;
      if (O.actions && O.actions.togglePack) {
        const r = O.actions.togglePack(day, decodeURIComponent(item || ''));
        if (r.undo) undoStack.push(r.undo);
        push(R(r.msg || 'Готово.', { buttons: [btn('Сумка ещё', 'cmd:что взять сегодня'), btn('Отменить', 'ag:undo')] }));
      }
    }
    else if (a === 'no') { delete pending[x]; push(R('Хорошо, не делаю.')); }
    else if (a === 'next') { const lp = O.lastPlan; if (lp && lp.options.length > 1) { lp.options.shift(); const b = lp.options[0]; push(R(`Следующий: №${b.number} в ${b.time}. Выйти в ${E.fmt(b.leaveBy)}, запас ${left(Math.max(0, b.slack))}.`, { cards: lp.options.slice(0, 3).map((o, i) => busCard(o, i, lp.kind)), buttons: lp.options.length > 1 ? [btn('Ещё следующий', 'ag:next')] : [] })); } else push(R('Больше подходящих рейсов нет.', { buttons: [btn('Все рейсы', 'tab:buses')] })); }
    else if (a === 'fav') { const p = S().people.find(v => v.id === x); if (p) { mem.favCall = p.id; saveMem(); push(R('Быстрый звонок: ' + p.name + '. Кнопка «Позвонить ' + firstName(p) + '» теперь звонит этому контакту.', { buttons: [btn('Мои команды', 'cmd:мои команды')] })); } }
    else if (a === 'favclear') { delete mem.favCall; saveMem(); push(R('Быстрый звонок сброшен: кнопка «Позвонить» будет спрашивать, кому звонить.', { buttons: [btn('Мои команды', 'cmd:мои команды')] })); }
    else if (a === 'unalias') { const k = decodeURIComponent(x || ''); delete mem.aliases[k]; saveMem(); push(R('Убрал привязку «' + k + '».', { buttons: [btn('Мои команды', 'cmd:мои команды')] })); }
    else if (a === 'pick') { const p = S().people.find(v => v.id === x); if (p) { if (pending.pickKey) { mem.aliases[pending.pickKey] = p.id; saveMem(); } push(R(y === 'sms' ? `Сообщение для ${p.name}.` : `Нажмите, чтобы позвонить: ${p.name}.`, { cards: [personCard(p, '')] })); } }
    else if (a === 'done') { const h = S().homework.find(v => v.id === x); if (h) { h.done = true; C().save(); C().render(); undoStack.push(() => { h.done = false; }); push(R(`Отметил: ${h.title}.`, { buttons: [btn('Отменить', 'ag:undo')] })); } }
    else if (a === 'dg-edit') {
      const id = x || '';
      let doc = O._lastDiagram;
      try {
        const st = O.diagrams && O.diagrams.storeGet && O.diagrams.storeGet();
        if (st && st.list) doc = st.list.find(d => d.id === id) || doc;
      } catch (e) {}
      if (O.diagrams && O.diagrams.openEditor) O.diagrams.openEditor(doc || id || 'pie');
      push(R('Открыл **редактор диаграмм**' + (doc && doc.title ? (': «' + doc.title + '»') : '') + '.', {
        buttons: [btn('Диаграммы', 'tab:diagrams'), btn('С дашборда', 'cmd:диаграмма с дашборда')]
      }));
      return;
    }
    else if (a === 'card-pin') {
      const id = x || '';
      if (O.cards && O.cards.pin) {
        const st = (() => { try { return JSON.parse(localStorage.getItem('contour-agent-cards') || '{}'); } catch (e) { return {}; } })();
        const was = st.live && st.live[id] && st.live[id].pin;
        O.cards.pin(id, !was);
      }
      return;
    }
    else if (a === 'close-calc') {
      try { if (O.inline && O.inline.closeCalc) O.inline.closeCalc(); } catch (e) {}
      push(R('Калькулятор свёрнут.'));
      return;
    }
    else if (a === 'close-flow') {
      try { if (O.inline && O.inline.closeFlowInChat) O.inline.closeFlowInChat(); } catch (e) {}
      push(R('Схемы свёрнуты.'));
      return;
    }
    else if (a === 'share-text' || a === 'share-png') {
      (async () => {
        try {
          if (a === 'share-png' && O._lastSchemePng && O._lastSchemePng.dataUrl) {
            const res = await fetch(O._lastSchemePng.dataUrl);
            const blob = await res.blob();
            const file = new File([blob], (O._lastSchemePng.name || 'scheme') + '.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title: O._lastSchemePng.name || 'Схема', text: 'Схема из Контура' });
              return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
            URL.revokeObjectURL(url);
            if (C() && C().toast) C().toast('PNG сохранён — отправьте из галереи');
            return;
          }
          const url = (location.href || '').split('#')[0];
          if (navigator.share) await navigator.share({ title: (O.brand && O.brand().name) || 'Контур', text: url, url: url });
          else { await navigator.clipboard.writeText(url); if (C() && C().toast) C().toast('Ссылка скопирована'); }
        } catch (e) {
          if (e && e.name === 'AbortError') return;
          if (C() && C().toast) C().toast('Не удалось поделиться');
        }
      })();
      return;
    }
    else if (a === 'forget') { mem = { aliases: {}, notes: [], msgs: [], facts: [] }; A.msgs = []; O.habits.clear(); C().clearAgentMemory && C().clearAgentMemory(); saveMem(); push(R('Память очищена.')); }
    else if (a === 'wiz') {
      // act = ag:wiz:OP:ARG  →  a=wiz, x=OP, y=ARG
      const op = x || 'start';
      const arg = y || '';
      if (op === 'start' || (!wiz && op !== 'tpl')) {
        wiz = O.work.wizardStart();
        const T = O.work.TEMPLATES;
        push(R('Мастер схемы — выберите шаблон:', {
          buttons: Object.keys(T).map(k => btn(T[k].label, 'ag:wiz:tpl:' + k))
        }));
      } else if (op === 'tpl') {
        if (!wiz) wiz = O.work.wizardStart();
        const key = arg || 'linear';
        O.work.wizardApplyTemplate(wiz, key);
        if (wiz.step === 'open' || key === 'blank') {
          O.actions.go('flow');
          wiz = null;
          push(R('Открыл пустой редактор FlowForge.', { buttons: [btn('Схемы', 'tab:flow')] }));
        } else {
          push(R('Шаблон «' + ((O.work.TEMPLATES[key] || {}).label || key) + '». Как назвать схему?', {
            buttons: [
              btn(wiz.name || 'Без названия', 'ag:wiz:name:' + encodeURIComponent(wiz.name || 'Схема')),
              btn('IT-процесс', 'ag:wiz:name:' + encodeURIComponent('IT-процесс')),
              btn('Встреча', 'ag:wiz:name:' + encodeURIComponent('Встреча')),
              btn('Далее → блоки', 'ag:wiz:blocks')
            ]
          }));
        }
      } else if (op === 'name') {
        if (!wiz) wiz = O.work.wizardStart();
        wiz.name = decodeURIComponent(arg || wiz.name || 'Схема');
        wiz.step = 'blocks';
        const blocks = wiz.blocks || [];
        push(R('«' + wiz.name + '». Отметьте блоки (нажмите чтобы убрать) или добавьте:', {
          buttons: blocks.map((b, i) => btn('✓ ' + b, 'ag:wiz:toggle:' + i)).concat([
            btn('+ Процесс', 'ag:wiz:add:process'),
            btn('+ Условие', 'ag:wiz:add:decision'),
            btn('+ Конец', 'ag:wiz:add:end'),
            btn('Готово → редактор', 'ag:wiz:finish')
          ])
        }));
      } else if (op === 'blocks') {
        if (!wiz) wiz = O.work.wizardStart();
        wiz.step = 'blocks';
        const blocks = wiz.blocks || [];
        push(R('Блоки «' + (wiz.name || 'Схема') + '»:', {
          buttons: blocks.map((b, i) => btn('✓ ' + b, 'ag:wiz:toggle:' + i)).concat([
            btn('+ Процесс', 'ag:wiz:add:process'),
            btn('+ Условие', 'ag:wiz:add:decision'),
            btn('+ Конец', 'ag:wiz:add:end'),
            btn('Готово → редактор', 'ag:wiz:finish')
          ])
        }));
      } else if (op === 'toggle') {
        if (!wiz) return;
        const i = +arg;
        if (wiz.blocks && wiz.blocks[i] != null) wiz.blocks.splice(i, 1);
        const blocks = wiz.blocks || [];
        push(R('Блоков: ' + blocks.length + '. Нажмите блок чтобы убрать.', {
          buttons: blocks.map((b, i) => btn('✓ ' + b, 'ag:wiz:toggle:' + i)).concat([
            btn('+ Процесс', 'ag:wiz:add:process'),
            btn('+ Условие', 'ag:wiz:add:decision'),
            btn('Готово → редактор', 'ag:wiz:finish')
          ])
        }));
      } else if (op === 'add') {
        if (!wiz) wiz = O.work.wizardStart();
        if (!wiz.blocks) wiz.blocks = [];
        if (arg === 'decision') wiz.blocks.push('Условие?');
        else if (arg === 'end') wiz.blocks.push('Конец');
        else wiz.blocks.push('Шаг ' + (wiz.blocks.length + 1));
        const blocks = wiz.blocks;
        push(R('Добавлено. Всего блоков: ' + blocks.length, {
          buttons: blocks.map((b, i) => btn('✓ ' + b, 'ag:wiz:toggle:' + i)).concat([
            btn('+ Процесс', 'ag:wiz:add:process'),
            btn('+ Условие', 'ag:wiz:add:decision'),
            btn('Готово → редактор', 'ag:wiz:finish')
          ])
        }));
      } else if (op === 'finish') {
        if (!wiz) { push(R('Сначала выберите шаблон.', { buttons: [btn('Мастер', 'ag:wiz:start')] })); }
        else {
          const built = O.work.wizardBuild(wiz);
          O.tools.openScheme(built.doc, wiz.name || built.name);
          const n = built.count;
          wiz = null;
          push(R('Готово: ' + n + ' блоков. Схема в редакторе FlowForge (не в чате).', {
            buttons: [btn('Открыть редактор', 'tab:flow'), btn('Ещё схему', 'ag:wiz:start')]
          }));
        }
      }
    }
    A.render(true);
  }

  /* ───── интерфейс ───── */
  A.chips = function () {
    const now = new Date(), nm = E.nowMin(now), ev = E.eventsOn(S(), now).list, out = [], seen = new Set();
    const st = S().settings || {};
    const catsOn = !!st.agentChipCats;
    const max = catsOn ? 20 : 5;
    const add = (l, c) => { const k = l.toLowerCase(); if (!seen.has(k) && out.length < max) { seen.add(k); out.push(btn(l, 'cmd:' + c)); } };
    // Базовый набор (всегда, мало кнопок)
    if (ev.length && nm < ev[0].s) add('Когда выходить', 'когда выходить на работу');
    else if (ev.length && nm >= Math.max(...ev.map(e => e.e)) - 40) add('Я освободился', 'я освободился');
    else add('Что дальше', 'что дальше');
    add('Задачи', 'что задано');
    if (S().people.some(p => p.phone)) { const f = favPerson(); add(f ? 'Позвонить ' + firstName(f) : 'Позвонить', f ? 'позвони ' + f.name : 'позвони'); }
    add('Помощь', 'помощь');
    if (!catsOn) return out;
    // Категории включены — расширенный набор
    if (st.agentSuggest !== false && O.habits) try { O.habits.top(now, { prefix: 'cmd:', limit: 2 }).forEach(m => add(m.label, m.label)); } catch (e) {}
    add('Цели', 'цели');
    add('Напомни', 'напомни');
    add('Помидор', 'помидор');
    add('QR приложения', 'qr приложения');
    add('Расписание', 'расписание на сегодня');
    add('Завтра', 'расписание на завтра');
    add('Напоминания', 'напоминания');
    add('Калькулятор', 'калькулятор');
    add('Схемы', 'где схема');
    add('Диаграммы', 'диаграммы');
    add('Занятость', 'диаграмма занятости');
    add('На экране', 'что на экране');
    add('Память', 'что было вчера');
    add('Концентрация', 'концентрация');
    add('Оформление', 'оформление');
    return out;
  };
  /** HTML ряда кнопок: при категориях — с подписью «расширенный набор» */
  A.chipsHtml = function () {
    const st = (S().settings || {});
    const tip = (O.onboard && O.onboard.enabled && O.onboard.enabled())
      ? `<button type="button" class="o-chip o-chip-tip" data-ag="cmd:обучи меня">💡 Совет</button>` : '';
    // компактный режим — одна горизонтальная лента
    if (!st.agentChipCats) {
      const chips = A.chips().map(x => `<button type="button" class="o-chip" data-ag="${esc(x.act)}">${esc(x.label)}</button>`).join('');
      return tip + `<div class="o-chips-scroll">` + chips +
        `<button type="button" class="o-chip o-chip-muted" data-ag="cmd:настройки агента">+ ещё</button></div>`;
    }
    // категории: кнопки-вкладки, внутри — горизонтальный скролл
    const groups = [
      { id: 'day', label: 'День', items: [
        ['cmd:что дальше', 'Что дальше'], ['cmd:я освободился', 'Автобус'],
        ['cmd:расписание на сегодня', 'Сегодня'], ['cmd:планы на завтра', 'Завтра']
      ]},
      { id: 'work', label: 'Дела', items: [
        ['cmd:что задано', 'Задачи'], ['cmd:цели', 'Цели'],
        ['cmd:напомни', 'Напомни'], ['cmd:напоминания', 'Список']
      ]},
      { id: 'tools', label: 'Инструменты', items: [
        ['cmd:калькулятор', 'Калькулятор'], ['cmd:создай схему', 'Схемы'],
        ['cmd:диаграммы', 'Диаграммы'], ['cmd:диаграмма занятости', 'Занятость'],
        ['cmd:помидор', 'Помидор']
      ]},
      { id: 'more', label: 'Ещё', items: [
        ['cmd:помощь', 'Помощь'], ['cmd:qr приложения', 'QR'],
        ['cmd:что на экране', 'На экране'], ['cmd:что ты помнишь', 'Память агента'],
        ['cmd:концентрация', 'Фокус'], ['cmd:настройки агента', 'Настройки']
      ]}
    ];
    let cat = A._chipCat || 'day';
    if (!groups.some(g => g.id === cat)) cat = 'day';
    const tabs = groups.map(g =>
      `<button type="button" class="o-chip-cat${g.id === cat ? ' on' : ''}" data-chip-cat="${g.id}">${g.label}</button>`
    ).join('');
    const g = groups.find(x => x.id === cat) || groups[0];
    const items = g.items.map(([act, lab]) =>
      `<button type="button" class="o-chip" data-ag="${esc(act)}">${esc(lab)}</button>`
    ).join('');
    return tip +
      `<div class="o-chip-cats">${tabs}</div>` +
      `<div class="o-chips-scroll">${items}</div>`;
  };


  function renderAgentPanel() {
    const body = $('ag-body'); if (!body) return;
    const b = O.brand();
    if (A.panel === 'quick') {
      const tiles = [
        ['cmd:что дальше', 'sparkle', 'Что дальше'],
        ['cmd:я освободился', 'bus', 'Я освободился'],
        ['cmd:что задано', 'check', 'Задачи'],
        ['cmd:что взять сегодня', 'bag', 'Сумка'],
        ['cmd:дни рождения', 'users', 'Дни рождения'],
        ['cmd:добавь встречу', 'plus', 'Встреча'],
        ['cmd:перенеси ', 'calendar', 'Перенести'],
        ['cmd:добавь задачу', 'plus', 'Задача'],
        ['cmd:добавь блок', 'plus', 'Блок'],
        ['cmd:добавь автобус', 'bus', 'Автобус'],
        ['cmd:напомни', 'clock', 'Напомнить'],
        ['cmd:заметка', 'file', 'Заметка'],
        ['cmd:журнал ', 'note', 'Журнал'],
        ['cmd:позвони', 'phone', 'Позвонить'],
        ['cmd:мои команды', 'users', 'Мои команды'],
        ['tab:schedule', 'calendar', 'Встречи'],
        ['tab:contacts', 'users', 'Контакты'],
        ['tab:tasks', 'check', 'Задачи'],
        ['tab:settings', 'sliders', 'Настройки'],
        ['sos', 'phone', 'SOS']
      ];
      body.innerHTML = `<div class="o-agent-quick">${tiles.map(([act, icon, lab]) => `<button type="button" class="o-aq" data-ag="${esc(act)}">${ic(icon, 22)}<span>${esc(lab)}</span></button>`).join('')}</div>`;
      return;
    }
    if (A.panel === 'day') {
      const now = new Date(), nm = E.nowMin(now);
      const ev = E.eventsOn(S(), now).list;
      const cur = ev.find(x => x.s <= nm && x.e > nm);
      const next = ev.find(x => x.s > nm);
      const act = O.actions || {};
      const hw = act.listHw ? act.listHw() : { msg: '—' };
      const pack = act.packFor ? act.packFor(E.dayIdx(now)) : { msg: '—' };
      const bday = act.upcomingBirthdays ? act.upcomingBirthdays(14) : { list: [] };
      body.innerHTML = `<div class="o-agent-day">
        <div class="o-ad-card"><h4>Сейчас</h4><p>${cur ? esc(cur.title) + ' до ' + esc(cur.end) : 'Окна / нет встречи'}</p>
          <p class="muted">${next ? 'Дальше: ' + esc(next.title) + ' в ' + esc(next.start) : 'На сегодня больше нет'}</p>
          <div class="o-m-b"><button class="o-chip" data-ag="cmd:что дальше">Обновить</button><button class="o-chip" data-ag="cmd:я освободился">Автобус домой</button></div></div>
        <div class="o-ad-card"><h4>Задачи</h4><p>${esc(hw.msg)}</p>
          <div class="o-m-b"><button class="o-chip" data-ag="cmd:что задано">Список</button><button class="o-chip" data-ag="cmd:добавь задачу">+ Задача</button></div></div>
        <div class="o-ad-card"><h4>Сумка</h4><p>${esc(pack.msg)}</p>
          <div class="o-m-b"><button class="o-chip" data-ag="tab:pack">Открыть</button></div></div>
        <div class="o-ad-card"><h4>Дни рождения (14 дн.)</h4><p>${bday.list.length ? bday.list.slice(0,4).map(u => esc(u.name) + ' · ' + (u.delta===0?'сегодня':u.delta===1?'завтра':'+'+u.delta+'д')).join('<br>') : 'Нет'}</p>
          <div class="o-m-b"><button class="o-chip" data-ag="cmd:дни рождения">Все</button></div></div>
      </div>`;
      return;
    }
    if (A.panel === 'edits') {
      const hist = (O.actions && O.actions.recent) ? O.actions.recent(15) : [];
      const fmt = ts => { try { const d = new Date(ts); return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
      body.innerHTML = `<div class="o-agent-edits">
        <div class="o-ad-card"><h4>Последние изменения</h4>
          ${hist.length ? hist.map(h => `<div class="o-edit-row"><div><b>${esc(h.label)}</b><small>${fmt(h.at)}</small></div></div>`).join('') : '<p class="muted">Пока нет изменений через агента. Добавьте встречу, задачу или контакт.</p>'}
          <div class="o-m-b" style="margin-top:10px"><button class="o-chip" data-ag="cmd:отмена">Отменить последнее</button><button class="o-chip" data-ag="cmd:помощь">Что умею</button></div>
        </div>
        <div class="o-ad-card"><h4>Быстро изменить</h4>
          <div class="o-agent-quick" style="padding:8px 0;grid-template-columns:repeat(2,1fr)">
            <button type="button" class="o-aq" data-ag="cmd:добавь встречу">${ic('plus',20)}<span>Встреча</span></button>
            <button type="button" class="o-aq" data-ag="cmd:добавь задачу">${ic('plus',20)}<span>Задача</span></button>
            <button type="button" class="o-aq" data-ag="cmd:добавь блок">${ic('plus',20)}<span>Блок</span></button>
            <button type="button" class="o-aq" data-ag="cmd:добавь автобус">${ic('bus',20)}<span>Автобус</span></button>
            <button type="button" class="o-aq" data-ag="tab:contacts">${ic('users',20)}<span>Контакты</span></button>
            <button type="button" class="o-aq" data-ag="tab:schedule">${ic('calendar',20)}<span>Расписание</span></button>
          </div>
        </div>
      </div>`;
      return;
    }
    if (A.panel === 'scripts') { if (O.scripts) O.scripts.panel(body); else body.innerHTML = '<p style="padding:16px">Модуль сценариев не загружен.</p>'; return; }
    if (A.panel === 'cloud' && !CLOUD_READY) {
      body.innerHTML = '<div class="o-panel o-scripts" style="display:block;padding:16px"><p style="margin:0 0 8px"><b>Облако — в разработке</b></p><p class="muted" style="margin:0">Облако, стена, друзья и cron — в разработке, версия 5.8. Сейчас всё хранится локально на устройстве.</p></div>';
      return;
    }
    if (A.panel === 'cloud') {
      const Cl = O.cloud;
      body.innerHTML = `<div class="o-panel o-scripts" style="display:block;flex-direction:column;gap:8px;padding:12px">
        <p class="muted" style="margin:0">${Cl ? esc(Cl.statusLine()) : 'Модуль облака не загружен.'}</p>
        ${Cl && Cl.logged() ? `<div class="o-segs" style="margin-bottom:4px"><button class="o-chip" data-ag="cmd:синхронизация">Синхронизировать</button><button class="o-chip" data-ag="cmd:мои расписания">Cron-задания</button><button class="o-chip" data-ag="cmd:что нового на стене">Стена</button></div>` : ''}
        ${(mem.msgs || []).length ? (() => {
          const days = {};
          (mem.msgs || []).forEach(m => { const d = new Date(m.at).toLocaleDateString('ru-RU'); (days[d] = days[d] || []).push(m); });
          return Object.entries(days).slice(-7).map(([d, arr]) => `<div class="sc-card"><b>${d}</b><small>${arr.length} сообщений · ${(() => { const c = memCap(); return 'всего в памяти ' + mem.msgs.length + (c > 0 ? ' из ' + c : ' (без лимита)') + ' локально'; })()}${Cl && Cl.logged() ? ' · полная история в облаке (до 100 МБ)' : ''}</small>
            <div class="sc-row">${arr.slice(-3).reverse().map(m => `${m.role === 'user' ? '🟦' : '🟪'} ${esc(String(m.text).slice(0, 60))}`).join('<br>')}</div></div>`).join('');
        })() : '<p class="muted" style="padding:8px">История пуста.</p>'}${Cl && Cl.logged() ? '' : '<p class="o-note" style="margin-top:8px">' + ic('info', 13) + ' Локально агент помнит последние сообщения (лимит в Настройках → Агент). Подключите Supabase (по желанию), чтобы хранить всю переписку до 100 МБ и заходить с любого устройства. Возможны сбои без ВПН — данные при этом остаются локально.</p><button class="o-btn pri" data-ag="tab:cloud">Подключить облако</button>'}</div>`;
      return;
    }
    if (A.panel === 'skills') {
      const cats = { day: 'День', tasks: 'Задачи', schedule: 'Расписание', people: 'Люди', tools: 'Калькулятор и схемы', nav: 'Навигация', sos: 'SOS' };
      const skills = (O.actions && O.actions.SKILLS) || [];
      body.innerHTML = `<div class="o-agent-skills">${Object.entries(cats).map(([cid, title]) => {
        const items = skills.filter(s => s.cat === cid);
        if (!items.length) return '';
        return `<div class="o-ad-card"><h4>${esc(title)}</h4>${items.map(s => `<button type="button" class="o-skill" data-ag="cmd:${esc(s.examples[0] || s.label)}"><b>${esc(s.label)}</b><small>${esc((s.examples || []).slice(0,2).join(' · '))}</small></button>`).join('')}</div>`;
      }).join('')}</div>`;
      return;
    }
    // chat (default)
    body.innerHTML = `<div class="o-chat"><div class="o-chat-h"><span class="o-chat-av" data-brand-logo="30"></span><div><b data-agent-name>${esc(b.agent)}</b><small id="ag-status">Офлайн · помнит привычки</small></div><button class="o-ib" id="ag-mem" aria-label="Память">${ic('sparkle', 18)}</button></div><div class="o-msgs" id="ag-msgs" aria-live="polite"></div><div class="o-chips-row" id="ag-chips"></div><div id="ag-live" class="o-live-chips hidden" aria-live="polite"></div><form class="o-composer" id="ag-form"><input class="input" id="ag-in" placeholder="Начни писать — подскажу…" autocomplete="off" enterkeyhint="send"><button type="button" class="o-ib" id="ag-mic" aria-label="Голос" hidden>${ic('mic', 20)}</button><button class="o-send" aria-label="Отправить">${ic('send', 20)}</button></form></div>`;
    const form = $('ag-form'), inp = $('ag-in'), memBtn = $('ag-mem');
    if (form) form.onsubmit = e => { e.preventDefault(); const i = $('ag-in'); if (!i) return; const v = i.value; i.value = ''; try { renderLiveChips([]); } catch (err) {} A.send(v); };
    if (inp) {
      inp.oninput = onAgentInputLive; // одно свойство — не копятся слушатели
      inp.setAttribute('autocomplete', 'off');
    }
    if (memBtn) memBtn.onclick = () => A.send('что ты помнишь');
    // клики по data-ag обрабатывает root (A.render)
    try { voice(); } catch (err) {}
    try { O.look && O.look(S().settings); } catch (err) {}
    try { const st = $('ag-status'); if (st) { const s = S().settings || {}; st.textContent = 'Помощник · помнит привычки' + ((O.llmReady && O.llmReady()) ? ' · ИИ в запасе' : ''); } } catch (e) {}
  }

  A.render = function (scroll) {
    const root = $('agent-root'); if (!root) return;
    const b = O.brand();
    if (!A.msgs.length) A.msgs.push(R(`${b.hello || 'Привет'}! Я ${b.agent}. Скажи «я освободился» — подберу автобус, «позвони» — звонок. Вкладки сверху: быстрые действия, день, навыки.`, { buttons: sug() }));
    if (!root.querySelector('.o-agent')) {
      root.innerHTML = `<div class="o-agent">
      <div class="o-agent-tabs" id="ag-tabs" role="tablist">
        <button type="button" class="o-agent-tab" data-apanel="chat" role="tab">${ic('sparkle',18)}<span>Чат</span></button>
        <button type="button" class="o-agent-tab" data-apanel="quick" role="tab">${ic('plus',18)}<span>Быстрые</span></button>
        <button type="button" class="o-agent-tab" data-apanel="day" role="tab">${ic('calendar',18)}<span>День</span></button>
        <button type="button" class="o-agent-tab" data-apanel="edits" role="tab">${ic('file',18)}<span>Правки</span></button>
        <button type="button" class="o-agent-tab" data-apanel="skills" role="tab">${ic('check',18)}<span>Навыки</span></button>
        <button type="button" class="o-agent-tab" data-apanel="scripts" role="tab">${ic('sparkle',18)}<span>Сценарии</span></button>
        <button type="button" class="o-agent-tab" data-apanel="cloud" role="tab">${ic('info',18)}<span>Облако</span></button>
      </div>
      <div class="o-agent-body" id="ag-body"></div>
    </div>`;
      root.addEventListener('click', e => {
        const tab = e.target.closest('[data-apanel]');
        if (tab && root.contains(tab)) {
          e.preventDefault(); e.stopPropagation();
          A.panel = tab.dataset.apanel || 'chat';
          A.render(false);
          return;
        }
        const catBtn = e.target.closest('[data-chip-cat]');
        if (catBtn && root.contains(catBtn)) {
          A._chipCat = catBtn.getAttribute('data-chip-cat');
          const chips = document.getElementById('ag-chips');
          if (chips && A.chipsHtml) chips.innerHTML = A.chipsHtml();
          return;
        }
        const a = e.target.closest('[data-ag]');
        if (!a || !root.contains(a)) return;
        e.preventDefault(); e.stopPropagation();
        const act = a.dataset.ag;
        if (act.startsWith('ag:')) { agAct(act); try { A.render(true); } catch (err) {} }
        else if (act.startsWith('cmd:')) { A.panel = 'chat'; try { renderLiveChips([]); } catch (err) {} A.send(act.slice(4)); }
        else if (O.dispatch) O.dispatch(act);
      });
    }
    root.querySelectorAll('[data-apanel]').forEach(btn => btn.classList.toggle('on', btn.dataset.apanel === (A.panel || 'chat')));
    try { renderAgentPanel(); } catch (err) {
      console.error('agent panel', err);
      const body = $('ag-body');
      if (body) body.innerHTML = '<p style="padding:16px;color:var(--text-muted)">Ошибка панели. Обновите страницу.</p>';
    }
    if ((A.panel || 'chat') !== 'chat') return;
    const last = A.msgs.length - 1, ms = $('ag-msgs');
    if (!ms) return;
    ms.innerHTML = A.msgs.filter(m => (m.text && String(m.text).trim()) || (m.cards && m.cards.length)).map((m, i) => {
      if (m.role === 'user') return `<div class="o-m me">${esc(m.text)}</div>`;
      const isLast = i === last, btns = (isLast ? (m.buttons || []) : []).map(x => `<button class="o-chip" data-ag="${esc(x.act)}">${esc(x.label)}</button>`).join('');
      const subj = m.legacySubjects && isLast ? `<div class="o-subj">${(C().SUBJECTS || []).map(x => `<button class="o-chip" data-ag="cmd:${esc(x)}">${esc(x)}</button>`).join('')}</div>` : '';
      return `<div class="o-m bot"><div class="o-m-t">${fmtBotText(m.text)}</div>${(m.cards || []).join('')}${subj}${btns ? `<div class="o-m-b">${btns}</div>` : ''}${m.copyPrompt && isLast ? `<div class="o-m-b"><button class="o-chip" data-ag="ag:copy">Копировать промпт для нейросети</button></div>` : ''}</div>`;
    }).join('') + (busy ? '<div class="o-m bot typing"><i></i><i></i><i></i></div>' : '');
    const chips = $('ag-chips');
    if (chips) {
      try { chips.innerHTML = A.chipsHtml ? A.chipsHtml() : A.chips().map(x => `<button class="o-chip" data-ag="${esc(x.act)}">${esc(x.label)}</button>`).join(''); }
      catch (err) { chips.innerHTML = ''; }
    }
    if (scroll !== false) ms.scrollTop = ms.scrollHeight;
  };
  document.addEventListener('click', e => { const a = e.target.closest('[data-ag="ag:copy"]'); if (a) { const m = [...A.msgs].reverse().find(x => x.copyPrompt); if (m) navigator.clipboard.writeText(m.copyPrompt).then(() => C().toast('Промпт скопирован')); } });
  function voice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $('ag-mic'); if (!SR || S().settings.voice === false || !mic) return;
    mic.hidden = false; let rec = null;
    mic.onclick = () => { if (rec) { rec.stop(); return; } rec = new SR(); rec.lang = 'ru-RU'; rec.interimResults = false; mic.classList.add('on'); rec.onresult = e => { const v = e.results[0][0].transcript; $('ag-in').value = ''; A.send(v); }; rec.onend = rec.onerror = () => { mic.classList.remove('on'); rec = null; }; try { rec.start(); } catch (e) { mic.classList.remove('on'); rec = null; } };
  }
  A.R = R; A.btn = btn;
  { const r0 = A.render; A.render = function (scroll) { const x = r0.apply(this, arguments); try { O.inline && O.inline.sync(); } catch (e) {}
    /* чат всегда открывается внизу: вкладка может стать видимой позже рендера, поэтому прокручиваем ещё и с задержкой */
    if (scroll !== false && (A.panel || 'chat') === 'chat') [0, 80, 300].forEach(d => setTimeout(() => { const ms = $('ag-msgs'); if (ms) ms.scrollTop = ms.scrollHeight; }, d));
    return x; }; }
  O.motion = () => document.documentElement.getAttribute('data-motion') || 'full';

  window.addEventListener('orbit-llm-limit', (ev) => {
    try {
      const msg = (ev.detail && ev.detail.msg) || 'Лимиты нейросети завершены. Перехожу на встроенные навыки (без облака).';
      if (A && A.push) A.push({ role: 'bot', text: msg });
      else if (O.core && O.core().toast) O.core().toast(msg, 4000);
    } catch (e) {}
  });

})();
/* Контур · набор тестов (запускается в браузере: tests/index.html, либо через tests/run.py)
   Приложение открывается во встроенном iframe. Каждый тест стартует с чистого состояния.
   Внутренние ключи хранилища (orbit-planner-v3 и т. п.) оставлены прежними ради совместимости с данными пользователей. */
(function () {
  'use strict';
  const BASE = location.pathname.replace(/tests\/[^/]*$/, '');
  const U = p => BASE + p;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const KEY = 'orbit-planner-v3', BAK = 'orbit-planner-backup-v3', WELCOME = 'orbit-welcome-v4';
  const TABS = ['today', 'schedule', 'buses', 'agent', 'contacts', 'kanban', 'pack', 'tasks', 'diary', 'notes', 'share', 'calc', 'flow', 'settings', 'more', 'profile'];
  const NO_IFRAME_TABS = TABS.filter(t => t !== 'calc' && t !== 'flow');
  /* школьная лексика, которой в продукте для IT / менеджеров / ИП быть не должно */
  const LEX = /школ|урок|ученик|учител|\bкласс(?:а|у|ом|е)?\b|домашн|домашк|\bдз\b|перемен[аыуе]\b|каникул|кружок|кружк|дневник|родител|орбит|продл[её]нк|лице[йяю]|гимнази|рюкзак|\bучеб|\bучёб|школьн/i;

  const T = [];
  const test = (g, n, fn, o) => T.push({ g, n, fn, o: o || {} });
  const ok = (c, m) => { if (!c) throw new Error(m || 'проверка не пройдена'); };
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'не равно') + ': получено ' + JSON.stringify(a) + ', ожидалось ' + JSON.stringify(b)); };
  const snippet = (t, re) => { const m = re.exec(t); if (!m) return ''; const i = m.index; return '…' + t.slice(Math.max(0, i - 35), i + 45).replace(/\s+/g, ' ') + '…'; };
  const noLex = (text, where) => { if (LEX.test(text)) throw new Error('школьная лексика в «' + where + '»: ' + snippet(text, LEX)); };
  const noGarbage = (text, where) => { const m = /\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b/.exec(text); if (m) throw new Error('«' + m[0] + '» на экране «' + where + '»: ' + snippet(text, /\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b/)); };

  let FRAME = null; const errs = [];
  async function fresh(o = {}) {
    if (!o.keep) {
      localStorage.clear();
      if (!o.welcome) localStorage.setItem(WELCOME, '1');
      if (o.state) localStorage.setItem(KEY, JSON.stringify(o.state));
      if (o.raw) Object.keys(o.raw).forEach(k => localStorage.setItem(k, o.raw[k]));
    }
    FRAME.style.width = (o.vw || 390) + 'px';
    errs.length = 0;
    await new Promise(res => { FRAME.onload = res; FRAME.src = U('index.html' + (o.query || '') + (o.query ? '&' : '?') + '_t=' + Date.now()); });
    const w = FRAME.contentWindow;
    for (let i = 0; i < 80 && !w.OrbitReady; i++) await sleep(100);
    w.addEventListener('error', e => errs.push(String(e.message || e.error)));
    w.addEventListener('unhandledrejection', e => errs.push('promise: ' + String(e.reason && e.reason.message || e.reason)));
    if (!w.OrbitReady) throw new Error('приложение не запустилось (window.OrbitReady не выставлен)');
    return w;
  }
  const core = w => w.OrbitCore;
  const st = w => w.OrbitCore.state;
  const tab = async (w, t) => { w.OrbitCore.switchTab(t); await sleep(90); };
  const attrsOf = el => [...el.querySelectorAll('[placeholder],[title],[aria-label],[alt]')].map(e => ['placeholder', 'title', 'aria-label', 'alt'].map(a => e.getAttribute(a) || '').join(' ')).join(' ');
  const tabText = (w, t) => { const el = w.document.getElementById('tab-' + t); return el ? el.textContent + ' ' + attrsOf(el) : ''; };
  const ask = async (w, cmd) => { const A = w.Orbit.assistant, n = A.msgs.length; await A.send(cmd); await sleep(40); const out = A.msgs.slice(n + 1); return { msgs: out, text: out.map(m => (m.text || '') + ' ' + (m.cards || []).join(' ').replace(/<[^>]+>/g, ' ')).join('\n') }; };
  const modalText = w => ['modal-title', 'modal-body', 'modal-footer'].map(id => { const e = w.document.getElementById(id); return e ? e.textContent + ' ' + attrsOf(e) : ''; }).join(' ');
  const fetchText = async p => { const r = await fetch(U(p), { cache: 'no-store' }); if (!r.ok) throw new Error(p + ' → HTTP ' + r.status); return r.text(); };
  const fetchHead = async p => { const r = await fetch(U(p), { cache: 'no-store' }); return r; };
  const monday = new Date(2026, 9, 19);   // понедельник
  const sampleMeeting = { day: 0, subject: 'Планёрка', start: '10:00', end: '10:30', items: ['Ноутбук', 'Зарядка'] };

  /* ═════════════ 1. ЗАПУСК ═════════════ */
  test('Запуск', 'Приложение стартует, в консоли нет ошибок', async () => { const w = await fresh(); await sleep(700); ok(w.OrbitReady); eq(errs, [], 'ошибки выполнения'); });
  test('Запуск', 'Заголовок страницы и экрана — «Контур»', async () => { const w = await fresh(); ok(/Контур/.test(w.document.title), 'title: ' + w.document.title); ok(/Контур/.test(w.document.getElementById('top-title').textContent), 'top-title'); });
  test('Запуск', 'Версия едина: version.json = manifest/sw = версия в приложении', async () => {
    const v = JSON.parse(await fetchText('version.json')).version, sw = await fetchText('sw.js'), w = await fresh();
    ok(sw.includes("'contour-v" + v + "'"), 'sw.js: имя кэша не соответствует версии ' + v);
    eq(w.OrbitCore.version, v, 'OrbitCore.version');
  });
  test('Запуск', 'Приветствие: нет поля «Класс», стили не дублируются', async () => {
    const w = await fresh({ welcome: true }); await sleep(900);
    const m = modalText(w); ok(/Добро пожаловать/.test(m), 'приветствие не показано');
    noLex(m, 'приветствие');
    const ids = [...w.document.querySelectorAll('#wl-brands [data-wb]')].map(b => b.dataset.wb);
    eq(ids.length, new Set(ids).size, 'карточки стилей повторяются: ' + ids.join(','));
    eq(ids.length, 4, 'ожидалось 4 стиля');
  });
  test('Запуск', 'Приветствие: «Начать» сохраняет имя и роль', async () => {
    const w = await fresh({ welcome: true }); await sleep(900);
    w.document.getElementById('wl-name').value = 'Анна';
    const role = w.document.getElementById('wl-cls'); if (role) role.value = 'CTO';
    w.document.getElementById('wl-go').click(); await sleep(150);
    eq(st(w).profile.name, 'Анна'); ok(w.document.getElementById('modal-overlay').classList.contains('hidden'), 'окно не закрылось');
  });
  test('Запуск', 'Ярлыки PWA ?go=… открывают нужный раздел; неизвестный не ломает приложение', async () => {
    let w = await fresh({ query: '?go=schedule' }); await sleep(400); eq(core(w).tab, 'schedule');
    w = await fresh({ query: '?go=agent' }); await sleep(400); eq(core(w).tab, 'agent');
    w = await fresh({ query: '?go=несуществует' }); await sleep(400); ok(w.document.querySelector('.tab.active'), 'нет активного раздела'); eq(errs, [], 'ошибки при неизвестном go');
  });

  /* ═════════════ 2. РАЗДЕЛЫ ═════════════ */
  TABS.forEach(t => test('Разделы', 'Раздел «' + t + '» открывается без ошибок и мусора', async () => {
    const w = await fresh(); await tab(w, t); await sleep(250);
    const sec = w.document.getElementById('tab-' + t); ok(sec && sec.classList.contains('active'), 'раздел не стал активным');
    if (t !== 'calc' && t !== 'flow') { ok(tabText(w, t).trim().length > 15, 'раздел пустой'); noGarbage(w.document.getElementById('tab-' + t).innerText, t); }
    eq(errs, [], 'ошибки выполнения');
  }));
  test('Разделы', 'Нижнее меню: каждая кнопка включает свой раздел', async () => {
    const w = await fresh(); const btns = [...w.document.querySelectorAll('.nav-btn[data-tab]')].filter(b => b.dataset.tab !== 'more'); ok(btns.length >= 10, 'мало кнопок: ' + btns.length);
    for (const b of btns) { b.click(); await sleep(70); ok(w.document.getElementById('tab-' + b.dataset.tab).classList.contains('active'), 'не открылся ' + b.dataset.tab); }
    eq(errs, []);
  });
  test('Разделы', 'Настройки: все секции раскрываются, есть выбор стиля и акцента', async () => {
    const w = await fresh(); await tab(w, 'settings'); await sleep(200);
    const d = [...w.document.querySelectorAll('#settings-root details.o-sec')]; ok(d.length >= 6, 'секций: ' + d.length);
    d.forEach(x => x.open = true); await sleep(60);
    eq(new Set([...w.document.querySelectorAll('#settings-root [data-sact^="brand:"]')].map(b => b.dataset.sact)).size, 4, 'стилей оформления');
    ok(w.document.querySelectorAll('#settings-root .o-dot').length >= 4, 'нет цветов акцента');
  });
  test('Разделы', 'Смена стиля и акцента работает и сохраняется', async () => {
    const w = await fresh(); await tab(w, 'settings'); await sleep(200);
    w.document.querySelector('#settings-root [data-sact="brand:vector"]').click(); await sleep(150);
    eq(st(w).settings.brand, 'vector');
    const dot = w.document.querySelector('#settings-root .o-dot'); dot.click(); await sleep(100); ok(st(w).settings.accentCustom, 'акцент не записан');
    eq(errs, []);
  });
  test('Разделы', 'Выбранный акцент реально меняет цвет интерфейса', async () => {
    const w = await fresh(); st(w).settings.accentCustom = '#ec4899'; w.OrbitCore.save(); w.OrbitCore.applyTheme(); await sleep(80);
    eq(w.document.documentElement.style.getPropertyValue('--accent').trim().toLowerCase(), '#ec4899', 'палитра бренда перетирает акцент');
  });
  test('Разделы', 'Тема: тёмная → светлая → AMOLED → авто', async () => {
    const w = await fresh(); const first = st(w).settings.theme, seen = [];
    for (let i = 0; i < 2; i++) { w.document.getElementById('btn-theme').click(); await sleep(60); seen.push(st(w).settings.theme); }
    ok(seen[0] !== first && seen[1] === first, 'кнопка темы не переключает туда-обратно: ' + [first, ...seen].join('→'));
    st(w).settings.theme = 'amoled'; w.OrbitCore.save(); w.OrbitCore.applyTheme(); await sleep(60); eq(w.document.documentElement.getAttribute('data-skin'), 'amoled');
  });

  /* ═════════════ 3. РЕБРЕНДИНГ: никакой школьной лексики ═════════════ */
  TABS.filter(t => t !== 'calc' && t !== 'flow').forEach(t => test('Ребрендинг', 'Пустое состояние «' + t + '» без школьной лексики', async () => {
    const w = await fresh(); await tab(w, t); await sleep(200);
    if (t === 'settings') w.document.querySelectorAll('#settings-root details').forEach(d => d.open = true);
    if (t === 'profile') for (const b of w.document.querySelectorAll('#profile-tabs [data-ptab]')) { b.click(); await sleep(60); noLex(tabText(w, t), t + '/' + b.textContent); }
    noLex(tabText(w, t), t);
  }));
  test('Ребрендинг', 'Демо-данные без школьной лексики во всех разделах', async () => {
    const w = await fresh(); w.OrbitCore.loadExample(); await sleep(200);
    for (const t of NO_IFRAME_TABS) { await tab(w, t); await sleep(120); if (t === 'settings') w.document.querySelectorAll('#settings-root details').forEach(d => d.open = true); noLex(tabText(w, t), 'демо/' + t); }
    eq(errs, [], 'ошибки при демо-данных');
  });
  test('Ребрендинг', 'Все формы и окна без школьной лексики', async () => {
    const w = await fresh(), C = core(w), forms = {
      'новая встреча': () => C.openLessonModal(), 'новый блок': () => C.openClubModal(), 'новое событие': () => C.openEventModal(),
      'новая задача': () => C.openHwModal(null), 'новая цель': () => C.openGoalModal(null), 'новая заметка': () => C.openNoteModal(null),
      'новый отпуск': () => C.openHolidayModal(null), 'новый контакт': () => w.Orbit.openPerson(null), 'SOS': () => w.Orbit.openSOS()
    };
    for (const k of Object.keys(forms)) { try { forms[k](); } catch (e) { throw new Error('форма «' + k + '» не открылась: ' + e.message); } await sleep(120); noLex(modalText(w), 'форма «' + k + '»'); C.closeModal(); await sleep(40); }
  });
  test('Ребрендинг', 'Ассистент: приветствие, подсказки, помощь и ответы без школьной лексики', async () => {
    const w = await fresh(); await tab(w, 'agent'); await sleep(200);
    noLex(tabText(w, 'agent'), 'агент/чат');
    for (const p of ['quick', 'day', 'edits', 'skills', 'scripts']) { w.Orbit.assistant.panel = p; w.Orbit.assistant.render(false); await sleep(80); noLex(tabText(w, 'agent'), 'агент/' + p); }
    w.Orbit.assistant.panel = 'chat';
    for (const q of ['помощь', 'привет', 'что умеешь', 'что дальше', 'расписание на завтра', 'мои задачи', 'qwerty zxcv', 'когда выходить']) { const r = await ask(w, q); noLex(r.text, 'ответ на «' + q + '»'); }
    noLex(w.Orbit.assistant.chips().map(c => c.label || c[0] || '').join(' '), 'подсказки-чипы');
  });
  test('Ребрендинг', 'Файлы: manifest, README, шаблоны, FlowForge, index.html', async () => {
    for (const p of ['manifest.json', 'README.markdown', 'templates/ai-prompt-template.txt', 'templates/schema-example.json', 'flowforge/index.html', 'index.html', 'js/orbit/llm.js', 'css/orbit4.css', 'browserconfig.xml']) noLex(await fetchText(p), p);
  });
  test('Ребрендинг', 'manifest: имя «Контур», категории без education, ярлыки без школьных слов', async () => {
    const m = JSON.parse(await fetchText('manifest.json'));
    ok(/Контур/.test(m.name) && /Контур/.test(m.short_name), 'имя'); ok(!(m.categories || []).includes('education'), 'категория education'); ok(!(m.categories || []).includes('lifestyle') || m.categories.includes('productivity'), 'категории');
    noLex(JSON.stringify(m.shortcuts) + m.description, 'manifest.shortcuts/description');
  });

  /* ═════════════ 4. РАСПИСАНИЕ / ВСТРЕЧИ ═════════════ */
  test('Расписание', 'Форма «Новая встреча»: сохраняется и видна в списке', async () => {
    const w = await fresh(), C = core(w); C.openLessonModal(); await sleep(150);
    const d = w.document, set = (id, v) => { d.getElementById(id).value = v; };
    set('f-subject', 'Стендап команды'); set('f-start', '09:30'); set('f-end', '09:45'); set('f-day', '1'); d.getElementById('modal-save').click(); await sleep(150);
    eq(st(w).lessons.length, 1); eq(st(w).lessons[0].day, 1); await tab(w, 'schedule'); w.OrbitCore.setScheduleDay(1); w.OrbitCore.render(); await sleep(100);
    ok(/Стендап команды/.test(tabText(w, 'schedule')), 'встреча не видна в «Расписании»');
  });
  test('Расписание', 'Пустое название не сохраняется', async () => { const w = await fresh(); core(w).openLessonModal(); await sleep(100); w.document.getElementById('modal-save').click(); await sleep(80); eq(st(w).lessons.length, 0); });
  test('Расписание', 'Ассистент: «добавь встречу Планёрка пн 10:00-10:30»', async () => {
    const w = await fresh(); await ask(w, 'добавь встречу Планёрка пн 10:00-10:30');
    eq(st(w).lessons.length, 1, 'встреча не создана'); const l = st(w).lessons[0]; ok(/Планёрка|Планерка/i.test(l.subject), 'название: ' + l.subject); eq([l.day, l.start, l.end], [0, '10:00', '10:30']);
  });
  test('Расписание', 'Ассистент: несколько дней сразу', async () => { const w = await fresh(); await ask(w, 'добавь встречу Стендап пн вт ср 9:30-9:45'); eq(st(w).lessons.length, 3); eq(st(w).lessons.map(l => l.day).sort(), [0, 1, 2]); });
  test('Расписание', 'Ассистент: без времени — переспрашивает, ничего не ломает', async () => { const w = await fresh(); const r = await ask(w, 'добавь встречу'); eq(st(w).lessons.length, 0); ok(r.text.length > 5, 'нет ответа'); eq(errs, []); });
  test('Расписание', 'Старые команды («добавь урок …») по-прежнему работают как синонимы', async () => { const w = await fresh(); await ask(w, 'добавь урок Демо чт 15:00'); eq(st(w).lessons.length, 1, 'синоним «урок» не принят'); });
  test('Расписание', 'Перенос: «перенеси Планёрка на среду»', async () => {
    const w = await fresh(); w.Orbit.actions.addLesson(sampleMeeting); await ask(w, 'перенеси Планёрка на среду'); eq(st(w).lessons[0].day, 2);
  });
  test('Расписание', 'Удаление с подтверждением и отмена', async () => {
    const w = await fresh(); w.Orbit.actions.addLesson(sampleMeeting);
    await ask(w, 'удали встречу Планёрка пн'); if (st(w).lessons.length) await ask(w, 'удали встречу Планёрка пн !confirm');
    eq(st(w).lessons.length, 0, 'встреча не удалена'); await ask(w, 'отмени'); eq(st(w).lessons.length, 1, 'отмена не вернула встречу');
  });
  test('Расписание', 'Встреча через полночь (23:30–00:30) не ломает расчёты', async () => {
    const w = await fresh(); w.Orbit.actions.addLesson({ day: 0, subject: 'Ночной релиз', start: '23:30', end: '00:30' });
    for (const t of ['today', 'schedule', 'kanban', 'agent']) { await tab(w, t); await sleep(80); }
    await ask(w, 'расписание на понедельник'); eq(errs, []);
  });
  test('Расписание', 'XSS: HTML в названии встречи экранируется везде', async () => {
    const w = await fresh(); w.Orbit.actions.addLesson({ day: monday.getDay() === 1 ? 0 : 0, subject: '<img src=x onerror="window.__xss=1">', start: '10:00', end: '11:00' });
    w.Orbit.actions.addPerson({ name: '"><svg onload=window.__xss=1>', relation: 'Коллега', phone: '+79990000000' });
    for (const t of ['today', 'schedule', 'kanban', 'contacts', 'pack', 'agent']) { await tab(w, t); await sleep(80); }
    await ask(w, 'расписание на понедельник'); await sleep(100);
    ok(!w.__xss, 'сработал внедрённый скрипт'); ok(!w.document.querySelector('img[src="x"],svg[onload]'), 'в DOM появился внедрённый элемент');
  });

  /* ═════════════ 5. ЗАДАЧИ ═════════════ */
  test('Задачи', 'Форма «Новая задача» сохраняет задачу', async () => {
    const w = await fresh(); core(w).openHwModal(null); await sleep(120); const d = w.document;
    d.getElementById('f-subject').value = 'Проект Альфа'; d.getElementById('f-title').value = 'Подготовить релиз'; d.getElementById('f-due').value = '2026-10-30'; d.getElementById('modal-save').click(); await sleep(120);
    eq(st(w).homework.length, 1); await tab(w, 'tasks'); ok(/Подготовить релиз/.test(tabText(w, 'tasks')), 'задача не видна');
  });
  test('Задачи', 'Ассистент: «добавь задачу Релиз до пятницы» → список → «готово»', async () => {
    const w = await fresh(); await ask(w, 'добавь задачу Релиз до пятницы');
    eq(st(w).homework.length, 1, 'задача не создана'); ok(st(w).homework[0].due, 'не распознан срок «до пятницы»');
    const r = await ask(w, 'мои задачи'); ok(/Релиз/i.test(r.text), 'в списке нет задачи: ' + r.text);
    await ask(w, 'сделал задачу Релиз'); ok(st(w).homework[0].done, 'задача не отмечена выполненной');
  });
  test('Задачи', 'Старые команды («добавь дз …») принимаются как синонимы', async () => { const w = await fresh(); await ask(w, 'добавь дз Релиз до пятницы'); eq(st(w).homework.length, 1); });
  test('Задачи', 'Пустой заголовок задачи не сохраняется', async () => { const w = await fresh(); core(w).openHwModal(null); await sleep(100); w.document.getElementById('modal-save').click(); await sleep(60); eq(st(w).homework.length, 0); });
  test('Задачи', 'Цели, заметки и журнал создаются через ассистента', async () => {
    const w = await fresh(); const A = w.Orbit.actions;
    ok(A.addGoal('Выпустить v2').ok !== false, 'цель'); ok(A.addNote('Купить кабель USB-C').ok !== false, 'заметка'); ok(A.addDiary('Созвон с клиентом прошёл хорошо', 4).ok !== false, 'журнал');
    eq([st(w).goals.length, st(w).notes.length, st(w).dayLogs.length], [1, 1, 1]);
    for (const t of ['tasks', 'notes', 'diary']) { await tab(w, t); await sleep(80); } eq(errs, []);
  });
  test('Задачи', 'Форма журнала: поле «где работал» без школьных вариантов', async () => {
    const w = await fresh(); await tab(w, 'diary'); const opts = [...w.document.querySelectorAll('#diary-stayed option')].map(o => o.textContent).join(' ');
    ok(/Офис/i.test(opts) && /Дома|удал/i.test(opts), 'ожидались варианты «Офис» и «Дома/удалённо»: ' + opts); noLex(opts, 'журнал/варианты');
  });

  /* ═════════════ 6. МАРШРУТЫ ═════════════ */
  test('Маршруты', 'Маршрут «на работу»: расчёт выхода учитывает первую встречу', async () => {
    const w = await fresh(); const A = w.Orbit.actions, E = w.Orbit.engine;
    A.addLesson({ day: 0, subject: 'Планёрка', start: '10:00', end: '10:30' });
    A.addBus({ number: 'М1', dir: 'school', times: ['08:30', '09:00', '09:30', '10:30'], walkMin: 5, rideMin: 20, from: 'Дом', to: 'Офис' });
    const p = E.planSchool(st(w), monday); ok(p && p.first, 'нет плана'); ok(p.first.start === '10:00' || E.toMin(p.first.start) === 600, 'первая встреча: ' + JSON.stringify(p.first));
    if (p.best) ok(p.best.leaveBy < 600, 'выход позже начала встречи: ' + p.best.leaveBy);
  });
  test('Маршруты', 'Без маршрутов: понятное сообщение, без ошибок', async () => { const w = await fresh(); const r = await ask(w, 'когда выходить'); ok(r.text.length > 5); eq(errs, []); await tab(w, 'buses'); await tab(w, 'today'); eq(errs, []); });
  test('Маршруты', 'Ассистент: «добавь автобус 537 домой 18:10 19:00»', async () => { const w = await fresh(); await ask(w, 'добавь автобус 537 домой 18:10 19:00'); eq(st(w).buses.length, 1); eq(st(w).buses[0].times.length, 2); });
  test('Маршруты', 'Повторное добавление того же маршрута не плодит дубли', async () => { const w = await fresh(); await ask(w, 'добавь автобус 537 домой 18:10'); await ask(w, 'добавь автобус 537 домой 19:00'); eq(st(w).buses.length, 1); eq(st(w).buses[0].times, ['18:10', '19:00']); });
  test('Маршруты', 'Метро: «добавь маршрут до работы метро 08:30» (мастер маршрутов)', async () => { const w = await fresh(); const r = await ask(w, 'добавь маршрут до работы метро 08:30'); ok(!/не понял/i.test(r.text), 'не понял: ' + r.text); eq(errs, []); });
  test('Маршруты', 'Направление определяется по названию: офис/работа → «на работу», дом → «домой»', async () => {
    const w = await fresh(), E = w.Orbit.engine; eq(E.busDir({ from: 'Дом', to: 'Офис', times: ['08:00'] }), 'school'); eq(E.busDir({ from: 'Офис', to: 'Дом', times: ['18:00'] }), 'home');
    eq(E.busDir({ from: 'Дом', to: 'Коворкинг', times: ['08:00'] }), 'school', 'коворкинг');
  });

  /* ═════════════ 7. ДВИЖОК ВРЕМЕНИ ═════════════ */
  test('Движок', 'toMin: корректные и некорректные значения времени', async () => {
    const E = (await fresh()).Orbit.engine; eq(E.toMin('09:05'), 545); eq(E.toMin('00:00'), 0); eq(E.toMin('23:59'), 1439);
    for (const bad of ['25:61', '99:99', '24:00', '7:5', '', null, undefined, 'abc']) eq(E.toMin(bad), null, 'toMin(' + bad + ')');
  });
  test('Движок', 'fmt/dur: переходы через полночь и пустые значения', async () => {
    const E = (await fresh()).Orbit.engine; eq(E.fmt(-30), '23:30'); eq(E.fmt(1445), '00:05'); eq(E.fmt(NaN), '—'); eq(E.fmt(null), '—'); eq(E.dur(125), '2 ч 5 мин'); eq(E.dur(60), '1 ч'); ok(/0/.test(E.dur(0)), 'dur(0)');
  });
  test('Движок', 'dateStr — локальная дата (не UTC)', async () => { const E = (await fresh()).Orbit.engine; eq(E.dateStr(new Date(2026, 0, 5, 0, 10)), '2026-01-05'); eq(E.dateStr(new Date(2026, 11, 31, 23, 50)), '2026-12-31'); });
  test('Движок', 'Отпуск скрывает встречи на эти даты', async () => {
    const w = await fresh(), E = w.Orbit.engine; w.Orbit.actions.addLesson({ day: 0, subject: 'Планёрка', start: '10:00', end: '10:30' });
    st(w).holidays.push({ id: 'h1', name: 'Отпуск', start: '2026-10-19', end: '2026-10-25' });
    const ev = E.eventsOn(st(w), monday); eq(ev.list.length, 0, 'во время отпуска встреча осталась'); ok(ev.holiday, 'отпуск не определён');
  });
  test('Движок', 'nowNext/insights/weekLoad на пустых данных не падают', async () => { const w = await fresh(), E = w.Orbit.engine, n = new Date(); E.nowNext(st(w), n); E.insights(st(w), n); E.weekLoad(st(w)); E.hwGroups(st(w), n); E.birthdays(st(w), n); eq(errs, []); });

  /* ═════════════ 8. АССИСТЕНТ ═════════════ */
  test('Ассистент', 'Калькулятор в чате: «посчитай 12*8» = 96', async () => { const r = await ask(await fresh(), 'посчитай 12*8'); ok(/96/.test(r.text), r.text); });
  test('Ассистент', 'Калькулятор: приоритет операций и скобки', async () => { const w = await fresh(); ok(/\b14\b/.test((await ask(w, 'посчитай 2+3*4')).text)); ok(/\b20\b/.test((await ask(w, 'посчитай (2+3)*4')).text)); });
  test('Ассистент', 'Калькулятор: деление на ноль и незакрытая скобка — без падения', async () => { const w = await fresh(); for (const q of ['посчитай 1/0', 'посчитай (2+3', 'посчитай ***']) { const r = await ask(w, q); ok(r.text.length > 2, 'нет ответа на ' + q); } eq(errs, []); });
  test('Ассистент', '«график sin(x)» отвечает, а не «не понял»', async () => { const r = await ask(await fresh(), 'график sin(x)'); ok(!/не понял/i.test(r.text), r.text); });
  test('Ассистент', '«создай схему» запускает мастер с кнопками', async () => { const r = await ask(await fresh(), 'создай схему'); ok(r.msgs.length && (r.msgs[0].buttons || []).length > 0, 'нет кнопок мастера: ' + r.text); });
  test('Ассистент', '«что было вчера» / «на прошлой неделе» отвечают', async () => { const w = await fresh(); for (const q of ['что было вчера', 'что было на прошлой неделе']) { const r = await ask(w, q); ok(r.text.length > 5, q); } eq(errs, []); });
  test('Ассистент', 'Неизвестная фраза, пустой и очень длинный ввод', async () => {
    const w = await fresh(); const r = await ask(w, 'asdkjh qwe zxc'); ok(r.text.length > 5, 'нет ответа'); const n = w.Orbit.assistant.msgs.length; await w.Orbit.assistant.send('   '); eq(w.Orbit.assistant.msgs.length, n, 'пустой ввод создал сообщение');
    await ask(w, 'я'.repeat(6000)); eq(errs, []);
  });
  test('Ассистент', 'HTML в сообщении не выполняется', async () => { const w = await fresh(); await tab(w, 'agent'); await ask(w, '<img src=x onerror="window.__xss=1"><b>x</b>'); await sleep(100); ok(!w.__xss && !w.document.querySelector('#agent-root img[src="x"]'), 'XSS в чате'); });
  test('Ассистент', 'После сбоя отрисовки ассистент не «зависает»', async () => {
    const w = await fresh(), A = w.Orbit.assistant, orig = A.render; let once = true; A.render = function () { if (once) { once = false; throw new Error('тестовый сбой'); } return orig.apply(this, arguments); };
    try { await A.send('привет'); } catch (e) { /* допустимо */ } A.render = orig; const n = A.msgs.length; await A.send('помощь'); ok(A.msgs.length > n, 'ассистент перестал отвечать после ошибки (флаг busy не сброшен)');
  });
  test('Ассистент', 'Память чата сохраняется после перезапуска', async () => { let w = await fresh(); await ask(w, 'помощь'); const n = w.Orbit.assistant.msgs.length; w = await fresh({ keep: true }); ok(w.Orbit.assistant.msgs.length >= n, 'память потеряна'); });
  test('Ассистент', 'Память ограничена 300 сообщениями', async () => {
    const w = await fresh(); const mem = { aliases: {}, notes: [], facts: [], msgs: Array.from({ length: 450 }, (_, i) => ({ role: i % 2 ? 'bot' : 'user', text: 'м' + i, at: i })) };
    localStorage.setItem('orbit-memory-v5', JSON.stringify(mem)); const w2 = await fresh({ keep: true }); await ask(w2, 'помощь');
    const saved = JSON.parse(localStorage.getItem('orbit-memory-v5') || '{"msgs":[]}'); ok(saved.msgs.length <= 300, 'в памяти ' + saved.msgs.length + ' сообщений');
  });
  test('Ассистент', 'Навигация голосом: «открой настройки», «открой задачи»', async () => { const w = await fresh(); await ask(w, 'открой настройки'); await sleep(150); eq(core(w).tab, 'settings'); await ask(w, 'открой задачи'); await sleep(150); eq(core(w).tab, 'tasks'); });
  test('Ассистент', '«позвони …» без контактов — без падения; SOS не звонит сам', async () => { const w = await fresh(); const r = await ask(w, 'позвони коллеге'); ok(r.text.length > 3); w.Orbit.openSOS(); await sleep(100); eq(errs, []); });

  /* ═════════════ 9. КАЛЬКУЛЯТОР И СХЕМЫ ═════════════ */
  test('Калькулятор', 'Вкладка загружает CIFRA, движок считает верно', async () => {
    const w = await fresh(); await tab(w, 'calc'); const f = w.document.getElementById('cifra-frame'); for (let i = 0; i < 40 && !(f.contentWindow && f.contentWindow.document.readyState === 'complete' && f.contentWindow.document.body.children.length); i++) await sleep(100);
    const E = f.contentWindow.eval('Engine'); ok(E, 'Engine не найден');
    const cases = [['2+2', 4], ['12*8', 96], ['2^10', 1024], ['sqrt(16)', 4], ['(2+3)*4', 20], ['10/4', 2.5], ['sin(pi/2)', 1], ['-3^2', -9], ['5!', 120], ['(3+2)!', 120], ['gcd(12,18)', 6]];
    cases.forEach(([e, v]) => { const got = E.calc(e, false); ok(Math.abs(got - v) < 1e-9, e + ' = ' + got + ', ожидалось ' + v); });
    let thrown = 0; ['(2+3', '2+*3', 'foo(1)', ''].forEach(e => { try { E.calc(e, false); } catch (x) { thrown++; } }); ok(thrown >= 3, 'некорректные выражения должны давать ошибку (' + thrown + ' из 4)');
    try { const r = E.calc('1/0', false); ok(!Number.isFinite(r), '1/0 = ' + r); } catch (x) { /* ошибка деления — допустимо */ }
  });
  test('Схемы', 'Вкладка загружает FlowForge, холст отрисован', async () => {
    const w = await fresh(); await tab(w, 'flow'); const f = w.document.getElementById('flow-frame'); for (let i = 0; i < 50 && !(f.contentWindow && f.contentWindow.document.readyState === 'complete'); i++) await sleep(100);
    await sleep(600); const d = f.contentWindow.document; ok(d.querySelector('svg,canvas'), 'нет холста'); ok(d.body.textContent.trim().length > 30, 'пустой интерфейс');
  });
  test('Схемы', 'Работает офлайн: внешние скрипты FlowForge кэшируются сервис-воркером', async () => {
    const html = await fetchText('flowforge/index.html'), sw = await fetchText('sw.js'); const ext = [...html.matchAll(/<script[^>]+src="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
    if (ext.length) ok(/jsdelivr/.test(sw), 'внешние скрипты ' + ext.map(x => x.split('/').pop()).join(', ') + ' не кэшируются сервис-воркером — без сети экспорт PDF и автораскладка не работают');
  });

  /* ═════════════ 10. ДАННЫЕ ═════════════ */
  test('Данные', 'Данные сохраняются после перезапуска', async () => { let w = await fresh(); await ask(w, 'добавь встречу Ретро пт 16:00-17:00'); w = await fresh({ keep: true }); eq(st(w).lessons.length, 1); });
  test('Данные', 'Экспорт → импорт: данные совпадают', async () => {
    const w = await fresh(), C = core(w); const data = { lessons: [{ id: 'a', day: 0, subject: 'Планёрка', start: '10:00', end: '10:30', items: [] }], homework: [{ id: 'h', title: 'Релиз', subject: '', due: '', done: false }] };
    const p = await C.encodePayload(data); ok(typeof p === 'string' && p.length > 10); const back = await C.decodePayload(p); eq(back.lessons, data.lessons); eq(back.homework, data.homework);
  });
  test('Данные', 'Импорт мусора не стирает данные и не падает', async () => {
    const w = await fresh(); await ask(w, 'добавь встречу Планёрка пн 10:00'); for (const bad of ['not json', '{', '[]', 'null', '{"lessons":"x"}', '%%%%']) { try { await w.Orbit.share.importText(bad); } catch (e) { throw new Error('importText(' + bad + ') выбросил: ' + e.message); } }
    eq(st(w).lessons.length, 1, 'данные пострадали'); eq(errs, []);
  });
  test('Данные', 'Пример schema-example.json импортируется целиком', async () => {
    const w = await fresh(); const obj = JSON.parse(await fetchText('templates/schema-example.json')); w.OrbitCore.applyImportedData(obj); await sleep(100);
    ok(st(w).lessons.length > 0, 'встречи не импортированы'); ok(st(w).buses.length > 0, 'маршруты не импортированы'); for (const t of ['today', 'schedule', 'tasks', 'buses']) { await tab(w, t); await sleep(80); noLex(tabText(w, t), 'после импорта/' + t); } eq(errs, []);
  });
  test('Данные', 'Excel-шаблон: имена листов понятны импортёру, содержимое без школьной лексики', async () => {
    const w = await fresh(); const buf = new w.Uint8Array(await (await fetch(U('templates/orbit-import-template.xlsx'), { cache: 'no-store' })).arrayBuffer()); const X = w.XLSX; ok(X, 'библиотека XLSX не загружена'); const wb = X.read(buf, { type: 'array' });
    let txt = ''; wb.SheetNames.forEach(n => { txt += ' ' + n; txt += ' ' + X.utils.sheet_to_csv(wb.Sheets[n]); }); noLex(txt, 'orbit-import-template.xlsx');
    const known = /профиль|profile|встреч|урок|lesson|meeting|блок|клуб|club|автобус|маршрут|bus|задач|homework|дз|цел|заметк|отпуск|праздник|каникул|holiday|контакт|люди|people|журнал/i; ok(wb.SheetNames.some(n => known.test(n)), 'ни один лист не распознаётся импортёром: ' + wb.SheetNames.join(', '));
  });
  test('Данные', 'Повреждён основной ключ — состояние берётся из резервной копии', async () => {
    const good = { lessons: [{ id: 'a', day: 0, subject: 'Планёрка', start: '10:00', end: '10:30' }] };
    const w = await fresh({ raw: { [KEY]: '{повреждено', [BAK]: JSON.stringify(good) } }); eq(st(w).lessons.length, 1, 'резервная копия не использована');
  });
  test('Данные', 'Повреждены оба ключа — приложение запускается с чистого листа', async () => { const w = await fresh({ raw: { [KEY]: '{x', [BAK]: '[[[' } }); for (const t of NO_IFRAME_TABS) { await tab(w, t); await sleep(50); } eq(errs, []); });
  test('Данные', 'Пустые элементы в массивах (null) не ломают разделы', async () => {
    const w = await fresh({ state: { lessons: [null, { id: 'a', day: 0, subject: 'X', start: '10:00', end: '11:00' }], buses: [null, { id: 'b', number: '1', dir: 'home', times: ['18:00'] }], people: [null], homework: [null], notes: [null], goals: [null], clubs: [null], events: [null], holidays: [null], dayLogs: [null], reminders: [null] } });
    for (const t of NO_IFRAME_TABS) { await tab(w, t); await sleep(60); } await ask(w, 'что дальше'); eq(errs, [], 'ошибки на null-элементах');
  });
  test('Данные', 'Ошибка записи (переполнено хранилище) не ломает интерфейс', async () => {
    const w = await fresh(); const S = w.Storage.prototype, orig = S.setItem; S.setItem = function () { throw new w.DOMException('Quota', 'QuotaExceededError'); };
    try { await ask(w, 'добавь встречу Тест пн 10:00'); await tab(w, 'today'); } finally { S.setItem = orig; } ok(w.document.querySelector('.tab.active'), 'интерфейс упал');
  });
  test('Данные', 'Резервная копия хранит предыдущую версию, а не копию текущей', async () => {
    const w = await fresh(); await ask(w, 'добавь встречу Первая пн 10:00'); await ask(w, 'добавь встречу Вторая вт 10:00');
    const main = JSON.parse(localStorage.getItem(KEY)), bak = JSON.parse(localStorage.getItem(BAK)); ok(main.lessons.length === 2, 'основной ключ'); ok(bak.lessons.length === 1, 'резерв должен отставать на одно изменение, сейчас: ' + bak.lessons.length);
  });
  test('Данные', 'Автокопии: хранятся не более 5 последних', async () => {
    const w = await fresh(); const keys = Object.keys(localStorage).filter(k => /snap|backup|копи/i.test(k) && k !== BAK); ok(keys.length <= 5, 'снимков: ' + keys.length);
  });

  /* ═════════════ 11. PWA ═════════════ */
  test('PWA', 'Все файлы из списка кэша sw.js существуют', async () => {
    const sw = await fetchText('sw.js'); const m = /const CORE = \[([\s\S]*?)\];/.exec(sw); ok(m, 'не найден CORE'); const files = [...m[1].matchAll(/'(\.\/[^']*)'/g)].map(x => x[1]).filter(x => x !== './');
    const miss = []; for (const f of new Set(files)) { const r = await fetchHead(f.slice(2)); if (!r.ok) miss.push(f); } eq(miss, [], 'нет файлов');
  });
  test('PWA', 'Все локальные ссылки из index.html / cifra / flowforge ведут на существующие файлы', async () => {
    const miss = []; for (const page of ['index.html', 'cifra/index.html', 'flowforge/index.html']) {
      const html = await fetchText(page), dir = page.includes('/') ? page.replace(/[^/]*$/, '') : '';
      for (const m of html.matchAll(/(?:src|href)="([^"#?:]+\.(?:js|css|png|svg|ico|webp|json|webmanifest|xml))"/g)) { const r = await fetchHead(dir + m[1]); if (!r.ok) miss.push(page + ' → ' + m[1]); }
    } eq(miss, [], 'битые ссылки');
  });
  test('PWA', 'Иконки manifest существуют и совпадают по размеру', async () => {
    const m = JSON.parse(await fetchText('manifest.json')), bad = [];
    for (const i of m.icons) { if (i.type !== 'image/png') { const r = await fetchHead(i.src); if (!r.ok) bad.push(i.src + ' нет файла'); continue; } const b = new DataView(await (await fetch(U(i.src))).arrayBuffer()); const w = b.getUint32(16), h = b.getUint32(20); if (i.sizes !== w + 'x' + h) bad.push(i.src + ': заявлено ' + i.sizes + ', на деле ' + w + 'x' + h); }
    eq(bad, [], 'иконки');
  });
  test('PWA', 'Ярлыки manifest ведут на существующие разделы', async () => {
    const m = JSON.parse(await fetchText('manifest.json')), valid = new Set([...TABS, 'free']); const bad = m.shortcuts.map(s => /[?&]go=([^&]+)/.exec(s.url)).map((x, i) => !x || !valid.has(x[1]) ? m.shortcuts[i].url : null).filter(Boolean); eq(bad, []);
  });
  test('PWA', 'Сервис-воркер: синтаксис верен, старые кэши Контура чистятся', async () => {
    const sw = await fetchText('sw.js'); try { new Function(sw); } catch (e) { throw new Error('sw.js: ' + e.message); }
    ok(/startsWith\('contour-'\)/.test(sw), 'activate не удаляет старые кэши contour-*: каждая версия оставляет в браузере лишний кэш');
  });
  test('PWA', 'Сервис-воркер: версия в версионном файле и в кэше совпадает с APP_VERSION', async () => { const app = await fetchText('js/app.js'); const v = JSON.parse(await fetchText('version.json')).version; ok(app.includes("APP_VERSION = '" + v + "'"), 'js/app.js содержит другую версию (ожидалось ' + v + ')'); });

  /* ═════════════ 12. ВЁРСТКА ═════════════ */
  [320, 390, 768, 1280].forEach(vw => test('Вёрстка', 'Нет горизонтальной прокрутки при ширине ' + vw + ' px', async () => {
    const w = await fresh({ vw }); w.OrbitCore.loadExample(); await sleep(150); const bad = [];
    for (const t of NO_IFRAME_TABS) { await tab(w, t); await sleep(110); const d = w.document.documentElement; if (d.scrollWidth > vw + 1) bad.push(t + ' (' + d.scrollWidth + ')'); }
    eq(bad, [], 'горизонтальная прокрутка');
  }));

  /* ═════════════ 13. НАВЫКИ АГЕНТА: каждый навык из каталога ═════════════ */
  /* Время фиксируем: понедельник 19.10.2026, 08:00 — ответы не зависят от дня запуска тестов. */
  function stubDate(w, y, mo, d, h, mi) {
    const Real = w.Date, fixed = new Real(y, mo, d, h || 0, mi || 0).getTime();
    function FD(...a) { return a.length ? new Real(...a) : new Real(fixed); }
    FD.prototype = Real.prototype; FD.now = () => fixed; FD.parse = Real.parse; FD.UTC = Real.UTC; w.Date = FD; return FD;
  }
  async function seeded() { const w = await fresh(); stubDate(w, 2026, 9, 19, 8, 0); w.OrbitCore.loadExample(); await sleep(120); return w; }
  const has = (r, re, m) => ok(re.test(r.text), (m || 'ответ не подошёл') + ': «' + r.text.replace(/\s+/g, ' ').slice(0, 200) + '»');
  const notConfused = (r, cmd) => ok(r.text.trim().length > 2 && !/не понял|не знаю|не распознал/i.test(r.text), '«' + cmd + '» не выполнен: «' + r.text.replace(/\s+/g, ' ').slice(0, 140) + '»');
  const hasDockVisible = w => { const d = w.document.getElementById('ag-dock'); return !!d && !d.hidden; };
  const SK = {
    'now': [['что дальше', (w, r) => has(r, /Планёрка/)], ['сейчас встреча', (w, r) => notConfused(r, 'сейчас встреча')]],
    'day': [['расписание на завтра', (w, r) => { has(r, /завтра: 2 встреч/); ok(r.msgs.some(m => (m.cards || []).length), 'нет карточки с расписанием'); }], ['встречи в пятницу', (w, r) => has(r, /пятниц\S*: 2 встреч/)]],
    'bus-home': [['я освободился', (w, r) => has(r, /автобус домой.*М3/)], ['автобусы домой', (w, r) => has(r, /М3/)]],
    'bus-school': [['когда выходить на работу', (w, r) => has(r, /автобус|выйти/i)]],
    'pack': [['что взять сегодня', (w, r) => has(r, /ноутбук/i)], ['сумка на завтра', (w, r) => { notConfused(r, 'сумка на завтра'); has(r, /ноутбук|бэклог/i); }]],
    'hw-list': [['что задано', (w, r) => { has(r, /Открытых задач: 2/); ok(r.text.includes('Подготовить релиз'), 'в карточке нет задачи'); }], ['задачи', (w, r) => has(r, /Открытых задач: 2/)], ['мои задачи', (w, r) => has(r, /Открытых задач: 2/)]],
    'hw-add': [['добавь задачу релиз 2.4', (w, r) => ok(st(w).homework.some(h => /релиз 2\.4/i.test(h.title)), 'название задачи потеряло слово «релиз»: ' + JSON.stringify(st(w).homework.map(h => h.title)))],
      ['добавь задачу КП клиенту до пятницы', (w, r) => { const h = st(w).homework.find(x => /КП клиенту/.test(x.title)); ok(h, 'задача не создана'); ok(h.due, 'нет срока «до пятницы»'); }]],
    'hw-done': [['сделал задачу релиз', (w, r) => ok(st(w).homework.some(h => h.done), 'задача не отмечена выполненной: ' + r.text)]],
    'lesson-add': [['добавь встречу Демо пн 9:00', (w, r) => { const l = st(w).lessons.find(x => x.subject === 'Демо' && x.day === 0); ok(l && l.start === '09:00', 'встреча не создана: ' + r.text); }]],
    'lesson-move': [['перенеси ретро на пятницу', (w, r) => eq(st(w).lessons.find(l => l.subject === 'Ретро').day, 4)], ['перенеси ретро на пт 10:00', (w, r) => { const l = st(w).lessons.find(x => x.subject === 'Ретро'); eq([l.day, l.start], [4, '10:00']); }]],
    'lesson-del': [['удали расписание на среду', async (w, r) => { if (st(w).lessons.some(l => l.day === 2)) await ask(w, 'удали расписание на среду !confirm'); eq(st(w).lessons.filter(l => l.day === 2).length, 0, 'встречи среды остались'); }]],
    'club-add': [['добавь блок фокус ср 15:00', (w, r) => ok(st(w).clubs.some(c => /фокус/i.test(c.name) && c.day === 2 && c.start === '15:00'), 'блок не создан: ' + r.text)]],
    'bus-add': [['добавь автобус 537 домой 12:52 13:40', (w, r) => { const b = st(w).buses.find(x => String(x.number) === '537'); ok(b, 'автобус не добавлен'); eq(b.times, ['12:52', '13:40']); }]],
    'person': [['позвони маме', (w, r) => { notConfused(r, 'позвони маме'); has(r, /Мама/); }], ['добавь контакт', (w, r) => has(r, /контакт/i)]],
    'bday': [['дни рождения', (w, r) => notConfused(r, 'дни рождения')], ['др мамы 12.03', (w, r) => { has(r, /ДР Мама/); ok(/03-12|12\.03/.test(st(w).people.find(p => p.name === 'Мама').birthday), 'ДР не записан'); }]],
    'remind': [['напомни через 30 мин', (w, r) => { has(r, /Напомню/); ok((st(w).reminders || []).length >= 1, 'напоминание не создано'); }]],
    'note': [['заметка купить тетрадь', (w, r) => ok(st(w).notes.some(n => /тетрадь/.test(JSON.stringify(n))), 'заметка не создана')]],
    'diary': [['журнал сегодня был контрольный', (w, r) => ok(st(w).dayLogs.length >= 1, 'запись не создана: ' + r.text)]],
    'goal': [['цель выучить английский', (w, r) => ok(st(w).goals.some(g => /английск/.test(g.title)), 'цель не создана')]],
    'go': [['открой встречи', async (w) => { await sleep(150); eq(core(w).tab, 'schedule'); }], ['открой настройки', async (w) => { await sleep(150); eq(core(w).tab, 'settings'); }]],
    'theme': [['тема светлая', (w) => eq(st(w).settings.theme, 'light')], ['тема тёмная', (w) => eq(st(w).settings.theme, 'dark')]],
    'undo': [['отмена', async (w) => { await ask(w, 'заметка тест отмены'); const n = st(w).notes.length; await ask(w, 'отмена'); eq(st(w).notes.length, n - 1, 'отмена не убрала заметку'); }]],
    'sos': [['sos', (w, r) => has(r, /112/)]],
    'help': [['помощь', (w, r) => { has(r, /Кон|навык/i); ok(r.msgs.some(m => (m.buttons || []).length), 'нет кнопок'); }], ['что умеешь', (w, r) => notConfused(r, 'что умеешь')]],
    'calc': [['посчитай 2+2', (w, r) => has(r, /= \*\*4\*\*/)], ['sqrt(16)', (w, r) => has(r, /= \*\*4\*\*/, 'sqrt(16) ушёл не в калькулятор')], ['sin(30)', (w, r) => has(r, /= \*\*0,5\*\*/)]],
    'graph': [['график sin(x)', (w, r) => ok(r.msgs.some(m => (m.cards || []).some(c => /<svg/.test(c))), 'нет графика')], ['нарисуй y=x^2', (w, r) => { has(r, /y = x\^2/); ok(!/нарисуй/.test(r.text), 'в заголовке осталось слово «нарисуй»'); }]],
    'scheme': [['создай схему Старт -> Проверка -> Конец', async (w, r) => { eq(S_steps(w).length, 3, 'должно быть 3 шага'); eq(core(w).tab, 'agent', 'редактор не должен открываться сам'); ok(r.msgs.some(m => (m.cards || []).some(c => /<svg/.test(c))), 'нет превью схемы в чате'); }]],
    'open-calc': [['открой калькулятор', async (w) => { await sleep(300); ok(hasDockVisible(w), 'панель калькулятора не открылась в чате'); eq(core(w).tab, 'agent', 'ушёл на вкладку калькулятора'); }], ['открой cifra', async (w) => { await sleep(300); ok(hasDockVisible(w)); eq(core(w).tab, 'agent'); }]],
    'open-flow': [['открой схемы', async (w) => { await sleep(150); eq(core(w).tab, 'flow'); }], ['открой flowforge', async (w) => { await sleep(150); eq(core(w).tab, 'flow'); }]],
    'route': [['добавь маршрут до работы метро 08:30', (w, r) => { has(r, /Маршрут:/); ok(!/«08»/.test(r.text), 'время принято за номер линии: ' + r.text); ok((st(w).routes || []).length >= 1, 'маршрут не сохранён'); }], ['добавь маршрут домой автобус 18:20', (w, r) => { has(r, /Маршрут:/); ok(!/«18»/.test(r.text), 'время принято за номер линии'); }]],
    'memory': [['что было вчера', (w, r) => has(r, /памяти/)], ['что было на прошлой неделе', (w, r) => has(r, /памяти/)]],
    'calc-dock': [['калькулятор', async (w, r) => { await sleep(250); ok(hasDockVisible(w), 'панель не открылась'); eq(core(w).tab, 'agent'); has(r, /прямо здесь/); }], ['калькулятор конвертер', async (w) => { await sleep(250); ok(hasDockVisible(w)); }], ['калькулятор финансы', async (w) => { await sleep(250); ok(hasDockVisible(w)); }]],
    'percent': [['15% от 2000', (w, r) => has(r, /= 300/)], ['скидка 20% на 3500', (w, r) => has(r, /2 800/)], ['сколько процентов 30 от 200', (w, r) => has(r, /15%/)]],
    'vat': [['ндс 20% на 1200', (w, r) => has(r, /1 440,00/)], ['выдели ндс из 1200', (w, r) => has(r, /200,00.*1 000,00/s)]],
    'convert': [['5 км в мили', (w, r) => has(r, /3,1068/)], ['100 °F в °C', (w, r) => has(r, /37,7777/)], ['2 ГБ в МБ', (w, r) => has(r, /2 048/)]],
    'loan': [['кредит 1000000 на 5 лет под 12%', (w, r) => has(r, /22 244,45/)], ['вклад 500000 под 8% на 3 года', (w, r) => has(r, /635 118,53/)]],
    'dates': [['сколько дней до 31.12', (w, r) => has(r, /73 дня/)], ['через 45 дней', (w, r) => has(r, /декабря 2026/)], ['дней между 01.03 и 15.05', (w, r) => has(r, /75 дней/)]],
    'base': [['255 в hex', (w, r) => has(r, /FF/)], ['1010 bin в dec', (w, r) => has(r, /= 10 /)]],
    'solve': [['реши x^2-5x+6=0', (w, r) => has(r, /x₁ = 2, x₂ = 3/)]],
    'stats': [['среднее 3 5 7', (w, r) => has(r, /: 5\s*$/m)], ['медиана 1 2 9 4', (w, r) => has(r, /: 3\s*$/m)]],
    'calc-history': [['история вычислений', async (w) => { await ask(w, '2+2*2'); const r = await ask(w, 'история вычислений'); has(r, /2\+2\*2 = 6/); }]],
    'scheme-chat': [['создай схему', (w, r) => { ok(r.msgs[0].buttons.length >= 3, 'нет шаблонов'); eq(core(w).tab, 'agent'); }]],
    'scheme-edit': [['покажи схему', async (w) => { await ask(w, 'создай схему Старт -> Проверка -> Конец'); await ask(w, 'добавь шаг Тесты после Старт'); eq(S_steps(w), ['Старт', 'Тесты', 'Проверка', 'Конец']); await ask(w, 'убери шаг Тесты'); eq(S_steps(w).length, 3); }]]
  };
  function S_steps(w) { return w.Orbit.inline.scheme.steps.slice(); }
  test('Навыки', 'Каталог: каждый навык из каталога покрыт тестом', async () => {
    const w = await fresh(), ids = w.Orbit.actions.SKILLS.map(s => s.id), miss = ids.filter(i => !SK[i]); eq(miss, [], 'навыки без тестов'); ok(ids.length >= 40, 'в каталоге ' + ids.length + ' навыков');
    const bad = w.Orbit.actions.SKILLS.filter(s => !s.examples || !s.examples.length || !s.label).map(s => s.id); eq(bad, [], 'навыки без примеров');
    const cats = [...new Set(w.Orbit.actions.SKILLS.map(s => s.cat))]; await tab(w, 'agent'); w.Orbit.assistant.panel = 'skills'; w.Orbit.assistant.render(false); await sleep(80);
    const shown = w.document.querySelectorAll('#ag-body .o-ad-card').length; eq(shown, cats.length, 'в панели «Навыки» показаны не все категории (' + cats.join(', ') + ')');
    noLex(w.document.getElementById('ag-body').textContent, 'панель навыков');
  });
  test('Навыки', 'Каталог: примеры из каталога выполняются, а не отвечают «не понял»', async () => {
    const w = await seeded(), bad = [];
    for (const sk of w.Orbit.actions.SKILLS) for (const ex of sk.examples) { const r = await ask(w, ex); if (!r.text.trim() || /не понял|не знаю|не распознал/i.test(r.text)) bad.push(sk.id + ': «' + ex + '»'); w.OrbitCore.loadExample(); w.OrbitCore.switchTab('agent'); }
    eq(bad, [], 'не выполняются');
  });
  Object.keys(SK).forEach(id => SK[id].forEach(([cmd, check]) => test('Навыки', id + ': «' + cmd + '»', async () => {
    const w = await seeded(); await tab(w, 'agent'); const r = await ask(w, cmd); await check(w, r, cmd); eq(errs, [], 'ошибки выполнения');
  })));

  /* ═════════════ 13b. ГОЛОС, БЫСТРЫЙ ЗВОНОК, «МОИ КОМАНДЫ» ═════════════ */
  test('Голос', 'Разбор фраз: «два плюс три посчитай» → 2+3 и флаг «посчитать»', async () => {
    const w = await fresh(); ok(w.CifraVoice && w.CifraVoice.parse, 'разбор речи не загружен на главной странице');
    const p = w.CifraVoice.parse('два плюс три посчитай'); eq(p.expr, '2+3'); ok(p.eq, 'нет флага «посчитать»');
    eq(w.CifraVoice.parse('сто двадцать пять умножить на четыре равно').expr, '125×4');
    eq(w.CifraVoice.parse('три запятая пять минус одна целая две десятых').expr, '3.5−1.2');
    eq(w.CifraVoice.parse('корень из девяти').expr, '√(9)');
    ok(w.CifraVoice.parse('позвони маме').unk.length > 0, 'обычная команда не должна считаться математикой');
  });
  test('Голос', 'Чат: разговорная математика считается («умножить на», «делённое на», «равно»)', async () => {
    const w = await seeded(); await tab(w, 'agent');
    let r = await ask(w, '128 плюс 114 умножить на 66 посчитай'); has(r, /7[\s\u00a0]?652/);
    r = await ask(w, '22 × 13 + 16 делённое на 2 - 6 ='); has(r, /288/);
    eq(errs, [], 'ошибки выполнения');
  });
  test('Голос', '«Мои команды» и быстрый звонок: без жёстко вшитых имён', async () => {
    const w = await seeded(); await tab(w, 'agent');
    let r = await ask(w, 'мои команды'); has(r, /Быстрый звонок/);
    r = await ask(w, 'быстрый звонок'); has(r, /Кому звонить|Контактов с номерами нет/);
    ok(!/позвони маме/.test(w.document.getElementById('ag-body').textContent), 'в подсказках осталась жёстко вшитая «мама»');
    eq(errs, [], 'ошибки выполнения');
  });

  /* ═════════════ 13c. ОБЛАКО — «в разработке» до версии 5.8 ═════════════ */
  test('Облако', 'Заглушка: облако, стена, друзья, cron отвечают коротко «в разработке, версия 5.8»', async () => {
    const w = await seeded(); await tab(w, 'agent');
    for (const q of ['облако', 'синхронизация', 'покажи стену', 'добавь в друзья Иван', 'мои расписания', 'поставь задание каждый день в 8:00 — что взять завтра']) {
      const r = await ask(w, q); has(r, /в разработке[\s\S]*5\.8/);
    }
    eq(errs, [], 'ошибки выполнения');
  });
  test('Облако', 'Заглушка не перехватывает обычные команды (задачи, звонки, «лента» в тексте)', async () => {
    const w = await seeded(); await tab(w, 'agent');
    let r = await ask(w, 'добавь задачу релиз 2.4'); ok(!/в разработке/.test(r.text), 'задача ушла в заглушку облака');
    r = await ask(w, 'что дальше'); ok(!/в разработке/.test(r.text), '«что дальше» ушло в заглушку облака');
  });
  test('Облако', 'Вкладка «Облако» в агенте показывает короткое сообщение, а не ошибку', async () => {
    const w = await seeded(); await tab(w, 'agent'); w.Orbit.assistant.panel = 'cloud'; w.Orbit.assistant.render(false); await sleep(80);
    ok(/в разработке/.test(w.document.getElementById('ag-body').textContent), 'нет сообщения «в разработке»');
    eq(errs, [], 'ошибки выполнения');
  });

  /* ═════════════ 13d. ДИАЛОГ: Кон держит фокус между сообщениями ═════════════ */
  test('Диалог', '«позвонить» → «Кому?» → имя следующим сообщением', async () => {
    const w = await seeded(); await tab(w, 'agent');
    let r = await ask(w, 'позвонить'); has(r, /Кому позвонить/);
    r = await ask(w, 'Мама'); has(r, /Мама/);
    r = await ask(w, 'что дальше'); ok(!/Кому позвонить/.test(r.text), 'фокус не сброшен после ответа');
    eq(errs, [], 'ошибки выполнения');
  });
  test('Диалог', 'Заметка по шагам: текст → ещё → напоминание → подтверждение', async () => {
    const w = await seeded(); await tab(w, 'agent');
    const before = (st(w).reminders || []).length;
    let r = await ask(w, 'запиши в заметке'); has(r, /Что записать/);
    r = await ask(w, 'купить молоко'); has(r, /Ещё что-то/);
    r = await ask(w, 'позвонить Ивану'); has(r, /Ещё что-то/);
    r = await ask(w, 'всё'); has(r, /Напомнить/);
    r = await ask(w, 'да'); has(r, /Когда напомнить/);
    r = await ask(w, 'завтра в 9:00'); has(r, /Подтверждаете/);
    r = await ask(w, 'подтверждаю'); has(r, /Готово/);
    ok(/купить молоко/i.test(JSON.stringify(st(w).notes)) && /позвонить ивану/i.test(JSON.stringify(st(w).notes)), 'обе строки должны попасть в заметку');
    eq((st(w).reminders || []).length, before + 1, 'напоминание не создано');
    eq(errs, [], 'ошибки выполнения');
  });
  test('Диалог', '«Напомни …» без времени спрашивает время; «отмена» выходит из диалога', async () => {
    const w = await seeded(); await tab(w, 'agent');
    let r = await ask(w, 'напомни позвонить Ивану'); has(r, /Когда напомнить/);
    r = await ask(w, 'завтра в 9 вечера'); has(r, /21:00|напомн/i);
    await ask(w, 'запиши в заметке'); r = await ask(w, 'отмена'); has(r, /отменил/i);
    r = await ask(w, 'что дальше'); ok(!/Что записать/.test(r.text), 'диалог не закрылся после «отмена»');
    eq(errs, [], 'ошибки выполнения');
  });
  test('Диалог', 'Время «в 9» без минут понимается как 09:00, а не молча 08:00', async () => {
    const w = await seeded(); await tab(w, 'agent');
    const r = await ask(w, 'напомни завтра в 9 позвонить Ивану'); has(r, /09:00/);
  });

  /* ═════════════ 14. КАЛЬКУЛЯТОР ПРЯМО В ЧАТЕ ═════════════ */
  test('Калькулятор в чате', '«калькулятор» открывает панель в чате и не уводит на вкладку', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'калькулятор'); await sleep(300);
    ok(hasDockVisible(w), 'панели нет'); eq(core(w).tab, 'agent', 'вкладка переключилась'); const f = w.document.getElementById('ag-calc-frame'); ok(f && /cifra\/index\.html/.test(f.getAttribute('src')), 'в панели не CIFRA');
    ok(f.getBoundingClientRect().height > 250, 'панель слишком низкая: ' + f.getBoundingClientRect().height);
  });
  test('Калькулятор в чате', 'Панель CIFRA содержит весь функционал: счёт, конвертер, финансы, даты, график, доска, учёт', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'калькулятор'); const f = w.document.getElementById('ag-calc-frame');
    for (let i = 0; i < 40 && !(f.contentDocument && f.contentDocument.querySelectorAll('.nav [data-t]').length); i++) await sleep(100);
    for (let i = 0; i < 40 && !f.contentDocument.querySelector('#pad button'); i++) await sleep(100); await sleep(300);
    const keys = [...f.contentDocument.querySelectorAll('.nav [data-t]')].map(b => b.dataset.t).sort(); eq(keys, ['acc', 'board', 'calc', 'conv', 'dates', 'fin', 'graph']);
    for (const k of keys) { f.contentDocument.querySelector('.nav [data-t="' + k + '"]').click(); await sleep(80); ok(!f.contentDocument.getElementById(k).hidden, 'раздел ' + k + ' не открылся'); }
  });
  test('Калькулятор в чате', 'Команда «калькулятор конвертер / финансы / даты» переключает раздел внутри панели', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'калькулятор'); const f = w.document.getElementById('ag-calc-frame');
    for (let i = 0; i < 40 && !(f.contentDocument && f.contentDocument.querySelectorAll('.nav [data-t]').length); i++) await sleep(100);
    for (const [cmd, id] of [['калькулятор конвертер', 'conv'], ['калькулятор финансы', 'fin'], ['калькулятор даты', 'dates'], ['калькулятор график', 'graph'], ['калькулятор', 'calc']]) { await ask(w, cmd); await sleep(250); ok(!f.contentDocument.getElementById(id).hidden, cmd + ' → раздел ' + id + ' не показан'); }
    eq(core(w).tab, 'agent');
  });
  test('Калькулятор в чате', 'Панель не пересоздаётся при новых сообщениях (состояние калькулятора сохраняется)', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'калькулятор'); const f = w.document.getElementById('ag-calc-frame'); f.__marker = 'live';
    await ask(w, 'привет'); await ask(w, 'что дальше'); await ask(w, '2+2'); w.Orbit.assistant.render(true); await sleep(100);
    const f2 = w.document.getElementById('ag-calc-frame'); ok(f2 === f && f2.__marker === 'live', 'iframe калькулятора был пересоздан — сбросилось состояние'); ok(hasDockVisible(w));
  });
  test('Калькулятор в чате', 'Результат из чата попадает в панель', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'калькулятор'); const f = w.document.getElementById('ag-calc-frame');
    for (let i = 0; i < 40 && !(f.contentDocument && f.contentDocument.getElementById('res')); i++) await sleep(100); await sleep(300);
    await ask(w, '12*8'); await sleep(400); const txt = f.contentDocument.getElementById('expr').textContent + ' ' + f.contentDocument.getElementById('res').textContent; ok(/12/.test(txt) && /8/.test(txt) || /96/.test(txt), 'панель не получила выражение: «' + txt.trim() + '»');
  });
  test('Калькулятор в чате', 'Панель можно свернуть, закрыть и открыть снова', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'калькулятор'); const d = w.document.getElementById('ag-dock');
    d.querySelector('[data-dact="min"]').click(); await sleep(60); ok(d.classList.contains('min'), 'не свернулась'); d.querySelector('[data-dact="min"]').click(); await sleep(60); ok(!d.classList.contains('min'), 'не развернулась');
    d.querySelector('[data-dact="close"]').click(); await sleep(60); ok(d.hidden, 'не закрылась'); await ask(w, 'калькулятор'); await sleep(100); ok(!d.hidden, 'не открылась повторно'); eq(w.document.querySelectorAll('#ag-calc-frame').length, 1, 'дубли панели');
  });
  test('Калькулятор в чате', 'Панель скрывается на других панелях агента и возвращается в чат', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'калькулятор'); w.Orbit.assistant.panel = 'skills'; w.Orbit.assistant.render(false); await sleep(60); ok(w.document.getElementById('ag-dock').hidden, 'панель видна на вкладке «Навыки»');
    w.Orbit.assistant.panel = 'chat'; w.Orbit.assistant.render(false); await sleep(60); ok(!w.document.getElementById('ag-dock').hidden, 'панель не вернулась');
  });
  test('Калькулятор в чате', 'Из других разделов «открой калькулятор» ведёт в чат с панелью', async () => {
    const w = await seeded(); await tab(w, 'today'); await ask(w, 'открой калькулятор'); await sleep(300); eq(core(w).tab, 'agent'); ok(hasDockVisible(w));
  });
  const CALC = [['2+2*2', '6'], ['(2+3)*4', '20'], ['2^10', '1 024'], ['5!', '120'], ['корень из 144', '12'], ['sqrt(144)+5', '17'], ['sin(30)', '0,5'], ['cos(60)', '0,5'], ['ln(1)', '0'], ['10 в степени 3', '1 000'], ['посчитай 12*8', '96'], ['сколько будет 7*6', '42'], ['0,1+0,2', '0,3'], ['100/8', '12,5']];
  CALC.forEach(([q, a]) => test('Калькулятор в чате', 'Считает «' + q + '» = ' + a, async () => { const r = await ask(await seeded(), q); ok(r.text.replace(/[\u00a0\u202f]/g, ' ').includes('**' + a + '**'), 'ответ «' + r.text.replace(/\s+/g, ' ') + '», ожидалось ' + a); }));
  test('Калькулятор в чате', '«ответ*2» продолжает прошлое вычисление', async () => { const w = await seeded(); await ask(w, '6*7'); const r = await ask(w, 'ответ*2'); ok(r.text.includes('**84**'), r.text); const r2 = await ask(w, '+16'); ok(r2.text.includes('**100**'), r2.text); });
  test('Калькулятор в чате', 'Ошибки выражений: деление на ноль, скобки, мусор — понятное сообщение без падения', async () => {
    const w = await seeded(); for (const q of ['1/0', 'sqrt(-4)', '(2+3', '2++', 'foo(5)']) { const r = await ask(w, q); ok(r.text.length > 3, 'нет ответа на ' + q); ok(!/undefined|NaN|\[object/i.test(r.text), 'мусор в ответе на ' + q + ': ' + r.text); } eq(errs, []);
  });
  test('Калькулятор в чате', 'Телефон и дата не принимаются за выражение', async () => {
    const w = await seeded(); for (const q of ['+7 999 123-45-67', '2026-10-20', '12.03.2026', '10:30']) { const r = await ask(w, q); ok(!/= \*\*/.test(r.text), '«' + q + '» посчитан как выражение: ' + r.text); }
  });
  test('Калькулятор в чате', 'Проценты и скидки: граничные случаи', async () => {
    const w = await seeded(); has(await ask(w, '0% от 500'), /= 0/); has(await ask(w, '100% от 77'), /= 77/); has(await ask(w, 'сколько процентов 5 от 0'), /нельзя/); has(await ask(w, 'на сколько процентов изменилось с 80 до 100'), /\+25%/); has(await ask(w, 'наценка 30% на 1000'), /1 300/); has(await ask(w, 'увеличь 200 на 50%'), /300/);
  });
  test('Калькулятор в чате', 'НДС: ставки 10% и 20%, по умолчанию 20%', async () => { const w = await seeded(); has(await ask(w, 'ндс 10% на 1000'), /100,00.*1 100,00/s); has(await ask(w, 'ндс на 5000'), /1 000,00/); has(await ask(w, 'ндс'), /сумм/i); });
  test('Калькулятор в чате', 'Конвертер: единицы разных категорий, температура, ошибки', async () => {
    const w = await seeded(); has(await ask(w, '1 миля в км'), /1,609/); has(await ask(w, '0 °C в K'), /273,15/); has(await ask(w, '1 т в кг'), /1 000/); has(await ask(w, '60 км/ч в м/с'), /16,6/); has(await ask(w, '1 га в м²'), /10 000/); has(await ask(w, '90 минут в часов'), /1,5/);
    const bad = await ask(w, '5 кг в метры'); has(bad, /Нельзя|разных/i); eq(errs, []);
  });
  test('Калькулятор в чате', 'Финансы: кредит и вклад — форматы, нулевая ставка, ошибки', async () => {
    const w = await seeded(); has(await ask(w, 'кредит 120000 на 12 мес под 0%'), /10 000,00/); has(await ask(w, 'кредит 500000 на 3 года под 15%'), /переплата/); has(await ask(w, 'кредит'), /Формат/); has(await ask(w, 'вклад 100000 под 10% на 12 мес'), /110 471,31/); eq(errs, []);
  });
  test('Калькулятор в чате', 'Даты: до даты, между датами, сдвиг, день недели', async () => {
    const w = await seeded(); has(await ask(w, 'сколько дней до 1 января'), /73 дня|74 дня/); has(await ask(w, '3 дня назад'), /16 октября/); has(await ask(w, 'через 2 недели'), /2 ноября/); has(await ask(w, 'какой день недели 01.01.2027'), /\(пт\)/); has(await ask(w, 'дней между 01.01.2026 и 01.01.2027'), /365 дней/);
  });
  test('Калькулятор в чате', 'Системы счисления: туда и обратно, ошибка для неверных цифр', async () => {
    const w = await seeded(); has(await ask(w, '255 в двоичную'), /11111111/); has(await ask(w, 'ff hex в dec'), /= 255/); has(await ask(w, '0xff в десятичную'), /= 255/); has(await ask(w, '12 bin в dec'), /не является/);
  });
  test('Калькулятор в чате', 'Уравнения: линейное, квадратное, без корней', async () => { const w = await seeded(); has(await ask(w, 'реши 5x-7=18'), /x = 5/); has(await ask(w, 'реши x^2-4=0'), /x₁ = -2, x₂ = 2|x₁ = 2, x₂ = -2/); has(await ask(w, 'реши x^2+1=0'), /нет|корн/i); eq(errs, []); });
  test('Калькулятор в чате', 'История вычислений: копится, очищается и переживает перезапуск', async () => {
    let w = await seeded(); await ask(w, '3*3'); await ask(w, '15% от 200'); w = await fresh({ keep: true }); const r = await ask(w, 'история вычислений'); has(r, /3\*3 = 9/); await ask(w, 'очисти историю вычислений'); has(await ask(w, 'история вычислений'), /пуста/);
  });
  test('Калькулятор в чате', 'Внешний вид: панель в чате не даёт горизонтальной прокрутки на 320 и 390 px', async () => {
    for (const vw of [320, 390]) { const w = await fresh({ vw }); await tab(w, 'agent'); await ask(w, 'калькулятор'); await sleep(400); ok(w.document.documentElement.scrollWidth <= vw + 1, 'прокрутка при ' + vw); }
  });

  /* ═════════════ 15. СХЕМА: СНАЧАЛА В ЧАТЕ, РЕДАКТОР — ПОТОМ ═════════════ */
  const nodeCount = r => { const c = r.msgs.map(m => (m.cards || []).join('')).join(''); return (c.match(/<(rect|polygon)\b/g) || []).length; };
  test('Схема в чате', '«создай схему» не открывает редактор: сначала разговор в чате', async () => {
    const w = await seeded(); await tab(w, 'agent'); const r = await ask(w, 'создай схему'); eq(core(w).tab, 'agent', 'редактор открылся сам'); ok(w.Orbit.inline.scheme.isActive(), 'режим ввода шагов не включён'); ok(/в чате/.test(r.text), 'нет приглашения писать в чате'); ok(r.msgs[0].buttons.some(b => /Пустая/.test(b.label)), 'нет кнопки «Пустая»');
  });
  test('Схема в чате', 'Шаги вводятся обычными сообщениями, превью обновляется в чате', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'создай схему'); let r = await ask(w, 'Старт'); eq(nodeCount(r), 1); r = await ask(w, 'Код-ревью'); eq(nodeCount(r), 2); r = await ask(w, 'Тесты прошли? да: Выкатить; нет: Исправить'); eq(nodeCount(r), 5); r = await ask(w, 'Конец'); eq(nodeCount(r), 6);
    eq(S_steps(w), ['Старт', 'Код-ревью', 'Тесты прошли?', 'Да: Выкатить', 'Нет: Исправить', 'Конец']); eq(core(w).tab, 'agent');
  });
  test('Схема в чате', 'Одной строкой: цепочка со стрелками и условием', async () => {
    const w = await seeded(); await tab(w, 'agent'); const r = await ask(w, 'создай схему Старт -> Код-ревью -> Тесты прошли? да: Выкатить; нет: Исправить -> Конец'); eq(nodeCount(r), 6); const g = w.Orbit.inline.scheme.graph(S_steps(w));
    eq(g.edges.filter(e => e.label).map(e => e.label).sort(), ['Да', 'Нет']); eq(g.edges.filter(e => e.to === g.nodes[5].id).length, 2, 'ветки должны сходиться в «Конец»');
  });
  test('Схема в чате', 'Цепочка «A -> B -> C» даёт 3 блока (раньше было 2)', async () => {
    const w = await fresh(); eq(w.Orbit.tools.buildScheme('A -> B -> C').count, 3); eq(w.Orbit.tools.buildScheme('A -> B').count, 2); const r = await ask(w, 'схема: A -> B -> C'); eq(S_steps(w).length, 3);
  });
  test('Схема в чате', 'Шаблон по кнопке подгружается в чат без редактора', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'создай схему'); w.Orbit.assistant.send; const A = w.Orbit.assistant; w.document.querySelector('[data-ag="ag:wiz:tpl:it_deploy"]').click(); await sleep(250);
    ok(S_steps(w).length >= 6, 'шаблон не загружен'); eq(core(w).tab, 'agent'); ok(A.msgs[A.msgs.length - 1].cards.join('').includes('<svg'), 'нет превью шаблона');
  });
  test('Схема в чате', 'Правка в чате: добавить после, убрать, переименовать, отменить', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'создай схему Старт -> Проверка -> Конец'); await ask(w, 'добавь шаг Тесты после Старт'); eq(S_steps(w), ['Старт', 'Тесты', 'Проверка', 'Конец']);
    await ask(w, 'убери шаг Тесты'); eq(S_steps(w), ['Старт', 'Проверка', 'Конец']); await ask(w, 'назови схему Релиз'); eq(w.Orbit.inline.scheme.name, 'Релиз'); await ask(w, 'отмени шаг'); eq(w.Orbit.inline.scheme.name, ''); await ask(w, 'убери последний шаг'); eq(S_steps(w).length, 2);
    await ask(w, 'добавь условие Оплата прошла? да: Выдать; нет: Вернуть'); ok(S_steps(w).includes('Да: Выдать'), 'условие не добавлено'); eq(core(w).tab, 'agent');
  });
  test('Схема в чате', 'Редактор открывается только по команде и показывает собранную схему', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'создай схему Альфа -> Бета -> Гамма'); eq(core(w).tab, 'agent'); await ask(w, 'открой схему в редакторе'); await sleep(300); eq(core(w).tab, 'flow');
    const f = w.document.getElementById('flow-frame'); for (let i = 0; i < 50 && !(f.contentDocument && f.contentDocument.readyState === 'complete' && /Гамма/.test(f.contentDocument.body.textContent)); i++) await sleep(100);
    const t = f.contentDocument.body.textContent; ok(/Альфа/.test(t) && /Бета/.test(t) && /Гамма/.test(t), 'в редакторе нет блоков схемы');
  });
  test('Схема в чате', 'После редактора чат не предлагает собирать заново и не глотает сообщения как шаги', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'создай схему Альфа -> Бета -> Гамма'); await ask(w, 'открой схему в редакторе'); await sleep(200); ok(!w.Orbit.inline.scheme.isActive(), 'режим ввода шагов остался включён');
    const A = w.Orbit.assistant, n = A.msgs.length; await tab(w, 'agent'); await sleep(200); eq(A.msgs.length, n, 'при возврате в чат появилось новое сообщение'); eq(w.document.querySelector('#ag-msgs').textContent.includes('Собираем схему здесь'), false, 'снова показан мастер');
    const steps = S_steps(w).length; await ask(w, 'привет'); eq(S_steps(w).length, steps, 'обычная фраза добавилась в схему как шаг');
  });
  test('Схема в чате', 'Пока режим схемы включён, обычные команды продолжают работать', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'создай схему'); await ask(w, 'Старт'); has(await ask(w, 'посчитай 2+2'), /= \*\*4\*\*/); has(await ask(w, 'что дальше'), /Планёрка/); has(await ask(w, 'ндс 20% на 1200'), /1 440/); eq(S_steps(w), ['Старт'], 'команды попали в схему');
    await ask(w, 'закончить схему'); ok(!w.Orbit.inline.scheme.isActive()); const r = await ask(w, 'Какой-то текст'); eq(S_steps(w).length, 1);
  });
  test('Схема в чате', 'Режим схемы сам выключается через 15 минут бездействия', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'создай схему'); await ask(w, 'Старт'); w.Orbit.inline.scheme.at = Date.now() - 16 * 60 * 1000; ok(!w.Orbit.inline.scheme.isActive()); await ask(w, 'Что-то ещё'); eq(S_steps(w), ['Старт']);
  });
  test('Схема в чате', 'Старые кнопки мастера не запускают сборку заново и не открывают редактор', async () => {
    const w = await seeded(); await tab(w, 'agent'); const A = w.Orbit.assistant; w.Orbit.inline.scheme.steps = []; w.Orbit.inline.scheme.active = false;
    w.document.getElementById('agent-root').dispatchEvent(new w.Event('x')); const r = w.Orbit.inline.act('ag:wiz:toggle:2'); ok(r && /закрыта|не работает/.test(r[0].text), 'старая кнопка ведёт себя странно: ' + (r && r[0].text)); eq(core(w).tab, 'agent');
  });
  test('Схема в чате', 'Пустая схема не открывается в редакторе', async () => { const w = await seeded(); await tab(w, 'agent'); await ask(w, 'создай схему'); const r = await ask(w, 'открой схему в редакторе'); eq(core(w).tab, 'agent'); has(r, /пуст/); });
  test('Схема в чате', 'Черновик сохраняется после перезапуска', async () => { let w = await seeded(); await tab(w, 'agent'); await ask(w, 'создай схему Старт -> Шаг -> Конец'); w = await fresh({ keep: true }); eq(S_steps(w), ['Старт', 'Шаг', 'Конец']); has(await ask(w, 'покажи схему'), /3 шага/); });
  test('Схема в чате', 'Безопасность: HTML и очень длинный текст в шагах', async () => {
    const w = await seeded(); await tab(w, 'agent'); await ask(w, 'создай схему'); await ask(w, '<img src=x onerror="window.__xss=1">'); await ask(w, 'Шаг "><svg onload=window.__xss=1>'); await sleep(100);
    ok(!w.__xss && !w.document.querySelector('#ag-msgs img[src="x"], #ag-msgs svg[onload]'), 'XSS через шаг схемы'); const n = S_steps(w).length; await ask(w, 'я'.repeat(300)); eq(S_steps(w).length, n, 'длинный текст принят как шаг'); eq(errs, []);
  });
  test('Схема в чате', 'Превью: длинные подписи переносятся, ветки не накладываются, тема светлая/тёмная', async () => {
    const w = await seeded(); await tab(w, 'agent'); const r = await ask(w, 'создай схему Старт -> Очень длинное название шага которое не помещается в блок -> Проверка? да: Да-ветка; нет: Нет-ветка -> Конец');
    const svg = r.msgs[0].cards[0]; ok(/<tspan/.test(svg), 'нет подписей'); ok(!/undefined|NaN/.test(svg), 'мусор в SVG'); const xs = [...svg.matchAll(/<rect x="(-?[\d.]+)" y="([\d.]+)"/g)].map(m => m[1] + ',' + m[2]); eq(xs.length, new Set(xs).size, 'блоки накладываются');
    st(w).settings.theme = 'light'; w.OrbitCore.applyTheme(); await sleep(60); ok(/var\(--text/.test(svg), 'цвета схемы не связаны с темой');
  });
  test('Схема в чате', 'Вёрстка: превью схемы без горизонтальной прокрутки страницы на 320 px', async () => {
    const w = await fresh({ vw: 320 }); await tab(w, 'agent'); await ask(w, 'создай схему Старт -> Проверка? да: Выкатить; нет: Откат -> Конец'); await sleep(300); ok(w.document.documentElement.scrollWidth <= 321, 'прокрутка: ' + w.document.documentElement.scrollWidth);
  });

  /* ═════════════ запуск ═════════════ */
  async function runAll(opts = {}) {
    FRAME = document.getElementById('app-frame'); const results = []; const only = opts.filter ? new RegExp(opts.filter, 'i') : null;
    for (const t of T) {
      if (only && !only.test(t.g + ' ' + t.n)) continue;
      const r = { group: t.g, name: t.n, status: 'ok', ms: 0 }; const t0 = performance.now();
      try { await Promise.race([t.fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('тайм-аут 25 с')), 25000))]); } catch (e) { r.status = 'fail'; r.error = String(e && e.message || e); }
      r.ms = Math.round(performance.now() - t0); results.push(r); if (opts.onResult) opts.onResult(r, results);
    }
    return results;
  }
  window.ContourTests = { runAll, count: () => T.length, groups: () => [...new Set(T.map(t => t.g))] };
})();

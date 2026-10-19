/* Контур 5.4 · INLINE — калькулятор и схемы прямо в чате агента.
   1) Калькулятор: «калькулятор» открывает в чате закреплённую панель с настоящим CIFRA (конвертер, финансы, даты, график, доска, учёт),
      а текстовые навыки считают проценты, НДС, единицы, кредит, вклад, даты, системы счисления, уравнения и статистику без переключения вкладок.
   2) Схемы: сначала собираются в чате (с живым превью), редактор FlowForge открывается только по команде «открой в редакторе». */
(function () {
  'use strict';
  const O = window.Orbit = window.Orbit || {};
  const I = O.inline = {};
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const A = () => O.assistant;
  const R = (text, o) => A().R(text, o);
  const btn = (l, a) => A().btn(l, a);
  /* NB: \s в JS-регулярках НЕ включает U+00A0 (неразрывный пробел), который
     возвращает toLocaleString('ru-RU') — «2 048». Схлопываем оба вида пробелов. */
  const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[\s\u00a0]+/g, ' ').trim();
  const NUM = '\\d+(?:[ \\u00a0]\\d{3})*(?:[.,]\\d+)?';
  const num = s => parseFloat(String(s).replace(/[\s\u00a0]/g, '').replace(',', '.'));
  const nf = (x, d) => {
    if (!Number.isFinite(x)) return '∞';
    d = d == null ? 6 : d;
    if (x !== 0 && (Math.abs(x) >= 1e15 || Math.abs(x) < 1e-6)) return x.toExponential(6).replace('.', ',');
    return (+x.toFixed(d)).toLocaleString('ru-RU', { maximumFractionDigits: d }).replace(/\u00a0/g, ' ');
  };
  const money = x => (Math.round(x * 100) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00a0/g, ' ') + ' ₽';

  /* ═══════════ 1. ПАНЕЛЬ КАЛЬКУЛЯТОРА В ЧАТЕ ═══════════ */
  const DOCK_TABS = [['calc', 'Калькулятор'], ['conv', 'Конвертер'], ['fin', 'Финансы'], ['dates', 'Даты'], ['graph', 'График'], ['board', 'Доска'], ['acc', 'Учёт']];
  const dock = I.dock = { open: false, min: false, tab: 'calc' };

  function dockEl() {
    let d = $('ag-dock'); if (d) return d;
    const host = document.querySelector('#agent-root .o-agent'); if (!host) return null;
    d = document.createElement('div'); d.id = 'ag-dock'; d.className = 'o-dock'; d.hidden = true;
    d.innerHTML = `<div class="o-dock-h"><b>Калькулятор</b>
      <span class="o-dock-sub">в чате · все разделы CIFRA внизу</span>
      <button type="button" class="o-ib" data-dact="min" aria-label="Свернуть">▾</button><button type="button" class="o-ib" data-dact="close" aria-label="Закрыть">✕</button></div>
      <div class="o-dock-b"></div>`;
    host.insertBefore(d, $('ag-body'));
    d.addEventListener('click', e => {
      const t = e.target.closest('[data-dtab]'); if (t) { I.openCalc({ tab: t.dataset.dtab }); return; }
      const a = e.target.closest('[data-dact]'); if (!a) return;
      if (a.dataset.dact === 'close') I.closeCalc(); else { dock.min = !dock.min; syncDock(); }
    });
    return d;
  }
  function frameEl() {
    const d = dockEl(); if (!d) return null;
    let f = d.querySelector('iframe');
    if (!f) {
      f = document.createElement('iframe'); f.id = 'ag-calc-frame'; f.title = 'CIFRA Pro в чате'; f.setAttribute('loading', 'eager'); f.allow = 'clipboard-read; clipboard-write; microphone';
      f.src = 'cifra/index.html?embed=1'; d.querySelector('.o-dock-b').appendChild(f);
    }
    return f;
  }
  function post(msg) { const f = $('ag-calc-frame'); if (!f) return; const send = () => { try { f.contentWindow.postMessage(msg, '*'); } catch (e) {} }; if (f.dataset.ready === '1') send(); else { f.addEventListener('load', () => { f.dataset.ready = '1'; setTimeout(send, 60); }, { once: true }); } }
  function syncDock() {
    const d = dockEl(); if (!d) return;
    const chat = (!O.assistant.panel || O.assistant.panel === 'chat');
    d.hidden = !(dock.open && chat);
    d.classList.toggle('min', !!dock.min);
    d.querySelectorAll('[data-dtab]').forEach(b => b.classList.toggle('on', b.dataset.dtab === dock.tab));
    const m = d.querySelector('[data-dact="min"]'); if (m) m.textContent = dock.min ? '▴' : '▾';
  }
  I.sync = syncDock;
  I.openCalc = function (o) {
    o = o || {};
    if (O.actions && O.actions.go && (!window.OrbitCore || OrbitCore.tab !== 'agent')) O.actions.go('agent');
    if (O.assistant.panel && O.assistant.panel !== 'chat') { O.assistant.panel = 'chat'; O.assistant.render(false); }
    dockEl(); const f = frameEl();
    dock.open = true; dock.min = false; if (o.tab) dock.tab = o.tab;
    syncDock();
    if (f) { if (o.tab) post({ type: 'orbit-calc', tab: o.tab }); if (o.expr) post({ type: 'orbit-calc', expr: o.expr, tab: 'calc' }); }
  };
  I.closeCalc = function () { dock.open = false; syncDock(); };
  function feedDock(expr) { if (dock.open) post({ type: 'orbit-calc', expr: expr, tab: 'calc' }); }

  /* ═══════════ 2. ТЕКСТОВЫЕ НАВЫКИ КАЛЬКУЛЯТОРА ═══════════ */
  const K = I.calc = { last: null, hist: [] };
  try { K.hist = JSON.parse(localStorage.getItem('kontur-calc-hist') || '[]').slice(-50); } catch (e) { K.hist = []; }
  const remember = (q, r) => { K.hist.push({ q, r, at: Date.now() }); K.hist = K.hist.slice(-50); try { localStorage.setItem('kontur-calc-hist', JSON.stringify(K.hist)); } catch (e) {} };
  const CALC_BTNS = () => [btn('Открыть калькулятор', 'cmd:калькулятор'), btn('Конвертер', 'cmd:калькулятор конвертер'), btn('Финансы', 'cmd:калькулятор финансы')];

  const UNITS = {
    'Длина': { 'м': 1, 'км': 1000, 'см': .01, 'мм': .001, 'дм': .1, 'миля': 1609.344, 'фут': .3048, 'дюйм': .0254, 'ярд': .9144, 'морская миля': 1852 },
    'Масса': { 'кг': 1, 'г': .001, 'т': 1000, 'мг': 1e-6, 'фунт': .45359237, 'унция': .028349523 },
    'Объём': { 'л': 1, 'мл': .001, 'м³': 1000, 'галлон': 3.785411784, 'пинта': .473176, 'баррель': 158.987 },
    'Площадь': { 'м²': 1, 'км²': 1e6, 'см²': 1e-4, 'га': 1e4, 'сотка': 100, 'акр': 4046.8564, 'фут²': .09290304 },
    'Скорость': { 'м/с': 1, 'км/ч': 1 / 3.6, 'миль/ч': .44704, 'узел': .514444 },
    'Время': { 'сек': 1, 'мс': .001, 'мин': 60, 'час': 3600, 'сутки': 86400, 'неделя': 604800, 'месяц': 2629800, 'год': 31557600 },
    'Энергия': { 'Дж': 1, 'кДж': 1000, 'ккал': 4184, 'Вт·ч': 3600, 'кВт·ч': 3.6e6 },
    'Мощность': { 'Вт': 1, 'кВт': 1000, 'МВт': 1e6, 'л.с.': 735.5 },
    'Давление': { 'Па': 1, 'кПа': 1000, 'бар': 1e5, 'атм': 101325, 'мм рт.ст.': 133.322, 'psi': 6894.76 },
    'Данные': { 'Б': 1, 'КБ': 1024, 'МБ': 1048576, 'ГБ': 1073741824, 'ТБ': 1099511627776, 'бит': .125, 'Кбит': 128, 'Мбит': 131072 },
    'Угол': { '°': 1, 'рад': 180 / Math.PI, 'град': .9, 'оборот': 360 }
  };
  const TEMP = { '°C': [x => x, x => x], '°F': [x => (x - 32) * 5 / 9, x => x * 9 / 5 + 32], 'K': [x => x - 273.15, x => x + 273.15] };
  const ALIAS = {
    'м': ['м', 'метр', 'метра', 'метров', 'метры', 'm'], 'км': ['км', 'километр', 'километра', 'километров', 'километры', 'km'], 'см': ['см', 'сантиметр', 'сантиметра', 'сантиметров', 'cm'], 'мм': ['мм', 'миллиметр', 'миллиметра', 'миллиметров', 'mm'], 'дм': ['дм', 'дециметр'],
    'миля': ['миля', 'мили', 'миль', 'милю', 'mile', 'miles'], 'фут': ['фут', 'фута', 'футов', 'футы', 'ft'], 'дюйм': ['дюйм', 'дюйма', 'дюймов', 'дюймы', 'inch', 'in'], 'ярд': ['ярд', 'ярда', 'ярдов'], 'морская миля': ['морская миля', 'морские мили', 'морских миль'],
    'кг': ['кг', 'килограмм', 'килограмма', 'килограммов', 'kg', 'кило'], 'г': ['г', 'гр', 'грамм', 'грамма', 'граммов', 'g'], 'т': ['т', 'тонна', 'тонны', 'тонн'], 'мг': ['мг', 'миллиграмм'], 'фунт': ['фунт', 'фунта', 'фунтов', 'lb', 'lbs'], 'унция': ['унция', 'унции', 'унций', 'oz'],
    'л': ['л', 'литр', 'литра', 'литров', 'литры', 'l'], 'мл': ['мл', 'миллилитр', 'миллилитра', 'миллилитров', 'ml'], 'м³': ['м3', 'м³', 'куб', 'кубометр', 'кубометра', 'кубометров'], 'галлон': ['галлон', 'галлона', 'галлонов', 'gal'], 'пинта': ['пинта', 'пинты', 'пинт'], 'баррель': ['баррель', 'барреля', 'баррелей'],
    'м²': ['м2', 'м²', 'кв м', 'квадратный метр', 'квадратных метров'], 'км²': ['км2', 'км²'], 'см²': ['см2', 'см²'], 'га': ['га', 'гектар', 'гектара', 'гектаров'], 'сотка': ['сотка', 'сотки', 'соток'], 'акр': ['акр', 'акра', 'акров'], 'фут²': ['фут2', 'фут²'],
    'м/с': ['м/с', 'метр в секунду', 'метров в секунду'], 'км/ч': ['км/ч', 'километр в час', 'километров в час', 'kmh'], 'миль/ч': ['миль/ч', 'миля в час', 'миль в час', 'mph'], 'узел': ['узел', 'узла', 'узлов'],
    'сек': ['сек', 'с', 'секунда', 'секунды', 'секунд', 'sec'], 'мс': ['мс', 'миллисекунда', 'миллисекунд'], 'мин': ['мин', 'минута', 'минуты', 'минут', 'min'], 'час': ['час', 'часа', 'часов', 'ч', 'h'], 'сутки': ['сутки', 'суток', 'день', 'дня', 'дней', 'сут'], 'неделя': ['неделя', 'недели', 'недель', 'нед'], 'месяц': ['месяц', 'месяца', 'месяцев', 'мес'], 'год': ['год', 'года', 'лет', 'г.'],
    'Дж': ['дж', 'джоуль', 'джоулей'], 'кДж': ['кдж', 'килоджоуль', 'килоджоулей'], 'ккал': ['ккал', 'килокалория', 'килокалорий', 'калорий', 'калория'], 'Вт·ч': ['вт·ч', 'вт*ч', 'ватт-час', 'ватт час'], 'кВт·ч': ['квт·ч', 'квт*ч', 'квтч', 'киловатт-час', 'киловатт час', 'киловатт-часов'],
    'Вт': ['вт', 'ватт', 'ватта', 'ватт', 'w'], 'кВт': ['квт', 'киловатт', 'киловатта', 'kw'], 'МВт': ['мвт', 'мегаватт'], 'л.с.': ['л.с.', 'лс', 'лошадиная сила', 'лошадиных сил', 'hp'],
    'Па': ['па', 'паскаль', 'паскаля', 'паскалей'], 'кПа': ['кпа', 'килопаскаль'], 'бар': ['бар', 'бара', 'баров'], 'атм': ['атм', 'атмосфера', 'атмосферы', 'атмосфер'], 'мм рт.ст.': ['мм рт.ст.', 'мм рт ст', 'мм ртутного столба'], 'psi': ['psi', 'пси'],
    'Б': ['б', 'байт', 'байта', 'байтов', 'byte'], 'КБ': ['кб', 'килобайт', 'килобайта', 'килобайтов', 'kb'], 'МБ': ['мб', 'мегабайт', 'мегабайта', 'мегабайтов', 'mb'], 'ГБ': ['гб', 'гигабайт', 'гигабайта', 'гигабайтов', 'gb'], 'ТБ': ['тб', 'терабайт', 'терабайта', 'терабайтов', 'tb'], 'бит': ['бит', 'бита', 'bit'], 'Кбит': ['кбит', 'килобит'], 'Мбит': ['мбит', 'мегабит'],
    '°': ['°', 'градус', 'градуса', 'градусов'], 'рад': ['рад', 'радиан', 'радиана', 'радиан'], 'град': ['град', 'градиан'], 'оборот': ['оборот', 'оборота', 'оборотов'],
    '°C': ['°c', 'c', 'цельсий', 'цельсия', 'градус цельсия', 'градусов цельсия', 'по цельсию'], '°F': ['°f', 'f', 'фаренгейт', 'фаренгейта', 'градус фаренгейта', 'градусов фаренгейта'], 'K': ['k', 'кельвин', 'кельвина', 'кельвинов']
  };
  const UNIT_IDX = {};
  Object.keys(ALIAS).forEach(c => ALIAS[c].forEach(a => { UNIT_IDX[norm(a)] = UNIT_IDX[norm(a)] || c; }));
  const catOf = u => { for (const c of Object.keys(UNITS)) if (u in UNITS[c]) return c; return u in TEMP ? 'Температура' : null; };
  const unitOf = s => { s = norm(s).replace(/[.]+$/, ''); return UNIT_IDX[s] || UNIT_IDX[s + '.'] || null; };
  K.convert = function (v, from, to) {
    const cf = catOf(from), ct = catOf(to);
    if (!cf || !ct || cf !== ct) return { ok: false, error: 'Нельзя перевести «' + from + '» в «' + to + '»' };
    if (cf === 'Температура') return { ok: true, value: TEMP[to][1](TEMP[from][0](v)) };
    return { ok: true, value: v * UNITS[cf][from] / UNITS[cf][to] };
  };

  const BASES = { 'hex': 16, 'шестнадцатеричн': 16, 'bin': 2, 'двоичн': 2, 'oct': 8, 'восьмеричн': 8, 'dec': 10, 'десятичн': 10 };
  const baseOf = s => { s = norm(s); for (const k of Object.keys(BASES)) if (s.startsWith(k)) return BASES[k]; return null; };

  const MONTHS = { 'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5, 'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11 };
  const DOW = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
  function parseDate(s, now, future) {
    s = norm(s); let m;
    if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/))) return mk(+m[1], +m[2] - 1, m[3] ? +m[3] : null);
    if ((m = s.match(/^(\d{1,2})\s+([а-я]+)(?:\s+(\d{4}))?(?:\s*г(?:ода|\.)?)?$/)) && MONTHS[m[2]] != null) return mk(+m[1], MONTHS[m[2]], m[3] ? +m[3] : null);
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return new Date(+m[1], +m[2] - 1, +m[3]);
    if (s === 'сегодня') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (s === 'завтра') return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return null;
    function mk(d, mo, y) {
      if (y != null && y < 100) y += 2000;
      let dt = new Date(y != null ? y : now.getFullYear(), mo, d);
      if (y == null && future && dt < new Date(now.getFullYear(), now.getMonth(), now.getDate())) dt = new Date(now.getFullYear() + 1, mo, d);
      return dt.getMonth() === mo ? dt : null;
    }
  }
  const DAYMS = 86400000, midnight = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysBetween = (a, b) => Math.round((midnight(b) - midnight(a)) / DAYMS);
  const fmtDate = d => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) + ' (' + ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][d.getDay()] + ')';
  const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const k = n % 10; return n > 10 && n < 20 ? c : k > 1 && k < 5 ? b : k === 1 ? a : c; };

  function evalExpr(raw) {
    let e = String(raw).trim();
    if (K.last != null) { e = e.replace(/(^|[^а-яa-z])(ans|ответ)(?![а-яa-z])/gi, '$1(' + K.last + ')'); if (/^[+*/^×÷]/.test(e)) e = '(' + K.last + ')' + e; }
    e = e.replace(/(\d)\s*%\s*$/, '$1/100').replace(/корень\s+из\s+(\d+(?:[.,]\d+)?)/gi, 'sqrt($1)').replace(/(\d+(?:[.,]\d+)?)\s+в\s+степени\s+(\d+(?:[.,]\d+)?)/gi, '($1)^($2)')
      .replace(/\blg\s*\(/gi, 'log(');
    const r = O.tools.calc(e);
    if (r.ok) { K.last = r.value; remember(r.expr, r.text); feedDock(r.expr); }
    return r;
  }
  const FN = '(?:sin|cos|tan|tg|ctg|asin|acos|atan|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log|lg|sqrt|abs|exp|cbrt|fact|floor|ceil|round|gcd|lcm|ncr|npr|hypot|mod|deg|rad|sec|csc|cot)';
  const RE_BARE_FN = new RegExp('^[\\s\\d+\\-*/^().,%!=×÷πeapi]*' + FN + '\\s*\\(', 'i');
  const RE_MATH_ONLY = /^[\d\s+\-*/^().,%!=×÷π]+$/;

  /* каждая функция возвращает массив сообщений или null */
  const skills = [];
  const skill = (id, re, fn) => skills.push({ id, re, fn });



  skill('calc-open', /^(?:открой(?:те)?\s+|покажи\s+|запусти\s+|включи\s+)?(калькулятор|cifra(?:\s*pro)?|конвертер|финансовый калькулятор|финансы|калькулятор\s+дат|даты|математическая доска|доска|учет|график\s*функций)(?:\s+(конвертер|финансы|даты|график|доска|учет|обычный|научный))?\s*$/, (n, m) => {
    const w = norm((m[2] || m[1])); let tab = 'calc';
    if (/конвертер/.test(w)) tab = 'conv'; else if (/финанс/.test(w)) tab = 'fin'; else if (/дат/.test(w)) tab = 'dates'; else if (/график/.test(w)) tab = 'graph'; else if (/доска/.test(w)) tab = 'board'; else if (/учет/.test(w)) tab = 'acc';
    I.openCalc({ tab });
    const tabs = { calc: 'калькулятор', conv: 'конвертер', fin: 'финансы', dates: 'даты', graph: 'график', board: 'математическая доска', acc: 'учёт' };
    return [R('Открыл ' + tabs[tab] + ' прямо здесь, в чате. Пишите выражения — посчитаю и покажу в панели, или пользуйтесь кнопками.\n\nЧто умею текстом:\n• выражения и функции: «sin(30)», «sqrt(144)+5», «2^10», «ответ*2»\n• «15% от 2000», «скидка 20% на 3500», «наценка 30% на 1000»\n• «ндс 20% на 1200», «выдели ндс из 1200»\n• «5 км в мили», «100 °F в °C», «2 ГБ в МБ»\n• «кредит 1000000 на 5 лет под 12%», «вклад 500000 под 8% на 3 года»\n• «сколько дней до 31.12», «через 45 дней», «255 в hex»\n• «реши x^2-5x+6=0», «среднее 3 5 7»', { buttons: [btn('Проценты', 'cmd:15% от 2000'), btn('Конвертер', 'cmd:5 км в мили'), btn('НДС', 'cmd:ндс 20% на 1200'), btn('Кредит', 'cmd:кредит 1000000 на 5 лет под 12%')] })];
  });

  skill('calc-history', /^(?:история вычислений|история расчетов|история калькулятора|покажи историю вычислений)\s*$/, () => {
    if (!K.hist.length) return [R('История вычислений пуста. Посчитайте что-нибудь: «2+2*2».', { buttons: CALC_BTNS() })];
    return [R('Последние вычисления:\n' + K.hist.slice(-10).reverse().map(h => '• ' + h.q + ' = ' + h.r).join('\n'), { buttons: [btn('Очистить историю', 'cmd:очисти историю вычислений')] })];
  });
  skill('calc-history-clear', /^(?:очисти|удали|сотри)\s+историю\s+(?:вычислений|расчетов|калькулятора)\s*$/, () => { K.hist = []; K.last = null; try { localStorage.removeItem('kontur-calc-hist'); } catch (e) {} return [R('История вычислений очищена.')]; });

  skill('percent-of', new RegExp('^(?:сколько будет\\s+|посчитай\\s+)?(' + NUM + ')\\s*%\\s*(?:от|of)\\s*(' + NUM + ')\\s*\\??$'), (n, m) => {
    const p = num(m[1]), v = num(m[2]), r = p * v / 100; remember(m[1] + '% от ' + m[2], nf(r)); K.last = r; feedDock(p + '/100*' + v);
    return [R(nf(p) + '% от ' + nf(v) + ' = ' + nf(r), { buttons: CALC_BTNS().slice(0, 1) })];
  });
  skill('percent-share', new RegExp('^(?:сколько процентов|какой процент|сколько %)\\s*(' + NUM + ')\\s*(?:составляет\\s+)?от\\s*(' + NUM + ')\\s*\\??$|^(' + NUM + ')\\s*(?:это\\s+)?сколько\\s+(?:процентов|%)\\s*от\\s*(' + NUM + ')\\s*\\??$'), (n, m) => {
    const a = num(m[1] || m[3]), b = num(m[2] || m[4]); if (!b) return [R('Делить на ноль нельзя: вторая сумма равна нулю.')];
    const r = a / b * 100; K.last = r; remember(nf(a) + ' от ' + nf(b) + ' в %', nf(r) + '%');
    return [R(nf(a) + ' составляет ' + nf(r) + '% от ' + nf(b))];
  });
  skill('percent-change', new RegExp('^(?:на сколько процентов (?:изменилось|выросло|упало|изменилась|выросла|упала)|изменение)\\s*(?:с|от)\\s*(' + NUM + ')\\s*до\\s*(' + NUM + ')\\s*\\??$'), (n, m) => {
    const a = num(m[1]), b = num(m[2]); if (!a) return [R('Начальное значение равно нулю — процент изменения не определён.')];
    const r = (b - a) / a * 100; K.last = r; return [R('С ' + nf(a) + ' до ' + nf(b) + ': ' + (r >= 0 ? '+' : '') + nf(r) + '%')];
  });
  skill('percent-apply', new RegExp('^(увеличь|увеличить|прибавь|прибавить|добавь|добавить|уменьши|уменьшить|вычти|вычесть|убавь|убавить)\\s*(' + NUM + ')\\s*на\\s*(' + NUM + ')\\s*%\\s*$|^(скидка|скидку|наценка|наценку|надбавка)\\s*(' + NUM + ')\\s*%\\s*(?:на|к|от)\\s*(' + NUM + ')\\s*(?:руб\\S*|р|₽)?\\s*$'), (n, m) => {
    let v, p, up;
    if (m[1]) { v = num(m[2]); p = num(m[3]); up = /^(увелич|прибав|добав)/.test(m[1]); } else { p = num(m[5]); v = num(m[6]); up = /^(наценк|надбавк)/.test(m[4]); }
    const r = up ? v * (1 + p / 100) : v * (1 - p / 100); K.last = r; remember(nf(v) + (up ? ' +' : ' −') + nf(p) + '%', nf(r));
    return [R((up ? 'С наценкой ' : 'Со скидкой ') + nf(p) + '%: ' + nf(v) + ' → ' + nf(r) + '\nРазница: ' + nf(Math.abs(r - v))) ];
  });

  skill('vat', new RegExp('^(?:(выдели|выдели ндс из|вычти ндс из|сумма без ндс)\\s*)?(?:ндс|с ндс|без ндс)?\\s*(?:(' + NUM + ')\\s*%\\s*)?(?:ндс\\s*)?(?:на|от|из|с|для)?\\s*(' + NUM + ')?\\s*(?:руб\\S*|р|₽)?\\s*(?:включен\\S*|в том числе)?\\s*$'), null);
  skills.pop();
  skill('vat', /(?:^|\s)ндс(?:\s|$)|без ндс|с ндс/, (n, m, t) => {
    if (!/(?:^|\s)(ндс|без ндс|с ндс)(?:\s|$)/.test(n)) return null;
    const rm = n.match(new RegExp('(' + NUM + ')\\s*%')); const rate = rm ? num(rm[1]) : 20;
    const rest = n.replace(rm ? rm[0] : '', ' ').replace(/ндс|выдели|вычти|из|на|от|с|без|для|включен\S*|в том числе|сумм\S*|руб\S*|₽/g, ' ');
    const am = rest.match(new RegExp(NUM)); if (!am) return [R('Укажите сумму: «ндс 20% на 1200» (добавить) или «выдели ндс из 1200» (когда НДС уже включён).', { buttons: [btn('ндс 20% на 1200', 'cmd:ндс 20% на 1200'), btn('выдели ндс из 1200', 'cmd:выдели ндс из 1200')] })];
    const a = num(am[0]);
    if (/выдели|вычти|без ндс|включен|в том числе|из\s/.test(n)) { const v = a * rate / (100 + rate); K.last = v; remember('НДС ' + rate + '% из ' + nf(a), money(v)); return [R('В сумме ' + money(a) + ' НДС ' + nf(rate) + '% = ' + money(v) + '\nБез НДС: ' + money(a - v))]; }
    const v = a * rate / 100; K.last = a + v; remember('НДС ' + rate + '% на ' + nf(a), money(a + v)); return [R('НДС ' + nf(rate) + '% на ' + money(a) + ': ' + money(v) + '\nИтого с НДС: ' + money(a + v))];
  });

  skill('margin', /^(?:маржа|наценка)\s*:?\s*(?:цена|продажа)\s*(\S+)\s*(?:себестоимость|закупка|затраты|cost)\s*(\S+)\s*$/, (n, m) => {
    const p = num(m[1]), c = num(m[2]); if (!p || !c) return null;
    return [R('Цена ' + money(p) + ', себестоимость ' + money(c) + ':\nприбыль ' + money(p - c) + '\nмаржа ' + nf((p - c) / p * 100, 2) + '%\nнаценка ' + nf((p - c) / c * 100, 2) + '%')];
  });

  skill('loan', /^(?:посчитай\s+)?(кредит|ипотека|заем|займ)(?![а-яa-z])/, (n) => {
    const rm = n.match(new RegExp('(' + NUM + ')\\s*%')); const tm = n.match(new RegExp('(' + NUM + ')\\s*(лет|года|год|г\\b|мес\\S*|месяц\\S*)'));
    const nums = (n.replace(rm ? rm[0] : '', ' ').replace(tm ? tm[0] : '', ' ').match(new RegExp(NUM, 'g')) || []).map(num).filter(x => x > 0);
    if (!rm || !tm || !nums.length) return [R('Формат: «кредит 1000000 на 5 лет под 12%» (сумма, срок, годовая ставка). Платёж считаю аннуитетный.', { buttons: [btn('Пример', 'cmd:кредит 1000000 на 5 лет под 12%')] })];
    const P = Math.max.apply(null, nums), r = num(rm[1]) / 100 / 12, months = /лет|год|^г/.test(tm[2]) ? Math.round(num(tm[1]) * 12) : Math.round(num(tm[1]));
    if (!(months > 0)) return null;
    const pay = r ? P * r / (1 - Math.pow(1 + r, -months)) : P / months, total = pay * months; K.last = pay; remember('кредит ' + nf(P) + ' ' + months + ' мес', money(pay));
    return [R('Кредит ' + money(P) + ' на ' + months + ' мес. под ' + nf(num(rm[1])) + '% (аннуитет):\nежемесячный платёж ' + money(pay) + '\nвсего выплатите ' + money(total) + '\nпереплата ' + money(total - P) + ' (' + nf((total - P) / P * 100, 1) + '%)', { buttons: [btn('Финансы в панели', 'cmd:калькулятор финансы')] })];
  });
  skill('deposit', /^(?:посчитай\s+)?(вклад|депозит|накопления)(?![а-яa-z])/, (n) => {
    const rm = n.match(new RegExp('(' + NUM + ')\\s*%')); const tm = n.match(new RegExp('(' + NUM + ')\\s*(лет|года|год|г\\b|мес\\S*|месяц\\S*)'));
    const nums = (n.replace(rm ? rm[0] : '', ' ').replace(tm ? tm[0] : '', ' ').match(new RegExp(NUM, 'g')) || []).map(num).filter(x => x > 0);
    if (!rm || !tm || !nums.length) return [R('Формат: «вклад 500000 под 8% на 3 года» (сумма, ставка, срок). Считаю с ежемесячной капитализацией.', { buttons: [btn('Пример', 'cmd:вклад 500000 под 8% на 3 года')] })];
    const P = Math.max.apply(null, nums), r = num(rm[1]) / 100 / 12, months = /лет|год|^г/.test(tm[2]) ? Math.round(num(tm[1]) * 12) : Math.round(num(tm[1]));
    const F = P * Math.pow(1 + r, months); K.last = F; remember('вклад ' + nf(P) + ' ' + months + ' мес', money(F));
    return [R('Вклад ' + money(P) + ' на ' + months + ' мес. под ' + nf(num(rm[1])) + '% (капитализация ежемесячно):\nитого ' + money(F) + '\nдоход ' + money(F - P))];
  });

  skill('convert', new RegExp('^(?:конвертируй|переведи|сколько будет|сколько|посчитай)?\\s*(-?' + NUM + ')\\s*([^\\d\\s][^\\s]*(?:\\s(?:в|рт|ст|миля|мили|час|секунду|секунда)[^\\s]*)*?)\\s+(?:в|->|→|=|to|на)\\s+([^\\d\\s]+(?:\\s[^\\s]+)?)\\s*\\??$'), (n, m) => {
    const v = num(m[1]); let a = unitOf(m[2]), b = unitOf(m[3]);
    if (!a || !b) { const w = m[3].split(' ')[0]; if (!b) b = unitOf(w); }
    if (!a || !b) return null;
    const r = K.convert(v, a, b); if (!r.ok) return [R(r.error + '. Единицы из разных категорий.')];
    K.last = r.value; remember(nf(v) + ' ' + a + ' в ' + b, nf(r.value)); if (dock.open) post({ type: 'orbit-calc', tab: 'conv' });
    return [R(nf(v) + ' ' + m[2].trim() + ' = ' + nf(r.value, 6) + ' ' + m[3].trim(), { buttons: [btn('Конвертер (все единицы)', 'cmd:калькулятор конвертер')] })];
  });

  skill('base', /^(?:переведи\s+)?(0x[0-9a-f]+|0b[01]+|0o[0-7]+|[0-9a-f]+)\s*(?:из\s+)?(hex|bin|oct|dec|шестнадцатеричн\S*|двоичн\S*|восьмеричн\S*|десятичн\S*)?\s*(?:в|->|→|to)\s*(hex|bin|oct|dec|шестнадцатеричн\S*|двоичн\S*|восьмеричн\S*|десятичн\S*)(?:\s+(?:систем\S*|вид|код))?\s*$/, (n, m) => {
    let s = m[1], from = m[2] ? baseOf(m[2]) : 10; const to = baseOf(m[3]); if (!to) return null;
    if (/^0x/.test(s)) { from = 16; s = s.slice(2); } else if (/^0b/.test(s)) { from = 2; s = s.slice(2); } else if (/^0o/.test(s)) { from = 8; s = s.slice(2); }
    if (!m[2] && /[a-f]/.test(s) && from === 10) from = 16;
    const v = parseInt(s, from); if (!Number.isFinite(v) || v.toString(from) !== s.replace(/^0+(?=.)/, '').toLowerCase()) return [R('«' + s + '» не является числом в системе с основанием ' + from + '.')];
    const names = { 2: 'двоичная', 8: 'восьмеричная', 10: 'десятичная', 16: 'шестнадцатеричная' };
    return [R(s + ' (' + names[from] + ') = ' + v.toString(to).toUpperCase() + ' (' + names[to] + ')')];
  });

  skill('days-until', /^(?:сколько\s+)?(?:дней|дни|осталось дней)\s+до\s+(.+?)\s*\??$/, (n, m, t, now) => {
    const d = parseDate(m[1], now, true); if (!d) return null; const k = daysBetween(now, d);
    return [R('До ' + fmtDate(d) + ': ' + k + ' ' + plural(k, 'день', 'дня', 'дней') + (k >= 7 ? ' (≈ ' + Math.floor(k / 7) + ' ' + plural(Math.floor(k / 7), 'неделя', 'недели', 'недель') + ')' : '') + '.')];
  });
  skill('days-between', /^(?:сколько\s+)?(?:дней|дни)\s+между\s+(.+?)\s+и\s+(.+?)\s*\??$/, (n, m, t, now) => {
    const a = parseDate(m[1], now, false), b = parseDate(m[2], now, false); if (!a || !b) return null; const k = Math.abs(daysBetween(a, b));
    return [R('Между ' + fmtDate(a) + ' и ' + fmtDate(b) + ': ' + k + ' ' + plural(k, 'день', 'дня', 'дней') + '.')];
  });
  skill('date-shift', /^(?:какая дата\s+)?(?:через\s+(\d+)\s*(дн\S*|нед\S*|мес\S*|год\S*|лет)|(\d+)\s*(дн\S*|нед\S*|мес\S*|год\S*|лет)\s+назад)\s*\??$/, (n, m, t, now) => {
    const k = +(m[1] || m[3]), u = m[2] || m[4], sign = m[1] ? 1 : -1, d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (/^дн/.test(u)) d.setDate(d.getDate() + sign * k); else if (/^нед/.test(u)) d.setDate(d.getDate() + sign * 7 * k); else if (/^мес/.test(u)) d.setMonth(d.getMonth() + sign * k); else d.setFullYear(d.getFullYear() + sign * k);
    return [R((sign > 0 ? 'Через ' : '') + k + ' ' + u + (sign < 0 ? ' назад' : '') + ': ' + fmtDate(d))];
  });
  skill('weekday', /^(?:какой\s+)?день\s+недели\s+(?:будет\s+|был\s+)?(.+?)\s*\??$/, (n, m, t, now) => {
    const d = parseDate(m[1], now, true); if (!d) return null; return [R(fmtDate(d))];
  });

  skill('solve', /^(?:реши|решить|найди корни|solve)\s*:?\s*(.+)$/, (n, m, t) => {
    const eq = t.replace(/^(?:реши|решить|найди корни|solve)\s*:?\s*/i, '').replace(/\s*[=]\s*0\s*$/, '=0').trim();
    const r = O.tools.solve(eq); if (!r.ok) return [R('Не решил «' + eq + '»: ' + r.error)];
    const res = r.result; let roots = Array.isArray(res) ? res : (res && Array.isArray(res.roots) ? res.roots : (res && res.x != null ? [res.x] : null));
    if (!roots || !roots.length) return [R('Уравнение ' + eq + ': ' + ((res && res.msg && !/∞/.test(res.msg)) ? res.msg : 'вещественных корней нет.'))];
    const d = res && res.D != null && Number.isFinite(+res.D) ? ' (D = ' + nf(+res.D) + ')' : '';
    K.last = +roots[0]; remember('реши ' + eq, roots.map(x => nf(+x)).join('; '));
    return [R('Уравнение ' + eq + ':\n' + (roots.length === 1 ? 'x = ' + nf(+roots[0]) : roots.map((x, i) => 'x' + (i + 1 === 1 ? '₁' : i + 1 === 2 ? '₂' : i + 1) + ' = ' + nf(+x)).join(', ')) + d)];
  });

  skill('stats', new RegExp('^(среднее|среднее арифметическое|сумма|сложи|медиана|максимум|макс|минимум|мин|количество|разброс)\\s*:?\\s*((?:' + NUM + '[\\s;]*){2,})$'), (n, m) => {
    const xs = (m[2].match(new RegExp(NUM, 'g')) || []).map(num).filter(Number.isFinite); if (xs.length < 2) return null;
    const s = xs.reduce((a, b) => a + b, 0), srt = xs.slice().sort((a, b) => a - b), k = m[1];
    const r = /^сред/.test(k) ? s / xs.length : /^(сумма|сложи)/.test(k) ? s : /^мед/.test(k) ? (srt.length % 2 ? srt[(srt.length - 1) / 2] : (srt[srt.length / 2 - 1] + srt[srt.length / 2]) / 2) : /^макс/.test(k) ? srt[srt.length - 1] : /^мин/.test(k) ? srt[0] : /^колич/.test(k) ? xs.length : srt[srt.length - 1] - srt[0];
    K.last = r; remember(k + ' ' + xs.join(' '), nf(r)); return [R(k + ' (' + xs.length + ' ' + plural(xs.length, 'число', 'числа', 'чисел') + '): ' + nf(r))];
  });

  /* выражения: «sin(30)», «2+2*2», «ответ*2», «15%» */
  skill('expr', /./, (n, m, t) => {
    const s = t.trim();
    if (/^\+?\d[\d\s()\-]{6,}\d$/.test(s) && !/[*/^×÷+]\s*\d/.test(s.replace(/^\+/, ''))) return [R('Похоже на номер телефона, а не на выражение. Чтобы сохранить: «добавь контакт Имя ' + s + '».')];
    if (/^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$/.test(s)) { const d = parseDate(s.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1'), new Date(), false); return [R(d ? 'Это дата: ' + fmtDate(d) + '. Спросите, например: «сколько дней до ' + s + '».' : 'Не похоже на дату. Если это выражение — запишите со скобками.')]; }
    const bareFn = RE_BARE_FN.test(s), mathOnly = RE_MATH_ONLY.test(s) && /[+\-*/^×÷!%]/.test(s.replace(/^\s*-/, '')) && /\d/.test(s);
    const withAns = /(^|[^а-яa-z])(ans|ответ)(?![а-яa-z])/i.test(s) && /[+\-*/^×÷]/.test(s) && /^[\s\d+\-*/^().,×÷a-zа-я]+$/i.test(s);
    const rootOf = /^корень\s+из\s+\d/i.test(s) || /^\d+(?:[.,]\d+)?\s+в\s+степени\s+\d/i.test(s) || /^\d+\s*!$/.test(s);
    if (!(bareFn || mathOnly || withAns || rootOf)) return null;
    const r = evalExpr(s.replace(/=+\s*$/, ''));
    if (!r.ok) return [R('Не смог посчитать «' + s + '»: ' + (r.error || 'ошибка') + '.', { buttons: CALC_BTNS().slice(0, 1) })];
    return [R(r.expr + ' = **' + r.text + '**', { buttons: [btn('Открыть калькулятор', 'cmd:калькулятор'), btn('ответ × 2', 'cmd:ответ*2')] })];
  });

  /* «посчитай …» — тот же движок, но результат дублируется в панель */
  skill('calc-verb', /^(?:посчитай|вычисли|сколько будет|реши пример)\s+(.+)$/, (n, m, t) => {
    const body = t.replace(/^(?:посчитай|вычисли|сколько будет|реши пример)\s+/i, '').replace(/\?+$/, '').trim();
    for (const sk of skills) { if (sk.id === 'calc-verb' || sk.id === 'expr') continue; const mm = sk.re.exec(norm(body)); if (mm) { const out = sk.fn(norm(body), mm, body, new Date()); if (out) return out; } }
    const r = evalExpr(body); if (!r.ok) return [R('Не смог посчитать «' + body + '»: ' + (r.error || 'ошибка') + '.', { buttons: CALC_BTNS().slice(0, 1) })];
    return [R(r.expr + ' = **' + r.text + '**', { buttons: [btn('Открыть калькулятор', 'cmd:калькулятор'), btn('ответ × 2', 'cmd:ответ*2')] })];
  });

  I.skillIds = () => skills.map(s => s.id);

  /* ═══════════ 3. СХЕМЫ: СНАЧАЛА В ЧАТЕ ═══════════ */
  const S = I.scheme = { name: '', steps: [], active: false, hist: [], at: 0 };
  const DKEY = 'kontur-scheme-draft';
  try { const d = JSON.parse(localStorage.getItem(DKEY) || 'null'); if (d && Array.isArray(d.steps)) { S.name = d.name || ''; S.steps = d.steps; } } catch (e) {}
  const persist = () => { try { localStorage.setItem(DKEY, JSON.stringify({ name: S.name, steps: S.steps })); } catch (e) {} };
  const TTL = 15 * 60 * 1000;
  S.isActive = () => S.active && Date.now() - S.at < TTL;
  const touch = () => { S.at = Date.now(); };
  const snap = () => { S.hist.push(JSON.stringify({ name: S.name, steps: S.steps })); if (S.hist.length > 30) S.hist.shift(); };
  const TPL = () => (O.work && O.work.TEMPLATES) || {};

  /* шаги → граф. Формат шага: «Старт», «Проверка?», «Да: Выкатить», «Нет: Откат», «Конец». */
  S.graph = function (steps) {
    const nodes = [], edges = []; let tails = [], decision = null, id = 0;
    const mkNode = text => { const low = norm(text); const type = /\?\s*$/.test(text) || /^если\s/.test(low) ? 'decision' : (/^(старт|начало|start|конец|финиш|end|финал)\b/.test(low) ? 'terminal' : (/^(ввод|вывод|input|output)\b/.test(low) ? 'io' : 'process')); const nd = { id: 'n' + (++id), type, text: text.replace(/^если\s+/i, '').trim() }; nodes.push(nd); return nd; };
    steps.forEach(raw => {
      const bm = raw.match(/^(да|нет|yes|no)\s*:\s*(.+)$/i);
      if (bm && decision) {
        const nd = mkNode(bm[2].trim()); edges.push({ id: 'e' + edges.length, from: decision.id, to: nd.id, label: /^(да|yes)/i.test(bm[1]) ? 'Да' : 'Нет' });
        if (decision._open) { tails = []; decision._open = false; } tails.push(nd.id); return;
      }
      const nd = mkNode(raw.replace(/^(да|нет)\s*:\s*/i, ''));
      tails.forEach(t => edges.push({ id: 'e' + edges.length, from: t, to: nd.id }));
      if (!tails.length && decision && decision._open) edges.push({ id: 'e' + edges.length, from: decision.id, to: nd.id });
      if (nd.type === 'decision') { decision = nd; nd._open = true; tails = []; } else { tails = [nd.id]; decision = null; }
    });
    nodes.forEach(n => { delete n._open; });
    return { nodes, edges };
  };
  S.layout = function (g, gx, gy, w) {
    const rank = {}; g.nodes.forEach(n => rank[n.id] = 0);
    for (let it = 0; it < g.nodes.length; it++) g.edges.forEach(e => { if (rank[e.to] < rank[e.from] + 1 && rank[e.from] + 1 < g.nodes.length) rank[e.to] = rank[e.from] + 1; });
    const rows = {}; g.nodes.forEach(n => (rows[rank[n.id]] = rows[rank[n.id]] || []).push(n));
    const maxc = Math.max.apply(null, Object.keys(rows).map(r => rows[r].length).concat([1]));
    const W = maxc * (w + gx);
    Object.keys(rows).forEach(r => rows[r].forEach((n, i) => { n.x = W / 2 + (i - (rows[r].length - 1) / 2) * (w + gx); n.y = r * gy; n.rank = +r; }));
    return { W, H: (Math.max.apply(null, Object.keys(rows).map(Number).concat([0])) + 1) * gy };
  };
  const wrapText = (s, max) => { const words = String(s).split(/\s+/), lines = []; let cur = ''; words.forEach(w => { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) lines.push(cur); if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].replace(/.{0,2}$/, '…'); } return lines; };
  let svgSeq = 0;
  S.svg = function (steps) {
    const g = S.graph(steps); if (!g.nodes.length) return '';
    const w = 150, gx = 26, gy = 78, L = S.layout(g, gx, gy, w), pad = 16, mid = 'ar' + (++svgSeq), by = {}; g.nodes.forEach(n => by[n.id] = n);
    const hOf = n => n.type === 'decision' ? 60 : 42;
    let out = '';
    g.edges.forEach(e => {
      const a = by[e.from], b = by[e.to], x1 = a.x, y1 = a.y + hOf(a) / 2, x2 = b.x, y2 = b.y - hOf(b) / 2, my = (y1 + y2) / 2;
      out += `<path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2 - 2}" fill="none" stroke="var(--text-muted,#94a3b8)" stroke-width="1.5" marker-end="url(#${mid})"/>`;
      if (e.label) out += `<text x="${(x1 + x2) / 2 + (x2 >= x1 ? 8 : -8)}" y="${my - 3}" text-anchor="${x2 >= x1 ? 'start' : 'end'}" font-size="11" fill="var(--accent,#6366f1)" font-weight="700">${esc(e.label)}</text>`;
    });
    g.nodes.forEach(n => {
      const h = hOf(n), lines = wrapText(n.text, n.type === 'decision' ? 14 : 18), x = n.x - w / 2, y = n.y - h / 2, st = 'fill="var(--bg-card,#12182a)" stroke="var(--accent,#6366f1)" stroke-width="1.6"';
      if (n.type === 'terminal') out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" ${st}/>`;
      else if (n.type === 'decision') out += `<polygon points="${n.x},${y} ${x + w},${n.y} ${n.x},${y + h} ${x},${n.y}" ${st}/>`;
      else if (n.type === 'io') out += `<polygon points="${x + 12},${y} ${x + w},${y} ${x + w - 12},${y + h} ${x},${y + h}" ${st}/>`;
      else out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ${st}/>`;
      out += `<text text-anchor="middle" font-size="12" fill="var(--text,#eef2ff)" font-family="system-ui,sans-serif">${lines.map((ln, i) => `<tspan x="${n.x}" y="${n.y + 4 + (i - (lines.length - 1) / 2) * 14}">${esc(ln)}</tspan>`).join('')}</text>`;
    });
    const vw = L.W + pad * 2, vh = L.H + 20 + pad;
    return `<div class="o-scheme"><svg role="img" aria-label="Схема: ${esc(S.name || 'без названия')}" viewBox="${-pad} ${-34} ${vw} ${vh}" style="width:100%;max-width:${Math.max(220, Math.min(vw, 520))}px;height:auto"><defs><marker id="${mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--text-muted,#94a3b8)"/></marker></defs>${out}</svg></div>`;
  };
  S.doc = function () {
    const g = S.graph(S.steps), L = S.layout(g, 70, 120, 160);
    const nodes = g.nodes.map(n => ({ id: n.id, type: n.type, text: n.text, x: Math.round(n.x - 80 + 60), y: Math.round(n.y + 40) }));
    return { format: 'flowforge', version: '2.8', camera: { x: 40, y: 20, zoom: 1 }, nodes, edges: g.edges.map(e => Object.assign({}, e)), groups: [] };
  };
  const name = () => S.name || 'Схема';
  const preview = (head, extra) => {
    const steps = S.steps.length;
    const text = (head ? head + '\n' : '') + 'Схема «' + name() + '»: ' + steps + ' ' + plural(steps, 'шаг', 'шага', 'шагов') + (S.isActive() ? '. Пишите следующие шаги прямо здесь.' : '.');
    const b = [btn('Открыть в редакторе', 'cmd:открой схему в редакторе'), btn('+ Шаг', 'cmd:добавь шаг'), btn('+ Условие', 'cmd:добавь условие')];
    if (S.hist.length) b.push(btn('Отменить шаг', 'cmd:отмени шаг'));
    if (S.isActive()) b.push(btn('Закончить', 'cmd:закончить схему'));
    return R(text + (extra ? '\n' + extra : ''), { cards: S.steps.length ? [S.svg(S.steps)] : [], buttons: b });
  };
  const startMsg = () => R('Собираем схему здесь, в чате — редактор откроем в самом конце, если понадобится.\n\nПишите шаги по одному или цепочкой: «Старт -> Проверка -> Конец».\nУсловие: «Оплата прошла? да: Выдать доступ; нет: Вернуть деньги».\nКоманды: «назови схему …», «убери шаг …», «покажи схему», «открой в редакторе».', {
    buttons: Object.keys(TPL()).filter(k => k !== 'blank').slice(0, 6).map(k => btn(TPL()[k].label, 'ag:wiz:tpl:' + k)).concat([btn('Пустая', 'ag:wiz:blank')])
  });
  function addSteps(list) {
    snap(); list.forEach(s => { s = s.trim(); if (s) S.steps.push(s); }); touch(); persist();
  }
  function parseSteps(body) {
    const out = [];
    String(body).split(/\n+/).forEach(line => {
      line = line.trim(); if (!line) return;
      line.split(/\s*(?:->|→|⇒)\s*/).forEach(p => {
        p = p.replace(/^\d+[).]\s*/, '').trim(); if (!p) return;
        const dec = p.match(/^(?:если\s+)?(.+?\?)\s*(?:да\s*:\s*(.+?))?\s*(?:[;,]\s*)?(?:нет\s*:\s*(.+))?$/i);
        if (dec && (dec[2] || dec[3])) { out.push(dec[1].trim()); if (dec[2]) out.push('Да: ' + dec[2].trim()); if (dec[3]) out.push('Нет: ' + dec[3].trim()); return; }
        p.split(/\s*;\s*/).forEach(q => { q = q.trim(); if (q) out.push(q); });
      });
    });
    return out;
  }
  const RE_START = /^(?:(?:создай|создать|нарисуй|сделай|построй|начни|новая|новую|собери)\s+)?(?:блок[- ]?схем\S*|схем\S*)(?:\s*:\s*|\s+)?(.*)$|^мастер схем$|^flowchart\b/i;
  const CMD_VERB = /^(добавь|добавить|удали|удалить|убери|перенеси|открой|покажи|позвони|напомни|посчитай|вычисли|график|нарисуй|что |когда |сколько|помощь|sos|тема|заметка|цель|журнал|дз|задач|ндс|кредит|вклад|реши|калькулятор|отмени|отмена|привет|спасибо|я освободился|через |ответ|история|переведи|конвертируй|мои |список|сделал|выполнил|запомни|забудь|стиль|настройки)/i;

  function openEditor() {
    if (!S.steps.length) return [R('Схема пока пустая — добавьте хотя бы пару шагов: «Старт -> Проверка -> Конец».')];
    const d = S.doc(), r = O.tools.openScheme(d, name());
    S.active = false; persist();
    if (!r.ok) return [R('Не смог открыть редактор: ' + r.error)];
    return [R('Открыл схему «' + name() + '» в редакторе FlowForge. Вернётесь в чат — я не буду предлагать собирать заново; нужна правка — скажите «покажи схему».', { buttons: [btn('Редактор', 'tab:flow')] })];
  }

  S.handle = function (t, n) {
    if (/^(закончить|закончи|выйти|выход|хватит)(?: из)?(?: режим[а]?)?\s*(?:схем\S*)?\s*$/.test(n) && S.isActive()) { S.active = false; return [R('Готово, режим схемы выключен. Схема «' + name() + '» сохранена: «покажи схему» или «открой схему в редакторе».')]; }
    if (/^(?:открой|открыть|перейди|покажи)\s+(?:схему?\s+)?(?:в\s+)?редактор\S*$|^открой\s+схему\s+в\s+редакторе$|^в\s+редактор$|^открой\s+(?:эту|текущую|мою)\s+схему$/.test(n)) return openEditor();
    if (/^(?:готово|готова|всё|все)\s*(?:→|->)?\s*(?:в\s+)?редактор\S*$/.test(n)) return openEditor();
    if (/^(?:покажи|покажи мне|что в|выведи)\s+(?:текущ\S+\s+|мою\s+|эту\s+)?схем\S*$/.test(n)) return [S.steps.length ? preview('') : R('Схема пока пустая. Напишите шаги: «Старт -> Проверка -> Конец».')];
    if (/^(?:новая схема|очисти схему|сбрось схему|начать заново|сначала)$/.test(n)) { snap(); S.name = ''; S.steps = []; S.active = true; touch(); persist(); return [startMsg()]; }
    let m;
    if ((m = t.match(/^(?:назови|переименуй|назвать)\s+(?:схему\s+)?(?:в\s+|как\s+)?[«"']?(.+?)[»"']?\s*$/i)) && (S.isActive() || /схем/i.test(t))) { snap(); S.name = m[1].trim(); touch(); persist(); return [preview('Назвал.')]; }
    if ((m = t.match(/^схема\s+называется\s+[«"']?(.+?)[»"']?\s*$/i))) { snap(); S.name = m[1].trim(); touch(); persist(); return [preview('Назвал.')]; }
    if (/^(?:отмени|отмена|верни)\s*(?:шаг|последний шаг|последнее)?$/.test(n) && S.hist.length && (S.isActive() || /шаг/.test(n))) { const p = JSON.parse(S.hist.pop()); S.name = p.name; S.steps = p.steps; persist(); return [preview('Отменил.')]; }
    if ((m = t.match(/^(?:убери|удали|сотри)\s+(?:последний шаг|последнее|последний)\s*$/i))) { if (!S.steps.length) return [R('В схеме нет шагов.')]; snap(); const x = S.steps.pop(); persist(); return [preview('Убрал «' + x + '».')]; }
    if ((m = t.match(/^(?:убери|удали|сотри)\s+шаг\s+(.+)$/i))) {
      const q = norm(m[1]), i = S.steps.findIndex(s => norm(s).includes(q)); if (i < 0) return [R('Не нашёл шаг «' + m[1] + '». Шаги: ' + S.steps.join(' → '))];
      snap(); const x = S.steps.splice(i, 1)[0]; persist(); touch(); return [preview('Убрал «' + x + '».')];
    }
    if ((m = t.match(/^(?:добавь|добавить|вставь|вставить)\s+(шаг|условие|этап)(?:\s*:?\s*(.*))?$/i))) {
      let body = (m[2] || '').trim(), kind = norm(m[1]);
      if (!body) { S.active = true; touch(); return [R(kind === 'условие' ? 'Какое условие? Напишите вопрос: «Тесты прошли?» — потом ветки «да: …; нет: …».' : 'Какой шаг добавить? Напишите текст — например, «Код-ревью».')]; }
      let after = null; const am = body.match(/^(.+?)\s+после\s+(.+)$/i); if (am) { body = am[1].trim(); after = norm(am[2]); }
      const list = kind === 'условие' && !/\?\s*$/.test(body.split(/да\s*:|нет\s*:/i)[0]) ? parseSteps(body.replace(/^([^;да]+?)(\s+да\s*:|\s*;|$)/i, '$1?$2')) : parseSteps(body);
      snap();
      if (after) { const i = S.steps.findIndex(s => norm(s).includes(after)); if (i >= 0) S.steps.splice(i + 1, 0, ...list); else S.steps.push(...list); } else S.steps.push(...list);
      S.active = true; touch(); persist(); return [preview('Добавил.')];
    }
    if ((m = t.match(RE_START)) && /схем|flowchart|мастер/i.test(t) && !/^(?:назови|переименуй)/i.test(t)) {
      const body = (m[1] || '').trim();
      if (/^(?:в\s+)?редактор\S*$/i.test(body) || /^открой/i.test(t)) return null;
      snap(); S.active = true; touch();
      const parts = body ? parseSteps(body) : [];
      if (parts.length >= 2) { S.name = ''; S.steps = parts; persist(); return [preview('Собрал схему.')]; }
      S.name = parts.length === 1 ? parts[0].replace(/^[«"']|[»"']$/g, '') : ''; S.steps = []; persist();
      return [startMsg()];
    }
    if (S.isActive()) {
      if (CMD_VERB.test(n) || t.length > 240) return null;
      const steps = parseSteps(t); if (!steps.length) return null;
      addSteps(steps); return [preview(steps.length > 1 ? 'Добавил ' + steps.length + ' ' + plural(steps.length, 'шаг', 'шага', 'шагов') + '.' : 'Добавил.')];
    }
    return null;
  };
  S.act = function (act) {
    const parts = String(act).split(':'), op = parts[2], arg = parts.slice(3).join(':');
    if (op === 'start') { snap(); S.name = ''; S.steps = []; S.active = true; touch(); persist(); return [startMsg()]; }
    if (op === 'blank') { snap(); S.name = ''; S.steps = []; S.active = true; touch(); persist(); return [R('Пустая схема. Пишите шаги: «Старт -> Проверка -> Конец».')]; }
    if (op === 'tpl') { const t = TPL()[arg || 'linear'] || TPL().linear; if (!t) return [R('Шаблон не найден.')]; snap(); S.name = t.label; S.steps = t.steps.slice(); S.active = true; touch(); persist(); return [preview('Взял шаблон «' + t.label + '».', 'Можно менять: «добавь шаг …», «убери шаг …».')]; }
    if (!S.isActive() && !S.steps.length) return [R('Эта схема уже закрыта. Скажите «создай схему», чтобы собрать новую.', { buttons: [btn('Создать схему', 'ag:wiz:start')] })];
    if (op === 'finish') return openEditor();
    return [R('Эта кнопка из прошлой схемы и больше не работает. Напишите «покажи схему» или «создай схему».', { buttons: [btn('Создать схему', 'ag:wiz:start')] })];
  };

  /* ═══════════ точка входа для ассистента ═══════════ */
  I.handle = function (text) {
    const t = String(text || '').trim(); if (!t || t.length > 600) return null;
    const n = norm(t).replace(/\?+$/, '').trim();
    try {
      const sm = S.handle(t, n); if (sm) return sm;
      const now = new Date();
      for (const sk of skills) { const m = sk.re.exec(n); if (m) { const out = sk.fn(n, m, t, now); if (out) return out; } }
    } catch (e) { console.error('inline', e); return [R('Не получилось выполнить: ' + (e && e.message || e) + '.')]; }
    return null;
  };
  I.act = function (act) { try { return S.act(act); } catch (e) { return null; } };

})();

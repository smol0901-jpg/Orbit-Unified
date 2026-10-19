/* Контур 4.6 · Work mode: маршруты (метро/работа), память 300, мастер схем */
(function () {
  const O = window.Orbit = window.Orbit || {};
  const W = O.work = {};

  /* ══════════════ MEMORY (300 msgs + notes + search) ══════════════ */
  const MEM_KEY = 'orbit-memory-v5';
  const MSG_CAP = 300;
  const NOTE_CAP = 80;

  W.loadMem = function () {
    try {
      const raw = localStorage.getItem(MEM_KEY) || localStorage.getItem('orbit-memory-v4');
      const m = Object.assign({ aliases: {}, notes: [], msgs: [], facts: [] }, JSON.parse(raw || '{}'));
      m.msgs = (m.msgs || []).map(x => ({
        role: x.role || 'user',
        text: String(x.text || ''),
        at: x.at || Date.now()
      }));
      return m;
    } catch (e) {
      return { aliases: {}, notes: [], msgs: [], facts: [] };
    }
  };

  W.saveMem = function (mem) {
    try {
      const payload = {
        aliases: mem.aliases || {},
        notes: (mem.notes || []).slice(-NOTE_CAP),
        facts: (mem.facts || []).slice(-60),
        msgs: (mem.msgs || []).slice(-MSG_CAP).map(x => ({
          role: x.role, text: String(x.text || '').slice(0, 2000), at: x.at || Date.now()
        }))
      };
      localStorage.setItem(MEM_KEY, JSON.stringify(payload));
    } catch (e) {
      // quota: drop older half
      try {
        mem.msgs = (mem.msgs || []).slice(-150);
        localStorage.setItem(MEM_KEY, JSON.stringify({
          aliases: mem.aliases || {}, notes: (mem.notes || []).slice(-40),
          facts: (mem.facts || []).slice(-30), msgs: mem.msgs
        }));
      } catch (e2) {}
    }
  };

  W.pushMsg = function (mem, msg) {
    const m = Object.assign({ at: Date.now() }, msg);
    mem.msgs = (mem.msgs || []).concat([m]).slice(-MSG_CAP);
    W.saveMem(mem);
    return m;
  };

  function dayBounds(offsetDays) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + (offsetDays || 0));
    const start = d.getTime();
    const end = start + 86400000;
    return { start, end, label: d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) };
  }

  W.queryMemory = function (mem, query) {
    const n = String(query || '').toLowerCase().replace(/ё/g, 'е');
    const msgs = mem.msgs || [];
    let from = 0, to = Date.now(), title = 'за всё время';

    if (/вчера/.test(n)) {
      const b = dayBounds(-1); from = b.start; to = b.end; title = 'вчера (' + b.label + ')';
    } else if (/позавчера/.test(n)) {
      const b = dayBounds(-2); from = b.start; to = b.end; title = 'позавчера';
    } else if (/сегодня/.test(n)) {
      const b = dayBounds(0); from = b.start; to = b.end; title = 'сегодня';
    } else if (/прошл(ой|ую)\s*недел|на\s*прошлой\s*неделе/.test(n)) {
      const now = new Date();
      const day = (now.getDay() + 6) % 7; // mon=0
      const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - day - 7);
      const end = new Date(start); end.setDate(end.getDate() + 7);
      from = start.getTime(); to = end.getTime(); title = 'на прошлой неделе';
    } else if (/этой\s*недел/.test(n)) {
      const now = new Date();
      const day = (now.getDay() + 6) % 7;
      const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - day);
      from = start.getTime(); to = Date.now(); title = 'на этой неделе';
    } else if (/месяц/.test(n)) {
      from = Date.now() - 30 * 86400000; title = 'за месяц';
    }

    let list = msgs.filter(m => (m.at || 0) >= from && (m.at || 0) < to);
    // keyword filter if not pure time query
    const kw = n.replace(/что\s*(было|говорили|обсуждали|делали)|вспомни|память|вчера|сегодня|позавчера|прошл\S*\s*недел\S*|этой\s*недел\S*|месяц|за\s*/g, ' ')
      .replace(/\s+/g, ' ').trim();
    if (kw.length > 2 && !/^\s*$/.test(kw)) {
      const parts = kw.split(/\s+/).filter(w => w.length > 2);
      if (parts.length) {
        list = list.filter(m => {
          const t = (m.text || '').toLowerCase();
          return parts.some(p => t.includes(p));
        });
      }
    }

    const fmt = ts => {
      try {
        return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      } catch (e) { return ''; }
    };

    const sample = list.slice(-12).map(m => {
      const who = m.role === 'user' ? 'Вы' : 'Орби';
      return '· ' + fmt(m.at) + ' — ' + who + ': ' + String(m.text || '').slice(0, 120);
    });

    return {
      title,
      count: list.length,
      total: msgs.length,
      lines: sample,
      empty: !list.length
    };
  };

  /* ══════════════ TRANSPORT / ROUTES ══════════════ */
  const MODES = {
    bus: 'Автобус', metro: 'Метро', walk: 'Пешком', car: 'Авто',
    taxi: 'Такси', train: 'Электричка', bike: 'Вело', mixed: 'Смешанный'
  };
  W.MODES = MODES;

  const DIRS = {
    home: 'Домой', work: 'На работу', school: 'На работу / в офис',
    office: 'В офис', other: 'Другое', gym: 'Спорт', shop: 'Магазины'
  };
  W.DIRS = DIRS;

  W.normalizeDir = function (text) {
    const n = String(text || '').toLowerCase().replace(/ё/g, 'е');
    if (/работ|офис|office|work/.test(n)) return 'work';
    if (/дом|home/.test(n)) return 'home';
    if (/офис|коворкинг|школ|универ|уче|лицей|колледж/.test(n)) return 'school';
    if (/спорт|зал|фитнес/.test(n)) return 'gym';
    if (/магаз|торгов/.test(n)) return 'shop';
    return 'other';
  };

  W.normalizeMode = function (text) {
    const n = String(text || '').toLowerCase();
    if (/метро|subway|metro|мцк|мцд/.test(n)) return 'metro';
    if (/пешк|walk|ножк/.test(n)) return 'walk';
    if (/машин|авто|car/.test(n)) return 'car';
    if (/такси|uber|яндекс/.test(n)) return 'taxi';
    if (/электр|поезд|train/.test(n)) return 'train';
    if (/вело|bike/.test(n)) return 'bike';
    if (/смеш|mixed/.test(n)) return 'mixed';
    if (/автобус|bus|маршрутк/.test(n)) return 'bus';
    return 'bus';
  };

  /** Ensure state.routes array exists */
  W.ensureRoutes = function (state) {
    if (!state.routes) state.routes = [];
    return state.routes;
  };

  W.addRoute = function (state, opts) {
    const routes = W.ensureRoutes(state);
    const r = {
      id: 'rt_' + Date.now().toString(36),
      name: opts.name || 'Маршрут',
      from: opts.from || 'Дом',
      to: opts.to || 'Работа',
      dir: opts.dir || W.normalizeDir(opts.to),
      mode: opts.mode || 'bus',
      line: opts.line || '',          // metro line / bus number
      times: opts.times || [],        // departure times HH:MM
      walkMin: opts.walkMin != null ? +opts.walkMin : 8,
      rideMin: opts.rideMin != null ? +opts.rideMin : 25,
      days: opts.days || [0, 1, 2, 3, 4], // weekdays default
      notes: opts.notes || ''
    };
    routes.push(r);
    // also mirror as bus-like for legacy planner if mode is bus/metro
    if (!state.buses) state.buses = [];
    const dir = r.dir === 'work' || r.dir === 'office' ? 'school' : (r.dir === 'home' ? 'home' : 'other');
    // use 'school' slot as "to work/morning destination" for legacy engine
    state.buses.push({
      id: r.id,
      number: r.line || r.name,
      dir: r.dir === 'home' ? 'home' : (r.dir === 'work' || r.dir === 'school' ? 'school' : 'other'),
      mode: r.mode,
      times: r.times.slice(),
      time: r.times[0] || '',
      walkMin: r.walkMin,
      rideMin: r.rideMin,
      from: r.from,
      to: r.to,
      days: r.days,
      routeId: r.id
    });
    return r;
  };

  /* ══════════════ SCHEME WIZARD ══════════════ */
  const TEMPLATES = {
    linear: {
      label: 'Линейная',
      desc: 'Шаги друг за другом',
      steps: ['Старт', 'Шаг 1', 'Шаг 2', 'Финиш']
    },
    branch: {
      label: 'С ветвлением',
      desc: 'Есть условие Да/Нет',
      steps: ['Старт', 'Проверка?', 'Да: действие', 'Нет: альтернатива', 'Конец']
    },
    it_deploy: {
      label: 'IT: деплой',
      desc: 'Типовой релиз',
      steps: ['Старт', 'Code review', 'CI зелёный?', 'Да: Deploy staging', 'Тесты OK?', 'Да: Deploy prod', 'Нет: Rollback', 'Конец']
    },
    it_bug: {
      label: 'IT: баг',
      desc: 'Разбор инцидента',
      steps: ['Старт', 'Воспроизвести', 'Найти причину', 'Фикс', 'Ревью', 'Выкатка', 'Конец']
    },
    mgr_meeting: {
      label: 'Встреча',
      desc: 'Подготовка созвона',
      steps: ['Старт', 'Повестка', 'Приглашения', 'Материалы', 'Созвон', 'Протокол', 'Задачи', 'Конец']
    },
    mgr_hire: {
      label: 'Найм',
      desc: 'Воронка кандидата',
      steps: ['Старт', 'Скрининг резюме', 'Созвон HR', 'Техсобес', 'Оффер?', 'Да: Онбординг', 'Нет: Отказ', 'Конец']
    },
    blank: {
      label: 'С нуля',
      desc: 'Пустой холст в редакторе',
      steps: []
    }
  };
  W.TEMPLATES = TEMPLATES;

  W.wizardStart = function () {
    return {
      step: 'template',
      template: null,
      name: '',
      blocks: [],
      links: []
    };
  };

  W.wizardApplyTemplate = function (wiz, key) {
    const t = TEMPLATES[key] || TEMPLATES.linear;
    wiz.template = key;
    wiz.blocks = (t.steps || []).slice();
    wiz.step = key === 'blank' ? 'open' : 'name';
    wiz.name = t.label;
    return wiz;
  };

  W.wizardBuild = function (wiz) {
    if (!wiz.blocks || !wiz.blocks.length) {
      return O.tools.buildScheme('Старт -> Процесс -> Конец', wiz.name || 'Схема');
    }
    // branch-aware: "Да: x" / "Нет: y" after a "?" node
    const parts = [];
    const blocks = wiz.blocks;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (/^(да|нет)\s*:/i.test(b)) {
        // connect from previous decision
        const label = /^да/i.test(b) ? 'Да' : 'Нет';
        const text = b.replace(/^(да|нет)\s*:\s*/i, '');
        parts.push((blocks[i - 1] || 'Условие') + ' ->|' + label + '| ' + text);
      } else if (i === 0) {
        parts.push(b);
      } else if (!/^(да|нет)\s*:/i.test(blocks[i - 1])) {
        parts.push(blocks[i - 1] + ' -> ' + b);
      }
    }
    // simpler fallback: sequential
    if (parts.length < 2) {
      return O.tools.buildScheme(blocks.join(' -> '), wiz.name);
    }
    return O.tools.buildScheme(parts.join('; '), wiz.name || 'Схема');
  };
})();

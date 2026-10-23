/* Контур · Обучение 14 дней + подсказки в агенте */
(function () {
  'use strict';
  const O = window.Orbit = window.Orbit || {};
  const KEY = 'contour-onboard';
  const DAYS = 14;

  const TIPS = [
    { id: 'hello', title: 'Приветствие', text: 'Напишите «помощь» — список команд. Или «что дальше» — ближайшее событие.', cmd: 'помощь' },
    { id: 'bus', title: 'Автобус', text: '«когда выходить» или «я освободился» — подберёт рейс домой/на работу.', cmd: 'когда автобус домой' },
    { id: 'tasks', title: 'Задачи', text: '«добавь задачу …» или «что задано». «задачи на завтра» — список на день.', cmd: 'что задано' },
    { id: 'remind', title: 'Напоминания', text: '«напомни через 30 мин купить ручки» — спросит время, если не указали.', cmd: 'напомни' },
    { id: 'calc', title: 'Калькулятор', text: '«калькулятор» или «посчитай 12*8» — панель CIFRA в чате.', cmd: 'калькулятор' },
    { id: 'scheme', title: 'Схемы', text: '«создай схему» — шаги в чате, потом «открой в редакторе».', cmd: 'создай схему' },
    { id: 'diag', title: 'Диаграммы', text: '«круговая диаграмма» или «диаграмма занятости» — карточка и редактор.', cmd: 'диаграммы' },
    { id: 'pomo', title: 'Помидор', text: '«помидор 25» — таймер фокуса в контейнере чата.', cmd: 'помидор' },
    { id: 'screen', title: 'Контекст', text: '«что на экране» — сводка вкладки, встреч и задач.', cmd: 'что на экране' },
    { id: 'plans', title: 'Планы', text: '«что у меня завтра вечером» — расписание на период.', cmd: 'планы на завтра' }
  ];

  function state() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    const st = { started: Date.now(), dayIndex: 0, seen: [], disabled: false };
    save(st);
    return st;
  }
  function save(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  }

  function dayNum(st) {
    const d = Math.floor((Date.now() - (st.started || Date.now())) / 86400000);
    return Math.min(DAYS, Math.max(0, d));
  }

  function enabled() {
    const s = ((O.core && O.core().S && O.core().S()) || {}).settings || {};
    if (s.agentOnboard === false) return false;
    const st = state();
    if (st.disabled) return false;
    return dayNum(st) < DAYS;
  }

  function nextTip() {
    const st = state();
    const left = TIPS.filter(t => !(st.seen || []).includes(t.id));
    if (!left.length) {
      st.seen = [];
      save(st);
      return TIPS[dayNum(st) % TIPS.length];
    }
    return left[dayNum(st) % left.length];
  }

  function markSeen(id) {
    const st = state();
    st.seen = st.seen || [];
    if (!st.seen.includes(id)) st.seen.push(id);
    save(st);
  }

  function tipCard() {
    if (!enabled()) return null;
    const tip = nextTip();
    if (!tip) return null;
    markSeen(tip.id);
    const body = '<p class="o-glass-p"><b>День ' + (dayNum(state()) + 1) + '/' + DAYS + ' · обучение</b></p>' +
      '<p class="o-glass-p">' + tip.text + '</p>';
    if (O.cards && O.cards.push) {
      return O.cards.push({
        type: 'info',
        title: 'Обучение · ' + tip.title,
        body,
        live: false,
        actions: [
          { label: 'Попробовать', act: 'cmd:' + tip.cmd },
          { label: 'Ещё совет', act: 'cmd:обучи меня' },
          { label: 'Выкл. обучение', act: 'cmd:выключи обучение' }
        ]
      }, { text: 'Подсказка по возможностям агента.' });
    }
    return tip;
  }

  function helpDocHtml() {
    return `<div class="o-onboard-doc">
      <h3>Что умеет агент</h3>
      <ul>
        <li><b>День:</b> «что дальше», «расписание на завтра», «что у меня завтра вечером»</li>
        <li><b>Транспорт:</b> «когда выходить», «я освободился», «когда автобус домой»</li>
        <li><b>Задачи:</b> «добавь задачу …», «что задано», «задачи на завтра»</li>
        <li><b>Напоминания:</b> «напомни через 30 мин …»</li>
        <li><b>Звонки:</b> «позвони маме», контакты в приложении</li>
        <li><b>Калькулятор / схемы / диаграммы:</b> в контейнере чата</li>
        <li><b>Помидор и концентрация:</b> «помидор», кнопка ◎ в шапке</li>
      </ul>
      <p>14 дней агент предлагает короткие подсказки. Выключить: Настройки → Агент → Обучение.</p>
    </div>`;
  }

  O.onboard = {
    enabled, nextTip, tipCard, helpDocHtml, state, DAYS, TIPS,
    disable() { const st = state(); st.disabled = true; save(st); },
    enable() { const st = state(); st.disabled = false; st.started = Date.now(); st.seen = []; save(st); },
    maybeSuggest() {
      if (!enabled()) return;
      const st = state();
      const key = 'tip-' + new Date().toISOString().slice(0, 10);
      if (st[key]) return;
      st[key] = 1;
      save(st);
      try { tipCard(); } catch (e) {}
    }
  };
})();

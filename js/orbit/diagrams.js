/* Контур · Ядро диаграмм: pie, bar, busy, state, journey, c4
   O.diagrams — API для агента, вкладки и редактора */
(function () {
  'use strict';
  const O = window.Orbit = window.Orbit || {};
  const TYPES = {
    pie: { id: 'pie', title: 'Круговая', hint: 'Доли целого' },
    bar: { id: 'bar', title: 'Гистограмма', hint: 'Столбцы значений' },
    busy: { id: 'busy', title: 'Занятость', hint: 'Свободное / занятое время' },
    state: { id: 'state', title: 'Состояния', hint: 'Переходы состояний' },
    journey: { id: 'journey', title: 'Путь пользователя', hint: 'Этапы опыта' },
    c4: { id: 'c4', title: 'C4-контекст', hint: 'Система и акторы' }
  };

  function uid() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function defaultDoc(type) {
    const t = TYPES[type] ? type : 'pie';
    const base = { id: uid(), type: t, title: TYPES[t].title, updated: Date.now() };
    if (t === 'pie') return Object.assign(base, { slices: [
      { label: 'Работа', value: 40, color: '#6366f1' },
      { label: 'Учёба', value: 25, color: '#22c55e' },
      { label: 'Отдых', value: 20, color: '#f59e0b' },
      { label: 'Прочее', value: 15, color: '#94a3b8' }
    ]});
    if (t === 'bar') return Object.assign(base, { bars: [
      { label: 'Пн', value: 4 }, { label: 'Вт', value: 6 }, { label: 'Ср', value: 5 },
      { label: 'Чт', value: 8 }, { label: 'Пт', value: 3 }
    ]});
    if (t === 'busy') return Object.assign(base, {
      dayStart: 8, dayEnd: 22,
      blocks: [
        { label: 'Встречи', start: 9, end: 12, kind: 'busy' },
        { label: 'Обед', start: 12, end: 13, kind: 'free' },
        { label: 'Фокус', start: 13, end: 17, kind: 'busy' },
        { label: 'Свободно', start: 17, end: 20, kind: 'free' }
      ]
    });
    if (t === 'state') return Object.assign(base, {
      states: ['Черновик', 'На проверке', 'Готово', 'Отклонено'],
      edges: [
        { from: 'Черновик', to: 'На проверке', label: 'отправить' },
        { from: 'На проверке', to: 'Готово', label: 'ок' },
        { from: 'На проверке', to: 'Отклонено', label: 'нет' },
        { from: 'Отклонено', to: 'Черновик', label: 'правка' }
      ]
    });
    if (t === 'journey') return Object.assign(base, {
      steps: [
        { name: 'Узнал', emotion: 2, note: 'Реклама / друг' },
        { name: 'Попробовал', emotion: 3, note: 'Первый вход' },
        { name: 'Разобрался', emotion: 4, note: 'Онбординг' },
        { name: 'Пользуется', emotion: 5, note: 'Привычка' },
        { name: 'Рекомендует', emotion: 5, note: 'NPS' }
      ]
    });
    if (t === 'c4') return Object.assign(base, {
      system: 'Контур',
      actors: [
        { name: 'Пользователь', desc: 'Планирует день' },
        { name: 'Агент', desc: 'Помощник в чате' }
      ],
      systems: [
        { name: 'CIFRA', desc: 'Калькулятор' },
        { name: 'FlowForge', desc: 'Схемы' },
        { name: 'Диаграммы', desc: 'Этот модуль' }
      ],
      links: [
        { from: 'Пользователь', to: 'Контур' },
        { from: 'Контур', to: 'Агент' },
        { from: 'Контур', to: 'Диаграммы' }
      ]
    });
    return base;
  }

  /* ─── SVG renderers ─── */
  function svgPie(doc) {
    const slices = (doc.slices || []).filter(s => +s.value > 0);
    const total = slices.reduce((a, s) => a + (+s.value || 0), 0) || 1;
    const cx = 120, cy = 120, r = 90;
    let a0 = -Math.PI / 2;
    const paths = slices.map((s, i) => {
      const a1 = a0 + (2 * Math.PI * (+s.value / total));
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
      a0 = a1;
      const col = s.color || ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#94a3b8'][i % 5];
      return `<path d="${d}" fill="${col}" stroke="rgba(0,0,0,.25)" stroke-width="1"><title>${esc(s.label)}: ${s.value}</title></path>`;
    }).join('');
    const legend = slices.map((s, i) => {
      const col = s.color || ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#94a3b8'][i % 5];
      const pct = Math.round(100 * s.value / total);
      return `<div class="dg-leg"><i style="background:${col}"></i><span>${esc(s.label)}</span><b>${pct}%</b></div>`;
    }).join('');
    return { svg: `<svg viewBox="0 0 240 240" class="dg-svg">${paths}</svg>`, legend };
  }

  function svgBar(doc) {
    const bars = doc.bars || [];
    const max = Math.max(1, ...bars.map(b => +b.value || 0));
    const w = 280, h = 160, pad = 28, gap = 8;
    const bw = bars.length ? (w - pad * 2 - gap * (bars.length - 1)) / bars.length : 20;
    const rects = bars.map((b, i) => {
      const bh = ((+b.value || 0) / max) * (h - pad * 2);
      const x = pad + i * (bw + gap);
      const y = h - pad - bh;
      return `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(2, bh)}" rx="4" fill="#6366f1" opacity=".9"/>
        <text x="${x + bw / 2}" y="${h - 8}" text-anchor="middle" font-size="10" fill="currentColor">${esc(b.label)}</text>
        <text x="${x + bw / 2}" y="${y - 4}" text-anchor="middle" font-size="10" fill="currentColor">${b.value}</text>`;
    }).join('');
    return { svg: `<svg viewBox="0 0 ${w} ${h}" class="dg-svg" style="color:var(--text,#e2e8f0)">${rects}</svg>`, legend: '' };
  }

  function svgBusy(doc) {
    const start = +doc.dayStart || 8, end = +doc.dayEnd || 22;
    const span = Math.max(1, end - start);
    const w = 320, h = 80 + (doc.blocks || []).length * 28;
    const blocks = (doc.blocks || []).map((b, i) => {
      const x = 40 + ((+b.start - start) / span) * (w - 50);
      const bw = Math.max(4, ((+b.end - +b.start) / span) * (w - 50));
      const y = 36 + i * 28;
      const col = b.kind === 'free' ? '#22c55e' : '#6366f1';
      return `<rect x="${x}" y="${y}" width="${bw}" height="20" rx="6" fill="${col}" opacity=".85"/>
        <text x="${x + 6}" y="${y + 14}" font-size="10" fill="#fff">${esc(b.label)} ${b.start}–${b.end}</text>`;
    }).join('');
    const axis = [];
    for (let h0 = start; h0 <= end; h0++) {
      const x = 40 + ((h0 - start) / span) * (w - 50);
      axis.push(`<text x="${x}" y="18" font-size="9" fill="currentColor" text-anchor="middle">${h0}</text>`);
    }
    return { svg: `<svg viewBox="0 0 ${w} ${h}" class="dg-svg" style="color:var(--text,#e2e8f0)">${axis.join('')}${blocks}</svg>`, legend: '<div class="dg-leg"><i style="background:#6366f1"></i>Занято <i style="background:#22c55e;margin-left:10px"></i>Свободно</div>' };
  }

  function svgState(doc) {
    const states = doc.states || [];
    const edges = doc.edges || [];
    const w = 320, h = 200;
    const n = states.length || 1;
    const positions = {};
    states.forEach((name, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      positions[name] = { x: 50 + col * 100, y: 40 + row * 70 };
    });
    const nodes = states.map(name => {
      const p = positions[name];
      return `<rect x="${p.x - 36}" y="${p.y - 16}" width="72" height="32" rx="10" fill="#1e293b" stroke="#6366f1" stroke-width="1.5"/>
        <text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="10" fill="#e2e8f0">${esc(name)}</text>`;
    }).join('');
    const lines = edges.map(e => {
      const a = positions[e.from], b = positions[e.to];
      if (!a || !b) return '';
      return `<line x1="${a.x}" y1="${a.y + 16}" x2="${b.x}" y2="${b.y - 16}" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#dg-arr)"/>
        <text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2}" font-size="9" fill="#94a3b8" text-anchor="middle">${esc(e.label || '')}</text>`;
    }).join('');
    return { svg: `<svg viewBox="0 0 ${w} ${h}" class="dg-svg"><defs><marker id="dg-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8"/></marker></defs>${lines}${nodes}</svg>`, legend: '' };
  }

  function svgJourney(doc) {
    const steps = doc.steps || [];
    const w = 320, h = 140;
    const n = Math.max(1, steps.length);
    const gap = (w - 40) / n;
    const pts = steps.map((s, i) => {
      const x = 20 + gap * i + gap / 2;
      const y = 100 - ((+s.emotion || 3) / 5) * 70;
      return { x, y, s };
    });
    const path = pts.map((p, i) => (i ? 'L' : 'M') + p.x + ',' + p.y).join(' ');
    const dots = pts.map(p =>
      `<circle cx="${p.x}" cy="${p.y}" r="8" fill="#6366f1"/>
       <text x="${p.x}" y="128" text-anchor="middle" font-size="9" fill="currentColor">${esc(p.s.name)}</text>`
    ).join('');
    return { svg: `<svg viewBox="0 0 ${w} ${h}" class="dg-svg" style="color:var(--text,#e2e8f0)"><path d="${path}" fill="none" stroke="#6366f1" stroke-width="2.5"/>${dots}</svg>`, legend: '' };
  }

  function svgC4(doc) {
    const w = 320, h = 220;
    const sys = doc.system || 'Система';
    let html = `<rect x="100" y="80" width="120" height="50" rx="12" fill="#312e81" stroke="#818cf8" stroke-width="2"/>
      <text x="160" y="110" text-anchor="middle" font-size="12" fill="#e2e8f0" font-weight="700">${esc(sys)}</text>`;
    (doc.actors || []).forEach((a, i) => {
      const x = 20 + i * 100;
      html += `<circle cx="${x + 30}" cy="30" r="14" fill="#0f172a" stroke="#22c55e"/><text x="${x + 30}" y="55" text-anchor="middle" font-size="9" fill="#e2e8f0">${esc(a.name)}</text>
        <line x1="${x + 30}" y1="44" x2="160" y2="80" stroke="#64748b" stroke-dasharray="4"/>`;
    });
    (doc.systems || []).forEach((s, i) => {
      const x = 30 + i * 95;
      html += `<rect x="${x}" y="160" width="80" height="36" rx="8" fill="#1e293b" stroke="#38bdf8"/><text x="${x + 40}" y="182" text-anchor="middle" font-size="9" fill="#e2e8f0">${esc(s.name)}</text>
        <line x1="160" y1="130" x2="${x + 40}" y2="160" stroke="#64748b"/>`;
    });
    return { svg: `<svg viewBox="0 0 ${w} ${h}" class="dg-svg">${html}</svg>`, legend: '' };
  }

  function render(doc) {
    if (!doc || !doc.type) doc = defaultDoc('pie');
    const map = { pie: svgPie, bar: svgBar, busy: svgBusy, state: svgState, journey: svgJourney, c4: svgC4 };
    const fn = map[doc.type] || svgPie;
    const { svg, legend } = fn(doc);
    return { svg, legend, html: cardHtml(doc, svg, legend) };
  }

  function cardHtml(doc, svg, legend) {
    return `<div class="o-glass-card o-dg-card" data-dg-id="${esc(doc.id || '')}">
      <div class="o-glass-h"><span>${esc(TYPES[doc.type] ? TYPES[doc.type].title : 'Диаграмма')}</span><em>${esc(doc.title || '')}</em></div>
      <div class="dg-preview">${svg}</div>
      <div class="dg-legend">${legend || ''}</div>
      <div class="o-m-b" style="padding:8px 12px 12px;display:flex;flex-wrap:wrap;gap:6px">
        <button type="button" class="o-chip" data-ag="tab:diagrams">Редактор</button>
        <button type="button" class="o-chip" data-ag="ag:dg-share">Поделиться</button>
      </div>
    </div>`;
  }

  function storeGet() {
    try {
      const raw = localStorage.getItem('contour-diagrams');
      return raw ? JSON.parse(raw) : { list: [] };
    } catch (e) { return { list: [] }; }
  }
  function storeSave(doc) {
    const st = storeGet();
    st.list = st.list || [];
    const i = st.list.findIndex(x => x.id === doc.id);
    doc.updated = Date.now();
    if (i >= 0) st.list[i] = doc; else st.list.unshift(doc);
    st.list = st.list.slice(0, 40);
    localStorage.setItem('contour-diagrams', JSON.stringify(st));
    O._lastDiagram = doc;
    return doc;
  }

  function parseQuick(text) {
    const n = String(text || '').toLowerCase().replace(/ё/g, 'е');
    if (/кругов|pie|доли|процент/.test(n)) return 'pie';
    if (/гист|столб|bar chart|bargraph/.test(n)) return 'bar';
    if (/занят|свободн|busy|timeline|загрузк/.test(n)) return 'busy';
    if (/состоян|state\s*machine|статусн/.test(n)) return 'state';
    if (/journey|путь\s*пользовател|user\s*flow|сценарий\s*пути/.test(n)) return 'journey';
    if (/\bc4\b|контекстн|context\s*diagram/.test(n)) return 'c4';
    if (/диаграм/.test(n)) return 'pie';
    return null;
  }

  function fromAgentText(text) {
    const type = parseQuick(text) || 'pie';
    const doc = defaultDoc(type);
    // try "A 30, B 70"
    const pairs = String(text).match(/([A-Za-zА-Яа-яЁё][^,:\d]{0,20})\s*[:=\s]\s*(\d+(?:[.,]\d+)?)/g);
    if (pairs && pairs.length >= 2 && (type === 'pie' || type === 'bar')) {
      const items = pairs.map(p => {
        const m = p.match(/(.+?)\s*[:=\s]\s*(\d+)/);
        return m ? { label: m[1].trim().slice(0, 24), value: +m[2] } : null;
      }).filter(Boolean);
      if (type === 'pie') doc.slices = items.map((x, i) => Object.assign(x, { color: ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#94a3b8'][i % 5] }));
      else doc.bars = items;
    }
    storeSave(doc);
    return doc;
  }

  O.diagrams = {
    TYPES,
    defaultDoc,
    render,
    storeGet,
    storeSave,
    parseQuick,
    fromAgentText,
    openEditor(type) {
      try {
        if (O.core && O.core().switchTab) O.core().switchTab('diagrams');
        const fr = document.getElementById('diagrams-frame');
        if (fr && fr.contentWindow) {
          setTimeout(() => {
            try { fr.contentWindow.postMessage({ t: 'dg-open', type: type || 'pie', doc: O._lastDiagram }, '*'); } catch (e) {}
          }, 200);
        }
      } catch (e) { console.error(e); }
    },
    cardFor(doc) {
      const r = render(doc);
      return r.html;
    }
  };
})();

/* Контур 4.5 · TOOLS — калькулятор (CIFRA Engine), графики SVG, схемы FlowForge */
(function () {
  const O = window.Orbit = window.Orbit || {};
  const T = O.tools = {};

  /* ─── Calculator via CIFRA Engine (loaded globally as Engine) ─── */
  T.calc = function (expr, deg) {
    const eng = window.Engine;
    if (!eng || typeof eng.calc !== 'function') {
      return { ok: false, error: 'Движок CIFRA не загружен' };
    }
    try {
      const raw = String(expr || '')
        .replace(/^=+|^=+$/g, '')
        .replace(/посчитай|вычисли|сколько\s*будет|равно/gi, '')
        .replace(/[×xх]/gi, '*')
        .replace(/[÷]/g, '/')
        .replace(/,/g, '.')
        .trim();
      if (!raw) return { ok: false, error: 'Пустое выражение' };
      const val = eng.calc(raw, deg !== false);
      const text = eng.fmt ? eng.fmt(val, 10, 'sp') : String(val);
      return { ok: true, value: val, text, expr: raw };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'Ошибка вычисления', expr: String(expr || '') };
    }
  };

  T.solve = function (eq) {
    const eng = window.Engine;
    if (!eng || typeof eng.solve !== 'function') return { ok: false, error: 'Решатель недоступен' };
    try {
      const r = eng.solve(String(eq).replace(/^=+/, '').trim(), true);
      return { ok: true, result: r, text: typeof r === 'object' ? JSON.stringify(r) : String(r) };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'Не решил' };
    }
  };

  /* ─── SVG graph y = f(x) ─── */
  T.graph = function (expr, opts) {
    opts = opts || {};
    const xmin = opts.xmin != null ? +opts.xmin : -10;
    const xmax = opts.xmax != null ? +opts.xmax : 10;
    const ymin = opts.ymin != null ? +opts.ymin : -10;
    const ymax = opts.ymax != null ? +opts.ymax : 10;
    const w = opts.w || 320, h = opts.h || 200;
    const pad = 28;
    const eng = window.Engine;
    let fn;
    if (eng && eng.fnOf) {
      try { fn = eng.fnOf(String(expr).replace(/^y\s*=\s*/i, '').trim(), true); }
      catch (e) { return { ok: false, error: 'Не разобрал функцию: ' + ((e && e.message) || '') }; }
    } else {
      return { ok: false, error: 'Движок графиков не загружен' };
    }
    const px = x => pad + ((x - xmin) / (xmax - xmin)) * (w - 2 * pad);
    const py = y => h - pad - ((y - ymin) / (ymax - ymin)) * (h - 2 * pad);
    const pts = [];
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const x = xmin + (i / steps) * (xmax - xmin);
      let y;
      try { y = fn(x); } catch (e) { y = NaN; }
      if (Number.isFinite(y) && y >= ymin - 50 && y <= ymax + 50) {
        pts.push((pts.length ? 'L' : 'M') + px(x).toFixed(1) + ',' + py(Math.max(ymin, Math.min(ymax, y))).toFixed(1));
      } else if (pts.length && !pts[pts.length - 1].endsWith('Z')) {
        pts.push(''); // gap
      }
    }
    const path = pts.filter(Boolean).join(' ');
    const axisX = py(0), axisY = px(0);
    const svg = `<svg class="o-graph" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px;background:#0f1220;border-radius:12px;border:1px solid rgba(255,255,255,.08)">
      <line x1="${pad}" y1="${axisX}" x2="${w - pad}" y2="${axisX}" stroke="#445" stroke-width="1"/>
      <line x1="${axisY}" y1="${pad}" x2="${axisY}" y2="${h - pad}" stroke="#445" stroke-width="1"/>
      <text x="${w - pad - 4}" y="${axisX - 4}" fill="#889" font-size="10">x</text>
      <text x="${axisY + 4}" y="${pad + 10}" fill="#889" font-size="10">y</text>
      <path d="${path}" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linejoin="round"/>
      <text x="${pad}" y="14" fill="#a78bfa" font-size="11" font-family="system-ui">y = ${String(expr).replace(/</g, '&lt;')}</text>
    </svg>`;
    return { ok: true, svg, expr: String(expr) };
  };

  /* ─── FlowForge diagram builder ─── */
  const TYPE_MAP = {
    старт: 'terminal', начало: 'terminal', конец: 'terminal', финиш: 'terminal',
    процесс: 'process', действие: 'process', шаг: 'process',
    условие: 'decision', если: 'decision', ветка: 'decision',
    ввод: 'io', вывод: 'io', данные: 'data',
    подпроцесс: 'sub', заметка: 'note', документ: 'doc',
    подготовка: 'prep', соединитель: 'conn'
  };

  /** Parse simple text recipe into flowforge JSON
   *  Formats:
   *   "схема: Старт -> Проверка -> Конец"
   *   "блок-схема: 1.Начало 2.Если x>0 3.Да:OK 4.Нет:FAIL 5.Конец"
   */
  T.buildScheme = function (text, title) {
    const raw = String(text || '').trim();
    const nodes = [], edges = [];
    let id = 0;
    const nid = () => 'n' + (++id);

    // Mermaid-ish: A --> B, A -->|Да| B
    if (/-->|flowchart|graph\s/i.test(raw) || /->/.test(raw)) {
      const lines = raw.replace(/^схем[аы]?\s*:?\s*/i, '').replace(/^блок[- ]?схем[аы]?\s*:?\s*/i, '').split(/[\n;]+/);
      const nameToId = {};
      const ensure = (label) => {
        const key = label.trim().toLowerCase();
        if (nameToId[key]) return nameToId[key];
        const idn = nid();
        nameToId[key] = idn;
        let type = 'process';
        const low = key;
        if (/старт|начало|start/.test(low)) type = 'terminal';
        else if (/конец|финиш|end/.test(low)) type = 'terminal';
        else if (/\?|если|услови|да\s*\?|нет\s*\?/.test(low)) type = 'decision';
        else if (/ввод|вывод|print|input/.test(low)) type = 'io';
        nodes.push({ id: idn, type, text: label.trim(), x: 80 + (nodes.length % 3) * 200, y: 60 + Math.floor(nodes.length / 3) * 120 });
        return idn;
      };
      const expand = line => { const segs = line.split(/\s*-+>\s*/); if (segs.length > 2 && !/\|/.test(line)) { const o = []; for (let i = 0; i < segs.length - 1; i++) o.push(segs[i] + ' -> ' + segs[i + 1]); return o; } return [line]; };
      lines.flatMap(expand).forEach(line => {
        line = line.trim();
        if (!line) return;
        const m = line.match(/^(.+?)\s*-+>\s*(?:\|([^|]+)\|\s*)?(.+)$/);
        if (m) {
          const a = ensure(m[1]), b = ensure(m[3]);
          const e = { id: 'e' + edges.length, from: a, to: b };
          if (m[2]) e.label = m[2].trim();
          edges.push(e);
        } else if (!/flowchart|graph/i.test(line)) {
          ensure(line);
        }
      });
    } else {
      // numbered list or comma/arrow chain
      const parts = raw
        .replace(/^схем[аы]?\s*:?\s*/i, '')
        .replace(/^блок[- ]?схем[аы]?\s*:?\s*/i, '')
        .replace(/^создай\s+(схему|блок-схему)\s*:?\s*/i, '')
        .split(/\s*(?:->|→|⇒|;|\n)\s*/)
        .map(s => s.replace(/^\d+[\).]\s*/, '').trim())
        .filter(Boolean);
      parts.forEach((p, i) => {
        let type = 'process';
        const low = p.toLowerCase();
        if (i === 0 || /старт|начало/.test(low)) type = 'terminal';
        if (i === parts.length - 1 || /конец|финиш/.test(low)) type = 'terminal';
        if (/\?|если|услови/.test(low)) type = 'decision';
        const idn = nid();
        nodes.push({ id: idn, type, text: p, x: 100 + (i % 4) * 180, y: 80 + Math.floor(i / 4) * 130 });
        if (i > 0) edges.push({ id: 'e' + i, from: nodes[i - 1].id, to: idn });
      });
    }

    if (!nodes.length) {
      // default demo
      nodes.push(
        { id: 'n1', type: 'terminal', text: 'Начало', x: 120, y: 40 },
        { id: 'n2', type: 'process', text: 'Действие', x: 120, y: 160 },
        { id: 'n3', type: 'terminal', text: 'Конец', x: 120, y: 280 }
      );
      edges.push({ id: 'e1', from: 'n1', to: 'n2' }, { id: 'e2', from: 'n2', to: 'n3' });
    }

    const doc = {
      format: 'flowforge',
      version: '2.8',
      camera: { x: 40, y: 20, zoom: 1 },
      nodes,
      edges,
      groups: []
    };
    const name = title || ('Схема · ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
    return { ok: true, doc, name, count: nodes.length };
  };

  /** Save scheme into FlowForge localStorage and open tab */
  T.openScheme = function (doc, name) {
    try {
      const pid = 'orbit_' + Date.now().toString(36);
      let PJ = {};
      try { PJ = JSON.parse(localStorage.getItem('ffProj') || '{}') || {}; } catch (e) { PJ = {}; }
      PJ[pid] = { n: name || 'Схема Орби', t: Date.now(), d: doc };
      localStorage.setItem('ffProj', JSON.stringify(PJ));
      // remember last for iframe
      localStorage.setItem('ffOrbitLoad', JSON.stringify({ pid, t: Date.now() }));
      try {
        let cfg = {};
        try { cfg = JSON.parse(localStorage.getItem('ffCfg') || '{}') || {}; } catch (e) {}
        cfg.pid = pid;
        localStorage.setItem('ffCfg', JSON.stringify(cfg));
      } catch (e) {}
    } catch (e) {
      return { ok: false, error: 'Не сохранил схему: ' + e.message };
    }
    // open tab + reload iframe
    if (O.actions && O.actions.go) O.actions.go('flow');
    setTimeout(() => {
      const fr = document.getElementById('flow-frame');
      if (fr) {
        const src = fr.getAttribute('src') || 'flowforge/index.html';
        fr.setAttribute('src', src.split('?')[0] + '?orbit=' + Date.now());
        fr.onload = function () {
          try {
            fr.contentWindow.postMessage({ type: 'orbit-load-scheme', doc: doc, name: name }, '*');
          } catch (e) {}
        };
      }
    }, 80);
    return { ok: true };
  };

  T.openCalc = function (expr) {
    if (O.inline) { O.inline.openCalc({ expr: expr || '' }); return; }
    if (O.actions && O.actions.go) O.actions.go('calc');
    setTimeout(() => {
      const fr = document.getElementById('cifra-frame');
      if (fr) {
        try {
          fr.contentWindow.postMessage({ type: 'orbit-calc', expr: expr || '' }, '*');
        } catch (e) {}
        if (expr) {
          try {
            fr.contentWindow.dispatchEvent(new CustomEvent('cifra-insert', { detail: expr }));
          } catch (e) {}
        }
      }
    }, 200);
  };

  T.helpTools = function () {
    return [
      '🧮 Калькулятор: «посчитай 2+2», «sqrt(16)», «sin(30)», «решi x^2-5x+6=0»',
      '📈 График: «график sin(x)», «нарисуй y=x^2 от -5 до 5»',
      '🔀 Схемы: «создай схему Старт -> Проверка -> Конец»',
      '   или: «схема: A ->|Да| B; A ->|Нет| C»',
      '📱 Открыть: «открой калькулятор», «открой схемы»'
    ].join('\n');
  };
})();

/* Контур 5 · БРЕНДЫ — рабочие пространства для IT и менеджеров */
(function () {
  const O = window.Orbit = window.Orbit || {};
  const BRANDS = {
    contour: {
      id: 'contour', name: 'Контур', tag: 'Рабочее пространство', agent: 'Кон', radius: 14, font: 'system',
      swatch: ['#6366f1', '#22d3ee'], hello: 'На связи', style: 'Индиго · стекло',
      d: { '--bg': '#07090f', '--bg-elevated': '#0c101c', '--bg-card': '#12182a', '--bg-card-hover': '#1a2238', '--text': '#eef2ff', '--text-muted': '#94a3b8', '--text-dim': '#64748b', '--accent': '#6366f1', '--accent-2': '#22d3ee', '--accent-3': '#f59e0b', '--on-accent': '#ffffff' },
      l: { '--bg': '#f1f5f9', '--bg-elevated': '#ffffff', '--bg-card': '#ffffff', '--bg-card-hover': '#f8fafc', '--text': '#0f172a', '--text-muted': '#475569', '--text-dim': '#94a3b8', '--accent': '#4f46e5', '--accent-2': '#0891b2', '--accent-3': '#d97706', '--on-accent': '#ffffff' }
    },
    pulse: {
      id: 'pulse', name: 'Пульс', tag: 'Ритм команды', agent: 'Пульс', radius: 20, font: 'rounded',
      swatch: ['#14b8a6', '#a3e635'], hello: 'Готов', style: 'Мята · мягко',
      d: { '--bg': '#041414', '--bg-elevated': '#0a1f1f', '--bg-card': '#0f2a2a', '--bg-card-hover': '#143636', '--text': '#e6fbf6', '--text-muted': '#7dd3c0', '--text-dim': '#4a7c72', '--accent': '#2dd4bf', '--accent-2': '#a3e635', '--accent-3': '#fb923c', '--on-accent': '#042f2e' },
      l: { '--bg': '#f0fdfa', '--bg-elevated': '#ffffff', '--bg-card': '#ffffff', '--bg-card-hover': '#f0fdfa', '--text': '#0a2a29', '--text-muted': '#3f6b66', '--text-dim': '#86aaa4', '--accent': '#0d9488', '--accent-2': '#65a30d', '--accent-3': '#ea580c', '--on-accent': '#ffffff' }
    },
    vector: {
      id: 'vector', name: 'Вектор', tag: 'Фокус и скорость', agent: 'Век', radius: 6, font: 'tech',
      swatch: ['#c6f432', '#38bdf8'], hello: 'Статус', style: 'Неон · sharp',
      d: { '--bg': '#09090b', '--bg-elevated': '#121214', '--bg-card': '#18181b', '--bg-card-hover': '#1f1f23', '--text': '#fafafa', '--text-muted': '#a1a1aa', '--text-dim': '#71717a', '--accent': '#c6f432', '--accent-2': '#38bdf8', '--accent-3': '#fb923c', '--on-accent': '#10130a' },
      l: { '--bg': '#f4f4f5', '--bg-elevated': '#ffffff', '--bg-card': '#ffffff', '--bg-card-hover': '#fafafa', '--text': '#18181b', '--text-muted': '#52525b', '--text-dim': '#a1a1aa', '--accent': '#65a30d', '--accent-2': '#0284c7', '--accent-3': '#ea580c', '--on-accent': '#ffffff' }
    },
    slate: {
      id: 'slate', name: 'Сланец', tag: 'Спокойная концентрация', agent: 'Слан', radius: 12, font: 'system',
      swatch: ['#94a3b8', '#38bdf8'], hello: 'Добрый день', style: 'Графит · спокойно',
      d: { '--bg': '#0c0e12', '--bg-elevated': '#141820', '--bg-card': '#1a1f2a', '--bg-card-hover': '#222836', '--text': '#e2e8f0', '--text-muted': '#94a3b8', '--text-dim': '#64748b', '--accent': '#94a3b8', '--accent-2': '#38bdf8', '--accent-3': '#fbbf24', '--on-accent': '#0c0e12' },
      l: { '--bg': '#f8fafc', '--bg-elevated': '#ffffff', '--bg-card': '#ffffff', '--bg-card-hover': '#f1f5f9', '--text': '#0f172a', '--text-muted': '#475569', '--text-dim': '#94a3b8', '--accent': '#475569', '--accent-2': '#0284c7', '--accent-3': '#d97706', '--on-accent': '#ffffff' }
    }
  };
  BRANDS.orbit = BRANDS.contour;
  BRANDS.ritm = BRANDS.pulse;
  BRANDS.vektor = BRANDS.vector;

  O.BRANDS = BRANDS;
  O.brands = BRANDS;
  /* список для экранов выбора — только основные стили, без алиасов старых версий */
  O.brandList = () => ['contour', 'pulse', 'vector', 'slate'].map(k => BRANDS[k]);
  O.ACCENTS = [['Индиго', '#6366f1'], ['Циан', '#22d3ee'], ['Бирюза', '#14b8a6'], ['Лайм', '#c6f432'], ['Небо', '#38bdf8'], ['Фиолетовый', '#8b5cf6'],
    ['Розовый', '#ec4899'], ['Коралл', '#f97316'], ['Красный', '#ef4444'], ['Янтарь', '#f59e0b'], ['Графит', '#94a3b8']];
  O.brand = function (id) {
    const st = O.settings ? O.settings() : {};
    let key = id || st.brand || 'contour';
    if (key === 'orbit') key = 'contour';
    if (key === 'ritm') key = 'pulse';
    if (key === 'vektor') key = 'vector';
    return BRANDS[key] || BRANDS.contour;
  };

  const hex2hsl = hex => {
    if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return null;
    let n = parseInt(hex.replace('#', ''), 16);
    let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l * 100];
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s * 100, l * 100];
  };
  const lum = hex => {
    if (!hex) return 0;
    let n = parseInt(String(hex).replace('#', ''), 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  };

  let logoSeq = 0;
  O.logo = function (id, size, a1, a2) {
    size = size || 28; const gid = 'kg' + (++logoSeq);
    a1 = a1 || '#6366f1'; a2 = a2 || '#22d3ee';
    return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="url(#${gid})"/>
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="64" y2="64"><stop stop-color="${a1}"/><stop offset="1" stop-color="${a2}"/></linearGradient></defs>
      <path d="M42 20.5a16 16 0 1 0 0 23" stroke="#fff" stroke-width="5.5" stroke-linecap="round" fill="none"/>
      <circle cx="44" cy="32" r="3.5" fill="#fff"/>
    </svg>`;
  };

  O.look = function (st) {
    st = st || (O.settings && O.settings()) || {};
    let brandKey = st.brand || 'contour';
    if (brandKey === 'orbit') brandKey = 'contour';
    if (brandKey === 'ritm') brandKey = 'pulse';
    if (brandKey === 'vektor') brandKey = 'vector';
    const R = document.documentElement, b = BRANDS[brandKey] || BRANDS.contour;
    let theme = st.theme || 'dark', skin = '';
    if (theme === 'auto') theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    if (theme === 'amoled') { theme = 'dark'; skin = 'amoled'; }
    R.setAttribute('data-theme', theme); R.setAttribute('data-skin', skin); R.setAttribute('data-brand', b.id);
    R.setAttribute('data-font', st.font && st.font !== 'system' ? st.font : b.font);
    const reduced = st.motion === 'reduced' || (st.motion === 'auto' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    R.setAttribute('data-motion', st.motion === 'off' ? 'off' : reduced ? 'reduced' : 'full');
    R.setAttribute('data-contrast', st.contrast === 'high' ? 'high' : 'normal');
    R.setAttribute('data-glass', st.glass === false ? 'off' : 'on');
    R.style.setProperty('--radius', ((st.radius && +st.radius !== 14) ? +st.radius : b.radius) + 'px');
    R.style.setProperty('--app-font-size', ((+st.fontSize || 16) * (+st.textScale || 100) / 100).toFixed(2) + 'px');
    const pal = theme === 'light' ? b.l : b.d;
    Object.keys(pal).forEach(k => R.style.setProperty(k, pal[k]));
    const hs = hex2hsl(st.accentCustom);
    if (hs) {
      const [h, s, l] = hs, a2 = `hsl(${(h + 42) % 360} ${Math.min(90, s)}% ${Math.max(48, l)}%)`;
      R.style.setProperty('--accent', st.accentCustom); R.style.setProperty('--accent-2', a2);
      R.style.setProperty('--on-accent', lum(st.accentCustom) > .6 ? '#10130a' : '#ffffff');
    } else ['--accent-2', '--on-accent'].forEach(k => { if (!(k in pal)) R.style.removeProperty(k); });
    document.title = b.name + ' — ' + b.tag;
    document.querySelectorAll('[data-brand-name]').forEach(e => { e.textContent = b.name; });
    document.querySelectorAll('[data-brand-tag]').forEach(e => { e.textContent = b.tag; });
    const cs = getComputedStyle(R), a1 = cs.getPropertyValue('--accent').trim() || b.swatch[0], a2c = cs.getPropertyValue('--accent-2').trim() || b.swatch[1];
    document.querySelectorAll('[data-brand-logo]').forEach(e => { e.innerHTML = O.logo(b.id, +e.dataset.brandLogo || 28, a1, a2c); });
    const fav = document.getElementById('o-favicon');
    if (fav) fav.href = 'data:image/svg+xml,' + encodeURIComponent(O.logo(b.id, 64, a1, a2c).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  };

  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (O.settings && O.settings().theme === 'auto') O.look();
  });
})();

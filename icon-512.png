/**
 * Utility & meta tools — expands the registry to 100+ functions.
 * Includes helpers, math, string, time, browser, agent meta.
 */

function makeEchoTools() {
  // Generate many small utility tools programmatically
  const list = [];
  const ops = [
    ['str_upper', 'Верхний регистр', s => String(s).toUpperCase()],
    ['str_lower', 'Нижний регистр', s => String(s).toLowerCase()],
    ['str_trim', 'Обрезать пробелы', s => String(s).trim()],
    ['str_len', 'Длина строки', s => String(s).length],
    ['str_reverse', 'Перевернуть строку', s => [...String(s)].reverse().join('')],
    ['str_slug', 'Slugify', s => String(s).toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '')],
    ['math_add', 'Сложить a+b', (a, b) => Number(a) + Number(b)],
    ['math_sub', 'Вычесть a-b', (a, b) => Number(a) - Number(b)],
    ['math_mul', 'Умножить', (a, b) => Number(a) * Number(b)],
    ['math_div', 'Делить', (a, b) => Number(b) === 0 ? null : Number(a) / Number(b)],
    ['math_round', 'Округлить', (n, d = 0) => +Number(n).toFixed(d)],
    ['math_abs', 'Модуль', n => Math.abs(Number(n))],
    ['math_min', 'Минимум', (a, b) => Math.min(Number(a), Number(b))],
    ['math_max', 'Максимум', (a, b) => Math.max(Number(a), Number(b))],
    ['arr_len', 'Длина массива', a => (Array.isArray(a) ? a.length : 0)],
    ['arr_unique', 'Уникальные', a => [...new Set(a || [])]],
    ['arr_join', 'Соединить массив', (a, sep = ', ') => (a || []).join(sep)],
    ['json_parse', 'Parse JSON', s => JSON.parse(s)],
    ['json_stringify', 'Stringify JSON', o => JSON.stringify(o, null, 2)],
    ['time_now', 'Текущее время ISO', () => new Date().toISOString()],
    ['time_unix', 'Unix timestamp', () => Math.floor(Date.now() / 1000)],
    ['uuid', 'Сгенерировать id', () => 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)],
    ['hash_simple', 'Простой хэш строки', s => {
      let h = 0;
      for (let i = 0; i < String(s).length; i++) h = (Math.imul(31, h) + String(s).charCodeAt(i)) | 0;
      return (h >>> 0).toString(36);
    }],
    ['bool_not', 'Логическое НЕ', v => !v],
    ['bool_and', 'Логическое И', (a, b) => !!(a && b)],
    ['bool_or', 'Логическое ИЛИ', (a, b) => !!(a || b)],
    ['clamp', 'Ограничить значение', (v, a, b) => Math.max(a, Math.min(b, Number(v)))],
    ['sleep_ms', 'Пауза (мс)', async (ms) => { await new Promise(r => setTimeout(r, Math.min(5000, Number(ms) || 0))); return { slept: ms }; }],
    ['browser_lang', 'Язык браузера', () => navigator.language],
    ['browser_online', 'Онлайн?', () => navigator.onLine],
    ['storage_get', 'localStorage get', k => localStorage.getItem(k)],
    ['storage_set', 'localStorage set', (k, v) => { localStorage.setItem(k, v); return true; }],
    ['storage_remove', 'localStorage remove', k => { localStorage.removeItem(k); return true; }],
    ['notify', 'Показать toast (если есть)', msg => {
      if (typeof toast === 'function') toast(String(msg));
      return { shown: true };
    }],
    ['log', 'Лог в консоль', msg => { console.log('[ForgeAgent]', msg); return true; }],
    ['type_of', 'Тип значения', v => typeof v],
    ['is_array', 'Это массив?', v => Array.isArray(v)],
    ['is_empty', 'Пустое?', v => v == null || v === '' || (Array.isArray(v) && !v.length)],
    ['coalesce', 'Первое непустое', (a, b) => a != null && a !== '' ? a : b],
    ['repeat', 'Повторить строку', (s, n) => String(s).repeat(Math.min(100, Number(n) || 1))],
    ['split', 'Разделить строку', (s, sep = ' ') => String(s).split(sep)],
    ['includes', 'Содержит?', (a, b) => String(a).includes(String(b))],
    ['starts_with', 'Начинается с?', (a, b) => String(a).startsWith(String(b))],
    ['ends_with', 'Заканчивается?', (a, b) => String(a).endsWith(String(b))],
    ['replace', 'Заменить', (s, a, b) => String(s).split(a).join(b)],
    ['num_parse', 'Parse float', s => parseFloat(s)],
    ['num_int', 'Parse int', s => parseInt(s, 10)],
    ['random', 'Случайное 0–1', () => Math.random()],
    ['random_int', 'Случайное целое [min,max]', (min, max) => Math.floor(Math.random() * (Number(max) - Number(min) + 1)) + Number(min)],
    ['base64_encode', 'Base64 encode', s => btoa(unescape(encodeURIComponent(String(s))))],
    ['base64_decode', 'Base64 decode', s => decodeURIComponent(escape(atob(s)))],
    ['url_encode', 'URL encode', s => encodeURIComponent(String(s))],
    ['url_decode', 'URL decode', s => decodeURIComponent(String(s))],
    ['object_keys', 'Ключи объекта', o => Object.keys(o || {})],
    ['object_values', 'Значения объекта', o => Object.values(o || {})],
    ['object_entries', 'Пары объекта', o => Object.entries(o || {})],
    ['pick', 'Взять поля объекта', (o, keys) => {
      const r = {};
      (keys || []).forEach(k => { if (o && k in o) r[k] = o[k]; });
      return r;
    }],
    ['omit', 'Исключить поля', (o, keys) => {
      const r = { ...(o || {}) };
      (keys || []).forEach(k => delete r[k]);
      return r;
    }],
    ['deep_clone', 'Глубокое клонирование', o => JSON.parse(JSON.stringify(o))],
    ['agent_version', 'Версия агента', () => '1.0.0'],
    ['agent_tool_count', 'Число инструментов', () => 100],
    ['agent_ping', 'Ping агента', () => ({ pong: true, ts: Date.now() })],
    ['list_providers', 'Список LLM-провайдеров', () => ['openai', 'anthropic', 'grok', 'deepseek', 'google', 'custom', 'local']],
    ['get_canvas_size', 'Размер холста', () => {
      const el = document.getElementById('cv');
      if (!el) return { w: 0, h: 0 };
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }],
    ['focus_agent_input', 'Фокус на поле ввода агента', () => {
      const el = document.getElementById('agentInput');
      if (el) el.focus();
      return { focused: !!el };
    }],
    ['scroll_to_bottom', 'Прокрутить чат вниз', () => {
      const el = document.getElementById('agentMessages');
      if (el) el.scrollTop = el.scrollHeight;
      return true;
    }],
  ];

  ops.forEach(([name, desc, fn]) => {
    list.push({
      name,
      description: desc,
      parameters: {
        type: 'object',
        properties: {
          a: { description: 'Первый аргумент / строка / значение' },
          b: { description: 'Второй аргумент' },
          n: { description: 'Число' },
          s: { description: 'Строка' },
          o: { description: 'Объект' },
          keys: { description: 'Массив ключей' },
          min: { type: 'number' },
          max: { type: 'number' },
          sep: { type: 'string' },
          d: { type: 'number' },
          ms: { type: 'number' },
          k: { type: 'string' },
          v: {},
          msg: { type: 'string' },
          text: { type: 'string' },
        },
      },
      execute: async (args = {}) => {
        // Flexible arg mapping
        const vals = [args.a ?? args.s ?? args.n ?? args.o ?? args.msg ?? args.text ?? args.k,
          args.b ?? args.v ?? args.sep ?? args.d ?? args.max ?? args.ms];
        try {
          const result = await fn(...vals.filter(x => x !== undefined), args);
          return result;
        } catch (e) {
          return { error: e.message };
        }
      },
    });
  });

  return list;
}

export const tools = [
  ...makeEchoTools(),
  {
    name: 'help',
    description: 'Краткая справка по возможностям агента',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({
      text: 'ForgeAgent: напишите задачу («построй схему входа», «улучши текущую схему», «проверь качество»). Подключите API-ключ в настройках агента для полной мощности. Локальный режим работает без ключа.',
    }),
  },
  {
    name: 'list_tools',
    description: 'Список имён всех инструментов (первые 50)',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      // Will be accurate at runtime via registry
      return { note: 'Используйте registry.count()', sample: tools.map(t => t.name).slice(0, 50) };
    },
  },
];

/** Analysis & quality tools */

import { QualityChecker } from '../quality/Checker.js';

const checker = new QualityChecker();

export const tools = [
  {
    name: 'quality_check',
    description: 'Проверить качество текущей схемы (0–1 + отчёт)',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Исходный запрос пользователя для оценки полноты' },
      },
    },
    execute: async ({ prompt }) => checker.checkCanvas(prompt || ''),
  },
  {
    name: 'quality_check_json',
    description: 'Проверить качество JSON-схемы без применения',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'string' },
        prompt: { type: 'string' },
      },
      required: ['json'],
    },
    execute: async ({ json, prompt }) => {
      const doc = typeof json === 'string' ? JSON.parse(json) : json;
      return checker.check(doc, prompt || '');
    },
  },
  {
    name: 'suggest_improvements',
    description: 'Предложить улучшения на основе quality report',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
      },
    },
    execute: async ({ prompt }) => {
      const report = checker.checkCanvas(prompt || '');
      return {
        overall: report.overall,
        label: report.label,
        fixes: checker.suggestFixes(report.report),
        summary: report.summary,
      };
    },
  },
  {
    name: 'detect_cycles',
    description: 'Найти циклы в графе схемы',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      if (typeof S === 'undefined') return { cycles: [] };
      const adj = new Map();
      S.nodes.forEach(n => adj.set(n.id, []));
      S.edges.forEach(e => {
        if (adj.has(e.from)) adj.get(e.from).push(e.to);
      });
      const cycles = [];
      const color = new Map(); // 0 white, 1 gray, 2 black
      const stack = [];
      function dfs(u) {
        color.set(u, 1);
        stack.push(u);
        for (const v of adj.get(u) || []) {
          if (color.get(v) === 1) {
            const idx = stack.indexOf(v);
            cycles.push(stack.slice(idx).concat(v));
          } else if (color.get(v) !== 2) dfs(v);
        }
        stack.pop();
        color.set(u, 2);
      }
      S.nodes.forEach(n => {
        if (!color.has(n.id)) dfs(n.id);
      });
      return { cycles: cycles.slice(0, 20), count: cycles.length };
    },
  },
  {
    name: 'find_unreachable',
    description: 'Найти узлы, недостижимые от стартовых terminal',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      if (typeof S === 'undefined') return { unreachable: [] };
      const starts = S.nodes.filter(n => n.type === 'terminal');
      if (!starts.length) return { unreachable: S.nodes.map(n => n.id), note: 'Нет terminal' };
      const adj = new Map(S.nodes.map(n => [n.id, []]));
      S.edges.forEach(e => {
        if (adj.has(e.from)) adj.get(e.from).push(e.to);
      });
      const seen = new Set();
      const q = starts.map(s => s.id);
      starts.forEach(s => seen.add(s.id));
      while (q.length) {
        const u = q.shift();
        for (const v of adj.get(u) || []) {
          if (!seen.has(v)) {
            seen.add(v);
            q.push(v);
          }
        }
      }
      const unreachable = S.nodes.filter(n => !seen.has(n.id)).map(n => ({ id: n.id, text: n.text }));
      return { unreachable, count: unreachable.length };
    },
  },
  {
    name: 'stats',
    description: 'Статистика схемы: типы, средняя длина текста, плотность',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      if (typeof S === 'undefined') return {};
      const types = {};
      let textLen = 0;
      S.nodes.forEach(n => {
        types[n.type] = (types[n.type] || 0) + 1;
        textLen += (n.text || '').length;
      });
      return {
        nodes: S.nodes.length,
        edges: S.edges.length,
        groups: (S.groups || []).length,
        types,
        avgTextLen: S.nodes.length ? Math.round(textLen / S.nodes.length) : 0,
        density: S.nodes.length > 1 ? +(S.edges.length / (S.nodes.length * (S.nodes.length - 1))).toFixed(3) : 0,
      };
    },
  },
  {
    name: 'validate_decisions',
    description: 'Проверить, что у всех decision есть Да/Нет',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      if (typeof S === 'undefined') return { issues: [] };
      const issues = [];
      const out = new Map();
      S.edges.forEach(e => {
        if (!out.has(e.from)) out.set(e.from, []);
        out.get(e.from).push(e);
      });
      S.nodes.filter(n => n.type === 'decision').forEach(d => {
        const outs = out.get(d.id) || [];
        if (outs.length < 2) issues.push({ id: d.id, problem: 'меньше 2 выходов' });
        const labels = outs.map(e => (e.label || '').toLowerCase());
        if (!labels.some(l => /да|yes/.test(l))) issues.push({ id: d.id, problem: 'нет метки Да' });
        if (!labels.some(l => /нет|no/.test(l))) issues.push({ id: d.id, problem: 'нет метки Нет' });
      });
      return { issues, ok: issues.length === 0 };
    },
  },
  {
    name: 'compare_to_prompt',
    description: 'Грубая оценка соответствия схемы запросу (по ключевым словам)',
    parameters: {
      type: 'object',
      properties: { prompt: { type: 'string' } },
      required: ['prompt'],
    },
    execute: async ({ prompt }) => {
      if (typeof S === 'undefined') return { coverage: 0 };
      const words = (prompt || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const texts = S.nodes.map(n => (n.text || '').toLowerCase()).join(' ');
      let hit = 0;
      words.forEach(w => {
        if (texts.includes(w)) hit++;
      });
      return {
        coverage: words.length ? +(hit / words.length).toFixed(2) : 1,
        matched: hit,
        totalKeywords: words.length,
      };
    },
  },
];
/** Individual validators for diagram quality */

import { validateFlowforge, isCoreType } from '../utils/jsonSchema.js';

export function validateSchema(doc) {
  const r = validateFlowforge(doc);
  return {
    name: 'schema',
    score: r.ok ? 1 : Math.max(0, 1 - r.errors.length * 0.15),
    ok: r.ok,
    details: r.errors,
  };
}

export function validateConnectivity(doc) {
  const nodes = doc.nodes || [];
  const edges = doc.edges || [];
  if (!nodes.length) return { name: 'connectivity', score: 0, ok: false, details: ['Нет узлов'] };

  const adj = new Map(nodes.map(n => [n.id, []]));
  edges.forEach(e => {
    if (adj.has(e.from)) adj.get(e.from).push(e.to);
    if (adj.has(e.to)) adj.get(e.to).push(e.from);
  });

  // BFS from first terminal or first node
  const start = nodes.find(n => n.type === 'terminal') || nodes[0];
  const seen = new Set();
  const q = [start.id];
  seen.add(start.id);
  while (q.length) {
    const id = q.shift();
    for (const nb of adj.get(id) || []) {
      if (!seen.has(nb)) {
        seen.add(nb);
        q.push(nb);
      }
    }
  }
  const orphanCount = nodes.length - seen.size;
  const score = 1 - orphanCount / nodes.length;
  return {
    name: 'connectivity',
    score: Math.max(0, score),
    ok: orphanCount === 0,
    details: orphanCount ? [`Несвязанных узлов: ${orphanCount}`] : ['Граф связный'],
  };
}

export function validateDecisionLabels(doc) {
  const decisions = (doc.nodes || []).filter(n => n.type === 'decision');
  if (!decisions.length) return { name: 'decisionLabels', score: 1, ok: true, details: ['Нет условий'] };

  const out = new Map();
  (doc.edges || []).forEach(e => {
    if (!out.has(e.from)) out.set(e.from, []);
    out.get(e.from).push(e);
  });

  let bad = 0;
  const details = [];
  decisions.forEach(d => {
    const outs = out.get(d.id) || [];
    if (outs.length < 2) {
      bad++;
      details.push(`${d.id}: меньше 2 исходящих`);
    }
    const labels = outs.map(e => (e.label || '').toLowerCase());
    const hasYes = labels.some(l => /да|yes|true|1/.test(l));
    const hasNo = labels.some(l => /нет|no|false|0/.test(l));
    if (!hasYes || !hasNo) {
      bad += 0.5;
      details.push(`${d.id}: нет меток Да/Нет`);
    }
  });
  const score = Math.max(0, 1 - bad / decisions.length);
  return { name: 'decisionLabels', score, ok: bad === 0, details: details.length ? details : ['Все условия корректны'] };
}

export function validateTextQuality(doc) {
  const nodes = doc.nodes || [];
  if (!nodes.length) return { name: 'textQuality', score: 0, ok: false, details: [] };
  let score = 1;
  const details = [];
  nodes.forEach(n => {
    const t = (n.text || '').trim();
    if (!t) {
      score -= 0.15;
      details.push(`${n.id}: пустой текст`);
    } else if (t.length > 120) {
      score -= 0.05;
      details.push(`${n.id}: слишком длинный текст`);
    } else if (t.length < 2) {
      score -= 0.08;
    }
  });
  return { name: 'textQuality', score: Math.max(0, score), ok: score > 0.7, details };
}

export function validateNoOrphans(doc) {
  const nodes = doc.nodes || [];
  const edges = doc.edges || [];
  const connected = new Set();
  edges.forEach(e => {
    connected.add(e.from);
    connected.add(e.to);
  });
  const orphans = nodes.filter(n => !connected.has(n.id) && nodes.length > 1);
  const score = nodes.length <= 1 ? 1 : 1 - orphans.length / nodes.length;
  return {
    name: 'noOrphans',
    score: Math.max(0, score),
    ok: orphans.length === 0,
    details: orphans.length ? orphans.map(o => o.id) : ['Нет сирот'],
  };
}

export function validateTypeCorrectness(doc) {
  const nodes = doc.nodes || [];
  let good = 0;
  nodes.forEach(n => {
    if (isCoreType(n.type) || (typeof n.type === 'string' && n.type.length > 0)) good++;
  });
  const score = nodes.length ? good / nodes.length : 0;
  return { name: 'typeCorrectness', score, ok: score === 1, details: [] };
}

export function validateCompleteness(doc, userPrompt = '') {
  // Heuristic: number of nodes vs prompt length / keywords
  const nodes = doc.nodes || [];
  const edges = doc.edges || [];
  const promptLen = (userPrompt || '').length;
  const expectedMin = promptLen > 200 ? 6 : promptLen > 80 ? 4 : 2;
  let score = 1;
  const details = [];
  if (nodes.length < expectedMin) {
    score -= 0.3;
    details.push(`Мало блоков (${nodes.length}), ожидалось ≥${expectedMin}`);
  }
  if (edges.length < nodes.length - 1 && nodes.length > 1) {
    score -= 0.2;
    details.push('Мало связей');
  }
  const hasStart = nodes.some(n => n.type === 'terminal' && /нач|start|begin/i.test(n.text || ''));
  if (!hasStart && nodes.length > 2) {
    score -= 0.1;
    details.push('Нет явного начала');
  }
  return { name: 'completeness', score: Math.max(0, score), ok: score > 0.6, details };
}

export function validateLayoutHint(doc) {
  // No coords required; just presence of groups for complex diagrams
  const nodes = doc.nodes || [];
  const groups = doc.groups || [];
  let score = 0.8;
  if (nodes.length > 12 && groups.length === 0) {
    score = 0.5;
  } else if (groups.length > 0) score = 1;
  return { name: 'layoutHint', score, ok: true, details: [] };
}
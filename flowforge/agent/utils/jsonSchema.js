/** Lightweight FlowForge JSON schema helpers */

export const FLOWFORGE_SCHEMA = {
  type: 'object',
  required: ['format', 'nodes'],
  properties: {
    format: { const: 'flowforge' },
    version: { type: 'string' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'type', 'text'],
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          text: { type: 'string' },
          color: { type: 'string' },
          ck: { type: 'array' },
          done: { type: 'boolean' },
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          label: { type: 'string' },
          route: { type: 'string' },
          dash: { type: 'string' },
          arrow: { type: 'string' },
          color: { type: 'string' },
        },
      },
    },
    groups: { type: 'array' },
  },
};

const CORE_TYPES = new Set([
  'terminal', 'process', 'decision', 'io', 'data', 'sub', 'note',
  'doc', 'prep', 'conn', 'manual', 'check',
]);

export function validateFlowforge(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object') {
    return { ok: false, errors: ['Документ не объект'] };
  }
  if (doc.format !== 'flowforge') {
    errors.push('format должен быть "flowforge"');
  }
  if (!Array.isArray(doc.nodes) || !doc.nodes.length) {
    errors.push('nodes пуст или отсутствует');
  }
  const ids = new Set();
  (doc.nodes || []).forEach((n, i) => {
    if (!n.id) errors.push(`nodes[${i}]: нет id`);
    if (ids.has(n.id)) errors.push(`Дубликат id: ${n.id}`);
    ids.add(n.id);
    if (!n.type) errors.push(`nodes[${i}]: нет type`);
    if (typeof n.text !== 'string') errors.push(`nodes[${i}]: text должен быть строкой`);
  });
  (doc.edges || []).forEach((e, i) => {
    if (!e.from || !e.to) errors.push(`edges[${i}]: нет from/to`);
    if (e.from && !ids.has(e.from)) errors.push(`edges[${i}]: from ${e.from} не существует`);
    if (e.to && !ids.has(e.to)) errors.push(`edges[${i}]: to ${e.to} не существует`);
  });
  return { ok: errors.length === 0, errors };
}

export function isCoreType(t) {
  return CORE_TYPES.has(t);
}
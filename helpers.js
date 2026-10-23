/**
 * Diagram manipulation tools (FlowForge canvas)
 * Accesses global S, addNode, addEdge, layout, draw, importText, etc.
 */

function ensureGlobals() {
  if (typeof S === 'undefined') throw new Error('Canvas state S not available');
}

function getDoc() {
  ensureGlobals();
  return {
    format: 'flowforge',
    version: '2.8',
    nodes: S.nodes.map(n => ({
      id: n.id, type: n.type, text: n.text, color: n.color,
      x: n.x, y: n.y, w: n.w, h: n.h, ck: n.ck, done: n.done,
    })),
    edges: S.edges.map(e => ({
      from: e.from, to: e.to, label: e.label, route: e.route,
      dash: e.dash, arrow: e.arrow, color: e.color, width: e.width,
    })),
    groups: JSON.parse(JSON.stringify(S.groups || [])),
  };
}

export const tools = [
  {
    name: 'get_diagram',
    description: 'Получить текущую схему как JSON FlowForge',
    parameters: { type: 'object', properties: {} },
    execute: async () => getDoc(),
  },
  {
    name: 'clear_diagram',
    description: 'Очистить всю схему',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      ensureGlobals();
      S.nodes = [];
      S.edges = [];
      S.groups = [];
      if (typeof draw === 'function') draw();
      if (typeof save === 'function') save();
      return { cleared: true };
    },
  },
  {
    name: 'apply_json',
    description: 'Применить JSON схемы (FlowForge или Mermaid) к холсту. Полностью заменяет текущую схему.',
    parameters: {
      type: 'object',
      properties: {
        json: { type: 'string', description: 'JSON или Mermaid текст' },
      },
      required: ['json'],
    },
    execute: async ({ json }) => {
      if (typeof importText !== 'function') throw new Error('importText unavailable');
      const ok = importText(typeof json === 'string' ? json : JSON.stringify(json));
      if (typeof layout === 'function') layout();
      if (typeof fit === 'function') fit();
      return { applied: !!ok, nodes: S.nodes.length, edges: S.edges.length };
    },
  },
  {
    name: 'add_node',
    description: 'Добавить один блок на схему',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'terminal|process|decision|io|data|sub|note|doc|prep|conn|manual|check' },
        text: { type: 'string' },
        color: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['type'],
    },
    execute: async ({ type, text, color, x, y }) => {
      ensureGlobals();
      const n = addNode(type || 'process', x ?? 100 + S.nodes.length * 30, y ?? 100 + S.nodes.length * 20, text, color);
      if (typeof draw === 'function') draw();
      if (typeof save === 'function') save();
      return { id: n.id, type: n.type, text: n.text };
    },
  },
  {
    name: 'add_edge',
    description: 'Соединить два блока',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        label: { type: 'string' },
      },
      required: ['from', 'to'],
    },
    execute: async ({ from, to, label }) => {
      ensureGlobals();
      const e = addEdge(from, to, label);
      if (typeof draw === 'function') draw();
      if (typeof save === 'function') save();
      return e ? { id: e.id, from, to, label } : { error: 'Edge not created (duplicate or invalid)' };
    },
  },
  {
    name: 'update_node_text',
    description: 'Изменить текст блока',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['id', 'text'],
    },
    execute: async ({ id, text }) => {
      ensureGlobals();
      const n = S.nodes.find(x => x.id === id);
      if (!n) throw new Error('Node not found: ' + id);
      n.text = text;
      if (typeof dim === 'function') dim(n);
      if (typeof draw === 'function') draw();
      if (typeof save === 'function') save();
      return { id, text };
    },
  },
  {
    name: 'set_node_type',
    description: 'Сменить тип блока',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string' },
      },
      required: ['id', 'type'],
    },
    execute: async ({ id, type }) => {
      ensureGlobals();
      const n = S.nodes.find(x => x.id === id);
      if (!n) throw new Error('Node not found');
      n.type = type;
      if (typeof dim === 'function') dim(n);
      if (typeof draw === 'function') draw();
      if (typeof save === 'function') save();
      return { id, type };
    },
  },
  {
    name: 'delete_node',
    description: 'Удалить блок и связанные рёбра',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    execute: async ({ id }) => {
      ensureGlobals();
      S.nodes = S.nodes.filter(n => n.id !== id);
      S.edges = S.edges.filter(e => e.from !== id && e.to !== id);
      if (typeof draw === 'function') draw();
      if (typeof save === 'function') save();
      return { deleted: id };
    },
  },
  {
    name: 'delete_edge',
    description: 'Удалить связь',
    parameters: {
      type: 'object',
      properties: { from: { type: 'string' }, to: { type: 'string' } },
      required: ['from', 'to'],
    },
    execute: async ({ from, to }) => {
      ensureGlobals();
      const before = S.edges.length;
      S.edges = S.edges.filter(e => !(e.from === from && e.to === to));
      if (typeof draw === 'function') draw();
      if (typeof save === 'function') save();
      return { removed: before - S.edges.length };
    },
  },
  {
    name: 'auto_layout',
    description: 'Автоматическая раскладка схемы (TB или LR)',
    parameters: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['TB', 'LR'] },
      },
    },
    execute: async ({ direction }) => {
      ensureGlobals();
      if (typeof layout === 'function') layout(direction || 'TB');
      if (typeof fit === 'function') fit();
      if (typeof draw === 'function') draw();
      return { layout: direction || 'TB', nodes: S.nodes.length };
    },
  },
  {
    name: 'fit_view',
    description: 'Подогнать вид под всю схему',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      if (typeof fit === 'function') fit();
      return { fitted: true };
    },
  },
  {
    name: 'undo',
    description: 'Отменить последнее действие',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      if (typeof undo === 'function') undo();
      else if (typeof ACT?.undo === 'function') ACT.undo();
      return { undone: true };
    },
  },
  {
    name: 'redo',
    description: 'Повторить отменённое',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      if (typeof redo === 'function') redo();
      else if (typeof ACT?.redo === 'function') ACT.redo();
      return { redone: true };
    },
  },
  {
    name: 'select_nodes',
    description: 'Выделить узлы по id',
    parameters: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['ids'],
    },
    execute: async ({ ids }) => {
      ensureGlobals();
      if (typeof sel !== 'undefined') {
        sel.clear();
        ids.forEach(id => sel.add(id));
      }
      if (typeof draw === 'function') draw();
      return { selected: ids };
    },
  },
  {
    name: 'add_group',
    description: 'Создать группу блоков',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        nodeIds: { type: 'array', items: { type: 'string' } },
        color: { type: 'string' },
      },
      required: ['title', 'nodeIds'],
    },
    execute: async ({ title, nodeIds, color }) => {
      ensureGlobals();
      const g = {
        id: 'g' + Date.now().toString(36),
        title,
        nodes: nodeIds,
        color: color || '#89b4fa',
      };
      S.groups = S.groups || [];
      S.groups.push(g);
      if (typeof draw === 'function') draw();
      if (typeof save === 'function') save();
      return g;
    },
  },
  {
    name: 'set_edge_label',
    description: 'Установить метку связи',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        label: { type: 'string' },
      },
      required: ['from', 'to', 'label'],
    },
    execute: async ({ from, to, label }) => {
      ensureGlobals();
      const e = S.edges.find(x => x.from === from && x.to === to);
      if (!e) throw new Error('Edge not found');
      e.label = label;
      if (typeof draw === 'function') draw();
      if (typeof save === 'function') save();
      return { from, to, label };
    },
  },
  {
    name: 'count_elements',
    description: 'Посчитать узлы и рёбра',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      ensureGlobals();
      return { nodes: S.nodes.length, edges: S.edges.length, groups: (S.groups || []).length };
    },
  },
  {
    name: 'list_node_ids',
    description: 'Список id всех узлов с типами и текстами',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      ensureGlobals();
      return S.nodes.map(n => ({ id: n.id, type: n.type, text: n.text }));
    },
  },
  {
    name: 'find_nodes_by_text',
    description: 'Найти узлы по подстроке текста',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    execute: async ({ query }) => {
      ensureGlobals();
      const q = (query || '').toLowerCase();
      return S.nodes.filter(n => (n.text || '').toLowerCase().includes(q)).map(n => ({ id: n.id, type: n.type, text: n.text }));
    },
  },
  {
    name: 'duplicate_selection',
    description: 'Дублировать выделенные блоки',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      if (typeof ACT?.dup === 'function') ACT.dup();
      else throw new Error('dup unavailable');
      return { duplicated: true };
    },
  },
  // --- more atomic tools to reach high count ---
  {
    name: 'set_node_color',
    description: 'Установить цвет блока',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' }, color: { type: 'string' } },
      required: ['id', 'color'],
    },
    execute: async ({ id, color }) => {
      ensureGlobals();
      const n = S.nodes.find(x => x.id === id);
      if (!n) throw new Error('Node not found');
      n.color = color;
      if (typeof draw === 'function') draw();
      if (typeof save === 'function') save();
      return { id, color };
    },
  },
  {
    name: 'add_checklist_item',
    description: 'Добавить пункт чек-листа к блоку check',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' }, text: { type: 'string' } },
      required: ['id', 'text'],
    },
    execute: async ({ id, text }) => {
      ensureGlobals();
      const n = S.nodes.find(x => x.id === id);
      if (!n) throw new Error('Node not found');
      if (!n.ck) n.ck = [];
      n.ck.push({ t: text, d: false });
      if (typeof draw === 'function') draw();
      return { id, items: n.ck.length };
    },
  },
  {
    name: 'toggle_checklist_item',
    description: 'Переключить пункт чек-листа',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' }, index: { type: 'number' } },
      required: ['id', 'index'],
    },
    execute: async ({ id, index }) => {
      ensureGlobals();
      const n = S.nodes.find(x => x.id === id);
      if (!n?.ck?.[index]) throw new Error('Item not found');
      n.ck[index].d = !n.ck[index].d;
      if (typeof draw === 'function') draw();
      return { id, index, done: n.ck[index].d };
    },
  },
  {
    name: 'set_edge_style',
    description: 'Стиль связи: route, dash, arrow, color, width',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        route: { type: 'string' },
        dash: { type: 'string' },
        arrow: { type: 'string' },
        color: { type: 'string' },
        width: { type: 'number' },
      },
      required: ['from', 'to'],
    },
    execute: async (args) => {
      ensureGlobals();
      const e = S.edges.find(x => x.from === args.from && x.to === args.to);
      if (!e) throw new Error('Edge not found');
      ['route', 'dash', 'arrow', 'color', 'width'].forEach(k => {
        if (args[k] != null) e[k] = args[k];
      });
      if (typeof draw === 'function') draw();
      if (typeof save === 'function') save();
      return { from: args.from, to: args.to };
    },
  },
  {
    name: 'move_node',
    description: 'Переместить блок',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } },
      required: ['id', 'x', 'y'],
    },
    execute: async ({ id, x, y }) => {
      ensureGlobals();
      const n = S.nodes.find(x => x.id === id);
      if (!n) throw new Error('Node not found');
      n.x = x;
      n.y = y;
      if (typeof draw === 'function') draw();
      return { id, x, y };
    },
  },
  {
    name: 'get_selected',
    description: 'Получить выделенные узлы',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      ensureGlobals();
      const ids = typeof sel !== 'undefined' ? [...sel] : [];
      return ids.map(id => {
        const n = S.nodes.find(x => x.id === id);
        return n ? { id: n.id, type: n.type, text: n.text } : { id };
      });
    },
  },
  {
    name: 'zoom_in',
    description: 'Приблизить',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      if (typeof zoomC === 'function') zoomC(1.2);
      return { zoom: 'in' };
    },
  },
  {
    name: 'zoom_out',
    description: 'Отдалить',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      if (typeof zoomC === 'function') zoomC(1 / 1.2);
      return { zoom: 'out' };
    },
  },
  {
    name: 'set_background',
    description: 'Сменить фон: dark|light|blue|paper|none',
    parameters: {
      type: 'object',
      properties: { theme: { type: 'string' } },
      required: ['theme'],
    },
    execute: async ({ theme }) => {
      if (typeof cfg !== 'undefined') {
        cfg.bg = theme;
        if (typeof cfgSave === 'function') cfgSave();
        if (typeof draw === 'function') draw();
      }
      return { bg: theme };
    },
  },
];
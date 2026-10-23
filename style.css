/** High-level generation helpers (used by agent planning) */

export const tools = [
  {
    name: 'build_linear_process',
    description: 'Построить линейную схему из списка шагов',
    parameters: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Список текстов шагов',
        },
        withStartEnd: { type: 'boolean' },
      },
      required: ['steps'],
    },
    execute: async ({ steps, withStartEnd = true }) => {
      const nodes = [];
      const edges = [];
      let i = 1;
      if (withStartEnd) {
        nodes.push({ id: 'n' + i, type: 'terminal', text: 'Начало' });
        i++;
      }
      steps.forEach((text, idx) => {
        const id = 'n' + i;
        nodes.push({ id, type: 'process', text });
        if (nodes.length > 1) {
          edges.push({ from: nodes[nodes.length - 2].id, to: id });
        }
        i++;
      });
      if (withStartEnd) {
        const id = 'n' + i;
        nodes.push({ id, type: 'terminal', text: 'Конец' });
        edges.push({ from: nodes[nodes.length - 2].id, to: id });
      }
      return { format: 'flowforge', version: '2.8', nodes, edges };
    },
  },
  {
    name: 'build_decision_branch',
    description: 'Построить ветвление: условие + Да/Нет ветки',
    parameters: {
      type: 'object',
      properties: {
        condition: { type: 'string' },
        yesSteps: { type: 'array', items: { type: 'string' } },
        noSteps: { type: 'array', items: { type: 'string' } },
      },
      required: ['condition'],
    },
    execute: async ({ condition, yesSteps = ['Действие Да'], noSteps = ['Действие Нет'] }) => {
      const nodes = [
        { id: 'n1', type: 'terminal', text: 'Начало' },
        { id: 'n2', type: 'decision', text: condition },
      ];
      const edges = [{ from: 'n1', to: 'n2' }];
      let i = 3;
      let lastYes = 'n2';
      yesSteps.forEach(t => {
        const id = 'n' + i++;
        nodes.push({ id, type: 'process', text: t });
        edges.push({ from: lastYes, to: id, label: lastYes === 'n2' ? 'Да' : undefined });
        lastYes = id;
      });
      let lastNo = 'n2';
      noSteps.forEach(t => {
        const id = 'n' + i++;
        nodes.push({ id, type: 'process', text: t });
        edges.push({ from: lastNo, to: id, label: lastNo === 'n2' ? 'Нет' : undefined });
        lastNo = id;
      });
      const end = 'n' + i;
      nodes.push({ id: end, type: 'terminal', text: 'Конец' });
      edges.push({ from: lastYes, to: end });
      edges.push({ from: lastNo, to: end });
      return { format: 'flowforge', version: '2.8', nodes, edges };
    },
  },
  {
    name: 'merge_diagrams',
    description: 'Объединить два JSON схем (узлы + рёбра, переименовать id)',
    parameters: {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'string' },
      },
      required: ['a', 'b'],
    },
    execute: async ({ a, b }) => {
      const A = typeof a === 'string' ? JSON.parse(a) : a;
      const B = typeof b === 'string' ? JSON.parse(b) : b;
      const map = new Map();
      let c = 1;
      const nodes = [];
      const edges = [];
      (A.nodes || []).forEach(n => {
        const id = 'n' + c++;
        map.set(n.id, id);
        nodes.push({ ...n, id });
      });
      (B.nodes || []).forEach(n => {
        const id = 'n' + c++;
        map.set('b_' + n.id, id);
        nodes.push({ ...n, id });
      });
      (A.edges || []).forEach(e => {
        edges.push({ ...e, from: map.get(e.from), to: map.get(e.to) });
      });
      (B.edges || []).forEach(e => {
        edges.push({
          ...e,
          from: map.get('b_' + e.from),
          to: map.get('b_' + e.to),
        });
      });
      return { format: 'flowforge', version: '2.8', nodes, edges };
    },
  },
  {
    name: 'template_login',
    description: 'Готовый шаблон «Авторизация»',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({
      format: 'flowforge',
      version: '2.8',
      nodes: [
        { id: 'n1', type: 'terminal', text: 'Старт' },
        { id: 'n2', type: 'io', text: 'Ввод логина/пароля' },
        { id: 'n3', type: 'process', text: 'Проверка' },
        { id: 'n4', type: 'decision', text: 'Успех?' },
        { id: 'n5', type: 'process', text: 'Создать сессию' },
        { id: 'n6', type: 'io', text: 'Показать ошибку' },
        { id: 'n7', type: 'terminal', text: 'Вход выполнен' },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' },
        { from: 'n4', to: 'n5', label: 'Да' },
        { from: 'n4', to: 'n6', label: 'Нет' },
        { from: 'n5', to: 'n7' },
        { from: 'n6', to: 'n2' },
      ],
    }),
  },
  {
    name: 'template_crud',
    description: 'Шаблон CRUD-операций',
    parameters: {
      type: 'object',
      properties: { entity: { type: 'string' } },
    },
    execute: async ({ entity = 'запись' }) => ({
      format: 'flowforge',
      version: '2.8',
      nodes: [
        { id: 'n1', type: 'terminal', text: 'Начало' },
        { id: 'n2', type: 'decision', text: `Операция с ${entity}?` },
        { id: 'n3', type: 'process', text: `Создать ${entity}` },
        { id: 'n4', type: 'process', text: `Прочитать ${entity}` },
        { id: 'n5', type: 'process', text: `Обновить ${entity}` },
        { id: 'n6', type: 'process', text: `Удалить ${entity}` },
        { id: 'n7', type: 'terminal', text: 'Конец' },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3', label: 'Create' },
        { from: 'n2', to: 'n4', label: 'Read' },
        { from: 'n2', to: 'n5', label: 'Update' },
        { from: 'n2', to: 'n6', label: 'Delete' },
        { from: 'n3', to: 'n7' },
        { from: 'n4', to: 'n7' },
        { from: 'n5', to: 'n7' },
        { from: 'n6', to: 'n7' },
      ],
    }),
  },
];
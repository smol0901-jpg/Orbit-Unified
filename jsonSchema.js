/** Export / serialization tools */

export const tools = [
  {
    name: 'export_json',
    description: 'Экспортировать схему в JSON-строку',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      if (typeof ser === 'function') return { json: JSON.stringify(ser(true), null, 2) };
      if (typeof S === 'undefined') return { json: '{}' };
      const doc = {
        format: 'flowforge',
        version: '2.8',
        nodes: S.nodes.map(n => ({ id: n.id, type: n.type, text: n.text, color: n.color, ck: n.ck })),
        edges: S.edges.map(e => ({ from: e.from, to: e.to, label: e.label })),
        groups: S.groups || [],
      };
      return { json: JSON.stringify(doc, null, 2) };
    },
  },
  {
    name: 'export_mermaid',
    description: 'Экспортировать в Mermaid flowchart',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      if (typeof S === 'undefined') return { mermaid: 'flowchart TD' };
      const lines = ['flowchart TD'];
      S.nodes.forEach(n => {
        const shape =
          n.type === 'decision' ? `{${n.text}}` :
          n.type === 'terminal' ? `([${n.text}])` :
          n.type === 'io' ? `[/${n.text}/]` :
          `[${n.text}]`;
        lines.push(`  ${n.id}${shape}`);
      });
      S.edges.forEach(e => {
        const lab = e.label ? `|${e.label}|` : '';
        lines.push(`  ${e.from} -->${lab} ${e.to}`);
      });
      return { mermaid: lines.join('\n') };
    },
  },
  {
    name: 'copy_to_clipboard',
    description: 'Скопировать текст в буфер обмена',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
    execute: async ({ text }) => {
      await navigator.clipboard.writeText(text);
      return { copied: true, length: text.length };
    },
  },
  {
    name: 'download_json',
    description: 'Скачать схему как .json файл',
    parameters: {
      type: 'object',
      properties: { filename: { type: 'string' } },
    },
    execute: async ({ filename }) => {
      let json;
      if (typeof ser === 'function') json = JSON.stringify(ser(true), null, 2);
      else {
        const r = await tools.find(t => t.name === 'export_json').execute({});
        json = r.json;
      }
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename || 'flowforge-diagram.json';
      a.click();
      URL.revokeObjectURL(a.href);
      return { downloaded: true };
    },
  },
  {
    name: 'export_summary_md',
    description: 'Краткое описание схемы в Markdown',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      if (typeof S === 'undefined') return { md: '' };
      const lines = [
        `# Схема (${S.nodes.length} блоков, ${S.edges.length} связей)`,
        '',
        '## Блоки',
      ];
      S.nodes.forEach(n => lines.push(`- **${n.id}** (${n.type}): ${n.text}`));
      lines.push('', '## Связи');
      S.edges.forEach(e => lines.push(`- ${e.from} → ${e.to}${e.label ? ` [${e.label}]` : ''}`));
      return { md: lines.join('\n') };
    },
  },
];
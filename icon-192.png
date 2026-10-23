/**
 * Tool registry — 100+ functions for the agent.
 * Grouped for maintainability. Each tool has name, description, parameters, execute.
 */

import * as diagram from './diagram.js';
import * as analysis from './analysis.js';
import * as generation from './generation.js';
import * as exportTools from './export.js';
import * as utilTools from './utils.js';

const ALL = [
  ...diagram.tools,
  ...analysis.tools,
  ...generation.tools,
  ...exportTools.tools,
  ...utilTools.tools,
];

export class ToolRegistry {
  constructor() {
    this.map = new Map();
    ALL.forEach(t => this.map.set(t.name, t));
  }

  list() {
    return [...this.map.values()];
  }

  get(name) {
    return this.map.get(name);
  }

  /** OpenAI-style tools schema */
  toOpenAITools() {
    return this.list().map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters || { type: 'object', properties: {} },
      },
    }));
  }

  async execute(name, args = {}) {
    const tool = this.map.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    try {
      const result = await tool.execute(args);
      return { ok: true, result };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  count() {
    return this.map.size;
  }
}

export function createRegistry() {
  return new ToolRegistry();
}
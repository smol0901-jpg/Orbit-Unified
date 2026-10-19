/** Executes tool calls from LLM or plan */

export class Executor {
  constructor(registry, onEvent) {
    this.registry = registry;
    this.onEvent = onEvent || (() => {});
  }

  async runTool(name, args = {}) {
    this.onEvent({ type: 'tool_start', name, args });
    const result = await this.registry.execute(name, args);
    this.onEvent({ type: 'tool_end', name, result });
    return result;
  }

  async runToolCalls(toolCalls) {
    const results = [];
    for (const tc of toolCalls || []) {
      const name = tc.function?.name || tc.name;
      let args = {};
      try {
        args = typeof tc.function?.arguments === 'string'
          ? JSON.parse(tc.function.arguments || '{}')
          : (tc.function?.arguments || tc.arguments || {});
      } catch {
        args = {};
      }
      const res = await this.runTool(name, args);
      results.push({
        tool_call_id: tc.id,
        name,
        ...res,
      });
    }
    return results;
  }
}
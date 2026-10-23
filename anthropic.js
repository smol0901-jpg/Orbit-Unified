/** Chain-of-Thought / verbal reasoning helper */

export class Thinker {
  constructor() {
    this.steps = [];
  }

  reset() {
    this.steps = [];
  }

  think(text) {
    const step = { type: 'think', text: String(text), ts: Date.now() };
    this.steps.push(step);
    return step;
  }

  plan(steps) {
    const step = { type: 'plan', steps: Array.isArray(steps) ? steps : [steps], ts: Date.now() };
    this.steps.push(step);
    return step;
  }

  observe(text) {
    const step = { type: 'observe', text: String(text), ts: Date.now() };
    this.steps.push(step);
    return step;
  }

  decide(text) {
    const step = { type: 'decide', text: String(text), ts: Date.now() };
    this.steps.push(step);
    return step;
  }

  getTrace() {
    return this.steps.map(s => {
      if (s.type === 'plan') return `📋 План:\n${s.steps.map((x, i) => `  ${i + 1}. ${x}`).join('\n')}`;
      if (s.type === 'observe') return `👁 Наблюдение: ${s.text}`;
      if (s.type === 'decide') return `✅ Решение: ${s.text}`;
      return `💭 ${s.text}`;
    }).join('\n\n');
  }

  /** Extract <thinking>...</thinking> or similar from LLM text */
  static extractThinking(content) {
    if (!content) return { thinking: '', answer: content || '' };
    const m = content.match(/<thinking>([\s\S]*?)<\/thinking>/i)
      || content.match(/💭\s*([\s\S]*?)(?=\n\n|$)/);
    if (m) {
      return {
        thinking: m[1].trim(),
        answer: content.replace(m[0], '').trim(),
      };
    }
    // Split first paragraph as thinking if long
    const parts = content.split(/\n\n+/);
    if (parts.length > 1 && parts[0].length > 40) {
      return { thinking: parts[0], answer: parts.slice(1).join('\n\n') };
    }
    return { thinking: '', answer: content };
  }
}
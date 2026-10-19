/**
 * ForgeAgent — main autonomous agent
 * Planning → Thinking → Tool use → Quality → Reflect → Retry (capped)
 */

import { SYSTEM_PROMPT, DEFAULTS, AGENT_VERSION } from '../config.js';
import { LLMRouter } from '../llm/LLMRouter.js';
import { createRegistry } from '../tools/registry.js';
import { Memory } from '../memory/Memory.js';
import { SessionStore } from '../memory/SessionStore.js';
import { Thinker } from './Thinker.js';
import { Planner } from './Planner.js';
import { Executor } from './Executor.js';
import { Reflector } from './Reflector.js';
import { extractJson, estimateTokens } from '../utils/helpers.js';

export class Agent {
  constructor(options = {}) {
    this.llm = new LLMRouter();
    this.registry = createRegistry();
    this.memory = new Memory();
    this.sessions = new SessionStore();
    this.thinker = new Thinker();
    this.planner = new Planner(this.registry);
    this.executor = new Executor(this.registry, (e) => this.emit(e));
    this.reflector = new Reflector(DEFAULTS.qualityThreshold);
    this.listeners = new Set();
    this.abort = null;
    this.sessionId = null;
    this.options = { ...DEFAULTS, ...options };
    this._busy = false;
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(event) {
    this.listeners.forEach(fn => {
      try { fn(event); } catch { /* */ }
    });
  }

  getToolCount() {
    return this.registry.count();
  }

  getVersion() {
    return AGENT_VERSION;
  }

  cancel() {
    if (this.abort) {
      try { this.abort.abort(); } catch { /* */ }
    }
    this._busy = false;
  }

  async run(userText, opts = {}) {
    if (this._busy) {
      this.emit({ type: 'status', text: 'Уже выполняется…' });
      return { busy: true };
    }
    this._busy = true;
    this.abort = new AbortController();
    this.thinker.reset();
    const autoApply = opts.autoApply ?? this.options.autoApply;
    const isLocal = (this.llm.getProvider()?.id === 'local') || !this.llm.getApiKey();

    try {
      if (!this.sessionId) {
        const s = this.sessions.create(userText.slice(0, 40));
        this.sessionId = s.id;
      }

      this.memory.addMessage('user', userText);
      this.emit({ type: 'user', text: userText });
      this.emit({ type: 'status', text: 'Думаю…' });

      const plan = this.planner.heuristicPlan(userText);
      this.thinker.plan(plan.map(p => `${p.action} — ${p.reason}`));
      this.emit({ type: 'thinking', text: this.thinker.getTrace() });

      // Local path: fast, no retry loop freeze
      if (isLocal) {
        return await this._runLocal(userText, autoApply);
      }

      return await this._runLLM(userText, autoApply, plan);
    } finally {
      this._busy = false;
    }
  }

  async _runLocal(userText, autoApply) {
    this.emit({ type: 'status', text: 'Локальный режим…' });
    let streamed = '';
    const response = await this.llm.chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
      onChunk: (c) => {
        streamed += c;
        this.emit({ type: 'stream', text: streamed });
      },
    });

    const content = response.content || streamed || '';
    const { thinking, answer } = Thinker.extractThinking(content);
    if (thinking) this.emit({ type: 'thinking', text: thinking });

    let applied = false;
    const json = extractJson(content);
    if (json && json.format === 'flowforge' && autoApply) {
      this.emit({ type: 'status', text: 'Применяю схему…' });
      const res = await this.registry.execute('apply_json', { json: JSON.stringify(json) });
      if (res.ok) {
        applied = true;
        await this.registry.execute('auto_layout', { direction: 'TB' });
        await this.registry.execute('fit_view', {});
      }
    }

    // One quality check only — no retry loop
    this.emit({ type: 'status', text: 'Проверка качества…' });
    const quality = await this.reflector.reflect(userText);
    this.emit({ type: 'quality', data: quality });

    const finalAnswer = answer || content || (applied
      ? `Схема построена (локальный режим). Качество: ${Math.round((quality.overall || 0) * 100)}%.`
      : content);

    this.memory.addMessage('assistant', finalAnswer);
    this.sessions.addMessage(this.sessionId, { role: 'assistant', content: finalAnswer, quality });
    this.emit({ type: 'done', text: finalAnswer, applied, quality, steps: 1 });
    this.emit({ type: 'status', text: applied ? 'Схема применена' : 'Готово' });
    return { answer: finalAnswer, applied, quality, steps: 1 };
  }

  async _runLLM(userText, autoApply, plan) {
    const tools = this.registry.toOpenAITools();
    const messages = [
      {
        role: 'system',
        content:
          SYSTEM_PROMPT +
          `\n\nДоступно инструментов: ${this.registry.count()}. Версия: ${AGENT_VERSION}.` +
          `\nПлан:\n${this.planner.formatForPrompt(plan)}`,
      },
      ...this.memory.getContext(10).map(m => ({ role: m.role, content: m.content })),
    ];

    try {
      const doc = await this.registry.execute('get_diagram', {});
      if (doc.ok && doc.result?.nodes?.length) {
        messages.push({
          role: 'system',
          content: `Текущая схема (${doc.result.nodes.length} блоков):\n${JSON.stringify(doc.result).slice(0, 2500)}`,
        });
      }
    } catch { /* */ }

    let finalAnswer = '';
    let applied = false;
    let quality = null;
    let steps = 0;
    // Cap retries hard — prevents UI freeze
    const maxSteps = Math.min(this.options.maxSteps || 12, 8);
    const maxRetries = 2;
    let retries = 0;

    while (steps < maxSteps) {
      if (this.abort?.signal?.aborted) {
        this.emit({ type: 'status', text: 'Отменено' });
        return { cancelled: true };
      }
      steps++;
      this.emit({ type: 'status', text: `Шаг ${steps}/${maxSteps}…` });

      let response;
      try {
        let streamed = '';
        response = await this.llm.chat({
          messages,
          tools,
          signal: this.abort.signal,
          onChunk: (chunk) => {
            streamed += chunk;
            this.emit({ type: 'stream', text: streamed });
          },
        });
      } catch (err) {
        if (err.name === 'AbortError') {
          this.emit({ type: 'status', text: 'Отменено' });
          return { cancelled: true };
        }
        this.emit({ type: 'error', text: err.message });
        // One local fallback, then stop
        return await this._runLocal(userText, autoApply);
      }

      const content = response.content || '';
      const { thinking, answer } = Thinker.extractThinking(content);
      if (thinking) {
        this.thinker.think(thinking);
        this.emit({ type: 'thinking', text: thinking });
      }

      if (response.tool_calls?.length) {
        this.emit({ type: 'status', text: `Инструменты: ${response.tool_calls.length}…` });
        const results = await this.executor.runToolCalls(response.tool_calls);
        messages.push({
          role: 'assistant',
          content: content || null,
          tool_calls: response.tool_calls,
        });
        for (const r of results) {
          messages.push({
            role: 'tool',
            tool_call_id: r.tool_call_id,
            content: JSON.stringify(r.ok ? r.result : { error: r.error }),
          });
          if (r.name === 'apply_json' && r.ok) applied = true;
        }
        continue;
      }

      finalAnswer = answer || content;
      const json = extractJson(content);
      if (json && json.format === 'flowforge' && autoApply && !applied) {
        this.emit({ type: 'status', text: 'Применяю схему…' });
        const res = await this.registry.execute('apply_json', { json: JSON.stringify(json) });
        if (res.ok) {
          applied = true;
          await this.registry.execute('auto_layout', { direction: 'TB' });
          await this.registry.execute('fit_view', {});
        }
      }

      this.emit({ type: 'status', text: 'Проверка качества…' });
      quality = await this.reflector.reflect(userText);
      this.emit({ type: 'quality', data: quality });

      if (quality.needsRetry && retries < maxRetries && steps < maxSteps - 1) {
        retries++;
        this.thinker.observe(`Качество ${quality.quality}: ${quality.summary}`);
        this.emit({ type: 'thinking', text: this.thinker.getTrace() });
        messages.push({ role: 'assistant', content: finalAnswer });
        messages.push({
          role: 'user',
          content: `Качество: ${quality.quality} (${quality.label}). Проблемы: ${quality.summary}. Исправь: ${(quality.fixes || []).join('; ')}. Верни улучшенный JSON flowforge.`,
        });
        continue;
      }
      break;
    }

    this.memory.addMessage('assistant', finalAnswer);
    this.sessions.addMessage(this.sessionId, { role: 'assistant', content: finalAnswer, quality });
    this.emit({ type: 'done', text: finalAnswer, applied, quality, steps });
    this.emit({ type: 'status', text: applied ? 'Схема применена' : 'Готово' });
    return {
      answer: finalAnswer,
      applied,
      quality,
      steps,
      tokensApprox: estimateTokens(messages.map(m => m.content || '').join('')),
    };
  }
}

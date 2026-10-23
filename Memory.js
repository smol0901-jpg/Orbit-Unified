/** Routes requests to the correct provider */

import { PROVIDERS, DEFAULTS } from '../config.js';
import { chatOpenAI } from './providers/openai.js';
import { chatAnthropic } from './providers/anthropic.js';
import { chatLocal } from './providers/local.js';
import { lsGet } from '../utils/helpers.js';
import { STORAGE_KEYS } from '../config.js';

export class LLMRouter {
  constructor() {
    this.settings = lsGet(STORAGE_KEYS.settings, {
      provider: 'local',
      model: 'rules-v1',
      temperature: DEFAULTS.temperature,
      maxTokens: DEFAULTS.maxTokens,
      stream: DEFAULTS.stream,
      customBaseUrl: '',
    });
    this.keys = lsGet(STORAGE_KEYS.keys, {});
  }

  getProvider() {
    return PROVIDERS[this.settings.provider] || PROVIDERS.local;
  }

  getApiKey() {
    return this.keys[this.settings.provider] || '';
  }

  setProvider(id, model) {
    if (!PROVIDERS[id]) throw new Error('Unknown provider: ' + id);
    this.settings.provider = id;
    this.settings.model = model || PROVIDERS[id].defaultModel;
    this.persist();
  }

  setKey(providerId, key) {
    this.keys[providerId] = key;
    try {
      localStorage.setItem(STORAGE_KEYS.keys, JSON.stringify(this.keys));
    } catch { /* quota */ }
  }

  setSettings(patch) {
    Object.assign(this.settings, patch);
    this.persist();
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(this.settings));
    } catch { /* */ }
  }

  async chat({ messages, tools, onChunk, signal }) {
    const prov = this.getProvider();
    const model = this.settings.model || prov.defaultModel;
    const apiKey = this.getApiKey();
    const temperature = this.settings.temperature ?? DEFAULTS.temperature;
    const maxTokens = this.settings.maxTokens ?? DEFAULTS.maxTokens;
    const stream = this.settings.stream ?? DEFAULTS.stream;

    if (prov.id === 'local' || !apiKey) {
      return chatLocal({ messages, onChunk });
    }

    if (prov.id === 'anthropic') {
      return chatAnthropic({
        apiKey,
        model,
        messages,
        tools,
        temperature,
        maxTokens,
        stream,
        onChunk,
        signal,
      });
    }

    // OpenAI-compatible (openai, grok, deepseek, custom, google via proxy if needed)
    let baseUrl = prov.baseUrl;
    if (prov.id === 'custom') {
      baseUrl = this.settings.customBaseUrl || baseUrl;
    }
    if (prov.id === 'google') {
      // Gemini uses different endpoint; simplified: treat as OpenAI-compatible if user proxies
      baseUrl = this.settings.customBaseUrl || baseUrl;
    }

    return chatOpenAI({
      baseUrl,
      apiKey,
      model,
      messages,
      tools,
      temperature,
      maxTokens,
      stream,
      onChunk,
      signal,
    });
  }
}
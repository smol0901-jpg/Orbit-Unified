/**
 * FlowForge Agent — configuration
 * Versioned, extensible. Edit providers, limits, quality thresholds here.
 */
export const AGENT_VERSION = '1.1.0';
export const AGENT_NAME = 'ForgeAgent';

export const DEFAULTS = {
  maxSteps: 24,
  maxTokens: 4096,
  temperature: 0.35,
  topP: 0.9,
  timeoutMs: 90000,
  retryAttempts: 2,
  qualityThreshold: 0.72,
  autoApply: true,
  showThinking: true,
  stream: true,
  memoryLimit: 40,
  costWarnUsd: 0.05,
};

/** Supported LLM providers (OpenAI-compatible + Anthropic + xAI + custom) */
export const PROVIDERS = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini'],
    defaultModel: 'gpt-4o-mini',
    authHeader: 'Bearer',
    supportsTools: true,
    supportsStream: true,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-latest', 'claude-opus-4-20250514'],
    defaultModel: 'claude-sonnet-4-20250514',
    authHeader: 'x-api-key',
    supportsTools: true,
    supportsStream: true,
  },
  grok: {
    id: 'grok',
    name: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    models: ['grok-3', 'grok-3-mini', 'grok-2'],
    defaultModel: 'grok-3-mini',
    authHeader: 'Bearer',
    supportsTools: true,
    supportsStream: true,
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    authHeader: 'Bearer',
    supportsTools: true,
    supportsStream: true,
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    defaultModel: 'gemini-2.0-flash',
    authHeader: 'key',
    supportsTools: true,
    supportsStream: true,
  },
  custom: {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    baseUrl: '',
    models: ['custom'],
    defaultModel: 'custom',
    authHeader: 'Bearer',
    supportsTools: true,
    supportsStream: true,
  },
  local: {
    id: 'local',
    name: 'Local (offline rules + templates)',
    baseUrl: null,
    models: ['rules-v1'],
    defaultModel: 'rules-v1',
    authHeader: null,
    supportsTools: false,
    supportsStream: false,
  },
};

export const SYSTEM_PROMPT = `Ты — ForgeAgent, автономный агент конструктора блок-схем FlowForge Studio.

Цель: по тексту пользователя построить или улучшить корректную блок-схему.

Понимание запроса:
- Выдели суть процесса (кто/что делает, решения, вводы-выводы, ошибки).
- Если пользователь перечисляет шаги — сохрани порядок.
- Типичные сценарии: вход/регистрация, оплата, заказ, CRUD, поддержка, API, согласование, онбординг, ETL.
- Если схема уже есть на холсте и просят «улучши/проверь» — сначала проанализируй, потом правь.

Действия:
1. Кратко подумай (thinking): цель, структура, риски.
2. Сгенерируй JSON format:"flowforge" ИЛИ вызови инструменты (apply_json, add_node, quality_check…).
3. У decision всегда ≥2 исходящих с метками «Да»/«Нет» (или Yes/No).
4. Координаты x,y не нужны — раскладка автоматическая.
5. После генерации — quality_check; при низком качестве исправь один раз.
6. Отвечай на языке пользователя. В конце — кратко, что сделано.

Типы блоков: terminal, process, decision, io, data, sub, note, doc, prep, conn, manual, check.

Формат ответа с схемой:
\`\`\`json
{"format":"flowforge","version":"2.8","nodes":[...],"edges":[...]}
\`\`\`
`;

export const QUALITY_WEIGHTS = {
  schema: 0.20,
  connectivity: 0.18,
  decisionLabels: 0.12,
  textQuality: 0.12,
  completeness: 0.15,
  layoutHint: 0.08,
  noOrphans: 0.10,
  typeCorrectness: 0.05,
};

export const STORAGE_KEYS = {
  settings: 'ffAgentSettings',
  memory: 'ffAgentMemory',
  sessions: 'ffAgentSessions',
  keys: 'ffAgentKeys', // encrypted-ish (base64, not real crypto)
};
# ⚡ ForgeAgent — модуль автономного агента для FlowForge Studio

Супер-продвинутый клиентский агент с цепочкой рассуждений (chain-of-thought), tool-calling, проверкой качества и поддержкой любых LLM через API.

Работает **полностью статически** на **GitHub Pages** и **Netlify** (без backend).

## Структура (20+ файлов)

```
agent/
├── index.js                 # Точка входа, авто-инициализация
├── config.js                # Версия, провайдеры, промпты, веса качества
├── core/
│   ├── Agent.js             # Главный цикл: план → LLM → tools → quality → reflect
│   ├── Planner.js           # Эвристический + LLM-планировщик
│   ├── Executor.js          # Выполнение tool calls
│   ├── Thinker.js           # Chain-of-thought / verbal reasoning
│   └── Reflector.js         # Самооценка и retry
├── llm/
│   ├── LLMRouter.js         # Маршрутизация к провайдерам
│   └── providers/
│       ├── openai.js        # OpenAI-compatible (Grok, DeepSeek, custom)
│       ├── anthropic.js     # Claude
│       └── local.js         # Встроенный offline «мозг» (шаблоны + правила)
├── tools/
│   ├── registry.js          # Реестр 100+ функций
│   ├── diagram.js           # Манипуляции схемой (add/delete/layout/…)
│   ├── analysis.js          # Quality, cycles, stats, decisions
│   ├── generation.js        # Шаблоны и конструкторы схем
│   ├── export.js            # JSON / Mermaid / download
│   └── utils.js             # 60+ утилитарных функций (строки, math, storage…)
├── quality/
│   ├── Checker.js           # Высокоуровневая проверка
│   ├── scorer.js            # Агрегированный score
│   └── validators.js        # schema, connectivity, labels, text, orphans…
├── memory/
│   ├── Memory.js            # Short + long-term memory
│   └── SessionStore.js      # История сессий
├── ui/
│   ├── AgentPanel.js        # Панель, FAB, голос
│   ├── ChatUI.js            # Сообщения, streaming, thinking
│   └── SettingsUI.js        # API keys, provider, model
└── utils/
    ├── helpers.js
    └── jsonSchema.js
```

## Как улучшить модуль

1. **Новый инструмент** — добавьте объект `{ name, description, parameters, execute }` в нужный файл `tools/*.js`. Реестр подхватит автоматически.
2. **Новый провайдер LLM** — файл в `llm/providers/`, зарегистрируйте в `config.js` → `PROVIDERS` и в `LLMRouter.js`.
3. **Новая проверка качества** — функция в `quality/validators.js`, вес в `config.js` → `QUALITY_WEIGHTS`, вызов в `scorer.js`.
4. **Улучшить планирование** — расширьте `Planner.heuristicPlan` или добавьте structured output от LLM.
5. **Локальный режим** — обогатите шаблоны в `providers/local.js`.
6. **UI** — стили в `css/style.css` (классы `.agent-*`), разметка в `AgentPanel.js`.
7. **Память** — `Memory.rememberFact` / `searchFacts` для долгосрочного контекста.
8. **Голос** — уже есть Web Speech API; можно добавить TTS.
9. **Мульти-агент** — клонируйте `Agent` с разными system prompt и координируйте.
10. **Тесты** — добавьте `agent/tests/` с node-совместимыми unit-тестами для validators/scorer.

## 10+ пунктов качества и необходимого

### Проверка качества
1. Schema validation (format, nodes, edges)
2. Connectivity / связность графа
3. Decision labels (Да/Нет)
4. Text quality (длина, пустота)
5. No orphans
6. Type correctness
7. Completeness vs prompt
8. Layout hint (группы для больших схем)
9. Cycle detection (tool)
10. Unreachable nodes (tool)

### Необходимо добавлено
1. Floating action button (⚡)
2. Боковая панель чата
3. Streaming ответов
4. Визуализация thinking
5. Tool-call индикация
6. Quality badge после генерации
7. Настройки API (localStorage)
8. Голосовой ввод (ru-RU)
9. Быстрые подсказки (hints)
10. Авто-layout + fit после apply
11. Сессии и история
12. Отмена (AbortController)
13. Локальный fallback без ключа
14. Поддержка 6+ провайдеров
15. Экспорт JSON/Mermaid из агента

## Подключение API

Откройте ⚡ → ⚙️ → выберите провайдер → вставьте ключ → Сохранить → Проверить.

Ключи **никогда** не уходят на сторонний сервер FlowForge — только на выбранный вами API endpoint.

## Лицензия

MIT — как и основное приложение.
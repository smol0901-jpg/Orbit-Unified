/**
 * Local offline brain — expanded template + intent base.
 * Improves understanding without external API.
 */

function node(id, type, text) {
  return { id, type, text };
}
function edge(from, to, label) {
  const e = { from, to };
  if (label) e.label = label;
  return e;
}
function doc(nodes, edges, groups) {
  const o = { format: 'flowforge', version: '2.8', nodes, edges };
  if (groups?.length) o.groups = groups;
  return o;
}

const TEMPLATES = {
  simple(topic) {
    return doc(
      [
        node('n1', 'terminal', 'Начало'),
        node('n2', 'process', `Обработать: ${topic}`),
        node('n3', 'decision', 'Успешно?'),
        node('n4', 'process', 'Завершить успешно'),
        node('n5', 'process', 'Обработать ошибку'),
        node('n6', 'terminal', 'Конец'),
      ],
      [
        edge('n1', 'n2'), edge('n2', 'n3'),
        edge('n3', 'n4', 'Да'), edge('n3', 'n5', 'Нет'),
        edge('n4', 'n6'), edge('n5', 'n6'),
      ]
    );
  },

  login() {
    return doc(
      [
        node('n1', 'terminal', 'Старт'),
        node('n2', 'io', 'Ввод логина и пароля'),
        node('n3', 'process', 'Проверка учётных данных'),
        node('n4', 'decision', 'Верные данные?'),
        node('n5', 'process', 'Создать сессию'),
        node('n6', 'io', 'Показать ошибку'),
        node('n7', 'terminal', 'Вход выполнен'),
      ],
      [
        edge('n1', 'n2'), edge('n2', 'n3'), edge('n3', 'n4'),
        edge('n4', 'n5', 'Да'), edge('n4', 'n6', 'Нет'),
        edge('n5', 'n7'), edge('n6', 'n2'),
      ]
    );
  },

  register() {
    return doc(
      [
        node('n1', 'terminal', 'Начало регистрации'),
        node('n2', 'io', 'Ввод email, пароля, имени'),
        node('n3', 'process', 'Валидация полей'),
        node('n4', 'decision', 'Данные корректны?'),
        node('n5', 'process', 'Проверка уникальности email'),
        node('n6', 'decision', 'Email свободен?'),
        node('n7', 'process', 'Создать аккаунт'),
        node('n8', 'process', 'Отправить письмо подтверждения'),
        node('n9', 'io', 'Показать ошибки формы'),
        node('n10', 'io', 'Email уже занят'),
        node('n11', 'terminal', 'Регистрация завершена'),
      ],
      [
        edge('n1', 'n2'), edge('n2', 'n3'), edge('n3', 'n4'),
        edge('n4', 'n5', 'Да'), edge('n4', 'n9', 'Нет'),
        edge('n5', 'n6'), edge('n6', 'n7', 'Да'), edge('n6', 'n10', 'Нет'),
        edge('n7', 'n8'), edge('n8', 'n11'),
        edge('n9', 'n2'), edge('n10', 'n2'),
      ]
    );
  },

  payment() {
    return doc(
      [
        node('n1', 'terminal', 'Начало оплаты'),
        node('n2', 'process', 'Сформировать заказ'),
        node('n3', 'io', 'Выбор способа оплаты'),
        node('n4', 'process', 'Создать платёж в шлюзе'),
        node('n5', 'decision', 'Оплата успешна?'),
        node('n6', 'process', 'Подтвердить заказ'),
        node('n7', 'process', 'Отправить чек клиенту'),
        node('n8', 'process', 'Отменить / вернуть в корзину'),
        node('n9', 'io', 'Показать ошибку оплаты'),
        node('n10', 'terminal', 'Заказ оплачен'),
        node('n11', 'terminal', 'Оплата не прошла'),
      ],
      [
        edge('n1', 'n2'), edge('n2', 'n3'), edge('n3', 'n4'), edge('n4', 'n5'),
        edge('n5', 'n6', 'Да'), edge('n5', 'n8', 'Нет'),
        edge('n6', 'n7'), edge('n7', 'n10'),
        edge('n8', 'n9'), edge('n9', 'n11'),
      ],
      [{ id: 'g1', title: 'Оплата', color: '#89b4fa', nodes: ['n3', 'n4', 'n5'] }]
    );
  },

  order() {
    return doc(
      [
        node('n1', 'terminal', 'Новый заказ'),
        node('n2', 'io', 'Корзина / состав заказа'),
        node('n3', 'process', 'Проверить наличие товаров'),
        node('n4', 'decision', 'Всё в наличии?'),
        node('n5', 'io', 'Адрес и способ доставки'),
        node('n6', 'process', 'Рассчитать стоимость'),
        node('n7', 'process', 'Оплата'),
        node('n8', 'decision', 'Оплачено?'),
        node('n9', 'process', 'Резерв и передача на сборку'),
        node('n10', 'io', 'Сообщить об отсутствии'),
        node('n11', 'terminal', 'Заказ принят'),
        node('n12', 'terminal', 'Отмена'),
      ],
      [
        edge('n1', 'n2'), edge('n2', 'n3'), edge('n3', 'n4'),
        edge('n4', 'n5', 'Да'), edge('n4', 'n10', 'Нет'),
        edge('n5', 'n6'), edge('n6', 'n7'), edge('n7', 'n8'),
        edge('n8', 'n9', 'Да'), edge('n8', 'n12', 'Нет'),
        edge('n9', 'n11'), edge('n10', 'n12'),
      ]
    );
  },

  crud(entity = 'запись') {
    return doc(
      [
        node('n1', 'terminal', 'Начало'),
        node('n2', 'decision', `Операция с «${entity}»?`),
        node('n3', 'process', `Создать ${entity}`),
        node('n4', 'process', `Прочитать ${entity}`),
        node('n5', 'process', `Обновить ${entity}`),
        node('n6', 'process', `Удалить ${entity}`),
        node('n7', 'terminal', 'Конец'),
      ],
      [
        edge('n1', 'n2'),
        edge('n2', 'n3', 'Create'), edge('n2', 'n4', 'Read'),
        edge('n2', 'n5', 'Update'), edge('n2', 'n6', 'Delete'),
        edge('n3', 'n7'), edge('n4', 'n7'), edge('n5', 'n7'), edge('n6', 'n7'),
      ]
    );
  },

  support() {
    return doc(
      [
        node('n1', 'terminal', 'Обращение в поддержку'),
        node('n2', 'io', 'Описание проблемы'),
        node('n3', 'process', 'Классификация тикета'),
        node('n4', 'decision', 'Срочный?'),
        node('n5', 'process', 'Эскалация L2'),
        node('n6', 'process', 'Ответ L1'),
        node('n7', 'decision', 'Решено?'),
        node('n8', 'process', 'Закрыть тикет'),
        node('n9', 'process', 'Дозапрос у пользователя'),
        node('n10', 'terminal', 'Закрыто'),
      ],
      [
        edge('n1', 'n2'), edge('n2', 'n3'), edge('n3', 'n4'),
        edge('n4', 'n5', 'Да'), edge('n4', 'n6', 'Нет'),
        edge('n5', 'n7'), edge('n6', 'n7'),
        edge('n7', 'n8', 'Да'), edge('n7', 'n9', 'Нет'),
        edge('n8', 'n10'), edge('n9', 'n2'),
      ]
    );
  },

  api() {
    return doc(
      [
        node('n1', 'terminal', 'Запрос API'),
        node('n2', 'process', 'Валидация входных данных'),
        node('n3', 'decision', 'Валидно?'),
        node('n4', 'process', 'Авторизация / API key'),
        node('n5', 'decision', 'Доступ разрешён?'),
        node('n6', 'process', 'Бизнес-логика'),
        node('n7', 'process', 'Запись в БД / кэш'),
        node('n8', 'io', 'Ответ 200 + JSON'),
        node('n9', 'io', 'Ошибка 400'),
        node('n10', 'io', 'Ошибка 401/403'),
        node('n11', 'terminal', 'Конец'),
      ],
      [
        edge('n1', 'n2'), edge('n2', 'n3'),
        edge('n3', 'n4', 'Да'), edge('n3', 'n9', 'Нет'),
        edge('n4', 'n5'),
        edge('n5', 'n6', 'Да'), edge('n5', 'n10', 'Нет'),
        edge('n6', 'n7'), edge('n7', 'n8'),
        edge('n8', 'n11'), edge('n9', 'n11'), edge('n10', 'n11'),
      ]
    );
  },

  approval() {
    return doc(
      [
        node('n1', 'terminal', 'Заявка создана'),
        node('n2', 'process', 'Заполнение формы'),
        node('n3', 'process', 'Отправка на согласование'),
        node('n4', 'decision', 'Согласовано руководителем?'),
        node('n5', 'decision', 'Нужно согласование финансов?'),
        node('n6', 'process', 'Согласование финансов'),
        node('n7', 'decision', 'Одобрено?'),
        node('n8', 'process', 'Исполнение'),
        node('n9', 'process', 'Доработка заявки'),
        node('n10', 'terminal', 'Выполнено'),
        node('n11', 'terminal', 'Отклонено'),
      ],
      [
        edge('n1', 'n2'), edge('n2', 'n3'), edge('n3', 'n4'),
        edge('n4', 'n5', 'Да'), edge('n4', 'n9', 'Нет'),
        edge('n5', 'n6', 'Да'), edge('n5', 'n8', 'Нет'),
        edge('n6', 'n7'),
        edge('n7', 'n8', 'Да'), edge('n7', 'n11', 'Нет'),
        edge('n8', 'n10'), edge('n9', 'n2'),
      ]
    );
  },

  onboarding() {
    return doc(
      [
        node('n1', 'terminal', 'Новый сотрудник'),
        node('n2', 'process', 'Создать учётки'),
        node('n3', 'process', 'Выдать оборудование'),
        node('n4', 'process', 'Обучение / инструктаж'),
        node('n5', 'check', 'Чек-лист адаптации'),
        node('n6', 'decision', 'Испытательный срок пройден?'),
        node('n7', 'process', 'Закрепить в штате'),
        node('n8', 'process', 'План развития / увольнение'),
        node('n9', 'terminal', 'Онбординг завершён'),
      ],
      [
        edge('n1', 'n2'), edge('n2', 'n3'), edge('n3', 'n4'), edge('n4', 'n5'),
        edge('n5', 'n6'),
        edge('n6', 'n7', 'Да'), edge('n6', 'n8', 'Нет'),
        edge('n7', 'n9'), edge('n8', 'n9'),
      ]
    );
  },

  dataPipeline() {
    return doc(
      [
        node('n1', 'terminal', 'Старт пайплайна'),
        node('n2', 'data', 'Источник данных'),
        node('n3', 'process', 'Извлечение (Extract)'),
        node('n4', 'process', 'Трансформация (Transform)'),
        node('n5', 'decision', 'Данные валидны?'),
        node('n6', 'process', 'Загрузка (Load)'),
        node('n7', 'process', 'Лог ошибок / карантин'),
        node('n8', 'io', 'Уведомление / метрики'),
        node('n9', 'terminal', 'Готово'),
      ],
      [
        edge('n1', 'n2'), edge('n2', 'n3'), edge('n3', 'n4'), edge('n4', 'n5'),
        edge('n5', 'n6', 'Да'), edge('n5', 'n7', 'Нет'),
        edge('n6', 'n8'), edge('n7', 'n8'), edge('n8', 'n9'),
      ]
    );
  },

  linear(steps) {
    const nodes = [node('n1', 'terminal', 'Начало')];
    const edges = [];
    let i = 2;
    (steps || ['Шаг 1', 'Шаг 2']).forEach((t) => {
      const id = 'n' + i;
      nodes.push(node(id, 'process', t));
      edges.push(edge(nodes[nodes.length - 2].id, id));
      i++;
    });
    const end = 'n' + i;
    nodes.push(node(end, 'terminal', 'Конец'));
    edges.push(edge(nodes[nodes.length - 2].id, end));
    return doc(nodes, edges);
  },
};

/** Intent detection — expanded keyword base */
function detectIntent(prompt) {
  const p = (prompt || '').toLowerCase();

  if (/логин|вход|авториз|auth|login|sign\s*in|учётн/.test(p)) return { tpl: 'login' };
  if (/регистр|sign\s*up|signup|создать аккаунт|создать учёт/.test(p)) return { tpl: 'register' };
  if (/оплат|платеж|payment|checkout|касс|эквайринг|сбер|stripe/.test(p)) return { tpl: 'payment' };
  if (/заказ|order|корзин|доставк|оформлен/.test(p)) return { tpl: 'order' };
  if (/crud|создать.*читать|create.*read|товар|сущност/.test(p)) {
    const m = p.match(/(?:для|с)\s+[«"]?([а-яa-z0-9_\- ]{2,30})/i);
    return { tpl: 'crud', arg: m ? m[1].trim() : 'запись' };
  }
  if (/поддержк|тикет|ticket|support|обращен|жалоб/.test(p)) return { tpl: 'support' };
  if (/api|endpoint|rest|graphql|запрос к серверу|бэкенд|backend/.test(p)) return { tpl: 'api' };
  if (/согласован|утвержд|approval|approve|заявк/.test(p)) return { tpl: 'approval' };
  if (/онборд|адаптац|новый сотрудник|onboard/.test(p)) return { tpl: 'onboarding' };
  if (/etl|пайплайн|pipeline|данн(ые|ых)|extract|transform|load/.test(p)) return { tpl: 'dataPipeline' };

  // Explicit numbered / bullet steps → linear
  const lines = (prompt || '').split(/\n/).map(s => s.replace(/^[\s\-*•\d.)]+/, '').trim()).filter(s => s.length > 2);
  if (lines.length >= 3 && lines.length <= 12) {
    return { tpl: 'linear', arg: lines.slice(0, 10) };
  }

  // "шаги: a, b, c"
  const stepList = p.match(/(?:шаги|этапы|steps)\s*[:—-]?\s*(.+)/i);
  if (stepList) {
    const parts = stepList[1].split(/[,;•]| и /).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) return { tpl: 'linear', arg: parts.slice(0, 10) };
  }

  return { tpl: 'simple', arg: extractTopic(prompt) };
}

function extractTopic(prompt) {
  const m = (prompt || '').match(
    /(?:схем[ауые]?|процесс|алгоритм|поток|workflow|построй|создай|сделай|нарисуй)\s+(.+)/i
  );
  let t = (m ? m[1] : prompt || 'задача').replace(/[.?!:]+$/g, '').trim();
  if (t.length > 70) t = t.slice(0, 70) + '…';
  return t || 'задача';
}

function buildFromIntent(intent) {
  const { tpl, arg } = intent;
  const fn = TEMPLATES[tpl];
  if (!fn) return TEMPLATES.simple(arg || 'задача');
  if (tpl === 'crud') return fn(arg || 'запись');
  if (tpl === 'linear') return fn(arg || ['Шаг 1', 'Шаг 2']);
  if (tpl === 'simple') return fn(arg || 'задача');
  return fn();
}

export async function chatLocal({ messages, onChunk }) {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const intent = detectIntent(lastUser);
  const diagram = buildFromIntent(intent);

  const thinkingLines = [
    '🤔 Локальный режим: разбираю запрос…',
    `Намерение: ${intent.tpl}${intent.arg ? ` (${Array.isArray(intent.arg) ? intent.arg.join(', ') : intent.arg})` : ''}`,
    `Блоков: ${diagram.nodes.length}, связей: ${diagram.edges.length}`,
    'Собираю JSON FlowForge…',
    'Проверяю ветки Да/Нет у условий…',
  ];
  const thinking = thinkingLines.join('\n');

  if (onChunk) {
    for (const ch of thinking) {
      onChunk(ch);
      await new Promise(r => setTimeout(r, 4));
    }
    onChunk('\n\n');
  }

  const jsonStr = JSON.stringify(diagram, null, 2);
  const content =
    `${thinking}\n\n\`\`\`json\n${jsonStr}\n\`\`\`\n\n` +
    `Схема «${intent.tpl}» сгенерирована локально (${diagram.nodes.length} блоков). ` +
    `Для сложных задач подключите API (OpenAI / Claude / Grok) в ⚙️ настройках агента.`;

  return {
    content,
    tool_calls: [],
    usage: null,
    model: 'rules-v2',
    finish_reason: 'stop',
  };
}

export const LOCAL_INTENTS = Object.keys(TEMPLATES);

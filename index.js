/** Planner: user goal → ordered steps */

export class Planner {
  constructor(registry) {
    this.registry = registry;
  }

  heuristicPlan(goal) {
    const g = (goal || '').toLowerCase();
    const steps = [];

    if (/очист|clear|удали всё|с нуля|новая схем/.test(g)) {
      steps.push({ action: 'clear_diagram', reason: 'Очистка перед новой схемой' });
    }

    if (/логин|вход|регистр|оплат|заказ|crud|поддержк|api|согласован|онборд|etl|пайплайн|построй|создай|сгенерир|нарисуй|сделай схем/.test(g)) {
      steps.push({ action: 'generate', reason: 'Генерация схемы по описанию' });
      steps.push({ action: 'apply_json', reason: 'Применить на холст' });
      steps.push({ action: 'auto_layout', reason: 'Раскладка' });
      steps.push({ action: 'quality_check', reason: 'Проверка качества' });
    } else if (/улучш|исправ|доработ|fix/.test(g)) {
      steps.push({ action: 'quality_check', reason: 'Текущее качество' });
      steps.push({ action: 'suggest_improvements', reason: 'Что улучшить' });
      steps.push({ action: 'generate', reason: 'Исправления' });
    } else if (/проверь|валид|quality|качество|lint/.test(g)) {
      steps.push({ action: 'quality_check', reason: 'Проверка' });
      steps.push({ action: 'validate_decisions', reason: 'Условия' });
      steps.push({ action: 'stats', reason: 'Статистика' });
    } else if (/экспорт|export|mermaid|json|скач/.test(g)) {
      steps.push({ action: 'export_json', reason: 'JSON' });
      steps.push({ action: 'export_mermaid', reason: 'Mermaid' });
    } else {
      steps.push({ action: 'generate', reason: 'Общая генерация / ответ' });
      steps.push({ action: 'quality_check', reason: 'Контроль' });
    }

    return steps;
  }

  formatForPrompt(plan) {
    return plan.map((s, i) => `${i + 1}. ${s.action}: ${s.reason}`).join('\n');
  }
}

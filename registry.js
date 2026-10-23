/** High-level quality checker used by the agent */

import { scoreDiagram, scoreToLabel } from './scorer.js';
import { deepClone } from '../utils/helpers.js';

export class QualityChecker {
  constructor(options = {}) {
    this.threshold = options.threshold ?? 0.72;
  }

  check(doc, userPrompt = '') {
    const result = scoreDiagram(doc, userPrompt);
    return {
      ...result,
      label: scoreToLabel(result.overall),
      passed: result.overall >= this.threshold,
      timestamp: Date.now(),
    };
  }

  /** Suggest fixes based on failed checks */
  suggestFixes(report) {
    const fixes = [];
    if (!report.schema?.ok) fixes.push('Исправь JSON по схеме FlowForge (format, nodes, edges).');
    if (!report.connectivity?.ok) fixes.push('Свяжи все узлы в один граф.');
    if (!report.decisionLabels?.ok) fixes.push('У каждого decision добавь минимум две исходящие связи с метками «Да» и «Нет».');
    if (!report.textQuality?.ok) fixes.push('Заполни пустые тексты блоков, сократи слишком длинные.');
    if (!report.noOrphans?.ok) fixes.push('Удали или подключи сиротские узлы.');
    if (!report.completeness?.ok) fixes.push('Добавь недостающие шаги процесса.');
    return fixes;
  }

  /** Quick check of current canvas state (global S) */
  checkCanvas(userPrompt = '') {
    if (typeof S === 'undefined') {
      return { overall: 0, passed: false, summary: 'Canvas state unavailable' };
    }
    const doc = {
      format: 'flowforge',
      version: '2.8',
      nodes: (S.nodes || []).map(n => ({
        id: n.id,
        type: n.type,
        text: n.text,
        color: n.color,
        ck: n.ck,
        done: n.done,
      })),
      edges: (S.edges || []).map(e => ({
        from: e.from,
        to: e.to,
        label: e.label,
        route: e.route,
        dash: e.dash,
        arrow: e.arrow,
        color: e.color,
      })),
      groups: deepClone(S.groups || []),
    };
    return this.check(doc, userPrompt);
  }
}
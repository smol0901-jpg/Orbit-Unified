/** Aggregate quality score */

import { QUALITY_WEIGHTS } from '../config.js';
import {
  validateSchema,
  validateConnectivity,
  validateDecisionLabels,
  validateTextQuality,
  validateNoOrphans,
  validateTypeCorrectness,
  validateCompleteness,
  validateLayoutHint,
} from './validators.js';

export function scoreDiagram(doc, userPrompt = '') {
  const checks = [
    validateSchema(doc),
    validateConnectivity(doc),
    validateDecisionLabels(doc),
    validateTextQuality(doc),
    validateNoOrphans(doc),
    validateTypeCorrectness(doc),
    validateCompleteness(doc, userPrompt),
    validateLayoutHint(doc),
  ];

  let total = 0;
  let weightSum = 0;
  const report = {};

  checks.forEach(c => {
    const w = QUALITY_WEIGHTS[c.name] ?? 0.05;
    total += c.score * w;
    weightSum += w;
    report[c.name] = {
      score: +c.score.toFixed(3),
      ok: c.ok,
      details: c.details,
    };
  });

  const overall = weightSum ? total / weightSum : 0;
  return {
    overall: +overall.toFixed(3),
    report,
    ok: overall >= 0.72,
    summary: Object.entries(report)
      .filter(([, v]) => !v.ok)
      .map(([k, v]) => `${k}: ${(v.score * 100).toFixed(0)}%`)
      .join('; ') || 'Все проверки пройдены',
  };
}

export function scoreToLabel(score) {
  if (score >= 0.9) return 'Отлично';
  if (score >= 0.8) return 'Хорошо';
  if (score >= 0.72) return 'Приемлемо';
  if (score >= 0.5) return 'Требует доработки';
  return 'Плохо';
}
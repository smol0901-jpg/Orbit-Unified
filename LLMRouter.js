/** Self-reflection after actions */

import { QualityChecker } from '../quality/Checker.js';

export class Reflector {
  constructor(threshold = 0.72) {
    this.checker = new QualityChecker({ threshold });
  }

  async reflect(userPrompt) {
    const q = this.checker.checkCanvas(userPrompt);
    const reflection = {
      quality: q.overall,
      passed: q.passed,
      label: q.label,
      summary: q.summary,
      fixes: this.checker.suggestFixes(q.report),
      needsRetry: !q.passed,
    };
    return reflection;
  }

  shouldContinue(reflection, stepIndex, maxSteps) {
    if (stepIndex >= maxSteps) return false;
    return reflection.needsRetry;
  }
}
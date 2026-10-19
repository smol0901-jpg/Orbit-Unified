/** Short-term + long-term agent memory */

import { lsGet, lsSet, uid, nowIso } from '../utils/helpers.js';
import { STORAGE_KEYS, DEFAULTS } from '../config.js';

export class Memory {
  constructor(limit = DEFAULTS.memoryLimit) {
    this.limit = limit;
    this.short = []; // current session messages
    this.long = lsGet(STORAGE_KEYS.memory, []); // persisted facts
    this.facts = new Map(); // key-value knowledge
  }

  addMessage(role, content, meta = {}) {
    this.short.push({
      id: uid('m'),
      role,
      content,
      meta,
      ts: nowIso(),
    });
    if (this.short.length > this.limit * 2) {
      this.short = this.short.slice(-this.limit);
    }
  }

  getContext(maxMessages = 12) {
    return this.short.slice(-maxMessages);
  }

  rememberFact(key, value, tags = []) {
    this.facts.set(key, { value, tags, ts: nowIso() });
    this.long.push({ key, value, tags, ts: nowIso() });
    if (this.long.length > 200) this.long = this.long.slice(-150);
    this.persist();
  }

  recall(key) {
    return this.facts.get(key)?.value ?? null;
  }

  searchFacts(query) {
    const q = (query || '').toLowerCase();
    return this.long.filter(
      f =>
        String(f.key).toLowerCase().includes(q) ||
        String(f.value).toLowerCase().includes(q) ||
        (f.tags || []).some(t => String(t).toLowerCase().includes(q))
    );
  }

  clearShort() {
    this.short = [];
  }

  persist() {
    lsSet(STORAGE_KEYS.memory, this.long.slice(-100));
  }

  load() {
    this.long = lsGet(STORAGE_KEYS.memory, []);
  }
}
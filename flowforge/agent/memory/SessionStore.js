/** Persist agent conversation sessions */

import { lsGet, lsSet, uid, nowIso } from '../utils/helpers.js';
import { STORAGE_KEYS } from '../config.js';

export class SessionStore {
  constructor() {
    this.sessions = lsGet(STORAGE_KEYS.sessions, []);
  }

  create(title = 'Новая сессия') {
    const s = {
      id: uid('sess'),
      title,
      created: nowIso(),
      updated: nowIso(),
      messages: [],
      qualityHistory: [],
    };
    this.sessions.unshift(s);
    this.save();
    return s;
  }

  get(id) {
    return this.sessions.find(s => s.id === id) || null;
  }

  list(limit = 20) {
    return this.sessions.slice(0, limit);
  }

  update(id, patch) {
    const s = this.get(id);
    if (!s) return null;
    Object.assign(s, patch, { updated: nowIso() });
    this.save();
    return s;
  }

  addMessage(id, msg) {
    const s = this.get(id);
    if (!s) return;
    s.messages.push(msg);
    if (s.messages.length > 80) s.messages = s.messages.slice(-60);
    s.updated = nowIso();
    this.save();
  }

  delete(id) {
    this.sessions = this.sessions.filter(s => s.id !== id);
    this.save();
  }

  save() {
    // keep only last 30 sessions
    lsSet(STORAGE_KEYS.sessions, this.sessions.slice(0, 30));
  }
}
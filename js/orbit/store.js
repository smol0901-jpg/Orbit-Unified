/* Контур 5.7.2 · Слой данных Orbit.store (Dexie / IndexedDB)
   schemaVersion 2: таблица scenarios (dual-write с orbit-scripts-v1).
   Документация: docs/DB-MIGRATION-5.8.md */
(function () {
  'use strict';
  const O = window.Orbit = window.Orbit || {};
  const LS_KEY = 'orbit-planner-v3';
  const LS_BACKUP = 'orbit-planner-backup-v3';
  const LS_SCRIPTS = 'orbit-scripts-v1';
  const DB_NAME = 'contour-db';
  const SCHEMA_VERSION = 2;
  const META_KEY = 'schema';

  let db = null;
  let readyResolve;
  const ready = new Promise(r => { readyResolve = r; });
  let isReady = false;
  let lastError = null;

  function nowISO() { return new Date().toISOString(); }

  function initDexie() {
    if (typeof Dexie === 'undefined') {
      lastError = 'Dexie не загружен';
      console.warn('[Контур.store]', lastError);
      readyResolve({ ok: false, error: lastError });
      return null;
    }
    try {
      const d = new Dexie(DB_NAME);
      d.version(1).stores({
        meta: 'key',
        main: 'id, updatedAt',
        records: '++id, type, updatedAt, deletedAt'
      });
      d.version(2).stores({
        meta: 'key',
        main: 'id, updatedAt',
        records: '++id, type, updatedAt, deletedAt',
        scenarios: 'id, updatedAt'
      });
      return d;
    } catch (e) {
      lastError = e && e.message ? e.message : String(e);
      console.error('[Контур.store] init', e);
      readyResolve({ ok: false, error: lastError });
      return null;
    }
  }

  async function ensureMeta(d) {
    const row = await d.meta.get(META_KEY);
    if (!row) {
      await d.meta.put({
        key: META_KEY,
        schemaVersion: SCHEMA_VERSION,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        migratedFrom: null
      });
    } else if (row.schemaVersion !== SCHEMA_VERSION) {
      await d.meta.update(META_KEY, { schemaVersion: SCHEMA_VERSION, updatedAt: nowISO() });
    }
  }

  async function boot() {
    db = initDexie();
    if (!db) return;
    try {
      await db.open();
      await ensureMeta(db);
      isReady = true;
      lastError = null;
      readyResolve({ ok: true, schemaVersion: SCHEMA_VERSION });
      setTimeout(() => {
        try { autoMigrate(); } catch (e) { console.warn('[Контур.store] autoMigrate', e); }
        try { migrateScriptsFromLocal(false); } catch (e) { console.warn('[Контур.store] scripts migrate', e); }
      }, 600);
    } catch (e) {
      lastError = e && e.message ? e.message : String(e);
      console.error('[Контур.store] open', e);
      readyResolve({ ok: false, error: lastError });
    }
  }

  async function getMain() {
    if (!isReady || !db) return null;
    try {
      const row = await db.main.get('state');
      return row && row.data && typeof row.data === 'object' ? row.data : null;
    } catch (e) {
      console.warn('[Контур.store] getMain', e);
      return null;
    }
  }

  async function putMain(state) {
    if (!isReady || !db || !state || typeof state !== 'object') return false;
    try {
      await db.main.put({ id: 'state', data: state, schemaVersion: SCHEMA_VERSION, updatedAt: nowISO() });
      await db.meta.update(META_KEY, { updatedAt: nowISO() });
      return true;
    } catch (e) {
      console.warn('[Контур.store] putMain', e);
      lastError = e && e.message ? e.message : String(e);
      return false;
    }
  }

  async function getScenarios() {
    if (!isReady || !db) return null;
    try {
      const rows = await db.scenarios.toArray();
      if (!rows || !rows.length) return [];
      return rows.map(r => r.data).filter(Boolean);
    } catch (e) {
      console.warn('[Контур.store] getScenarios', e);
      return null;
    }
  }

  async function putScenarios(list) {
    if (!isReady || !db || !Array.isArray(list)) return false;
    try {
      await db.scenarios.clear();
      const now = nowISO();
      const rows = list.filter(x => x && typeof x === 'object').map(x => ({
        id: String(x.id || ('sc-' + Math.random().toString(36).slice(2, 9))),
        data: x,
        updatedAt: now
      }));
      if (rows.length) await db.scenarios.bulkPut(rows);
      return true;
    } catch (e) {
      console.warn('[Контур.store] putScenarios', e);
      return false;
    }
  }

  async function migrateScriptsFromLocal(force) {
    if (!isReady || !db) return { migrated: false, reason: 'not-ready' };
    try {
      const existing = await db.scenarios.count();
      if (existing > 0 && !force) return { migrated: false, reason: 'already-has-data' };
      let raw = null;
      try { raw = localStorage.getItem(LS_SCRIPTS); } catch (e) { /* ignore */ }
      if (!raw) return { migrated: false, reason: 'no-local-data' };
      let data;
      try { data = JSON.parse(raw); } catch (e) { return { migrated: false, reason: 'parse-error' }; }
      if (!Array.isArray(data)) return { migrated: false, reason: 'invalid-data' };
      await putScenarios(data);
      return { migrated: true, count: data.length };
    } catch (e) {
      return { migrated: false, reason: (e && e.message) || String(e) };
    }
  }

  async function migrateFromLocalStorage(force) {
    if (!isReady || !db) return { migrated: false, reason: 'not-ready' };
    try {
      const existing = await db.main.get('state');
      if (existing && existing.data && !force) return { migrated: false, reason: 'already-has-data' };
      let raw = null;
      try { raw = localStorage.getItem(LS_KEY); } catch (e) { /* ignore */ }
      if (!raw) { try { raw = localStorage.getItem(LS_BACKUP); } catch (e) { /* ignore */ } }
      if (!raw) return { migrated: false, reason: 'no-local-data' };
      let data;
      try { data = JSON.parse(raw); } catch (e) { return { migrated: false, reason: 'parse-error' }; }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return { migrated: false, reason: 'invalid-data' };
      await putMain(data);
      await db.meta.update(META_KEY, { migratedFrom: 'localStorage:' + LS_KEY, migratedAt: nowISO(), updatedAt: nowISO() });
      return { migrated: true, source: LS_KEY, keys: Object.keys(data) };
    } catch (e) {
      console.error('[Контур.store] migrateFromLocalStorage', e);
      return { migrated: false, reason: (e && e.message) || String(e) };
    }
  }

  async function autoMigrate() {
    if (!isReady) return;
    const r = await migrateFromLocalStorage(false);
    if (r.migrated) console.info('[Контур.store] миграция localStorage → Dexie', r);
  }

  function onSave(state) {
    if (!isReady || !state) return;
    putMain(state).catch(e => console.warn('[Контур.store] onSave', e));
  }

  async function getMeta() {
    if (!isReady || !db) return null;
    try { return await db.meta.get(META_KEY); } catch (e) { return null; }
  }

  async function clearDexie() {
    if (!isReady || !db) return false;
    try {
      await db.main.clear();
      await db.records.clear();
      await db.scenarios.clear();
      await ensureMeta(db);
      return true;
    } catch (e) {
      console.warn('[Контур.store] clearDexie', e);
      return false;
    }
  }

  O.store = {
    ready,
    get isReady() { return isReady; },
    get lastError() { return lastError; },
    get schemaVersion() { return SCHEMA_VERSION; },
    getMain, putMain,
    getScenarios, putScenarios, migrateScriptsFromLocal,
    migrateFromLocalStorage, getMeta, clearDexie, onSave,
    _db: () => db
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

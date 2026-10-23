/** Shared helpers for ForgeAgent */

export function uid(prefix = 'id') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export function extractJson(text) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  // try full parse
  let obj = safeJsonParse(cleaned);
  if (obj) return obj;
  // try find first { ... }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) return safeJsonParse(m[0]);
  return null;
}

export function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function formatUsd(n) {
  if (n < 0.001) return '<$0.001';
  return '$' + n.toFixed(n < 0.01 ? 4 : 3);
}

export function estimateTokens(text) {
  // rough heuristic: ~4 chars per token for mixed RU/EN
  return Math.ceil((text || '').length / 3.5);
}

export function lsGet(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? def : JSON.parse(v);
  } catch {
    return def;
  }
}

export function lsSet(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch {
    return false;
  }
}

export function maskKey(key) {
  if (!key || key.length < 8) return '••••';
  return key.slice(0, 4) + '…' + key.slice(-4);
}

export function nowIso() {
  return new Date().toISOString();
}

export function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

export function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
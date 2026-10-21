/* Контур 5.7.4 · Mermaid: диаграммы в чате агента.
   После рендера сообщений ищет блоки ```mermaid … ``` и рисует SVG.
   CDN: mermaid@11 (кэш в SW). Без mermaid — текст остаётся как есть. */
(function () {
  'use strict';
  const O = window.Orbit = window.Orbit || {};
  let ready = false;
  let starting = false;

  function ensureMermaid() {
    if (ready) return Promise.resolve(true);
    if (typeof mermaid !== 'undefined') {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'default' : 'dark',
          securityLevel: 'strict',
          fontFamily: 'system-ui, sans-serif'
        });
        ready = true;
        return Promise.resolve(true);
      } catch (e) {
        console.warn('[Контур.mermaid] init', e);
        return Promise.resolve(false);
      }
    }
    if (starting) return Promise.resolve(false);
    starting = true;
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
      s.async = true;
      s.onload = () => { starting = false; ensureMermaid().then(resolve); };
      s.onerror = () => { starting = false; resolve(false); };
      document.head.appendChild(s);
    });
  }

  function extractBlocks(text) {
    const re = /```mermaid\s*([\s\S]*?)```/gi;
    const parts = [];
    let last = 0, m;
    const src = String(text || '');
    while ((m = re.exec(src)) !== null) {
      if (m.index > last) parts.push({ type: 'text', value: src.slice(last, m.index) });
      parts.push({ type: 'mermaid', value: m[1].trim() });
      last = m.index + m[0].length;
    }
    if (last < src.length) parts.push({ type: 'text', value: src.slice(last) });
    return parts;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  async function mount(root) {
    if (!root) return;
    const nodes = root.querySelectorAll('.o-m-t');
    if (!nodes.length) return;
    const jobs = [];
    nodes.forEach(el => {
      if (el.dataset.mermaidDone === '1') return;
      const raw = el.textContent || '';
      if (!/```mermaid/i.test(raw) && !el.querySelector('.o-mermaid')) return;
      jobs.push(el);
    });
    if (!jobs.length) return;
    const ok = await ensureMermaid();
    if (!ok || typeof mermaid === 'undefined') return;

    for (const el of jobs) {
      if (el.dataset.mermaidDone === '1') continue;
      const raw = el.textContent || '';
      const parts = extractBlocks(raw);
      if (!parts.some(p => p.type === 'mermaid')) continue;

      const frag = document.createDocumentFragment();
      const wrappers = [];
      parts.forEach(p => {
        if (p.type === 'text') {
          const d = document.createElement('div');
          d.innerHTML = esc(p.value).replace(/\n/g, '<br>');
          while (d.firstChild) frag.appendChild(d.firstChild);
        } else {
          const wrap = document.createElement('div');
          wrap.className = 'o-mermaid';
          wrap.style.cssText = 'margin:10px 0;overflow:auto;background:rgba(127,127,127,.08);border-radius:10px;padding:10px';
          const pre = document.createElement('pre');
          pre.className = 'mermaid';
          pre.textContent = p.value;
          wrap.appendChild(pre);
          frag.appendChild(wrap);
          wrappers.push(pre);
        }
      });
      el.innerHTML = '';
      el.appendChild(frag);
      el.dataset.mermaidDone = '1';
      try {
        if (wrappers.length) await mermaid.run({ nodes: wrappers });
      } catch (e) {
        console.warn('[Контур.mermaid] run', e);
        wrappers.forEach(pre => {
          pre.style.whiteSpace = 'pre-wrap';
          pre.style.fontSize = '12px';
          pre.textContent = 'Не удалось нарисовать схему:\n' + pre.textContent;
        });
      }
    }
  }

  function hookRender() {
    const A = O.assistant;
    if (!A || typeof A.render !== 'function') return false;
    if (A._mermaidHooked) return true;
    const orig = A.render;
    A.render = function (scroll) {
      const r = orig.apply(this, arguments);
      try {
        const ms = document.getElementById('ag-msgs');
        if (ms) setTimeout(() => mount(ms), 0);
      } catch (e) { /* ignore */ }
      return r;
    };
    A._mermaidHooked = true;
    return true;
  }

  function boot() {
    if (!hookRender()) {
      let n = 0;
      const t = setInterval(() => {
        if (hookRender() || ++n > 40) clearInterval(t);
      }, 200);
    }
  }

  O.mermaid = { mount, ensure: ensureMermaid, extractBlocks };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

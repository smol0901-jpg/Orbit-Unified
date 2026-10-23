/** Chat message rendering for agent panel */

export class ChatUI {
  constructor(container) {
    this.el = container;
  }

  clear() {
    this.el.innerHTML = '';
  }

  add(role, text, meta = {}) {
    const div = document.createElement('div');
    div.className = 'agent-msg agent-msg-' + role;
    if (role === 'thinking') {
      div.innerHTML = `<details open><summary>💭 Мышление</summary><pre class="agent-think">${esc(text)}</pre></details>`;
    } else if (role === 'tool') {
      div.innerHTML = `<div class="agent-tool"><b>🔧 ${esc(meta.name || 'tool')}</b><pre>${esc(text)}</pre></div>`;
    } else if (role === 'quality') {
      const q = meta.data || {};
      const pct = Math.round((q.overall || 0) * 100);
      div.innerHTML = `<div class="agent-quality">📊 Качество: <b>${pct}%</b> — ${esc(q.label || '')}<br><small>${esc(q.summary || '')}</small></div>`;
    } else if (role === 'status') {
      div.className = 'agent-msg agent-msg-status';
      div.textContent = text;
    } else if (role === 'error') {
      div.innerHTML = `<div class="agent-error">⚠️ ${esc(text)}</div>`;
    } else {
      div.innerHTML = `<div class="agent-bubble">${formatMd(text)}</div>`;
    }
    this.el.appendChild(div);
    this.el.scrollTop = this.el.scrollHeight;
    return div;
  }

  updateLastStream(text) {
    let last = this.el.querySelector('.agent-msg-stream');
    if (!last) {
      last = document.createElement('div');
      last.className = 'agent-msg agent-msg-assistant agent-msg-stream';
      last.innerHTML = '<div class="agent-bubble"></div>';
      this.el.appendChild(last);
    }
    last.querySelector('.agent-bubble').innerHTML = formatMd(text);
    this.el.scrollTop = this.el.scrollHeight;
  }

  clearStream() {
    const last = this.el.querySelector('.agent-msg-stream');
    if (last) last.classList.remove('agent-msg-stream');
  }
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatMd(text) {
  let t = esc(text);
  t = t.replace(/```([\s\S]*?)```/g, '<pre>$1</pre>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  t = t.replace(/\n/g, '<br>');
  return t;
}
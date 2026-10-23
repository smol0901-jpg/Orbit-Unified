/** Main agent UI panel — scroll-safe, non-blocking canvas */

import { ChatUI } from './ChatUI.js';
import { SettingsUI } from './SettingsUI.js';
import { AGENT_VERSION } from '../config.js';

export class AgentPanel {
  constructor(agent) {
    this.agent = agent;
    this.visible = false;
    this.chat = null;
    this.settings = null;
    this.tab = 'chat';
    this._running = false;
  }

  mount() {
    if (document.getElementById('agentPanel')) return;

    const panel = document.createElement('aside');
    panel.id = 'agentPanel';
    panel.className = 'agent-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'ForgeAgent');
    panel.innerHTML = `
      <header class="agent-header">
        <div class="agent-title">
          <span class="agent-logo">⚡</span>
          <div>
            <b>ForgeAgent</b>
            <small>v${AGENT_VERSION} · ${this.agent.getToolCount()}+ tools</small>
          </div>
        </div>
        <div class="agent-hdr-btns">
          <button type="button" id="agentTabChat" class="on" title="Чат">💬</button>
          <button type="button" id="agentTabSet" title="Настройки">⚙️</button>
          <button type="button" id="agentClose" title="Закрыть">✕</button>
        </div>
      </header>
      <div id="agentBody" class="agent-body">
        <div id="agentChatView">
          <div id="agentMessages" class="agent-messages" tabindex="0"></div>
          <div class="agent-input-row">
            <textarea id="agentInput" rows="2" placeholder="Опишите схему… например: построй процесс оплаты заказа"></textarea>
            <div class="agent-actions">
              <button type="button" id="agentSend" class="primary">Отправить</button>
              <button type="button" id="agentStop" hidden>Стоп</button>
              <button type="button" id="agentVoice" title="Голос">🎤</button>
              <button type="button" id="agentClearChat" title="Очистить чат">🗑</button>
            </div>
          </div>
          <div class="agent-hints">
            <button type="button" data-hint="Построй схему входа пользователя с проверкой пароля">Вход</button>
            <button type="button" data-hint="Создай CRUD для товара">CRUD</button>
            <button type="button" data-hint="Схема оформления и оплаты заказа">Оплата</button>
            <button type="button" data-hint="Проверь качество текущей схемы и улучши">Улучшить</button>
            <button type="button" data-hint="Экспортируй схему в Mermaid">Mermaid</button>
          </div>
        </div>
        <div id="agentSetView" hidden></div>
      </div>
      <footer class="agent-footer">
        <span id="agentStatus">Готов · локальный режим</span>
      </footer>
    `;
    document.body.appendChild(panel);

    // Prevent wheel / touch from reaching the canvas behind the panel
    const stop = (e) => e.stopPropagation();
    panel.addEventListener('wheel', stop, { passive: true });
    panel.addEventListener('touchstart', stop, { passive: true });
    panel.addEventListener('touchmove', stop, { passive: true });
    panel.addEventListener('pointerdown', stop);

    this.chat = new ChatUI(document.getElementById('agentMessages'));
    this.settings = new SettingsUI(panel, this.agent.llm);
    document.getElementById('agentSetView').innerHTML = this.settings.render();
    this.settings.bind();

    document.getElementById('agentClose').onclick = () => this.hide();
    document.getElementById('agentTabChat').onclick = () => this.showTab('chat');
    document.getElementById('agentTabSet').onclick = () => this.showTab('settings');
    document.getElementById('agentSend').onclick = () => this.send();
    document.getElementById('agentStop').onclick = () => {
      this.agent.cancel();
      this.setRunning(false);
      this.setStatus('Остановлено');
    };
    document.getElementById('agentClearChat').onclick = () => {
      this.chat.clear();
      this.agent.memory.clearShort();
      this.setStatus('Чат очищен');
    };
    document.getElementById('agentInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });
    document.querySelectorAll('[data-hint]').forEach(btn => {
      btn.onclick = () => {
        document.getElementById('agentInput').value = btn.dataset.hint;
        this.send();
      };
    });
    document.getElementById('agentVoice').onclick = () => this.toggleVoice();

    this.agent.on(ev => this.onAgentEvent(ev));

    if (!document.getElementById('agentFab')) {
      const fab = document.createElement('button');
      fab.id = 'agentFab';
      fab.className = 'agent-fab';
      fab.title = 'ForgeAgent';
      fab.type = 'button';
      fab.innerHTML = '⚡';
      fab.onclick = () => this.toggle();
      document.body.appendChild(fab);
    }
  }

  showTab(tab) {
    this.tab = tab;
    document.getElementById('agentChatView').hidden = tab !== 'chat';
    document.getElementById('agentSetView').hidden = tab !== 'settings';
    document.getElementById('agentTabChat').classList.toggle('on', tab === 'chat');
    document.getElementById('agentTabSet').classList.toggle('on', tab === 'settings');
    if (tab === 'settings') {
      document.getElementById('agentSetView').innerHTML = this.settings.render();
      this.settings.bind();
    }
  }

  show() {
    this.mount();
    const p = document.getElementById('agentPanel');
    p.hidden = false;
    this.visible = true;
    document.body.classList.add('agent-panel-open');
    document.getElementById('agentFab')?.classList.add('agent-open');
    document.getElementById('agentInput')?.focus();
  }

  hide() {
    const p = document.getElementById('agentPanel');
    if (p) p.hidden = true;
    this.visible = false;
    document.body.classList.remove('agent-panel-open');
    document.getElementById('agentFab')?.classList.remove('agent-open');
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  setStatus(t) {
    const el = document.getElementById('agentStatus');
    if (el) el.textContent = t;
  }

  setRunning(on) {
    this._running = on;
    const send = document.getElementById('agentSend');
    const stop = document.getElementById('agentStop');
    if (send) send.hidden = !!on;
    if (stop) stop.hidden = !on;
  }

  async send() {
    if (this._running) return;
    const input = document.getElementById('agentInput');
    const text = (input?.value || '').trim();
    if (!text) return;
    input.value = '';
    this.chat.add('user', text);
    this.setRunning(true);

    try {
      await this.agent.run(text, {
        autoApply: this.agent.llm.settings.autoApply !== false,
      });
    } catch (err) {
      this.chat.add('error', err.message || String(err));
      this.setStatus('Ошибка');
    } finally {
      this.setRunning(false);
      this.chat.clearStream();
    }
  }

  onAgentEvent(ev) {
    switch (ev.type) {
      case 'status':
        this.setStatus(ev.text);
        break;
      case 'thinking':
        this.chat.add('thinking', ev.text);
        break;
      case 'stream':
        this.chat.updateLastStream(ev.text);
        break;
      case 'tool_start':
        this.chat.add('tool', JSON.stringify(ev.args || {}, null, 0), { name: ev.name });
        break;
      case 'quality':
        this.chat.add('quality', '', { data: ev.data });
        break;
      case 'error':
        this.chat.add('error', ev.text);
        break;
      case 'done':
        if (ev.text) this.chat.add('assistant', ev.text);
        this.setStatus(ev.applied ? 'Схема применена' : 'Готово');
        break;
      default:
        break;
    }
  }

  toggleVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      if (typeof toast === 'function') toast('Голосовой ввод не поддерживается');
      return;
    }
    if (this._rec) {
      this._rec.stop();
      this._rec = null;
      return;
    }
    const rec = new SR();
    rec.lang = 'ru-RU';
    rec.interimResults = false;
    rec.onresult = e => {
      const t = e.results[0][0].transcript;
      const input = document.getElementById('agentInput');
      if (input) input.value = (input.value + ' ' + t).trim();
    };
    rec.onend = () => { this._rec = null; };
    rec.start();
    this._rec = rec;
    if (typeof toast === 'function') toast('🎤 Слушаю…');
  }
}

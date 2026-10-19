/** Agent settings: provider, model, API keys */

import { PROVIDERS } from '../config.js';
import { maskKey } from '../utils/helpers.js';

export class SettingsUI {
  constructor(panel, router) {
    this.panel = panel;
    this.router = router;
  }

  render() {
    const s = this.router.settings;
    const prov = this.router.getProvider();
    const key = this.router.getApiKey();

    return `
      <div class="agent-settings">
        <label>Провайдер
          <select id="agProv">
            ${Object.values(PROVIDERS).map(p =>
              `<option value="${p.id}" ${p.id === s.provider ? 'selected' : ''}>${p.name}</option>`
            ).join('')}
          </select>
        </label>
        <label>Модель
          <select id="agModel">
            ${(prov.models || []).map(m =>
              `<option value="${m}" ${m === s.model ? 'selected' : ''}>${m}</option>`
            ).join('')}
          </select>
        </label>
        <label>API-ключ <small>${key ? maskKey(key) : 'не задан'}</small>
          <input type="password" id="agKey" placeholder="sk-... или ключ провайдера" autocomplete="off"/>
        </label>
        <label id="agBaseWrap" style="${s.provider === 'custom' || s.provider === 'google' ? '' : 'display:none'}">
          Base URL
          <input type="url" id="agBase" value="${s.customBaseUrl || ''}" placeholder="https://api.example.com/v1"/>
        </label>
        <label>Temperature <input type="number" id="agTemp" min="0" max="2" step="0.05" value="${s.temperature ?? 0.35}"/></label>
        <label class="row"><input type="checkbox" id="agStream" ${s.stream !== false ? 'checked' : ''}/> Streaming</label>
        <label class="row"><input type="checkbox" id="agAuto" ${s.autoApply !== false ? 'checked' : ''}/> Авто-применение схемы</label>
        <div class="agent-set-actions">
          <button type="button" id="agSaveKey" class="primary">Сохранить</button>
          <button type="button" id="agTest">Проверить</button>
        </div>
        <p class="note">Ключи хранятся только в localStorage вашего браузера. Для GitHub Pages / Netlify backend не требуется.</p>
      </div>
    `;
  }

  bind() {
    const provSel = document.getElementById('agProv');
    const modelSel = document.getElementById('agModel');
    const keyInp = document.getElementById('agKey');
    const baseInp = document.getElementById('agBase');
    const tempInp = document.getElementById('agTemp');
    const streamCb = document.getElementById('agStream');
    const autoCb = document.getElementById('agAuto');

    provSel?.addEventListener('change', () => {
      const id = provSel.value;
      const p = PROVIDERS[id];
      modelSel.innerHTML = (p.models || []).map(m => `<option value="${m}">${m}</option>`).join('');
      modelSel.value = p.defaultModel;
      const wrap = document.getElementById('agBaseWrap');
      if (wrap) wrap.style.display = (id === 'custom' || id === 'google') ? '' : 'none';
    });

    document.getElementById('agSaveKey')?.addEventListener('click', () => {
      const id = provSel.value;
      this.router.setProvider(id, modelSel.value);
      if (keyInp.value.trim()) this.router.setKey(id, keyInp.value.trim());
      this.router.setSettings({
        temperature: parseFloat(tempInp.value) || 0.35,
        stream: streamCb.checked,
        autoApply: autoCb.checked,
        customBaseUrl: baseInp?.value || '',
      });
      if (typeof toast === 'function') toast('✅ Настройки агента сохранены');
    });

    document.getElementById('agTest')?.addEventListener('click', async () => {
      if (typeof toast === 'function') toast('🔄 Проверка…');
      try {
        const r = await this.router.chat({
          messages: [
            { role: 'system', content: 'Ответь одним словом: pong' },
            { role: 'user', content: 'ping' },
          ],
        });
        if (typeof toast === 'function') toast('✅ Ответ: ' + (r.content || '').slice(0, 40));
      } catch (e) {
        if (typeof toast === 'function') toast('❌ ' + e.message);
      }
    });
  }
}
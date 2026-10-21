/* Контур 4.4 · СЦЕНАРИИ: визуальный редактор блок-схем для агента.
   Блоки: команда агента · сообщение · напоминание · «Если → Да/Нет». Триггеры: фраза, время, вручную. */
(function () {
  'use strict';
  const O = window.Orbit = window.Orbit || {}, KEY = 'orbit-scripts-v1';
  const esc = s => (O.esc ? O.esc(s) : String(s == null ? '' : s)).replace(/"/g, '"');
  const N = s => (O.engine && O.engine.N ? O.engine.N(s) : String(s || '').toLowerCase().replace(/ё/g, 'е'));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  console.error('[Контур] scripts.js temporarily incomplete — upload scripts-5.7.2.js from agent artifacts');
  O.scripts = { panel() {}, match() { return null; }, matchName() { return null; }, find() { return null; }, run() {}, list: () => [], templates: [], saveGraph() {} };
})();

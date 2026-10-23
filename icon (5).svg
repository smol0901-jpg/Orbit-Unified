/* FlowForge · режим «Сценарий агента».
   Работает только внутри Контура (iframe того же origin): блоки агента из каталога навыков, запуск схемы с подсветкой текущего блока,
   сохранение схемы как сценария агента. Подробнее: ../docs/SCENARIO-GRAPH.md (в репозитории Контура). */
(function () {
  'use strict';
  let O = null;
  try { if (window.parent !== window && window.parent.Orbit && window.parent.Orbit.flow) O = window.parent.Orbit; } catch (e) { O = null; }
  if (!O) return;                                   // отдельно от Контура режим не нужен
  const F = O.flow, esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SPEC = {
    start: { type: 'terminal', text: 'Начало', color: '#a6e3a1' }, end: { type: 'terminal', text: 'Конец', color: '#a6e3a1' },
    say: { type: 'process', text: 'Сообщение', color: '#f9e2af' }, cmd: { type: 'process', text: 'что дальше', color: '#89b4fa' },
    day: { type: 'process', text: 'Сегодня', color: '#94e2d5' }, tasks: { type: 'process', text: 'Задачи', color: '#94e2d5' }, plans: { type: 'process', text: 'Планы', color: '#94e2d5' },
    reminders: { type: 'process', text: 'Напоминания', color: '#94e2d5' }, edits: { type: 'process', text: 'Правки', color: '#94e2d5' },
    ask: { type: 'process', text: 'Как настроение?', color: '#f5c2e7' }, set: { type: 'process', text: 'Запомнить', color: '#f5c2e7' }, sub: { type: 'process', text: 'Запустить сценарий', color: '#cba6f7' },
    report: { type: 'process', text: 'Показать отчёт', color: '#cba6f7' }, decision: { type: 'decision', text: 'Условие?', color: '#fab387' }
  };
  const CONDS = [['', 'Определить по тексту ромба'], ['ask', 'Спросить пользователя (Да/Нет)'], ['weekday:work', 'Сегодня будний день'], ['weekday:off', 'Сегодня выходной'], ['hw', 'Есть открытые задачи'],
    ['overdue', 'Есть просроченное'], ['reminders', 'Есть активные напоминания'], ['meetings', 'Сегодня есть встречи'], ['time:after', 'Сейчас после времени…'], ['time:before', 'Сейчас до времени…'],
    ['count', 'Повторить N раз (петля назад по «Да»)'], ['var:yes', 'Ответ похож на «да»'], ['var:has', 'Ответ содержит…'], ['var:eq', 'Ответ равен…'], ['var:empty', 'Ответ пустой']];
  let on = false, running = false, built = false;
  const $a = s => document.querySelector(s);

  /* ───── интерфейс ───── */
  function build() {
    if (built) return; built = true;
    const top = $a('#top'), sep = top && top.querySelector('.sep');
    const btn = document.createElement('button'); btn.id = 'agBtn'; btn.dataset.ag = 'toggle'; btn.title = 'Сценарий агента'; btn.textContent = '🤖';
    if (top) top.insertBefore(btn, sep ? sep.nextSibling : null);
    const p = document.createElement('div'); p.id = 'agp'; p.hidden = true;
    p.innerHTML = `<div class="lh"><b>🤖 Сценарий агента</b><span><button data-ag="close" title="Закрыть">✕</button></span></div>
      <input id="agn" placeholder="Название сценария">
      <div class="row"><select id="agtr"><option value="manual">Запуск: вручную</option><option value="phrase">Запуск: фразой в чате</option><option value="time">Запуск: по времени</option></select></div>
      <div class="row"><input id="agtv" placeholder="Фраза, например: отчёт дня" hidden><input id="agtt" type="time" value="08:00" hidden><label class="mini" id="agwd" hidden><input type="checkbox" id="agwk" checked> только по будням</label></div>
      <div class="row"><button class="pri" data-ag="run">▶ Запустить</button><button data-ag="save">💾 В агента</button><button data-ag="rep" id="agrep" hidden>📋 Отчёт</button></div>
      <small id="agst">Тап по блоку добавляет его и соединяет с выбранным. После «Условия» связи получают подписи «Да» и «Нет».</small>
      <h4>Блоки</h4><div class="agpal" id="agpal"></div>
      <h4>Команды агента</h4><div class="agpal" id="agsk"></div>`;
    ($a('#stage') || document.body).appendChild(p);
    $a('#agpal').innerHTML = F.list().map(b => `<button data-ag="blk" data-b="${b.b}" data-c="${b.cat}" title="${esc(b.hint || '')}">${esc(b.label)}</button>`).join('');
    const SK = (O.actions && O.actions.SKILLS) || [];
    $a('#agsk').innerHTML = SK.filter(s => s.examples && s.examples.length).map((s, i) => `<button data-ag="sk" data-i="${i}" data-c="agent" title="${esc(s.examples[0])}">${esc(s.label)}</button>`).join('');
    const sec = document.createElement('div'); sec.className = 'sec'; sec.id = 's-agent'; sec.hidden = true;
    sec.innerHTML = `<h4>Блок агента</h4><div class="row"><select id="agb"><option value="">Определить по тексту</option>${F.list().map(b => `<option value="${b.b}">${esc(b.label)}</option>`).join('')}</select></div>
      <input id="agt" placeholder="Заголовок раздела в отчёте (необязательно)">
      <div id="agq" hidden><input id="agv" placeholder="Имя переменной (например: ответ)"><input id="agval" placeholder="Значение (можно {{переменную}})" hidden><select id="ags" hidden></select></div>
      <div id="agc" hidden><div class="row"><select id="agk">${CONDS.map(c => `<option value="${c[0]}">${esc(c[1])}</option>`).join('')}</select><input id="agtm" type="time" value="12:00" hidden></div><div class="row"><input id="agx1" hidden><input id="agx2" hidden></div></div>
      <small id="agh"></small>`;
    const sn = $a('#s-node'); if (sn) sn.insertAdjacentElement('afterend', sec);
    wire();
  }
  function meta() { return S.agent || (S.agent = {}); }
  function fill() {
    const m = S.agent || {}, t = m.trigger || { kind: 'manual' };
    $a('#agn').value = m.name || (typeof pname === 'function' ? pname() : '');
    $a('#agtr').value = t.kind || 'manual'; $a('#agtv').value = t.text || ''; $a('#agtt').value = t.at || '08:00'; $a('#agwk').checked = !t.days || (t.days.length === 5);
    trigUi();
  }
  function trigUi() { const k = $a('#agtr').value; $a('#agtv').hidden = k !== 'phrase'; $a('#agtt').hidden = k !== 'time'; $a('#agwd').hidden = k !== 'time'; }
  function trigger() {
    const k = $a('#agtr').value;
    if (k === 'phrase') return { kind: 'phrase', text: $a('#agtv').value.trim() };
    if (k === 'time') return { kind: 'time', at: $a('#agtt').value || '08:00', days: $a('#agwk').checked ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6] };
    return { kind: 'manual' };
  }
  function say(t) { const el = $a('#agst'); if (el) el.textContent = t; }

  /* ───── блоки ───── */
  function addAg(b, text) {
    const sp = SPEC[b]; if (!sp) return;
    const r = svg.getBoundingClientRect(), c = S.cam, s = sel.size === 1 ? N([...sel][0]) : null, o = (S.nodes.length % 6) * 20;
    let n;
    if (s) { n = addNode(sp.type, s.x, s.y + s.h + 60, text || sp.text, sp.color); addEdge(s.id, n.id, s.type === 'decision' ? (['Да', 'Нет', ''][Math.min(2, S.edges.filter(e => e.from === s.id).length)]) : ''); }
    else n = addNode(sp.type, (r.width / 2 - c.x) / c.k - 60 + o, (r.height / 2 - c.y) / c.k - 30 + o, text || sp.text, sp.color);
    n.ag = { b }; sel = new Set([n.id]); selE = null; selG = null; commit();
  }
  function inferAg(n) { try { return F.fromScheme({ nodes: [{ id: n.id, type: n.type, text: n.text }], edges: [] }).nodes[0].ag; } catch (e) { return { b: 'say' }; } }
  function syncInsp() {
    const sec = $a('#s-agent'); if (!sec) return;
    const one = sel.size === 1 ? N([...sel][0]) : null;
    sec.hidden = !(on && one); if (!(on && one)) return;
    const ag = one.ag || null, b = ag ? ag.b : '';
    $a('#agb').value = b; $a('#agt').value = (ag && ag.title) || '';
    const shown = b || inferAg(one).b, dec = shown === 'decision' || one.type === 'decision', q = shown === 'ask' || shown === 'set' || shown === 'sub';
    $a('#agq').hidden = !q; $a('#agv').hidden = shown === 'sub'; $a('#agval').hidden = shown !== 'set'; $a('#ags').hidden = shown !== 'sub';
    if (q) { $a('#agv').value = (ag && ag.var) || ''; $a('#agval').value = (ag && ag.value) || ''; if (shown === 'sub') fillSubs(ag && ag.ref); }
    $a('#agc').hidden = !dec;
    if (dec) {
      const c = ag && ag.cond; let v = '';
      if (c) v = (c.k === 'time' || c.k === 'weekday' || c.k === 'var') ? c.k + ':' + c.v : c.k; else if (ag && ag.ask) v = 'ask';
      $a('#agk').value = CONDS.some(x => x[0] === v) ? v : ''; const k = $a('#agk').value, isCount = k === 'count', isVar = /^var:/.test(k);
      $a('#agtm').hidden = !/^time:/.test(k); if (c && c.at) $a('#agtm').value = c.at;
      $a('#agx1').hidden = !(isCount || isVar); $a('#agx2').hidden = !/^var:(has|eq)$/.test(k);
      $a('#agx1').placeholder = isCount ? 'Сколько раз повторить (число)' : 'Имя переменной (по умолчанию: ответ)'; $a('#agx2').placeholder = 'С чем сравнить';
      $a('#agx1').value = c ? (isCount ? c.n : c.name || '') : ''; $a('#agx2').value = c && c.value ? c.value : '';
    }
    const H = { cmd: 'Текст блока — команда агента, как в чате. Можно {{переменные}}.', say: 'Текст блока попадёт в отчёт. Можно {{переменные}}.', ask: 'Текст блока — вопрос. Ответ пользователя сохраняется в переменную; дальше {{имя}} можно подставлять в тексты и команды.', set: 'Запоминает значение в переменной.', sub: 'Запускает другой сценарий; переменные и отчёт общие.', report: 'Выводит собранное сейчас (в конце сценария выводится само).', start: 'Начало сценария.', end: 'Конец ветки.', decision: 'Связи подпишите «Да» и «Нет». Для петли ведите «Да» назад к началу повтора.' };
    $a('#agh').textContent = H[shown] || (F.BLOCKS[shown] ? 'Встроенный блок: ' + F.BLOCKS[shown].hint + '.' : '');
  }
  function setBlock(v) {
    sel.forEach(i => { const n = N(i); if (!n) return;
      if (!v) { delete n.ag; return; }
      n.ag = Object.assign({}, n.ag || {}, { b: v }); const sp = SPEC[v]; if (sp) { n.color = sp.color; if (sp.type === 'decision' || n.type === 'decision') n.type = sp.type === 'decision' ? 'decision' : 'process'; if (sp.type === 'terminal') n.type = 'terminal'; dim(n); } });
    commit();
  }
  function setCond() {
    const n = sel.size === 1 && N([...sel][0]); if (!n) return;
    const v = $a('#agk').value, ag = n.ag = n.ag || { b: 'decision' }; delete ag.cond; delete ag.ask;
    if (v === 'ask') ag.ask = true;
    else if (v === 'count') ag.cond = { k: 'count', n: Math.max(1, Math.min(20, Math.round(+$a('#agx1').value) || 1)) };
    else if (/^var:/.test(v)) ag.cond = { k: 'var', v: v.split(':')[1], name: ($a('#agx1').value || '').trim() || 'ответ', value: $a('#agx2').value };
    else if (v) { const [k, x] = v.split(':'); ag.cond = { k }; if (x) ag.cond.v = x; if (k === 'time') ag.cond.at = $a('#agtm').value || '12:00'; }
    syncInsp(); commit();
  }
  function fillSubs(cur) {
    const me = S.agent && S.agent.scId, list = (O.scripts.list() || []).filter(s => s.id !== me && (s.graph || (s.steps && s.steps.length)));
    $a('#ags').innerHTML = '<option value="">— выберите сценарий —</option>' + list.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    $a('#ags').value = cur || '';
  }

  /* ───── запуск и сохранение ───── */
  const nameNow = () => ($a('#agn').value || '').trim() || (typeof pname === 'function' ? pname() : 'Сценарий');
  async function runNow() {
    if (running) return;
    const g = F.fromScheme(ser(), nameNow()), chk = F.validate(g);
    if (!chk.ok) return say('Нельзя запустить: ' + chk.errors[0]);
    running = true; say('Выполняю… текущий блок подсвечен.'); $a('#agrep').hidden = true;
    const before = sel;
    try {
      const ctx = await F.run(g, { name: nameNow(), delay: 380, onStep: id => { sel = new Set([id]); selE = null; selG = null; draw(); } });
      say(ctx.error ? ctx.error : ctx.warn && ctx.warn.length ? 'Готово с замечаниями: ' + ctx.warn[0] : ctx.stopped ? 'Остановлено: вопрос остался без ответа.' : 'Готово — отчёт в чате агента.');
      $a('#agrep').hidden = !(ctx && ctx.message);
    } catch (e) { say('Ошибка запуска: ' + (e.message || e)); }
    sel = new Set(); selE = null; draw(); insp(); running = false; void before;
  }
  function openChat() { try { const core = O.core(); core.switchTab('agent'); O.assistant.panel = 'chat'; O.assistant.render && O.assistant.render(false); } catch (e) { /* не критично */ } }
  function saveAgent() {
    const g = F.fromScheme(ser(), nameNow()), chk = F.validate(g);
    if (!chk.ok) return say('Нельзя сохранить: ' + chk.errors[0]);
    const m = meta(); m.name = nameNow(); m.trigger = trigger();
    if (m.trigger.kind === 'phrase' && !m.trigger.text) return say('Введите фразу запуска или выберите «вручную».');
    m.scId = O.scripts.saveGraph({ id: m.scId, src: (typeof cfg !== 'undefined' && cfg.pid) || undefined, name: m.name, trigger: m.trigger, graph: g });
    save(); say('Сохранено в агенте: «' + m.name + '». Запуск — вкладка «Сценарии»' + (m.trigger.kind === 'phrase' ? ' или фраза «' + m.trigger.text + '»' : '') + '.'); toast('Сценарий «' + m.name + '» сохранён в агенте');
  }

  function wire() {
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-ag]'); if (!b) return; const a = b.dataset.ag;
      if (a === 'toggle') { if (on) close(); else open(); }
      else if (a === 'close') close();
      else if (a === 'blk') addAg(b.dataset.b);
      else if (a === 'sk') { const SK = (O.actions.SKILLS || []).filter(s => s.examples && s.examples.length), s = SK[+b.dataset.i]; if (s) addAg('cmd', s.examples[0]); }
      else if (a === 'run') runNow();
      else if (a === 'save') saveAgent();
      else if (a === 'rep') openChat();
    });
    $a('#agtr').onchange = () => { trigUi(); const m = meta(); m.trigger = trigger(); save(); };
    ['agn', 'agtv', 'agtt', 'agwk'].forEach(id => $a('#' + id).onchange = () => { const m = meta(); m.name = nameNow(); m.trigger = trigger(); save(); });
    $a('#agb').onchange = e => setBlock(e.target.value);
    $a('#agt').oninput = e => { const n = sel.size === 1 && N([...sel][0]); if (!n) return; n.ag = n.ag || inferAg(n); if (e.target.value.trim()) n.ag.title = e.target.value.trim(); else delete n.ag.title; };
    $a('#agt').onchange = commit; $a('#agk').onchange = setCond; $a('#agtm').onchange = setCond;
    $a('#agx1').onchange = setCond; $a('#agx2').onchange = setCond;
    const cur = () => { const n = sel.size === 1 && N([...sel][0]); if (!n) return null; n.ag = n.ag || inferAg(n); return n; };
    $a('#agv').oninput = e => { const n = cur(); if (!n) return; const v = e.target.value.trim(); if (v) n.ag.var = v; else delete n.ag.var; };
    $a('#agval').oninput = e => { const n = cur(); if (!n) return; n.ag.value = e.target.value; };
    $a('#agv').onchange = $a('#agval').onchange = commit;
    $a('#ags').onchange = e => { const n = cur(); if (!n) return; const o = e.target.selectedOptions[0]; if (e.target.value) { n.ag.ref = e.target.value; n.text = o.textContent; dim(n); } else delete n.ag.ref; commit(); };
  }
  function open() { build(); on = true; $a('#agp').hidden = false; $a('#agBtn').classList.add('on'); fill(); syncInsp(); }
  function close() { on = false; if ($a('#agp')) $a('#agp').hidden = true; if ($a('#agBtn')) $a('#agBtn').classList.remove('on'); syncInsp(); }

  const _insp = insp; insp = function () { _insp.apply(this, arguments); syncInsp(); };
  window.agOpen = open;
  if (document.readyState !== 'loading') build(); else document.addEventListener('DOMContentLoaded', build);
})();

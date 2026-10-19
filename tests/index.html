<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Контур · самопроверка</title>
<style>
  :root { --bg:#07090f; --card:#12182a; --line:#232c45; --text:#eef2ff; --dim:#94a3b8; --ok:#34d399; --bad:#f87171; --acc:#6366f1; }
  @media (prefers-color-scheme: light) { :root { --bg:#f1f5f9; --card:#fff; --line:#d8e0ee; --text:#0f172a; --dim:#475569; --ok:#047857; --bad:#b91c1c; --acc:#4f46e5; } }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--text); }
  main { max-width: 920px; margin: 0 auto; padding: 18px 14px 80px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p.sub { margin: 0 0 14px; color: var(--dim); }
  .warn { border:1px solid var(--line); border-left:4px solid var(--bad); background:var(--card); padding:12px 14px; border-radius:10px; margin-bottom:14px; }
  .bar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:12px; }
  button { font:inherit; padding:10px 16px; border-radius:10px; border:1px solid var(--line); background:var(--card); color:var(--text); cursor:pointer; }
  button.primary { background:var(--acc); border-color:var(--acc); color:#fff; font-weight:600; }
  button:disabled { opacity:.5; cursor:default; }
  input[type=text] { font:inherit; padding:9px 12px; border-radius:10px; border:1px solid var(--line); background:var(--card); color:var(--text); min-width:0; flex:1; }
  .sum { font-weight:600; }
  .sum .ok { color:var(--ok); } .sum .bad { color:var(--bad); }
  progress { width:100%; height:6px; accent-color: var(--acc); }
  details { background:var(--card); border:1px solid var(--line); border-radius:10px; margin:8px 0; }
  summary { cursor:pointer; padding:10px 14px; font-weight:600; display:flex; justify-content:space-between; gap:10px; }
  ul { list-style:none; margin:0; padding:0 14px 8px; }
  li { padding:6px 0; border-top:1px solid var(--line); display:flex; gap:10px; }
  li:first-child { border-top:0; }
  .m { flex:0 0 1.4em; font-weight:700; } .ok .m { color:var(--ok); } .fail .m { color:var(--bad); }
  .err { color:var(--bad); font-size:13px; margin-top:2px; word-break:break-word; }
  .ms { color:var(--dim); font-size:12px; margin-left:auto; white-space:nowrap; }
  iframe { position:fixed; right:-2000px; top:0; height:760px; border:0; }
  body.show iframe { position:static; display:block; margin:14px auto; border:1px solid var(--line); border-radius:10px; max-width:100%; }
</style>
</head>
<body>
<main>
  <h1>Контур · самопроверка</h1>
  <p class="sub">Проверяет запуск, все разделы, ассистента, данные, офлайн-режим и отсутствие школьной лексики. Приложение открывается во встроенном окне.</p>
  <div class="warn" id="warn">Тесты временно очищают локальные данные этого сайта (расписание, задачи, заметки). Перед запуском я сохраню копию в браузере и верну её в конце, а также скачаю файл-резерв. Надёжнее запускать на отдельном адресе или на localhost.</div>
  <div class="bar">
    <button class="primary" id="run">Запустить все тесты</button>
    <input type="text" id="flt" placeholder="Фильтр: например, Ассистент или PWA">
    <button id="toggle">Показать приложение</button>
  </div>
  <progress id="prog" value="0" max="1" hidden></progress>
  <p class="sum" id="sum" aria-live="polite"></p>
  <div id="out"></div>
  <iframe id="app-frame" title="Тестируемое приложение" style="width:390px"></iframe>
</main>
<script src="suite.js"></script>
<script>
(function () {
  const $ = id => document.getElementById(id), qs = new URLSearchParams(location.search);
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (local || qs.get('auto')) $('warn').hidden = true;
  $('toggle').onclick = () => { const s = document.body.classList.toggle('show'); $('toggle').textContent = s ? 'Скрыть приложение' : 'Показать приложение'; };
  $('flt').value = qs.get('filter') || '';

  function snapshot() { const s = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); s[k] = localStorage.getItem(k); } return s; }
  function restore(s) { localStorage.clear(); Object.keys(s).forEach(k => localStorage.setItem(k, s[k])); }
  function download(s) { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(s)], { type: 'application/json' })); a.download = 'kontur-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); } catch (e) {} }

  function render(results, running) {
    const g = {}; results.forEach(r => (g[r.group] = g[r.group] || []).push(r));
    const fails = results.filter(r => r.status === 'fail').length;
    $('sum').innerHTML = '<span class="ok">Пройдено: ' + (results.length - fails) + '</span> · <span class="bad">Провалено: ' + fails + '</span> · Всего: ' + results.length + (running ? ' …' : '');
    $('out').innerHTML = Object.keys(g).map(k => {
      const f = g[k].filter(r => r.status === 'fail').length;
      return '<details' + (f ? ' open' : '') + '><summary><span>' + k + '</span><span>' + (g[k].length - f) + '/' + g[k].length + '</span></summary><ul>' +
        g[k].map(r => '<li class="' + r.status + '"><span class="m">' + (r.status === 'ok' ? '✓' : '✗') + '</span><div>' + esc(r.name) + (r.error ? '<div class="err">' + esc(r.error) + '</div>' : '') + '</div><span class="ms">' + r.ms + ' мс</span></li>').join('') + '</ul></details>';
    }).join('');
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function start() {
    const snap = snapshot(); if (!local && !qs.get('auto')) download(snap);
    $('run').disabled = true; $('prog').hidden = false; $('prog').max = window.ContourTests.count(); $('prog').value = 0;
    window.__RESULTS = { done: false, results: [] };
    let results = [];
    try {
      results = await window.ContourTests.runAll({ filter: $('flt').value.trim(), onResult: (r, all) => { $('prog').value = all.length; render(all, true); window.__RESULTS.results = all.slice(); } });
    } finally { restore(snap); $('run').disabled = false; $('prog').hidden = true; }
    render(results, false); window.__RESULTS = { done: true, results };
  }
  $('run').onclick = start;
  if (qs.get('auto')) start();
})();
</script>
</body>
</html>

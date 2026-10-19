/* Контур · Service Worker — единственный на весь проект.
   Калькулятор CIFRA и схемы FlowForge открываются внутри Контура и работают под этим же воркером: отдельные воркеры
   подприложений на одном адресе стирали чужие кэши и ломали офлайн-режим.
   • офлайн: все файлы приложения кэшируются при установке (включая библиотеки dagre/jsPDF для схем);
   • обновления: новая версия ставится в фоне, пользователь подтверждает «Обновить» (тост в приложении);
   • «Поделиться в Контур»: принимает файл/текст из системного меню (share_target) и передаёт в приложение. */
const V = 'contour-v5.4.0';
const SHARE = 'contour-share';
const CORE = [
  './', './index.html', './manifest.json', './version.json',
  './browserconfig.xml', './css/styles.css', './css/orbit4.css', './js/qrcode.js',
  './js/jsQR.js', './js/xlsx.mini.min.js', './js/app.js', './js/orbit/engine.js',
  './js/orbit/kit.js', './js/orbit/brand.js', './js/orbit/habits.js', './js/orbit/dash.js',
  './js/orbit/lists.js', './js/orbit/actions.js', './js/orbit/llm.js', './js/orbit/assistant.js', './js/orbit/inline.js',
  './js/orbit/scripts.js', './js/orbit/share.js', './js/orbit/settings.js', './js/orbit/boot.js',
  './js/orbit/tools.js', './js/orbit/work.js', './cifra/js/engine.js', './icons/icon.svg',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './icons/favicon-32.png', './cifra/index.html', './cifra/css/style.css', './cifra/js/app.js', './cifra/js/voice.js',
  './cifra/js/tools.js', './cifra/js/graph.js', './cifra/js/db.js', './cifra/manifest.webmanifest',
  './flowforge/index.html', './flowforge/css/style.css', './flowforge/js/app.js', './flowforge/manifest.webmanifest',
  './flowforge/icons/icon-192.png', './flowforge/icons/icon-512.png', './flowforge/icons/icon.svg', './flowforge/icons/logo.webp',
  './cifra/icons/icon-192.png', './cifra/icons/icon-512.png', './cifra/icons/icon.svg', './cifra/icons/brand.png',
  './icons/icon-maskable-192.png', './icons/mstile-150.png'];
const CDN = ['https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dagre.min.js', 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all([
    ...CORE.map(u => c.add(u).catch(() => {})),
    // внешние скрипты: opaque-ответ нельзя добавить через add(), кладём вручную
    ...CDN.map(u => fetch(new Request(u, { mode: 'no-cors' })).then(r => c.put(u, r)).catch(() => {}))
  ])));
});

// чистим только кэши Контура прошлых версий и кэши прежних отдельных воркеров (orbit-*, ff-*, cifra-*)
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k =>
    (k.startsWith('contour-') && k !== V && k !== SHARE) || k.startsWith('orbit-') || k.startsWith('ff-') || k.startsWith('cifra-')
  ).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { const d = e.data; if (d === 'SKIP_WAITING' || (d && d.type === 'SKIP_WAITING')) self.skipWaiting(); });

const strip = url => url.origin + url.pathname;

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) { e.respondWith(receiveShare(req)); return; }
  if (req.method !== 'GET') return;
  if (url.origin !== location.origin) { if (CDN_HOSTS.includes(url.hostname)) e.respondWith(cacheFirst(req)); return; }
  if (url.pathname.endsWith('/version.json')) { e.respondWith(fetch(req).catch(() => caches.match(req, { ignoreSearch: true }))); return; }
  if (req.mode === 'navigate') { e.respondWith(navigate(req, url)); return; }
  e.respondWith(staleWhileRevalidate(req));
});

// страницы: сеть → кэш. Каждая страница кэшируется под СВОИМ адресом (раньше любая навигация, в том числе внутри iframe
// калькулятора, затирала запись главной страницы).
async function navigate(req, url) {
  const c = await caches.open(V);
  try {
    const r = await fetch(req);
    if (r && r.ok && r.type === 'basic') c.put(strip(url), r.clone());
    return r;
  } catch (err) {
    const hit = await c.match(strip(url)) || await c.match(url.href, { ignoreSearch: true });
    if (hit) return hit;
    if (req.destination !== 'iframe') { const shell = await c.match('./index.html'); if (shell) return shell; }
    return Response.error();
  }
}
async function staleWhileRevalidate(req) {
  const c = await caches.open(V);
  const hit = await c.match(req, { ignoreSearch: true });
  const net = fetch(req).then(r => { if (r && r.ok && r.type === 'basic') c.put(req, r.clone()); return r; }).catch(() => null);
  return hit || (await net) || Response.error();
}
async function cacheFirst(req) {
  const c = await caches.open(V);
  const hit = await c.match(req);
  if (hit) return hit;
  try { const r = await fetch(req); if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; } catch (err) { return Response.error(); }
}

async function receiveShare(req) {
  try {
    const fd = await req.formData(); let text = '';
    const f = fd.get('file'); if (f && typeof f !== 'string') text = await f.text();
    if (!text) text = [fd.get('text'), fd.get('url')].filter(Boolean).join('\n').trim();
    const c = await caches.open(SHARE); await c.put('/shared.contour', new Response(text));
  } catch (e) {}
  return Response.redirect(new URL('./index.html?shared=1', self.registration.scope).href, 303);
}

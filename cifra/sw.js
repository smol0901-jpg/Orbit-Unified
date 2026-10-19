const V='cifra-v17';
const A=['./','index.html','css/style.css','js/engine.js','js/graph.js','js/db.js','js/tools.js','js/app.js','js/voice.js','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/brand.png','icons/nova-192.png','icons/icon-nova.svg'];
const CDN=['cdnjs.cloudflare.com'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(A)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('cifra-')&&x!==V).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||(u.origin!==self.location.origin&&!CDN.includes(u.hostname)))return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>{
    const net=fetch(e.request).then(res=>{if(res.ok||res.type==='opaque'){const c=res.clone();caches.open(V).then(x=>x.put(e.request,c))}return res})
      .catch(()=>r||(e.request.mode==='navigate'?caches.match('index.html'):Response.error()));
    return r||net;
  }));
});

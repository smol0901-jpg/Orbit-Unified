/* История в IndexedDB: срок хранения задаётся настройкой, все вызовы безопасны при сбое. */
const DB=(()=>{
let p;
const open=()=>p||(p=new Promise((ok,no)=>{
  if(!window.indexedDB)return no(Error('no idb'));
  const r=indexedDB.open('raschet',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('h',{keyPath:'id',autoIncrement:true});
  r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
}));
const tx=async(mode,f)=>{const d=await open();return new Promise((ok,no)=>{
  const t=d.transaction('h',mode),q=f(t.objectStore('h'));
  t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>no(t.error);
})};
return{
  add:(e,r,v)=>tx('readwrite',s=>s.add({t:Date.now(),e,r,v})),
  all:()=>tx('readonly',s=>s.getAll()).then(a=>a.reverse()),
  clear:()=>tx('readwrite',s=>s.clear()),
  prune:ms=>tx('readwrite',s=>{s.openCursor().onsuccess=e=>{const c=e.target.result;if(c){if(c.value.t<Date.now()-ms)c.delete();c.continue()}}})
};
})();

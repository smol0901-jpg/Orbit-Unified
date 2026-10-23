(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const V='8.0',SHEETJS='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const TG='https://t.me/ASV_PROD',DZ='https://dzen.ru/asv_prod';
const TOOLS=[['pH-метр','https://smol0901-jpg.github.io/ph-metr/'],['HACCP Control','https://haccp-control.netlify.app'],['HACCP Studio v8','https://smol0901-jpg.github.io/haccp-studio-v8/'],['Тестирование','https://smol0901-jpg.github.io/testing/index.html'],['Калькулятор (онлайн)','https://smol0901-jpg.github.io/calculator/'],['FlowForge 2.3','https://smol0901-jpg.github.io/Flowforge-2-3/']];
const D={vvib:1,vbeep:0,vspeak:1,theme:'auto',accent:'#7c5cff',bg:'nova',hap:2,sound:0,size:1,shape:'round',dec:10,grp:'sp',dsep:',',deg:false,anim:'on',awake:'off',keep:'month',sci:false,mem:null,v:5};
let cfg={...D};try{Object.assign(cfg,JSON.parse(localStorage.getItem('cfg')))}catch(e){}
if(!cfg.v){if(cfg.accent==='#3347d6')cfg.accent=D.accent;cfg.v=3}
if(cfg.v<4){cfg.mem=null;cfg.v=4}
if(cfg.v<5){cfg.bg='nova';cfg.accent=D.accent;cfg.v=5}   /* ребрендинг: новая палитра по умолчанию */
const save=()=>{try{localStorage.setItem('cfg',JSON.stringify(cfg))}catch(e){}};
const dot=s=>cfg.dsep==='.'?s.replace(/,/g,'.'):s;
const fmt=n=>dot(Engine.fmt(n,cfg.dec,cfg.grp)),money=n=>dot(Engine.fmt(Math.round(n*100)/100,2,cfg.grp));
const show=s=>cfg.dsep===','?s.replace(/\./g,','):s;
const OPS='+−×÷^',FN=/(a?sin\(|a?cos\(|a?tan\(|ln\(|log\(|√\(|abs\(|.)$/;
/* Обычный: цифры + повседневные операции. Математический: + SCI-панель (тригонометрия, log, …) */
const MAIN_BASIC=[
  ['AC','c','fn'],['⌫','bs','fn'],['(','(','fn'],[')',')','fn'],
  ['%','%','fn'],['√','√(','fn'],['x²','^2','fn'],['÷','÷','op'],
  ['7'],['8'],['9'],['×','×','op'],
  ['4'],['5'],['6'],['−','−','op'],
  ['1'],['2'],['3'],['+','+','op'],
  ['0','0','z'],[',','.'],['=','=','eq']
];
const MAIN_SCI=[
  ['AC','c','fn'],['⌫','bs','fn'],['(','(','fn'],[')',')','fn'],
  ['7'],['8'],['9'],['÷','÷','op'],
  ['4'],['5'],['6'],['×','×','op'],
  ['1'],['2'],['3'],['−','−','op'],
  ['0'],[',','.'],['+','+','op'],['=','=','eq']
];
const SCI=[['sin','sin('],['cos','cos('],['tan','tan('],['π','π'],['ln','ln('],['log','log('],['√','√('],['e','e'],['x²','^2'],['xʸ','^'],['n!','!'],['1/x','1÷('],['abs','abs('],['10ˣ','10^('],['RAD','deg'],['sin⁻¹','asin('],['cos⁻¹','acos('],['tan⁻¹','atan('],['x','x'],['τ','τ'],['exp','exp('],['∛','cbrt('],['sec','sec('],['csc','csc('],['cot','cot('],['nCr','ncr('],['nPr','npr(']];
const MEM=[['MC'],['MR'],['M+'],['M−'],['MS'],['ƒx','sci']];
const FORCE_BASIC=/[?&](?:basic=1|mode=basic)(?:&|$)/.test(location.search);
const SET=[['Оформление',[['theme','Тема','seg',[['auto','Авто'],['light','День'],['dark','Ночь'],['amoled','AMOLED']]],['accent','Цвет акцента','col',['#7c5cff','#22d3ee','#0e9f6e','#e0662b','#c026d3','#e11d48','#0f7fd0']],['bg','Фон','seg',[['nova','CIFRA'],['none','Нет'],['aurora','Аврора'],['dusk','Закат'],['forest','Лес'],['mono','Графит']]]]],
['Отклик',[['hap','Вибрация','seg',[[0,'Выкл'],[1,'Лёгкая'],[2,'Средняя'],[3,'Сильная']]],['sound','Звук нажатий','seg',[[0,'Выкл'],[.05,'Тихий'],[.14,'Громкий']]],['anim','Анимации','sw',['off','on']]]],
['Клавиатура',[['size','Размер кнопок','seg',[[.88,'Компактные'],[1,'Обычные'],[1.15,'Крупные']]],['shape','Форма кнопок','seg',[['round','Мягкие'],['pill','Овал'],['square','Строгие']]]]],
['Расчёты',[['dec','Знаков после запятой','seg',[[10,'Авто'],[2,'2'],[4,'4'],[6,'6']]],['grp','Разряды','seg',[['sp','1 000'],['no','1000']]],['dsep','Десятичный знак','seg',[[',','Запятая'],['.','Точка']]],['deg','Углы','seg',[[false,'Радианы'],[true,'Градусы']]]]],
['Голос',[['vvib','Вибрация при распознавании','sw',[0,1]],['vbeep','Звуковой сигнал','sw',[0,1]],['vspeak','Озвучивать ответ','sw',[0,1]]]],
['Система',[['awake','Не гасить экран','sw',['off','on']],['keep','Хранить историю','seg',[['month','Месяц'],['day','Сутки'],['off','Нет']]]]]];
let expr='',prev='',done=false,val=0,good='0',tab='calc',lp=0,wl,AC,hl;
const mq=matchMedia('(prefers-color-scheme: dark)'),wide=()=>matchMedia('(min-width:860px)').matches;
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;

function apply(){const r=document.documentElement,s=r.style;
  r.dataset.theme=cfg.theme==='auto'?(mq.matches?'dark':'light'):cfg.theme;r.dataset.bg=cfg.bg;r.dataset.anim=cfg.anim;r.classList.toggle('sm',!!cfg.sci);
  s.setProperty('--eq',cfg.accent);s.setProperty('--ks',cfg.size);s.setProperty('--kr',{round:'20px',pill:'999px',square:'8px'}[cfg.shape]||'20px');
  $('meta[name=theme-color]').content=getComputedStyle(r).getPropertyValue('--card').trim()||'#12151b';
  $('#sciPad [data-k=deg]').textContent=cfg.deg?'DEG':'RAD';
  const sciBtn=$('#memp [data-k=sci]');
  if(sciBtn){
    sciBtn.setAttribute('aria-pressed',!!cfg.sci);
    sciBtn.setAttribute('title',cfg.sci?'Математический режим':'Обычный режим');
    sciBtn.setAttribute('aria-label',sciBtn.getAttribute('title'));
    sciBtn.textContent=cfg.sci?'SCI':'ƒx';
  }
  const sp=$('#sciPad');
  if(sp){
    sp.hidden=!cfg.sci;
    sp.style.display=cfg.sci?'':'none';
    if(!cfg.sci) sp.setAttribute('hidden',''); else sp.removeAttribute('hidden');
  }
  if(FORCE_BASIC){cfg.sci=false;const bar=$('#modeBar');if(bar)bar.hidden=true;}

  document.documentElement.classList.toggle('sm',!!cfg.sci);
  const mb=$('#modeBar');
  if(mb){
    mb.querySelectorAll('.mode-btn').forEach(b=>{
      const on=(b.dataset.mode==='sci')===!!cfg.sci;
      b.classList.toggle('on',on);
      b.setAttribute('aria-pressed',on?'true':'false');
    });
  }
  $('#hap').hidden=!HM;$('#hap').classList.toggle('off',!cfg.hap);mark(1);
  $('#pad [data-k="."]').textContent=cfg.dsep;wake()}
mq.onchange=apply;
async function wake(){try{if(cfg.awake==='on'&&navigator.wakeLock&&!wl){wl=await navigator.wakeLock.request('screen');wl.onrelease=()=>wl=null}
  else if(cfg.awake!=='on'&&wl){await wl.release();wl=null}}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')wake()});

/* Вибрация (Android — vibrate; iOS 17.4+ — переключатель-«свитч») и звук (Web Audio) */
const HM=navigator.vibrate&&matchMedia('(pointer:coarse)').matches?'vib':(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))?'sw':'';
const LV=[0,12,22,38],PAT={key:[1],op:[1.2],fn:[1],mem:[1.3],soft:[.7],eq:[1,2.5,1.8],warn:[1.6,3,1.6],err:[2.5,3,2.5,3,3.2]};
function buzz(kind='key'){const l=cfg.hap;if(!l||!HM)return;
  const p=(PAT[kind]||PAT.key).map((x,i)=>i%2?Math.round(x*10):Math.max(8,Math.round(x*LV[l])));
  if(HM==='vib'){try{navigator.vibrate(p)}catch(e){}return}
  if(!hl){hl=document.createElement('label');hl.setAttribute('aria-hidden','true');hl.style.cssText='position:fixed;left:-99px;top:0;width:1px;height:1px;opacity:.01;pointer-events:none';hl.innerHTML='<input type="checkbox" switch>';document.body.append(hl)}
  p.forEach((x,i)=>{if(i%2===0)i?setTimeout(()=>hl.click(),i*30):hl.click()})}
function tick(c){if(!cfg.sound)return;
  try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
    const o=AC.createOscillator(),g=AC.createGain(),t=AC.currentTime;o.type='triangle';o.frequency.value={op:700,eq:900,fn:420}[c]||560;
    g.gain.setValueAtTime(+cfg.sound,t);g.gain.exponentialRampToValueAtTime(.0001,t+.07);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+.08)}catch(e){}}
const fb=c=>{buzz(c==='fn'?'soft':c);tick(c)};
document.addEventListener('pointerup',()=>{if(AC&&AC.state==='suspended')AC.resume()});

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.id);toast.id=setTimeout(()=>t.classList.remove('on'),2200)}
async function copy(t){try{await navigator.clipboard.writeText(t.replace(/[\s\u00a0]/g,'').replace(',','.'));toast('Скопировано')}catch(e){toast('Не удалось скопировать')}}
async function share(t){if(navigator.share){try{await navigator.share({text:t});return}catch(e){if(e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(t);toast('Скопировано — вставьте в чат')}catch(e){toast('Не удалось поделиться')}}
const toExpr=v=>{const s=String(v);return(/e/.test(s)?v.toExponential().replace(/e\+?(-?\d+)/,'×10^($1)'):s).replace(/-/g,'−')};

function mk(list,el){el.innerHTML='';list.forEach(([l,k,c])=>{const b=document.createElement('button');b.textContent=l;b.dataset.k=k||l;if(c)b.className=c;el.append(b)})}
function rebuildPad(){
  const main=cfg.sci?MAIN_SCI:MAIN_BASIC;
  mk(main,$('#pad'));
  /* 6 рядов в обычном, 5 в математическом */
  const pad=$('#pad');
  if(pad) pad.style.gridTemplateRows=cfg.sci?'repeat(5,minmax(0,1fr))':'repeat(6,minmax(0,1fr))';
}
mk(MEM,$('#memp'));mk(SCI,$('#sciPad'));rebuildPad();

/* переключатель Обычный / Математический */
(function(){
  if(FORCE_BASIC){
    cfg.sci=false;
    try{save()}catch(e){}
    const bar=$('#modeBar'); if(bar) bar.hidden=true;
    const fx=$('#memp [data-k=sci]'); if(fx){ fx.hidden=true; fx.style.display='none'; }
    rebuildPad();
  }
  const bar=$('#modeBar'); if(!bar) return;
  bar.addEventListener('click',e=>{
    const b=e.target.closest('.mode-btn'); if(!b||FORCE_BASIC) return;
    const want=b.dataset.mode==='sci';
    if(want===!!cfg.sci) return;
    cfg.sci=want; save(); rebuildPad(); apply();
    toast(want?'Математический режим':'Обычный режим');
  });
})();


function preview(){
  const s=expr.replace(/(?:[+−×÷^(]|(?:a?sin|a?cos|a?tan|ln|log|√|abs)\()+$/,'');
  if(!s){good='0';val=0;return good}
  try{val=Engine.calc(s,cfg.deg);good=fmt(val)}catch(e){}
  return good}
function render(err){
  const r=$('#res'),x=$('#expr');x.textContent=done?show(prev)+' =':show(expr);x.scrollLeft=x.scrollWidth;
  r.textContent=err||(done?fmt(val):preview());r.className=err?'err':'';if(err)buzz('err');
  const n=r.textContent.length;r.style.fontSize=n>16?'1.9rem':n>11?'2.5rem':'3.4rem'}
function equals(){if(!expr||done)return;
  try{val=Engine.calc(expr,cfg.deg);if(cfg.keep!=='off')DB.add(show(expr),fmt(val),val).catch(()=>{});
    prev=expr;expr=toExpr(val);done=true;render();}
  catch(e){render(e.message||'Ошибка')}}
function press(k){
  if(k==='c'){expr='';done=false;return render()}
  if(k==='bs'){if(done){expr='';done=false}else expr=expr.replace(FN,'');return render()}
  if(k==='=')return equals();
  if(k==='sci'){if(FORCE_BASIC)return;cfg.sci=!cfg.sci;save();rebuildPad();apply();toast(cfg.sci?'Математический режим':'Обычный режим');return}
  if(k==='deg'){cfg.deg=!cfg.deg;save();apply();return render()}
  if(/^M[CR+−S]$/.test(k))return memory(k);
  if(k==='1÷('){const l=expr.slice(-1);expr=expr&&!/[+−×÷^(]/.test(l)?'1÷('+expr+')':expr+k;done=false;return render()}
  const isOp=OPS.includes(k)&&k.length===1,post=k==='%'||k==='!'||k==='^2';
  if(done&&!isOp&&!post)expr='';
  done=false;if(expr.length>200)return;
  if(k==='10^('&&/[\d.)x]$/.test(expr))expr+='×';
  const last=expr.slice(-1);
  if(isOp){
    if(!expr)expr=k==='−'?'−':'0'+k;
    else if(OPS.includes(last)){if(k==='−'&&last!=='−'&&last!=='+')expr+=k;else expr=expr.slice(0,-1)+k}
    else if(last==='('){if(k==='−')expr+=k}
    else expr+=k;
  }else if(post){if(expr&&/[\d)πeτx%!^]$/.test(last))expr+=k}
  else if(k==='.'){const seg=expr.match(/[\d.]*$/)[0];if(seg.includes('.'))return;expr+=seg?'.':'0.'}
  else if(/^\d$/.test(k)){const seg=expr.match(/[\d.]*$/)[0];expr=seg==='0'?expr.slice(0,-1)+k:expr+k}
  else if(k==='x'||k==='τ'){const g=expr.match(/[\d.]*$/)[0];
    if(g&&/[\d)]$/.test(expr))expr+='×';expr+=k}
  else if(k==='exp('){if(/[\d)x.]$/.test(last))expr+='×';expr+=k}
  else expr+=k;
  render()}

/* pointerdown = мгновенный отклик; click только для клавиатуры */
document.addEventListener('pointerdown',e=>{const b=e.target.closest('.pad button');if(!b||b.disabled)return;
  const r=b.getBoundingClientRect();b.style.setProperty('--x',e.clientX-r.left+'px');b.style.setProperty('--y',e.clientY-r.top+'px');
  b.classList.remove('rp');void b.offsetWidth;b.classList.add('rp');
  const k=b.dataset.k,c=['op','eq','fn'].find(x=>b.classList.contains(x)),kind=/^M[CR+−S]$/.test(k)?'mem':c||'key';
  b._h=kind;tick(c);if(HM==='vib')buzz(kind);press(k);
  if(k==='bs')lp=setTimeout(()=>{press('c');buzz('warn')},500)});
['pointerup','pointercancel'].forEach(t=>document.addEventListener(t,()=>clearTimeout(lp)));
document.addEventListener('click',e=>{const b=e.target.closest('.pad button');if(!b||b.disabled)return;
  if(e.detail===0)press(b.dataset.k);else if(HM==='sw')buzz(b._h||'key')}); /* iOS: тик только из click-жеста */
addEventListener('keydown',e=>{
  if(tab!=='calc'||$('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT/.test(document.activeElement.tagName))return;
  const k=e.key,map={'*':'×','/':'÷','-':'−','Enter':'=','=':'=','Backspace':'bs','Escape':'c','Delete':'c',',':'.','x':'x','X':'x','τ':'τ'};
  if(/^[0-9.+^()!%]$/.test(k)){tick();press(k)}else if(map[k]){e.preventDefault();tick();press(map[k])}});
let sx=null;const sc=$('.screen');
sc.addEventListener('pointerdown',e=>sx=e.clientX);
sc.addEventListener('pointerup',e=>{if(sx!==null&&Math.abs(e.clientX-sx)>50){fb('fn');press('bs')}sx=null});
$('#res').onclick=()=>copy($('#res').textContent);
$('#share').onclick=()=>share(done?`${show(prev)} = ${fmt(val)}`:$('#res').textContent);
$('#paste').onclick=async()=>{try{const t=(await navigator.clipboard.readText()).replace(/\s/g,'').replace(/,/g,'.').replace(/[^\d.+\-*/×÷−^()!%a-zπ√]/gi,'').replace(/-/g,'−').replace(/\*/g,'×').replace(/\//g,'÷');
  if(!t)return toast('В буфере нет чисел');if(done){expr='';done=false}expr+=t;render()}catch(e){toast('Нет доступа к буферу обмена')}};
$('#copy').onclick=()=>copy($('#res').textContent);
$('#hap').onclick=()=>{cfg.hap=cfg.hap?0:2;save();apply();buzz('mem');toast(cfg.hap?'Вибрация включена':'Вибрация выключена')};
function mark(q){const m=cfg.mem!==null&&cfg.mem!==undefined,b=$('#mb');b.hidden=!m;b.textContent=m?'M  '+fmt(cfg.mem):'';
  $$('#memp [data-k=MC],#memp [data-k=MR]').forEach(x=>x.disabled=!m);if(m&&!q){b.classList.remove('pulse');void b.offsetWidth;b.classList.add('pulse')}}
function memory(k){const has=cfg.mem!==null&&cfg.mem!==undefined;
  if(k==='MC'){cfg.mem=null;save();mark(1);return toast('Память очищена')}
  if(k==='MR'){if(!has)return;const s=toExpr(cfg.mem);if(done){expr='';done=false}
    const g=expr.match(/[\d.]*$/)[0];if(g)expr=expr.slice(0,-g.length);else if(/[)πe%!]$/.test(expr))expr+='×';
    expr+=cfg.mem<0&&expr?'('+s+')':s;return render()}
  if($('#res').className==='err')return;
  preview();const v=val;
  cfg.mem=k==='MS'?v:parseFloat(((has?cfg.mem:0)+(k==='M+'?v:-v)).toPrecision(12));
  save();if(expr&&!done){prev=expr;expr=toExpr(v);done=true}
  mark();render();toast('В памяти: '+fmt(cfg.mem))}

function go(t){tab=t;$$('.nav [data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t===t));['calc','conv','fin','dates','graph','board','acc'].forEach(v=>$('#'+v).hidden=v!==t);
  try{history.replaceState(null,'','?tab='+t)}catch(e){}}
$$('.nav [data-t]').forEach(b=>b.onclick=()=>{fb('fn');go(b.dataset.t)});

/* История (IndexedDB) */
const ttl=()=>cfg.keep==='day'?864e5:30*864e5;
const stamp=t=>new Date(t).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
async function drawer(keepState){const l=$('#list');let h=[];
  try{await DB.prune(ttl());h=await DB.all()}catch(e){}
  l.innerHTML=h.length?'':'<li class="empty">Здесь появятся ваши вычисления</li>';
  h.forEach(x=>{const li=document.createElement('li');li.innerHTML='<small></small><b></b>';
    li.firstChild.textContent=stamp(x.t)+' · '+x.e;li.lastChild.textContent=x.r;
    li.onclick=()=>{expr=toExpr(x.v);done=false;if(!wide())$('#drawer').hidden=true;go('calc');render()};l.append(li)});
  if(!keepState)$('#drawer').hidden=false;drawer.h=h}
$('#hist').onclick=()=>{const d=$('#drawer');if(!d.hidden){d.hidden=true;return}drawer()};$('#close').onclick=()=>$('#drawer').hidden=true;
$('#hc').onclick=async()=>{try{await DB.clear()}catch(e){}toast('История очищена');drawer(true)};
$('#hs').onclick=()=>share((drawer.h||[]).slice().reverse().map(x=>`${x.e} = ${x.r}`).join('\n')||'История пуста');
const lib=src=>window.XLSX?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.append(s)});
async function exportHist(kind){let h=[];try{h=(await DB.all()).reverse()}catch(e){}
  if(!h.length)return toast('История пуста');
  const rows=h.map(x=>[new Date(x.t).toLocaleString('ru-RU'),x.e,x.v]);
  if(kind==='xlsx'){try{await lib(SHEETJS);const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Дата','Выражение','Результат'],...rows]),'История');
    XLSX.writeFile(wb,'raschet-history.xlsx');return toast('Файл Excel сохранён')}catch(e){toast('Excel недоступен без интернета — сохраняю CSV')}}
  const q=c=>'"'+(typeof c==='number'?String(c).replace('.',','):String(c)).replace(/"/g,'""')+'"';
  const csv='\ufeff'+[['Дата','Выражение','Результат'],...rows].map(r=>r.map(q).join(';')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='raschet-history.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
$('#hx').onclick=$('#xl').onclick=()=>exportHist('xlsx');$('#csv').onclick=()=>exportHist('csv');

function settings(){const b=$('#sb'),y=$('#dlg').scrollTop;b.innerHTML='';
  SET.forEach(([t,rows])=>{const s=document.createElement('section');s.innerHTML='<h3></h3><div class="card"></div>';s.firstChild.textContent=t;
    rows.forEach(([k,l,ty,o])=>{const r=document.createElement('div');r.className='st '+ty;const h=document.createElement('span');h.textContent=l;r.append(h);
      const set=v=>{cfg[k]=v;save();apply();render();buzz(k==='hap'?'key':'soft');if(k==='sound')tick();settings()};
      if(ty==='sw'){const w=document.createElement('button'),on=cfg[k]===o[1];w.className='tg';w.setAttribute('role','switch');w.setAttribute('aria-label',l);w.setAttribute('aria-checked',on);w.onclick=()=>set(on?o[0]:o[1]);r.append(w)}
      else{const g=document.createElement('div');g.className=ty==='col'?'cols':'segm';
        o.forEach(x=>{const[v,n]=ty==='col'?[x,'']:x,e=document.createElement('button');e.className=String(cfg[k])===String(v)?'on':'';
          if(ty==='col'){e.style.background=v;e.setAttribute('aria-label',v)}else e.textContent=n;e.onclick=()=>set(v);g.append(e)});r.append(g)}
      s.lastChild.append(r)});
    if(t==='Отклик'){const p=document.createElement('p');p.className='note';p.textContent=HM==='vib'?'Android: вибрация включена в системе устройства.':HM==='sw'?'iPhone: нужен iOS 17.4+ и включённые «Тактильные сигналы» (Настройки → Звуки).':'На этом устройстве вибрации нет — работают звук и анимации.';s.append(p)}
    b.append(s)});$('#dlg').scrollTop=y}
$('#set').onclick=()=>{settings();$('#dlg').showModal()};
$('#dx').onclick=()=>$('#dlg').close();$('#dlg').onclick=e=>{if(e.target===$('#dlg'))$('#dlg').close()};
$('#wipe').onclick=$('#hc').onclick;
$('#reset').onclick=()=>{cfg={...D};save();apply();render();settings();toast('Настройки сброшены')};

function about(){$('#ab').innerHTML=`<div class="brand"><img src="icons/nova-192.png" alt="CIFRA Pro"><b>CIFRA Pro · NEURAL_ARCHITECT PREMIUM++</b><small>v${V} · автор: Смолянинов Александр</small></div>
<div class="links"><a href="${TG}" target="_blank" rel="noopener">Telegram: ASV_PROD</a><a href="${DZ}" target="_blank" rel="noopener">Дзен: ASV_PROD</a></div>
<div class="acts"><button id="fbk">Написать автору</button><button id="shr">Поделиться приложением</button></div>
<h3 class="sub">Что внутри</h3><p class="note">Калькулятор с историей и памятью · научный режим (x, exp, ∛, τ) · график y=f(x) с трассировкой, сдвигом и масштабом · конвертер 12 категорий · финансы с диаграммами · дата-калькулятор. Работает офлайн.</p>
<h3 class="sub">Другие инструменты</h3><div class="links">${TOOLS.map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener">${n}</a>`).join('')}</div>`;
  $('#fbk').onclick=async()=>{const t=`CIFRA Pro v${V}\n${navigator.userAgent}\n${innerWidth}x${innerHeight}, ${standalone?'PWA':'браузер'}\n${JSON.stringify(cfg)}\nОпишите проблему:`;
    try{await navigator.clipboard.writeText(t);toast('Данные скопированы — вставьте в сообщение')}catch(e){}open(TG,'_blank')};
  $('#shr').onclick=()=>share('CIFRA Pro — калькулятор, графики, конвертер, финансы, даты: '+location.href.split('?')[0]);
  $('#about').showModal()}
$('#abt').onclick=()=>{$('#dlg').close();setTimeout(about,50)};
$('#ax').onclick=()=>$('#about').close();$('#about').onclick=e=>{if(e.target===$('#about'))$('#about').close()};

let dp;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();dp=e;$('#install').hidden=false});
if(/iphone|ipad/i.test(navigator.userAgent)&&!standalone)$('#install').hidden=false;
$('#install').onclick=async()=>{if(dp){dp.prompt();await dp.userChoice;dp=null;$('#install').hidden=true}else{$('#dlg').close();toast('Safari: «Поделиться» → «На экран Домой»')}};
addEventListener('appinstalled',()=>$('#install').hidden=true);
const EMBEDDED=window.parent!==window;   /* внутри Контура работает его общий сервис-воркер */
if('serviceWorker' in navigator&&!EMBEDDED){
  if(/^(localhost|127\.|192\.168\.|\[::1\])/.test(location.hostname)){ /* разработка: без кэша, чтобы видеть правки сразу; трогаем только свой воркер и свои кэши */
    const own=new URL('./',location.href).href;
    navigator.serviceWorker.getRegistrations().then(r=>r.filter(x=>x.scope===own).forEach(x=>x.unregister()));caches.keys().then(k=>k.filter(x=>x.startsWith('cifra-')).forEach(x=>caches.delete(x)))}
  else{const had=!!navigator.serviceWorker.controller;
    addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had)toast('Приложение обновлено — перезапустите')})}}


const CB={fmt,money,copy,vib:()=>buzz('soft'),share};
Tools.conv($('#conv'),CB);Tools.fin($('#fin'),CB);Tools.dateTool($('#dates'),CB);Tools.graph($('#graph'),CB);Tools.board($('#board'),CB);Tools.acc($('#acc'),CB);
window.addEventListener('cifra-insert',e=>{if(e.detail){expr=String(e.detail);done=false;render();}});
/* голосовой ввод: js/voice.js присылает выражение, команду и флаг «посчитай» */
/* подтверждение голосового ввода: вибро и/или короткий сигнал (настройки «Голос») */
function beep(k){try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
  const q=k==='ok'?[[660,0],[880,.1]]:k==='err'?[[260,0],[190,.13]]:[[540,0]];
  q.forEach(([f,d])=>{const o=AC.createOscillator(),g=AC.createGain(),t=AC.currentTime+d;o.type='sine';o.frequency.value=f;
    g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.0001,t+.1);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+.11)})}catch(e){}}
window.addEventListener('cifra-vfb',e=>{const k=e.detail;
  if(cfg.vvib){const h=cfg.hap;cfg.hap=h||2;buzz(k==='ok'?'eq':k==='err'?'err':'key');cfg.hap=h}
  if(cfg.vbeep)beep(k)});
window.addEventListener('cifra-voice',e=>{const d=e.detail||{};if(tab!=='calc')go('calc');
  if(d.cmd==='clear')return press('c');if(d.cmd==='bs')return press('bs');
  if(d.expr){const x=d.expr;if(/^[+−×÷^%]/.test(x)&&expr)expr+=x;else expr=/^[+×÷^%]/.test(x)?'0'+x:x;done=false;render()}
  if(d.eq)equals()});
/* управление из чата Контура: {type:'orbit-calc', tab:'conv|fin|dates|graph|board|acc|calc', expr:'2+2'} */
window.addEventListener('message',e=>{const d=e.data;if(!d||d.type!=='orbit-calc')return;if(d.tab&&['calc','conv','fin','dates','graph','board','acc'].includes(d.tab))go(d.tab);if(d.expr){expr=String(d.expr);done=false;go('calc');render();}})
apply();render();
const q=new URLSearchParams(location.search).get('tab');if(['conv','fin','dates','graph','board','acc'].includes(q))go(q);
DB.prune(ttl()).catch(()=>{});
})();

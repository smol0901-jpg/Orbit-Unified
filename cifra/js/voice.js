/* CIFRA Voice — речь → текст → выражение → результат (Web Speech API, ru-RU) */
(()=>{
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const U={ноль:0,нуль:0,один:1,одна:1,одну:1,одно:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,одиннадцать:11,двенадцать:12,тринадцать:13,четырнадцать:14,пятнадцать:15,шестнадцать:16,семнадцать:17,восемнадцать:18,девятнадцать:19,
двадцать:20,тридцать:30,сорок:40,пятьдесят:50,шестьдесят:60,семьдесят:70,восемьдесят:80,девяносто:90,
сто:100,двести:200,триста:300,четыреста:400,пятьсот:500,шестьсот:600,семьсот:700,восемьсот:800,девятьсот:900};
Object.keys(U).forEach(k=>{if(k.endsWith('ть'))U[k.slice(0,-1)+'и']=U[k]});   /* родительный: девяти, двадцати… */
Object.assign(U,{семи:7,восьми:8,двух:2,трех:3,четырех:4,одного:1,сорока:40,девяноста:90,ста:100,пятидесяти:50,шестидесяти:60,семидесяти:70,восьмидесяти:80,двухсот:200,трехсот:300,четырехсот:400,пятисот:500,шестисот:600,семисот:700,восьмисот:800,девятисот:900});
const M={тысяча:1e3,тысячи:1e3,тысяч:1e3,тысячу:1e3,миллион:1e6,миллиона:1e6,миллионов:1e6,миллиард:1e9,миллиарда:1e9,миллиардов:1e9};
const EQ=new Set(['посчитай','посчитать','подсчитай','считай','вычисли','вычислить','реши','равно','равняется','результат','ответ','итого','получится','сколько','=']);
const FILL=new Set(['а','и','на','от','из','число','будет','квадратный','скобка','скобки','скобку','же','ну','давай','пожалуйста','так','итак']);
const DEN={десятых:1,десятая:1,сотых:2,сотая:2,тысячных:3};

function intNum(w,i){
  if(/^\d+$/.test(w[i]||''))return{s:w[i],n:i+1};
  let tot=0,cur=0,ok=false,j=i;
  for(;j<w.length;j++){const t=w[j];
    if(has(U,t)){cur+=U[t];ok=true}
    else if(has(M,t)){tot+=(cur||1)*M[t];cur=0;ok=true}
    else break}
  return ok?{s:String(tot+cur),n:j}:null}
function num(w,i){
  const a=/^\d+[.,]\d+$/.test(w[i]||'')?{s:w[i].replace(',','.'),n:i+1}:intNum(w,i);
  if(!a)return null;
  const j=a.n,t=w[j]||'';
  if(t==='запятая'||t==='точка'){
    let k=j+1,z='';while(['ноль','нуль','0'].includes(w[k])){z+='0';k++}
    const d=intNum(w,k);
    if(d)return{s:a.s+'.'+z+d.s,n:d.n};
    if(z)return{s:a.s+'.'+z,n:k}}
  if(/^цел(ых|ая|ое|ый)$/.test(t)){
    let k=j+1;if(w[k]==='и')k++;
    const d=intNum(w,k);
    if(d&&has(DEN,w[d.n]))return{s:a.s+'.'+d.s.padStart(DEN[w[d.n]],'0'),n:d.n+1}}
  return a}

function parse(raw){
  const w=String(raw).toLowerCase().replace(/ё/g,'е')
    .replace(/[×*]/g,' × ').replace(/[÷/:]/g,' ÷ ').replace(/\+/g,' + ').replace(/[−–—-]/g,' − ').replace(/([()^%=])/g,' $1 ')
    .split(/\s+/).map(x=>x.replace(/[.,!?;]+$/,'')).filter(Boolean);
  const o=[];let eq=false,cl=0,cube=false,nat=false;const unk=[];
  for(let i=0;i<w.length;){
    const a=num(w,i);
    if(a){o.push(a.s);i=a.n;while(cl>0){o.push(')');cl--}continue}
    const t=w[i++],n=w[i];
    if(EQ.has(t))eq=true;
    else if(t==='плюс'||t==='+')o.push('+');
    else if(t==='минус'||t==='−')o.push('−');
    else if(/^(по)?умнож/.test(t)||t==='×'||t==='х'||t==='x'){o.push('×');if(n==='на')i++}
    else if(/^(по|раз)?дел/.test(t)||t==='÷'){o.push('÷');if(n==='на')i++}
    else if(t==='^')o.push('^');
    else if(t==='в'&&n==='степени'){o.push('^');i++}
    else if(t==='в'&&n==='квадрате'){o.push('^2');i++}
    else if(t==='в'&&n==='кубе'){o.push('^3');i++}
    else if(t==='кубический')cube=true;
    else if(t==='корень'){if(n==='кубический'){cube=true;i++}o.push(cube?'∛(':'√(');cube=false;cl++}
    else if(/^синус/.test(t)){o.push('sin(');cl++}
    else if(/^косинус/.test(t)){o.push('cos(');cl++}
    else if(/^тангенс/.test(t)){o.push('tan(');cl++}
    else if(t==='натуральный')nat=true;
    else if(/^логарифм/.test(t)){o.push(nat?'ln(':'log(');nat=false;cl++}
    else if(t==='пи')o.push('π');
    else if(/^процент/.test(t)){o.push('%');if(n==='от'){o.push('×');i++}}
    else if(t==='('||/^откр/.test(t))o.push('(');
    else if(t===')'||/^закр/.test(t))o.push(')');
    else if(!FILL.has(t))unk.push(t);
  }
  const text=w.join(' ');let cmd=null;
  if(!o.length){
    if(/очист|сброс|с нуля|удали(ть)? все|стереть все/.test(text))cmd='clear';
    else if(/удали|назад|стере|отмен/.test(text))cmd='bs'}
  return{expr:o.join(''),eq,cmd,text,unk}}

window.CifraVoice={parse};

/* ---------- интерфейс ---------- */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(typeof document==='undefined')return;
const top=document.querySelector('.top');
if(!top)return;
const cfgv=()=>{try{return JSON.parse(localStorage.getItem('cfg'))||{}}catch(e){return{}}};
const fb=k=>window.dispatchEvent(new CustomEvent('cifra-vfb',{detail:k}));   /* start | ok | err — вибро/звук настраиваются в app.js */
const btn=document.createElement('button');btn.id='mic';btn.className='ib';btn.title='Голосовой ввод';btn.setAttribute('aria-label','Голосовой ввод');
btn.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
top.insertBefore(btn,document.getElementById('hap'));
const bar=document.createElement('div');bar.id='vtr';bar.setAttribute('role','status');document.body.append(bar);
bar.addEventListener('click',()=>{if(last)speak(last,true)});
let rec=null,on=false,tm=0;
const say=(m,ms)=>{bar.textContent=m;bar.classList.add('on');clearTimeout(tm);if(ms)tm=setTimeout(()=>bar.classList.remove('on'),ms)};
let utt=null,last='';
/* iOS разрешает озвучку только после жеста: «прогреваем» синтез на нажатии 🎙, потом говорим с небольшой паузой */
function unlock(){try{const ss=window.speechSynthesis;if(!ss)return;const u=new SpeechSynthesisUtterance(' ');u.volume=0;u.lang='ru-RU';ss.speak(u);ss.getVoices()}catch(e){}}
function speak(t,now){try{const ss=window.speechSynthesis;if(!ss)return say('🔊 Этот браузер не умеет озвучивать',3000);
  last=t;ss.cancel();
  setTimeout(()=>{const u=utt=new SpeechSynthesisUtterance(t);u.lang='ru-RU';u.rate=1;u.volume=1;
    const v=ss.getVoices().find(x=>/^ru/i.test(x.lang));if(v)u.voice=v;
    u.onerror=ev=>{if(ev.error!=='canceled'&&ev.error!=='interrupted')say('🔊 Не удалось озвучить ('+ev.error+')',3500)};
    u.onstart=()=>{u.ok=1};
    if(ss.resume)ss.resume();ss.speak(u);
    if(!now)setTimeout(()=>{if(!u.ok&&!ss.speaking)say('🔊 Телефон не дал озвучить сам — нажмите на эту плашку, и я произнесу ответ',6000)},2200)},now?0:700)}catch(e){}}
function handle(text){
  const p=parse(text);
  if(!p.expr&&!p.eq&&!p.cmd){fb('err');return say('Не понял: «'+text+'»',3500)}
  fb('ok');
  window.dispatchEvent(new CustomEvent('cifra-voice',{detail:p}));
  const r=document.getElementById('res');
  say('✓ «'+p.text+'»'+(p.expr?'  →  '+p.expr.replace(/\./g,','):'')+(p.eq?'  =  '+r.textContent:''),p.eq?5000:3500);
  if(p.eq&&cfgv().vspeak!==0)speak(r.className==='err'?'Ошибка':'Ответ: '+r.textContent.replace(/\u00a0/g,' '))}
function start(){
  rec=new SR();rec.lang='ru-RU';rec.interimResults=true;rec.continuous=false;
  let full='',err='';
  rec.onstart=()=>{on=true;btn.classList.add('listening');say('Слушаю… скажите: «два плюс три, посчитай»')};
  rec.onresult=e=>{full='';for(let i=0;i<e.results.length;i++)full+=e.results[i][0].transcript;say('🎙 '+full)};
  rec.onerror=e=>{err=e.error};
  rec.onend=()=>{on=false;btn.classList.remove('listening');
    if(err==='not-allowed'||err==='service-not-allowed'){fb('err');say('Нет доступа к микрофону — разрешите его в настройках браузера',4500)}
    else if(err==='network'){fb('err');say(/YaBrowser|Yowser|OPR\/|Brave/i.test(navigator.userAgent)||navigator.onLine?'Распознавание речи этим браузером не поддерживается (служба Google недоступна — так бывает в Яндекс.Браузере, Opera, Brave). Откройте Контур в Chrome или Edge.':'Нет интернета — распознавание речи работает только онлайн',9000)}
    else if(full.trim())handle(full);
    else{fb('err');say('Не расслышал, попробуйте ещё раз',2500)}};
  try{rec.start()}catch(e){}}
btn.addEventListener('click',()=>{
  if(!SR)return say('Этот браузер не поддерживает голосовой ввод. Откройте Контур в Safari или Chrome.',4500);
  if(on)rec.stop();else{fb('start');unlock();start()}});
})();

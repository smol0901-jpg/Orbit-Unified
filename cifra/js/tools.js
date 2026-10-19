/* CIFRA Tools — конвертер, финансы, даты, график, математическая доска. */
const Tools=(()=>{
const $=(e,s)=>e.querySelector(s),$$=(e,s)=>[...e.querySelectorAll(s)];
const tpl=h=>{const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstChild};
const num=v=>parseFloat(String(v).replace(/\s|\u00a0/g,'').replace(',','.'));
const opt=(a,s)=>a.map(x=>`<option${x===s?' selected':''}>${esc(x)}</option>`).join('');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function chips(host,names,cur,on){host.innerHTML='';names.forEach(n=>{const b=tpl(`<button class="chip${n===cur?' on':''}">${esc(n)}</button>`);b.onclick=()=>on(n);host.append(b)})}

/* ================= КОНВЕРТЕР ================= */
const U={
'Длина':{'м':1,'км':1000,'см':.01,'мм':.001,'дм':.1,'микрон':1e-6,'миля':1609.344,'фут':.3048,'дюйм':.0254,'ярд':.9144,'морская миля':1852,'парсек':3.0857e16,'а.е.':1.496e11},
'Масса':{'кг':1,'г':.001,'т':1000,'мг':1e-6,'фунт':.45359237,'унция':.028349523,'карата':.0002,'гран':6.48e-5},
'Объём':{'л':1,'мл':.001,'м³':1000,'см³':1e-3,'галлон':3.785411784,'кварта':.946353,'пинта':.473176,'баррель':158.987,'столовая ложка':.015,'чайная ложка':.005,'флюид. унция':.0295735},
'Площадь':{'м²':1,'км²':1e6,'см²':1e-4,'га':1e4,'ар':100,'акр':4046.8564,'фут²':.09290304,'дюйм²':.00064516,'сотка':100},
'Скорость':{'м/с':1,'км/ч':1/3.6,'миль/ч':.44704,'узел':.514444,'фут/с':.3048,'Мах':340.29},
'Время':{'сек':1,'мс':.001,'мин':60,'час':3600,'сутки':86400,'неделя':604800,'месяц':2629800,'год':31557600,'мкс':1e-6,'нс':1e-9},
'Энергия':{'Дж':1,'кДж':1000,'ккал':4184,'кал':4.184,'Вт·ч':3600,'кВт·ч':3.6e6,'эВ':1.602e-19,'БТЕ':1055.06},
'Мощность':{'Вт':1,'кВт':1000,'МВт':1e6,'л.с.':735.5,'л.с. (имп.)':745.7,'BTU/ч':.29307,'кал/с':4.184},
'Давление':{'Па':1,'кПа':1000,'МПа':1e6,'бар':1e5,'атм':101325,'мм рт.ст.':133.322,'psi':6894.76,'кгс/см²':98066.5},
'Данные':{'Б':1,'КБ':1024,'МБ':1048576,'ГБ':1073741824,'ТБ':1099511627776,'ПБ':1125899906842624,'бит':.125,'Кбит':128,'Мбит':131072},
'Угол':{'°':1,'рад':180/Math.PI,'град':.9,'оборот':360,'′':1/60,'″':1/3600}};
const T={'°C':[x=>x,x=>x],'°F':[x=>(x-32)*5/9,x=>x*9/5+32],'K':[x=>x-273.15,x=>x+273.15],'°R':[x=>x*5/9,x=>x*9/5]};
function conv(root,C){
  let cat='Длина';
  root.innerHTML=`<div class="chips"></div>
  <div class="card box">
    <div class="row convrow"><input inputmode="decimal" value="1" aria-label="Значение" placeholder="0"><select aria-label="Из"></select></div>
    <div class="midrow"><button class="swap" aria-label="Поменять местами"><svg viewBox="0 0 24 24"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg></button><button class="swap neg" aria-label="Сменить знак">±</button><span class="mlabel"></span></div>
    <div class="row resrow convrow"><output>—</output><select aria-label="В"></select></div>
  </div>
  <div class="quick"></div>
  <div class="sub">Все единицы</div>
  <ul class="out clist"></ul>`;
  const cs=$(root,'.chips'),rows=$$(root,'.row'),a=$(rows[0],'input'),u1=$(rows[0],'select'),o=$(rows[1],'output'),u2=$(rows[1],'select');
  const sw=$(root,'.swap'),ml=$(root,'.mlabel'),qk=$(root,'.quick'),cl=$(root,'.clist');
  const convert=v=>cat==='Температура'?T[u2.value][1](T[u1.value][0](v)):v*U[cat][u1.value]/U[cat][u2.value];
  const fit=()=>{const L=o.textContent.length,n=a.value.length;o.style.fontSize=(L>22?.95:L>16?1.15:L>11?1.4:1.7)+'rem';a.style.fontSize=(n>18?.85:n>13?1:1.15)+'rem'};
  function calc(){const v=num(a.value);
    if(isNaN(v)){o.textContent='—';ml.textContent='';cl.innerHTML='';return}
    o.textContent=C.fmt(parseFloat(convert(v).toPrecision(12)));fit();
    ml.textContent=`${C.fmt(v)} ${u1.value} →`;
    cl.innerHTML='';
    const units=cat==='Температура'?Object.keys(T):Object.keys(U[cat]);
    units.filter(x=>x!==u1.value&&x!==u2.value).forEach(x=>{
      const val=cat==='Температура'?T[x][1](T[u1.value][0](v)):v*U[cat][u1.value]/U[cat][x];
      const li=document.createElement('li');li.innerHTML='<span></span><b></b>';
      li.firstChild.textContent=x;li.lastChild.textContent=C.fmt(parseFloat(val.toPrecision(12)));
      li.onclick=()=>C.copy(li.lastChild.textContent);cl.append(li)});
    }
  function quickRow(){qk.innerHTML='';if(cat==='Температура')return;
    Object.keys(U[cat]).slice(0,6).forEach(x=>{
      const b=tpl(`<button>${esc(x)}</button>`);b.onclick=()=>{u2.value=x;calc();C.vib()};qk.append(b)})}
  const draw=()=>{chips(cs,[...Object.keys(U),'Температура'],cat,n=>{C.vib();cat=n;draw()});
    const ks=cat==='Температура'?Object.keys(T):Object.keys(U[cat]);
    u1.innerHTML=opt(ks,ks.includes(u1.value)?u1.value:ks[0]);
    u2.innerHTML=opt(ks,ks.includes(u2.value)&&u2.value!==u1.value?u2.value:(ks[1]||ks[0]));
    quickRow();calc()};
  a.oninput=calc;u1.onchange=u2.onchange=calc;o.onclick=()=>C.copy(o.textContent);
  sw.onclick=()=>{[u1.value,u2.value]=[u2.value,u1.value];calc();C.vib()};
  $(root,'.neg').onclick=()=>{a.value=-num(a.value)||0;calc();C.vib()};
  draw();
}

/* ================= ФИНАНСЫ ================= */
const FIN={
'Кредит':{f:[['Сумма, ₽','1000000'],['Ставка, %','12'],['Срок, мес','60'],['Первый взнос, ₽','0']],calc(v){
  const S=v[0]-v[3],r=v[1]/100/12,n=v[2];if(S<=0||r<0||n<=0)return[['—','Проверьте данные']];
  const p=r?S*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1):S/n;
  const total=p*n,over=total-S;
  return[['Ежемесячный платёж',p],['Тело кредита',S],['Всего выплат',total],['Переплата',over],['Переплата, %',over/S*100]];
}},
'Ипотека':{f:[['Стоимость, ₽','5000000'],['Первый взнос, %','20'],['Ставка, %','10'],['Срок, лет','20']],calc(v){
  const down=v[0]*v[1]/100,S=v[0]-down,r=v[2]/100/12,n=v[3]*12;if(S<=0||r<0||n<=0)return[['—','Проверьте данные']];
  const p=r?S*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1):S/n;
  return[['Взнос',down],['Тело кредита',S],['Платёж в месяц',p],['Переплата',p*n-S],['Всего выплат',p*n]];
}},
'Вклад':{f:[['Сумма, ₽','100000'],['Ставка, %','8'],['Срок, мес','12'],['Капитализация','12']],calc(v){
  const P=v[0],r=v[1]/100,n=v[2]/12,m=v[3]||1;if(P<=0||r<0||n<=0)return[['—','Проверьте данные']];
  const A=P*Math.pow(1+r/m,m*n),int=A-P;
  return[['Итого',A],['Проценты',int],['Внесено',P],['Доходность, %',int/P*100]];
}},
'Сложный процент':{f:[['Начальная сумма','10000'],['Ставка, %','7'],['Периодов в год','12'],['Лет','10']],calc(v){
  const A=v[0]*Math.pow(1+v[1]/100/v[2],v[2]*v[3]);
  return[['Итого',A],['Прирост',A-v[0]],['Внесено',v[0]]];
}}};
function fin(root,C){
  let k='Кредит';
  root.innerHTML=`<div class="chips"></div><div class="card box"><div class="fields"></div></div><ul class="out"></ul><div class="chartbox"></div>`;
  const cs=$(root,'.chips'),fl=$(root,'.fields'),ou=$(root,'.out'),cb=$(root,'.chartbox');
  function calc(){
    const v=[...fl.querySelectorAll('input')].map(i=>num(i.value));
    const res=FIN[k].calc(v);ou.innerHTML='';
    res.forEach(([l,val],i)=>{const li=document.createElement('li');li.style.animationDelay=(i*40)+'ms';
      li.innerHTML='<span></span><b></b>';li.firstChild.textContent=l;
      li.lastChild.textContent=typeof val==='number'?C.money(val):val;
      li.onclick=()=>C.copy(li.lastChild.textContent);ou.append(li)});
    lastAcc=res.map(([l,val])=>l+': '+(typeof val==='number'?C.money(val):val)).join('\n');
    cb.innerHTML='';
    if(k==='Кредит'||k==='Ипотека'){
      const body=res.find(r=>r[0].includes('Тело')||r[0].includes('кредит'))?.[1]||0;
      const over=res.find(r=>r[0].includes('Переплата')&&!r[0].includes('%'))?.[1]||0;
      Graph.donut(cb,[{n:'Тело',v:Math.max(body,0)},{n:'Переплата',v:Math.max(over,0)}],k);
    }
    if(k==='Вклад')Graph.bars(cb,[{n:'Внесено',v:res[2][1]},{n:'Проценты',v:res[1][1]},{n:'Итого',v:res[0][1]}],'₽');
    if(k==='Сложный процент'){const y=Math.max(1,Math.min(12,num(v[3])||1)),pts=[];
      for(let t=1;t<=y;t++)pts.push({n:t+' г.',v:v[0]*Math.pow(1+v[1]/100/v[2],v[2]*t)-v[0]});
      Graph.bars(cb,pts,'прирост, ₽')}}
  const draw=()=>{chips(cs,Object.keys(FIN),k,n=>{C.vib();k=n;draw()});
    fl.innerHTML='';
    FIN[k].f.forEach(([l,d])=>{const w=tpl('<label><small></small><input inputmode="decimal"></label>');
      w.firstChild.textContent=l;w.lastChild.value=d;w.lastChild.oninput=calc;fl.append(w)});calc()};
  draw();
}

/* ================= ДАТА ================= */
const MON=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const WD=['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const dstr=d=>d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear()+', '+WD[d.getDay()];
function dateTool(root,C){
  const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const today=ymd(new Date());
  const inp=(id,label,v=today)=>`<label class="di"><small>${label}</small><input id="${id}" type="date" value="${v}"></label>`;
  const CATS=['Разница дат','Прибавить дни','Возраст','Из возраста','До ДР'];
  root.innerHTML=`<div class="chips"></div>
  <div class="dt dt-diff"><div class="cols2">${inp('d1','Дата начала')}${inp('d2','Дата окончания')}</div><ul class="out" id="do1"></ul></div>
  <div class="dt dt-add" hidden><div class="cols2">${inp('d3','От какой даты')}</div>
    <div class="row"><input id="dadd" inputmode="numeric" value="100"><select id="dunit"><option>дней</option><option>недель</option><option>месяцев</option><option>лет</option></select><select id="dsgn"><option value="1">прибавить</option><option value="-1">вычесть</option></select></div>
    <ul class="out" id="do2"></ul></div>
  <div class="dt dt-age" hidden><div class="cols2">${inp('d4','Дата рождения / события')}</div><ul class="out" id="do3"></ul></div>
  <div class="dt dt-fromage" hidden>
    <div class="card box">
      <div class="cols2">
        <label><small>Полных лет</small><input id="ageY" inputmode="numeric" value="38"></label>
        <label><small>Месяцев (доп.)</small><input id="ageM" inputmode="numeric" value="0"></label>
      </div>
      <label><small>Дней (доп.)</small><input id="ageD" inputmode="numeric" value="0"></label>
      <p class="note">Считаем дату рождения «назад» от сегодня (или от указанной даты ниже).</p>
      ${inp('d5','От какой даты (обычно сегодня)',today)}
    </div>
    <ul class="out" id="do4"></ul>
  </div>
  <div class="dt dt-until" hidden>
    <div class="card box">
      <label><small>Через сколько дней день рождения</small><input id="untilD" inputmode="numeric" value="10"></label>
      <p class="note">Например: «через 10 дней ДР» → дата праздника и возраст, который исполнится.</p>
      <label><small>Сколько лет исполнится (необяз.)</small><input id="untilAge" inputmode="numeric" value="" placeholder="например 39"></label>
    </div>
    <ul class="out" id="do5"></ul>
  </div>
  <div class="tool-share"><button type="button" id="dshare">Поделиться результатом</button></div>`;

  const cs=$(root,'.chips');let mode='diff';
  const el=id=>root.querySelector('#'+id);
  const D=id=>{const x=el(id);return x&&x.value?new Date(x.value+'T00:00:00'):NaN};
  const out=(id,rows)=>{const u=el(id);if(!u)return;u.innerHTML='';
    rows.forEach(([l,v],i)=>{const li=document.createElement('li');li.style.animationDelay=(i*45)+'ms';
      li.innerHTML='<span></span><b></b>';li.firstChild.textContent=l;li.lastChild.textContent=v;
      li.onclick=()=>C.copy(v);u.append(li)})};
  let lastShare='';
  function calcDiff(){const a=D('d1'),b=D('d2');if(isNaN(a)||isNaN(b))return;
    const s=Math.round((b-a)/864e5);
    let y=b.getFullYear()-a.getFullYear(),mo=b.getMonth()-a.getMonth(),d=b.getDate()-a.getDate();
    if(d<0){mo--;d+=new Date(b.getFullYear(),b.getMonth(),0).getDate()}
    if(mo<0){y--;mo+=12}
    const rows=[['Разница, дней',(s>0?'+':'')+s],['Полных периодов',`${y>0?y+' г. ':''}${mo>0?mo+' мес. ':''}${Math.abs(d)} д.`],
      ['Рабочих дней (≈)',Math.sign(s||1)*Math.floor(Math.abs(s)*5/7)],['Выходных (≈)',Math.sign(s||1)*Math.ceil(Math.abs(s)*2/7)],
      ['Недель',(s>0?'+':'')+Math.trunc(s/7)],['Дата начала',dstr(a)],['Дата окончания',dstr(b)]];
    out('do1',rows);lastShare=rows.map(r=>r[0]+': '+r[1]).join('\n')}
  function calcAdd(){const a=D('d3');if(isNaN(a))return;
    const v=parseInt(el('dadd').value)||0,u=el('dunit').value,sg=+el('dsgn').value;
    const b=new Date(a);
    if(u==='дней')b.setDate(b.getDate()+sg*v);else if(u==='недель')b.setDate(b.getDate()+sg*v*7);
    else if(u==='месяцев')b.setMonth(b.getMonth()+sg*v);else b.setFullYear(b.getFullYear()+sg*v);
    const rows=[['Результат',dstr(b)],['ISO-формат',ymd(b)],['Сдвиг, дней',Math.round((b-a)/864e5)]];
    out('do2',rows);lastShare=rows.map(r=>r[0]+': '+r[1]).join('\n')}
  function calcAge(){const a=D('d4'),now=new Date(new Date().setHours(0,0,0,0));if(isNaN(a))return;
    if(a>now){out('do3',[['—','Дата в будущем']]);return}
    let y=now.getFullYear()-a.getFullYear(),mo=now.getMonth()-a.getMonth(),d=now.getDate()-a.getDate();
    if(d<0){mo--;d+=new Date(now.getFullYear(),now.getMonth(),0).getDate()}
    if(mo<0){y--;mo+=12}
    const next=new Date(now.getFullYear(),a.getMonth(),a.getDate());if(next<now)next.setFullYear(now.getFullYear()+1);
    const rows=[['Полных лет',y],['Полный возраст',`${y} г. ${mo} мес. ${d} д.`],['Прошло дней',Math.round((now-a)/864e5)],
      ['Следующая годовщина',dstr(next)],['До неё осталось дней',Math.round((next-now)/864e5)]];
    out('do3',rows);lastShare=rows.map(r=>r[0]+': '+r[1]).join('\n')}
  function calcFromAge(){
    const y=parseInt(el('ageY').value)||0,m=parseInt(el('ageM').value)||0,d=parseInt(el('ageD').value)||0;
    const base=D('d5');if(isNaN(base))return;
    const b=new Date(base);
    b.setFullYear(b.getFullYear()-y);
    b.setMonth(b.getMonth()-m);
    b.setDate(b.getDate()-d);
    const rows=[
      ['Дата рождения (расчёт)',dstr(b)],
      ['ISO',ymd(b)],
      ['Возраст задан',`${y} г. ${m} мес. ${d} д.`],
      ['От даты',dstr(base)],
      ['Прошло дней',Math.round((base-b)/864e5)]
    ];
    out('do4',rows);lastShare=rows.map(r=>r[0]+': '+r[1]).join('\n')}
  function calcUntil(){
    const days=parseInt(el('untilD').value);if(isNaN(days))return;
    const now=new Date(new Date().setHours(0,0,0,0));
    const bday=new Date(now);bday.setDate(bday.getDate()+days);
    const ageStr=el('untilAge').value.trim();
    const rows=[
      ['День рождения',dstr(bday)],
      ['ISO',ymd(bday)],
      ['Через дней',days],
      ['День недели',WD[bday.getDay()]]
    ];
    if(ageStr!==''&&!isNaN(parseInt(ageStr))){
      const years=parseInt(ageStr);
      const born=new Date(bday);born.setFullYear(born.getFullYear()-years);
      rows.push(['Исполнится лет',years],['Дата рождения (если ДР = '+years+' лет)',dstr(born)]);
    }
    out('do5',rows);lastShare=rows.map(r=>r[0]+': '+r[1]).join('\n')}
  const refresh=()=>{
    if(mode==='diff')calcDiff();
    else if(mode==='add')calcAdd();
    else if(mode==='age')calcAge();
    else if(mode==='fromage')calcFromAge();
    else calcUntil();
  };
  const setMode=n=>{
    mode={'Разница дат':'diff','Прибавить дни':'add','Возраст':'age','Из возраста':'fromage','До ДР':'until'}[n];
    root.querySelectorAll('.dt').forEach(x=>x.hidden=true);
    const map={diff:'.dt-diff',add:'.dt-add',age:'.dt-age',fromage:'.dt-fromage',until:'.dt-until'};
    const sel=root.querySelector(map[mode]);if(sel)sel.hidden=false;
    chips(cs,CATS,n,setMode);refresh();
  };
  cs.onclick=e=>{const b=e.target.closest('.chip');if(!b)return;C.vib();setMode(b.textContent)};
  ['d1','d2','d3','d4','d5','dadd','ageY','ageM','ageD','untilD','untilAge'].forEach(id=>{
    const x=el(id);if(x)x.oninput=refresh;
  });
  const du=el('dunit'),ds=el('dsgn');
  if(du)du.onchange=refresh;if(ds)ds.onchange=refresh;
  el('dshare').onclick=()=>{
    if(!lastShare){C.copy('');return}
    const text='CIFRA Pro · Даты\n'+lastShare;
    if(navigator.share){navigator.share({title:'CIFRA Pro · Даты',text}).catch(()=>C.copy(text))}
    else C.copy(text);
  };
  chips(cs,CATS,CATS[0],n=>{C.vib();setMode(n)});refresh();
}

/* ================= ГРАФИК ================= */
function graph(root,C){
  root.innerHTML=`<div class="card box gform">
    <label><small>y = f(x)</small><input id="gf" value="sin(x)/x" spellcheck="false" autocomplete="off"></label>
    <div class="cols2">
      <label><small>x от</small><input id="gx0" inputmode="decimal" value="-20"></label>
      <label><small>x до</small><input id="gx1" inputmode="decimal" value="20"></label>
    </div>
    <div class="presets"></div>
  </div>
  <div class="plotwrap"><canvas id="gc"></canvas></div>
  <div id="gread" class="gread">Ведите пальцем по графику — x и y. Тяните — сдвиг, колесо мыши — масштаб</div>
  <div class="bar zoom"><button data-z="2" aria-label="Отдалить">−</button><button id="zr">Сброс</button><button data-z=".5" aria-label="Приблизить">+</button><button id="gcopy">Копировать y = f(x)</button><button id="gshare">Поделиться</button></div>
  <div class="tool-share"></div>`;
  const el=id=>root.querySelector('#'+id);
  const cv=el('gc'),inp=el('gf'),x0=el('gx0'),x1=el('gx1'),ps=$(root,'.presets'),pw=$(root,'.plotwrap');
  ['sin(x)/x','x^2','x^3−3x','√(x)','1/x','tan(x)','ln(x)','abs(x)−2','2^x−x^2','sin(x)+sin(3x)/3']
    .forEach(p=>{const b=tpl(`<button class="chip">${esc(p)}</button>`);b.onclick=()=>{inp.value=p;draw();C.vib()};ps.append(b)});
  function draw(){if(cv.hidden)return;
    try{const f=Engine.fnOf(inp.value,false);
      Graph.plot(cv,f,{xmin:num(x0.value),xmax:num(x1.value)});}
    catch(e){const g=cv.getContext('2d'),dpr=devicePixelRatio||1;
      g.clearRect(0,0,cv.width/dpr,cv.height/dpr);g.font='14px system-ui';g.fillStyle='#e5484d';
      g.fillText('Проверьте выражение, например: sin(x)/x',16,28)}}
  inp.oninput=x0.oninput=x1.oninput=draw;
  const zoom=(z,c)=>{const a=num(x0.value),b=num(x1.value);if(isNaN(a)||isNaN(b))return;c=c??(a+b)/2;x0.value=+(c-(c-a)*z).toPrecision(6);x1.value=+(c+(b-c)*z).toPrecision(6);draw()};
  $$(root,'[data-z]').forEach(b=>b.onclick=()=>{C.vib();zoom(+b.dataset.z)});
  el('zr').onclick=()=>{x0.value=-20;x1.value=20;draw()};
  el('gcopy').onclick=()=>C.copy('y = '+inp.value);
  el('gshare').onclick=async()=>{
    C.vib();
    const text='CIFRA Pro · График\ny = '+inp.value+'\nx ∈ ['+x0.value+'; '+x1.value+']';
    /* PNG с canvas (с фоном, чтобы не было прозрачности) */
    const exportPng=()=>new Promise(ok=>{
      try{
        const w=cv.width,h=cv.height;if(!w||!h)return ok(null);
        const off=document.createElement('canvas');off.width=w;off.height=h;
        const g=off.getContext('2d');
        const bg=getComputedStyle(document.documentElement).getPropertyValue('--card').trim()||'#12151b';
        g.fillStyle=bg;g.fillRect(0,0,w,h);g.drawImage(cv,0,0);
        off.toBlob(b=>ok(b),'image/png');
      }catch(e){ok(null)}
    });
    const blob=await exportPng();
    const file=blob?new File([blob],'cifra-graph.png',{type:'image/png'}):null;
    try{
      if(file&&navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({title:'CIFRA Pro · График',text,files:[file]});
        return;
      }
      if(navigator.share){
        await navigator.share({title:'CIFRA Pro · График',text});
        /* параллельно предложим сохранить PNG */
        if(file){const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download='cifra-graph.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
        return;
      }
    }catch(e){if(e&&e.name==='AbortError')return}
    if(file){const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download='cifra-graph.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
    C.copy(text);
  };
  const gread=el('gread');let drag=null;
  const xAt=e=>{const r=cv.getBoundingClientRect(),a=num(x0.value),b=num(x1.value);return a+((e.clientX-r.left)-40)/(r.width-64)*(b-a)};
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);drag={x:e.clientX,a:num(x0.value),b:num(x1.value)}});
  cv.addEventListener('pointermove',e=>{
    if(drag){const r=cv.getBoundingClientRect(),d=(e.clientX-drag.x)/(r.width-64)*(drag.b-drag.a);x0.value=+(drag.a-d).toPrecision(6);x1.value=+(drag.b-d).toPrecision(6);draw()}
    try{const x=xAt(e),y=Engine.fnOf(inp.value,false)(x);gread.textContent='x = '+C.fmt(+x.toPrecision(6))+'    y = '+C.fmt(+y.toPrecision(6))}catch(_){}});
  ['pointerup','pointercancel'].forEach(t=>cv.addEventListener(t,()=>drag=null));
  cv.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.15:1/1.15,xAt(e))},{passive:false});
  new ResizeObserver(()=>draw()).observe(pw);
  const sync=()=>{const vis=!root.hidden;
    if(vis&&cv.hidden){cv.hidden=false;requestAnimationFrame(draw)}else if(!vis)cv.hidden=true};
  new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['hidden']});
  cv.hidden=!root.hidden;
  if(!cv.hidden)draw();
}

/* ================= ДОСКА (формулы + решатель) ================= */
const FORMULAS={
/* Только выражения, которые реально считаются / решаются / строятся на графике.
   Числа уже подставлены, либо используется x. */
'Алгебра':[
  {t:'Линейное: 2x+3=11',e:'2x+3=11',d:'Решение линейного уравнения'},
  {t:'Линейное: 5x−7=18',e:'5x-7=18',d:''},
  {t:'Квадратное: x²−5x+6=0',e:'x^2-5x+6=0',d:'Два корня'},
  {t:'Квадратное: x²−4=0',e:'x^2-4=0',d:''},
  {t:'Квадратное: x²+x−6=0',e:'x^2+x-6=0',d:''},
  {t:'C(10,3) сочетания',e:'ncr(10,3)',d:'Число сочетаний из 10 по 3'},
  {t:'P(10,3) размещения',e:'npr(10,3)',d:'Число размещений из 10 по 3'},
  {t:'Факториал 7!',e:'7!',d:''},
  {t:'2¹⁰',e:'2^10',d:''},
  {t:'√(144)',e:'sqrt(144)',d:''},
  {t:'∛(27)',e:'cbrt(27)',d:''},
  {t:'gcd(48,18)',e:'gcd(48,18)',d:'НОД'},
  {t:'lcm(12,18)',e:'lcm(12,18)',d:'НОК'},
  {t:'|−7,5|',e:'abs(-7.5)',d:''}
],
'Геометрия':[
  {t:'Площадь круга r=5',e:'pi*5^2',d:'S = πr²'},
  {t:'Длина окружности r=5',e:'2*pi*5',d:'C = 2πr'},
  {t:'Пифагор a=3 b=4',e:'sqrt(3^2+4^2)',d:'c = √(a²+b²)'},
  {t:'Площадь прямоуг. 6×4',e:'6*4',d:'S = a·b'},
  {t:'Диагональ 6×8',e:'sqrt(6^2+8^2)',d:''},
  {t:'Объём шара r=3',e:'4/3*pi*3^3',d:'V = ⁴⁄₃πr³'},
  {t:'Площадь сферы r=3',e:'4*pi*3^2',d:'S = 4πr²'},
  {t:'Объём цилиндра r=2 h=5',e:'pi*2^2*5',d:'V = πr²h'},
  {t:'Объём конуса r=3 h=4',e:'1/3*pi*3^2*4',d:'V = ⅓πr²h'},
  {t:'Площадь треугольника',e:'0.5*6*4',d:'S = ½·a·b (прямоуг.)'}
],
'Тригонометрия':[
  {t:'sin(30°) — включите DEG',e:'sin(30)',d:'В калькуляторе: DEG'},
  {t:'cos(60°) — DEG',e:'cos(60)',d:''},
  {t:'tan(45°) — DEG',e:'tan(45)',d:''},
  {t:'sin²x+cos²x при x=1',e:'sin(x)^2+cos(x)^2',d:'≈1 (радианы)'},
  {t:'sin(2x) при x=1',e:'2*sin(x)*cos(x)',d:'формула двойного угла'},
  {t:'sec(0)',e:'sec(0)',d:'1/cos'},
  {t:'График: sin(x)/x',e:'sin(x)/x',d:'Нажмите «На график»'},
  {t:'График: cos(x)',e:'cos(x)',d:''},
  {t:'График: tan(x)',e:'tan(x)',d:'осторожно с разрывами'}
],
'Физика':[
  {t:'Скорость s=100 t=10',e:'100/10',d:'v = s/t'},
  {t:'Ускорение Δv=15 t=3',e:'15/3',d:'a = Δv/t'},
  {t:'Путь: v₀=5 a=2 t=10',e:'5*10+2*10^2/2',d:'s = v₀t + at²/2'},
  {t:'Сила m=2 a=3',e:'2*3',d:'F = ma'},
  {t:'Кинет. энергия m=2 v=10',e:'2*10^2/2',d:'Eₖ = mv²/2'},
  {t:'Потенц. энергия m=2 h=5',e:'2*9.8*5',d:'Eₚ = mgh (g≈9,8)'},
  {t:'Мощность A=500 t=25',e:'500/25',d:'P = A/t'},
  {t:'Закон Ома U=220 R=110',e:'220/110',d:'I = U/R'},
  {t:'Плотность m=800 V=0.5',e:'800/0.5',d:'ρ = m/V'},
  {t:'Работа F=50 s=4',e:'50*4',d:'A = F·s (угол 0°)'}
],
'Химия':[
  {t:'n = m/M : 36/18',e:'36/18',d:'количество вещества'},
  {t:'m = n·M : 2·18',e:'2*18',d:'масса'},
  {t:'c = n/V : 0.5/0.25',e:'0.5/0.25',d:'молярная концентрация'},
  {t:'pH при [H⁺]=10⁻⁷',e:'-log(1e-7)',d:'pH = −log[H⁺]'},
  {t:'pH при [H⁺]=10⁻³',e:'-log(0.001)',d:''},
  {t:'Разбавление C₁V₁/C₂',e:'2*0.5/0.5',d:'V₂ = C₁V₁/C₂'},
  {t:'Массовая доля 15/200·100',e:'15/200*100',d:'ω, %'},
  {t:'Выход реакции 8.5/10·100',e:'8.5/10*100',d:'η, %'}
]
};

/* Справочник — только текст, без вычислений */
const NOTES={
'Алгебра':[
  {t:'Квадратное уравнение',e:'ax² + bx + c = 0',d:'D = b² − 4ac; x = (−b ± √D)/(2a)'},
  {t:'Дискриминант',e:'D = b² − 4ac',d:'D>0 два корня; D=0 один; D<0 нет действительных'},
  {t:'(a+b)²',e:'a² + 2ab + b²',d:'квадрат суммы'},
  {t:'(a−b)²',e:'a² − 2ab + b²',d:'квадрат разности'},
  {t:'a² − b²',e:'(a−b)(a+b)',d:'разность квадратов'},
  {t:'Арифм. прогрессия',e:'aₙ = a₁ + (n−1)d',d:'Sₙ = n/2 · (2a₁ + (n−1)d)'},
  {t:'Геом. прогрессия',e:'aₙ = a₁ · rⁿ⁻¹',d:'Sₙ = a₁(rⁿ−1)/(r−1) при r≠1'},
  {t:'Сочетания',e:'C(n,k) = n! / (k!(n−k)!)',d:'в доске: ncr(n,k)'},
  {t:'Размещения',e:'P(n,k) = n! / (n−k)!',d:'в доске: npr(n,k)'}
],
'Геометрия':[
  {t:'Площадь круга',e:'S = πr²',d:''},
  {t:'Длина окружности',e:'C = 2πr',d:''},
  {t:'Теорема Пифагора',e:'c = √(a² + b²)',d:'прямоугольный треугольник'},
  {t:'Площадь треугольника',e:'S = ½ab·sin(C)',d:'также S = ½·a·h'},
  {t:'Площадь трапеции',e:'S = (a+b)/2 · h',d:'a,b — основания'},
  {t:'Объём шара',e:'V = ⁴⁄₃πr³',d:''},
  {t:'Площадь сферы',e:'S = 4πr²',d:''},
  {t:'Объём цилиндра',e:'V = πr²h',d:''},
  {t:'Объём конуса',e:'V = ⅓πr²h',d:''},
  {t:'Объём пирамиды',e:'V = ⅓S·h',d:'S — площадь основания'}
],
'Тригонометрия':[
  {t:'Основное тождество',e:'sin²α + cos²α = 1',d:''},
  {t:'tg и ctg',e:'tg α = sinα/cosα',d:'ctg α = cosα/sinα'},
  {t:'Двойной угол',e:'sin 2α = 2 sinα cosα',d:'cos 2α = cos²α − sin²α'},
  {t:'Приведение',e:'sin(90°−α) = cos α',d:'cos(90°−α) = sin α'},
  {t:'Теорема синусов',e:'a/sin A = b/sin B = 2R',d:'R — радиус описанной'},
  {t:'Теорема косинусов',e:'c² = a² + b² − 2ab·cos C',d:''},
  {t:'sec, csc, cot',e:'sec = 1/cos; csc = 1/sin; cot = 1/tg',d:''}
],
'Физика':[
  {t:'Скорость',e:'v = s/t',d:''},
  {t:'Ускорение',e:'a = (v − v₀)/t',d:''},
  {t:'Равноускоренное',e:'s = v₀t + at²/2',d:'v = v₀ + at'},
  {t:'Второй закон Ньютона',e:'F = ma',d:''},
  {t:'Работа',e:'A = Fs·cos α',d:''},
  {t:'Мощность',e:'P = A/t',d:''},
  {t:'Кинетическая энергия',e:'Eₖ = mv²/2',d:''},
  {t:'Потенциальная энергия',e:'Eₚ = mgh',d:'g ≈ 9,8 м/с²'},
  {t:'Закон Ома',e:'I = U/R',d:''},
  {t:'Плотность',e:'ρ = m/V',d:''}
],
'Химия':[
  {t:'Количество вещества',e:'n = m/M',d:'M — молярная масса'},
  {t:'Масса',e:'m = n·M',d:''},
  {t:'Молярная концентрация',e:'c = n/V',d:'моль/л'},
  {t:'Массовая доля',e:'ω = m(в-ва)/m(р-ра)·100%',d:''},
  {t:'pH',e:'pH = −log[H⁺]',d:''},
  {t:'Разбавление',e:'C₁V₁ = C₂V₂',d:''},
  {t:'Выход реакции',e:'η = m(практ)/m(теор)·100%',d:''},
  {t:'Уравнение Менделеева–Клапейрона',e:'pV = nRT',d:'R ≈ 8,314 Дж/(моль·К)'}
]
};

function board(root,C){
  let cat='Алгебра', mode='calc'; /* calc | notes */
  root.innerHTML=`
  <div class="chips board-mode"></div>
  <div class="chips board-cats"></div>
  <div class="card box board-solve" id="bpanel">
    <label><small>Уравнение или выражение</small>
      <input id="beq" spellcheck="false" autocomplete="off" placeholder="2x+3=11  или  pi*5^2  или  sin(x)">
    </label>
    <div class="board-keys" id="bkeys">
      <button type="button" data-ins="√(">√</button>
      <button type="button" data-ins="^2">x²</button>
      <button type="button" data-ins="^3">x³</button>
      <button type="button" data-ins="π">π</button>
      <button type="button" data-ins="x" title="Переменная x">𝑥</button>
      <button type="button" data-ins="(">(</button>
      <button type="button" data-ins=")">)</button>
      <button type="button" data-ins="/">÷</button>
      <button type="button" data-ins="*">×</button>
      <button type="button" data-ins="=">=</button>
    </div>
    <div class="board-actions">
      <button id="bsolve" class="primary">Решить / Считать</button>
      <button id="btoGraph">На график</button>
      <button id="btoCalc">В калькулятор</button>
      <button id="bshare">Поделиться</button>
    </div>
    <div id="bresult" class="board-result"></div>
  </div>
  <div class="sub" id="blabel">Примеры — нажмите, чтобы подставить и сразу посчитать</div>
  <ul class="out formula-list" id="flist"></ul>
  <div class="board-hint" id="bhint">На доске только выражения с числами или с x. Для углов в градусах включите DEG в калькуляторе (кнопка RAD/DEG). Справка — текстовые формулы без вычисления.</div>`;

  const cs=$(root,'.board-cats'), ms=$(root,'.board-mode'), fl=$(root,'#flist');
  const beq=$(root,'#beq'), bres=$(root,'#bresult'), bpanel=$(root,'#bpanel');let lastBoard='';
  const blabel=$(root,'#blabel'), bhint=$(root,'#bhint');
  const deg=()=>{try{return !!JSON.parse(localStorage.getItem('cfg')||'{}').deg}catch(e){return false}};

  function showResult(html){bres.innerHTML=html;bres.classList.add('show');lastBoard=bres.innerText||''}

  function solve(){
    const eq=beq.value.trim();if(!eq){showResult('<span class="err">Введите уравнение или выражение</span>');return}
    C.vib();
    try{
      if(eq.includes('=')){
        const sol=Engine.solve(eq,deg());
        if(sol.type==='none')showResult(`<span class="err">${esc(sol.msg)}</span>`);
        else if(sol.type==='identity')showResult(`<b>${esc(sol.msg)}</b>`);
        else{
          const roots=sol.roots.map((r,i)=>`<li><span>x${sol.roots.length>1?(i+1):''}</span><b>${C.fmt(r)}</b></li>`).join('');
          showResult(`<div class="sol-head">${esc(sol.msg)}${sol.D!==undefined?' · D = '+C.fmt(sol.D):''}</div><ul class="out">${roots}</ul>`);
        }
      }else{
        /* вычисление: если есть x — считаем при x=1 и подсказываем график */
        const hasX=/\bx\b/i.test(eq.replace(/exp|max|min|ncr|npr|sqrt|cbrt|sec|csc|cot|sin|cos|tan|log|abs/gi,''));
        if(hasX){
          const v=Engine.calc(eq,deg(),{x:1,y:1});
          showResult(`<div class="sol-head">При x = 1</div><ul class="out"><li><span>f(1)</span><b>${C.fmt(v)}</b></li></ul>
            <p class="hint">Есть переменная x — нажмите «На график» или решите уравнение вида f(x)=0</p>`);
        }else{
          const v=Engine.calc(eq,deg(),{});
          showResult(`<ul class="out"><li><span>Результат</span><b>${C.fmt(v)}</b></li></ul>`);
        }
      }
    }catch(e){showResult(`<span class="err">${esc(e.message||'Ошибка')} — проверьте запись (используйте числа или x)</span>`)}
  }

  function toGraph(){
    const eq=beq.value.trim();if(!eq)return;C.vib();
    let expr=eq.includes('=')?eq.split('=')[0].trim():eq;
    const g=document.querySelector('#graph #gf');
    if(g){g.value=expr;document.querySelector('[data-t=graph]')?.click();g.dispatchEvent(new Event('input'))}
  }
  function toCalc(){
    const eq=beq.value.trim();if(!eq)return;C.vib();
    const expr=eq.includes('=')?eq.split('=')[0].trim():eq;
    window.dispatchEvent(new CustomEvent('cifra-insert',{detail:expr}));
    document.querySelector('[data-t=calc]')?.click();
  }

  $(root,'#bsolve').onclick=solve;
  $(root,'#btoGraph').onclick=toGraph;
  $(root,'#btoCalc').onclick=toCalc;
  const bsh=$(root,'#bshare');
  if(bsh)bsh.onclick=()=>{
    const text='CIFRA Pro · Доска\n'+(beq.value||'')+'\n'+(lastBoard||'');
    if(C.share)C.share(text);else if(navigator.share)navigator.share({title:'CIFRA Pro · Доска',text}).catch(()=>C.copy(text));else C.copy(text);
  };
  beq.onkeydown=e=>{if(e.key==='Enter')solve()};

  /* быстрые кнопки √ x² x³ */
  $(root,'#bkeys').onclick=e=>{
    const b=e.target.closest('[data-ins]');if(!b)return;
    C.vib();
    const ins=b.dataset.ins;
    const el=beq;const start=el.selectionStart??el.value.length,end=el.selectionEnd??start;
    el.value=el.value.slice(0,start)+ins+el.value.slice(end);
    const pos=start+ins.length;el.focus();el.setSelectionRange(pos,pos);
  };

  function renderList(){
    fl.innerHTML='';
    const src=mode==='notes'?NOTES:FORMULAS;
    (src[cat]||[]).forEach((f,i)=>{
      const li=document.createElement('li');
      li.style.animationDelay=(i*30)+'ms';
      li.innerHTML=`<div class="f-head"><span class="f-title"></span><b class="f-expr"></b></div><small class="f-desc"></small>`;
      li.querySelector('.f-title').textContent=f.t;
      li.querySelector('.f-expr').textContent=f.e;
      li.querySelector('.f-desc').textContent=f.d||'';
      if(mode==='calc'){
        li.onclick=()=>{beq.value=f.e;C.vib();bres.classList.remove('show');bres.innerHTML='';solve()};
      }else{
        li.onclick=()=>{C.copy(f.e);C.vib()};
        li.title='Нажмите, чтобы скопировать';
      }
      fl.append(li);
    });
  }

  function onCat(n){C.vib();cat=n;drawCats()}
  function drawCats(){
    const src=mode==='notes'?NOTES:FORMULAS;
    const names=Object.keys(src);
    if(!names.includes(cat))cat=names[0];
    chips(cs,names,cat,onCat);
    renderList();
  }

  function setMode(m){
    mode=m;
    chips(ms,['Расчёт','Справка'],mode==='calc'?'Расчёт':'Справка',n=>{
      C.vib();setMode(n==='Справка'?'notes':'calc');
    });
    bpanel.hidden=mode==='notes';
    blabel.textContent=mode==='calc'?'Примеры — нажмите, чтобы подставить и посчитать':'Справочник формул — нажмите, чтобы скопировать';
    bhint.textContent=mode==='calc'
      ?'Только выражения с числами или с x. Углы в градусах — включите DEG в калькуляторе. Кнопки √ x² x³ подставляют символы в поле.'
      :'Текстовые формулы и тождества. Вычисления здесь нет — скопируйте и используйте на вкладке «Расчёт» или в калькуляторе.';
    drawCats();
  }

  setMode('calc');
}


/* ================= БУХГАЛТЕРИЯ ================= */
const ACC={
'НДС':{f:[['Сумма, ₽','10000'],['Ставка НДС, %','20'],['Сумма включает НДС','1']],calc(v){
  const sum=v[0],rate=v[1]/100,inc=v[2]>=1;
  if(inc){const net=sum/(1+rate),vat=sum-net;return[['Сумма с НДС',sum],['Без НДС',net],['НДС',vat],['Ставка, %',v[1]]]}
  const vat=sum*rate,tot=sum+vat;return[['Без НДС',sum],['НДС',vat],['Сумма с НДС',tot],['Ставка, %',v[1]]];
}},
'УСН':{f:[['Доход, ₽','500000'],['Расход, ₽','200000'],['Режим','6']],calc(v){
  const income=v[0],expense=v[1],mode=v[2];
  if(mode<=6){const tax=income*0.06;return[['Объект','Доходы 6%'],['Налог УСН',tax],['К уплате',tax],['Эффективная ставка, %',6]]}
  const base=Math.max(income-expense,0),tax=base*0.15;
  return[['Объект','Доходы−расходы 15%'],['Налоговая база',base],['Налог УСН',tax],['К уплате',tax]];
}},
'Маржа / наценка':{f:[['Себестоимость, ₽','1000'],['Цена продажи, ₽','1500']],calc(v){
  const cost=v[0],price=v[1];if(cost<=0)return[['—','Проверьте данные']];
  const profit=price-cost,markup=profit/cost*100,margin=price>0?profit/price*100:0;
  return[['Прибыль',profit],['Наценка, %',markup],['Маржа, %',margin],['Коэффициент',price/cost]];
}},
'Скидка':{f:[['Цена, ₽','2000'],['Скидка, %','15']],calc(v){
  const price=v[0],pct=v[1],off=price*pct/100,final=price-off;
  return[['Цена до скидки',price],['Скидка',off],['Итого',final],['Экономия, %',pct]];
}},
'Зарплата (НДФЛ)':{f:[['Оклад / на руки, ₽','50000'],['Ввод','1']],calc(v){
  /* 1 = на руки (net), 0 = до вычета (gross). НДФЛ 13% */
  const x=v[0],isNet=v[1]>=1;
  if(isNet){const gross=x/0.87,ndfl=gross-x;return[['На руки',x],['НДФЛ 13%',ndfl],['Начислено (gross)',gross]]}
  const ndfl=x*0.13,net=x-ndfl;return[['Начислено',x],['НДФЛ 13%',ndfl],['На руки',net]];
}},
'Взносы (упрощ.)':{f:[['Фонд оплаты труда, ₽','100000'],['Ставка взносов, %','30']],calc(v){
  const fot=v[0],rate=v[1]/100,ins=fot*rate;
  return[['ФОТ',fot],['Взносы',ins],['Итого с взносами',fot+ins],['Ставка, %',v[1]]];
}},
'Рентабельность':{f:[['Прибыль, ₽','150000'],['Выручка, ₽','1000000'],['Активы, ₽','500000']],calc(v){
  const profit=v[0],rev=v[1],assets=v[2];
  const ros=rev>0?profit/rev*100:0,roa=assets>0?profit/assets*100:0;
  return[['Рентаб. продаж (ROS), %',ros],['Рентаб. активов (ROA), %',roa],['Прибыль',profit],['Выручка',rev]];
}},
'Амортизация':{f:[['Стоимость, ₽','500000'],['Срок, лет','5'],['Ликвидац. стоимость, ₽','0']],calc(v){
  const cost=v[0],years=v[1],salv=v[2];if(years<=0)return[['—','Проверьте срок']];
  const annual=(cost-salv)/years,monthly=annual/12;
  return[['Годовая амортизация',annual],['Месячная',monthly],['За весь срок',cost-salv],['Остаточная (год 1)',cost-annual]];
}}
};
function acc(root,C){
  let k='НДС';
  root.innerHTML=`<div class="chips"></div><div class="card box"><div class="fields"></div>
  <p class="acc-hint" id="ahint"></p></div><ul class="out"></ul><div class="chartbox"></div>
  <div class="tool-share"><button type="button" id="ashare">Поделиться результатом</button></div>`;
  const cs=$(root,'.chips'),fl=$(root,'.fields'),ou=$(root,'.out'),cb=$(root,'.chartbox'),hint=$(root,'#ahint');let lastAcc='';
  const HINTS={
    'НДС':'«Сумма включает НДС»: 1 — да (выделить НДС), 0 — нет (начислить сверху). Ставки: 20, 10, 0.',
    'УСН':'Режим: 6 — доходы 6%, 15 — доходы минус расходы 15%.',
    'Маржа / наценка':'Наценка от себестоимости, маржа от цены продажи.',
    'Скидка':'Итоговая цена после процентной скидки.',
    'Зарплата (НДФЛ)':'Ввод: 1 — сумма «на руки», 0 — сумма до вычета НДФЛ (13%).',
    'Взносы (упрощ.)':'Ориентир по страховым взносам с ФОТ (ставка настраивается).',
    'Рентабельность':'ROS = прибыль/выручка, ROA = прибыль/активы.',
    'Амортизация':'Линейный метод: (стоимость − ликвидационная) / срок.'
  };
  function calc(){
    const v=[...fl.querySelectorAll('input')].map(i=>num(i.value));
    const res=ACC[k].calc(v);ou.innerHTML='';
    res.forEach(([l,val],i)=>{const li=document.createElement('li');li.style.animationDelay=(i*40)+'ms';
      li.innerHTML='<span></span><b></b>';li.firstChild.textContent=l;
      li.lastChild.textContent=typeof val==='number'?C.money(val):val;
      li.onclick=()=>C.copy(li.lastChild.textContent);ou.append(li)});
    lastAcc=res.map(([l,val])=>l+': '+(typeof val==='number'?C.money(val):val)).join('\n');
    cb.innerHTML='';
    if(k==='НДС'){
      const rows=res.filter(r=>typeof r[1]==='number'&&(r[0].includes('НДС')||r[0].includes('Без')||r[0].includes('с НДС')));
      if(rows.length>=2)Graph.donut(cb,rows.slice(0,3).map(r=>({n:r[0],v:Math.abs(r[1])})),'НДС');
    }
    if(k==='Маржа / наценка'){
      const cost=v[0],profit=Math.max(v[1]-v[0],0);
      Graph.donut(cb,[{n:'Себестоимость',v:cost},{n:'Прибыль',v:profit}],'Цена');
    }
  }
  const draw=()=>{chips(cs,Object.keys(ACC),k,n=>{C.vib();k=n;draw()});
    fl.innerHTML='';hint.textContent=HINTS[k]||'';
    ACC[k].f.forEach(([l,d])=>{const w=tpl('<label><small></small><input inputmode="decimal"></label>');
      w.firstChild.textContent=l;w.lastChild.value=d;w.lastChild.oninput=calc;fl.append(w)});calc()};
  const ash=$(root,'#ashare');
  if(ash)ash.onclick=()=>{
    const text='CIFRA Pro · Учёт · '+k+'\n'+lastAcc;
    if(C.share)C.share(text);else if(navigator.share)navigator.share({title:'CIFRA Pro · Учёт',text}).catch(()=>C.copy(text));else C.copy(text);
  };
  draw();
}

return{conv,fin,dateTool,graph,board,acc};
})();

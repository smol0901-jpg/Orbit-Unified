/* CIFRA Engine v8 — безопасный парсер выражений без eval().
   Переменные x,y; константы pi,e,tau,phi; расширенные функции;
   простой решатель линейных/квадратных уравнений; nCr/nPr, gcd/lcm. */
const Engine=(()=>{
const F={
  sin:Math.sin,cos:Math.cos,tan:Math.tan,
  asin:Math.asin,acos:Math.acos,atan:Math.atan,atan2:Math.atan2,
  sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,
  asinh:Math.asinh,acosh:Math.acosh,atanh:Math.atanh,
  ln:Math.log,log:Math.log10,lg:Math.log10,log2:Math.log2,
  sqrt:Math.sqrt,cbrt:Math.cbrt,abs:Math.abs,exp:Math.exp,
  floor:Math.floor,ceil:Math.ceil,round:Math.round,sign:Math.sign,
  hypot:Math.hypot,min:Math.min,max:Math.max,
  mod:(a,b)=>((a%b)+b)%b,
  sec:x=>1/Math.cos(x),csc:x=>1/Math.sin(x),cot:x=>1/Math.tan(x),
  asec:x=>Math.acos(1/x),acsc:x=>Math.asin(1/x),acot:x=>Math.atan(1/x),
  logb:(b,x)=>Math.log(x)/Math.log(b),
  gcd:(a,b)=>{a=Math.abs(Math.round(a));b=Math.abs(Math.round(b));while(b){const t=b;b=a%b;a=t}return a},
  lcm:(a,b)=>{a=Math.abs(Math.round(a));b=Math.abs(Math.round(b));return a&&b?Math.abs(a*b)/F.gcd(a,b):0},
  ncr:(n,k)=>{n=Math.round(n);k=Math.round(k);if(k<0||k>n||n<0)return 0;if(k>n-k)k=n-k;let r=1;for(let i=1;i<=k;i++)r=r*(n-k+i)/i;return Math.round(r)},
  npr:(n,k)=>{n=Math.round(n);k=Math.round(k);if(k<0||k>n||n<0)return 0;let r=1;for(let i=0;i<k;i++)r*=(n-i);return r},
  rand:()=>Math.random(),
  deg:x=>x*180/Math.PI,rad:x=>x*Math.PI/180
};
const ERR='Ошибка',VARS={x:1,y:1};
const CONST={pi:Math.PI,e:Math.E,tau:2*Math.PI,phi:(1+Math.sqrt(5))/2,inf:Infinity};

function fact(n){
  if(n<0||n%1||n>170)throw Error(ERR);
  let r=1;for(let i=2;i<=n;i++)r*=i;return r;
}

function tokenize(s){
  s=String(s)
    .replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/–/g,'-')
    .replace(/√/g,'sqrt').replace(/∛/g,'cbrt')
    .replace(/π/g,'pi').replace(/τ/g,'tau').replace(/φ/g,'phi')
    .replace(/²/g,'^2').replace(/³/g,'^3')
    .replace(/≤/g,'<=').replace(/≥/g,'>=').replace(/≠/g,'!=')
    /* кириллица х/у → латиница (русская раскладка) */
    .replace(/[хХ]/g,'x').replace(/[уУ]/g,'y')
    .replace(/[аА]/g,'a').replace(/[бБ]/g,'b').replace(/[сС]/g,'c');
  const t=[];let i=0;
  while(i<s.length){
    const c=s[i];
    if(/\s/.test(c)){i++;continue}
    if(/[\d.]/.test(c)){
      let n='';
      while(i<s.length&&/[\d.]/.test(s[i]))n+=s[i++];
      const prevTok=t[t.length-1];
      const afterFunc=prevTok==='('||prevTok===',';
      if(!afterFunc&&s[i]===','&&!n.includes('.')&&/\d/.test(s[i+1]||'')){
        n+='.';i++;
        while(i<s.length&&/\d/.test(s[i]))n+=s[i++];
      }
      /* научная запись: 1e-7, 2.5E+3 */
      if(/e/i.test(s[i]||'')&&/[+\-\d]/.test(s[i+1]||'')){
        n+=s[i++];
        if(s[i]==='+'||s[i]==='-')n+=s[i++];
        while(i<s.length&&/\d/.test(s[i]))n+=s[i++];
      }
      t.push(n);continue;
    }
    if(/[a-z]/i.test(c)){
      let w='';
      while(i<s.length&&/[a-z]/i.test(s[i]))w+=s[i++].toLowerCase();
      t.push(w);continue;
    }
    if(c==='<'||c==='>'||c==='!'){
      if(s[i+1]==='='){t.push(c+'=');i+=2;continue}
      if(c!=='!'){t.push(c);i++;continue}
      t.push('!');i++;continue;   /* факториал: 5!, (3+2)! */
    }
    if('+-*/^()!%;,='.includes(c)){t.push(c==='%'?'%':c);i++;continue}
    throw Error(ERR);
  }
  return t;
}

function calc(s,deg,vars){
  const t=tokenize(s);let o=0,i=0;
  for(const q of t){if(q==='(')o++;if(q===')')o--}
  while(o-->0)t.push(')');
  const peek=()=>t[i],next=()=>t[i++];
  const rad=v=>deg?v*Math.PI/180:v;
  const clean=r=>Math.abs(r)<1e-12?0:(Math.abs(r)>1e15?r:parseFloat(r.toPrecision(14)));
  const vmap=Object.assign({},CONST,vars||{});

  function expr(){
    let v=sum();
    const p=peek();
    if(p==='<'||p==='>'||p==='<='||p==='>='||p==='='||p==='!='){
      const op=next(),w=sum();
      if(op==='<')v=v<w?1:0;
      else if(op==='>')v=v>w?1:0;
      else if(op==='<=')v=v<=w?1:0;
      else if(op==='>=')v=v>=w?1:0;
      else if(op==='!=')v=v!==w?1:0;
      else v=v===w?1:0;
    }
    return v;
  }
  function sum(){
    let v=term().v;
    while(peek()==='+'||peek()==='-'){
      const op=next(),r=term(),b=r.pct?v*r.v:r.v;
      v=op==='+'?v+b:v-b;
    }
    return v;
  }
  function term(){
    let v=unary(),mul=false;
    for(;;){
      const p=peek();
      if(p==='*'||p==='/'){
        next();mul=true;const r=unary();
        if(p==='/'){if(r===0)throw Error('Деление на 0');v/=r}else v*=r;
      }else if(p&&(p==='('||/^[a-z\d.]/.test(p))){
        mul=true;v*=unary();
      }else break;
    }
    return{v,pct:!mul&&t[i-1]==='%'};
  }
  function unary(){
    const p=peek();
    if(p==='-'){next();return -unary()}
    if(p==='+'){next();return unary()}
    return power();
  }
  function power(){
    const b=post();
    if(peek()==='^'){next();return Math.pow(b,unary())}
    return b;
  }
  function post(){
    let v=prim();
    while(peek()==='!'||peek()==='%'){v=next()==='!'?fact(v):v/100}
    return v;
  }
  function prim(){
    const x=next();
    if(x===undefined)throw Error(ERR);
    if(/^[\d.]/.test(x))return parseFloat(x);
    if(x==='('){const v=expr();if(next()!==')')throw Error(ERR);return v}
    if(x in vmap){
      if(typeof vmap[x]==='number')return vmap[x];
      throw Error(ERR);
    }
    if(F[x]){
      if(next()!=='(')throw Error(ERR);
      const args=[expr()];
      while(peek()===','){next();args.push(expr())}
      if(next()!==')')throw Error(ERR);
      const v=args[0];
      if(/^(sin|cos|tan|sec|csc|cot)$/.test(x))return clean(F[x](rad(v)));
      if(/^a(sin|cos|tan|sec|csc|cot)$/.test(x))return clean(F[x](v)*(deg?180/Math.PI:1));
      if(x==='min'||x==='max'||x==='hypot'||x==='mod'||x==='logb'||x==='gcd'||x==='lcm'||x==='ncr'||x==='npr'||x==='atan2')
        return clean(F[x](...args));
      if(x==='rand')return F.rand();
      return clean(F[x](v));
    }
    throw Error(ERR);
  }
  const r=expr();
  if(i<t.length||!isFinite(r)&&r!==Infinity&&r!==-Infinity)throw Error(ERR);
  return clean(r);
}

function fnOf(s,deg){return x=>calc(s,deg,{x})}
function surfOf(s,deg){return(x,y)=>calc(s,deg,{x,y})}

/* Простой решатель: линейные ax+b=c и квадратные ax²+bx+c=0 */
function solve(eq,deg){
  eq=String(eq).replace(/\s+/g,'');
  /* нормализуем кириллицу до toLowerCase */
  eq=eq.replace(/[хХ]/g,'x').replace(/[уУ]/g,'y');
  eq=eq.toLowerCase();
  let left,right='0';
  if(eq.includes('=')){
    const parts=eq.split('=');
    if(parts.length!==2)throw Error('Нужно одно равенство: выражение = число');
    left=parts[0];right=parts[1]||'0';
  }else{left=eq}

  let R;
  try{R=calc(right,deg,{})}catch(e){throw Error('Правая часть: '+ (e.message||ERR))}

  /* f(x) = left(x) - R  → ищем корни f(x)=0 */
  const f=x=>{try{return calc(left,deg,{x})-R}catch(e){return NaN}};
  const y0=f(0),y1=f(1),y2=f(2),y3=f(3);
  if(!isFinite(y0)||!isFinite(y1)||!isFinite(y2)){
    throw Error('Не удалось вычислить выражение. Используйте лат. x и скобки');
  }

  /* проверка степени: для квадратного вторая разность постоянна */
  const d2_01=y2-2*y1+y0, d2_12=y3-2*y2+y1;
  const a=d2_01/2;
  const b=y1-y0-a;
  const c=y0;

  /* если третья разность заметна — выше 2 степени */
  if(isFinite(y3)&&Math.abs(d2_12-d2_01)>1e-6*Math.max(1,Math.abs(d2_01))){
    /* пробуем численно найти до 2 корней на отрезке [-200,200] */
    const roots=[],N=800,x0=-200,x1=200;
    let prevX=x0,prevY=f(x0);
    for(let i=1;i<=N;i++){
      const x=x0+(x1-x0)*i/N;let y=f(x);
      if(isFinite(prevY)&&isFinite(y)&&(prevY<0)!==(y<0)){
        /* бисекция */
        let lo=prevX,hi=x,flo=prevY;
        for(let k=0;k<40;k++){
          const mid=(lo+hi)/2,fm=f(mid);
          if(!isFinite(fm))break;
          if((flo<0)===(fm<0)){lo=mid;flo=fm}else hi=mid;
        }
        roots.push(clean((lo+hi)/2));
        if(roots.length>=4)break;
      }
      prevX=x;prevY=y;
    }
    if(roots.length)return{type:'numeric',roots,msg:'Численное решение ('+roots.length+')'};
    return{type:'none',msg:'Нет корней на [-200; 200] или степень > 2'};
  }

  if(Math.abs(a)<1e-10){
    if(Math.abs(b)<1e-10){
      if(Math.abs(c)<1e-10)return{type:'identity',msg:'Верно при любом x'};
      return{type:'none',msg:'Нет решений'};
    }
    return{type:'linear',roots:[clean(-c/b)],msg:'Линейное уравнение'};
  }
  const D=b*b-4*a*c;
  if(D<-1e-10)return{type:'none',msg:'Нет действительных корней',D:clean(D)};
  if(Math.abs(D)<1e-10)return{type:'quadratic',roots:[clean(-b/(2*a))],msg:'Один корень',D:0};
  const sD=Math.sqrt(D);
  return{type:'quadratic',roots:[clean((-b-sD)/(2*a)),clean((-b+sD)/(2*a))].sort((p,q)=>p-q),msg:'Два корня',D:clean(D)};
}

function clean(r){
  if(typeof r!=='number'||!isFinite(r))return r;
  return Math.abs(r)<1e-12?0:parseFloat(r.toPrecision(12));
}

function fmt(n,dec=10,sep='sp'){
  if(n===0)return '0';
  if(!isFinite(n))return n>0?'∞':'-∞';
  const a=Math.abs(n);
  if(a>=1e15||a<1e-9&&a>0)return n.toExponential(6).replace(/\.?0+e/,'e').replace('e+','×10^').replace('e-','×10^−');
  return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:dec,useGrouping:sep!=='no'}).format(n);
}

return{calc,fmt,fnOf,surfOf,solve,CONST,F};
})();
if(typeof module!=='undefined')module.exports=Engine;
if(typeof window!=='undefined')window.Engine=Engine;

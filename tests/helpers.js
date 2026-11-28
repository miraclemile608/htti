const vm=require('node:vm');
const fs=require('node:fs');
function clock(){
  let now=0,id=0;const tasks=new Map();
  return {now:()=>now,tasks,
    setTimeout(fn,delay=0){const key=++id;tasks.set(key,{fn,at:now+Math.max(1,delay)});return key;},
    clearTimeout(key){tasks.delete(key);},
    advance(ms){const end=now+ms;let iterations=0;while(true){const next=[...tasks].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;if(++iterations>100000)throw Error('timer loop');now=next[1].at;tasks.delete(next[0]);next[1].fn();}now=end;}
  };
}
function memoryStorage(){
  const map=new Map();
  return {getItem:key=>map.has(String(key))?map.get(String(key)):null,
    setItem:(key,value)=>{map.set(String(key),String(value));},
    removeItem:key=>{map.delete(String(key));},
    clear:()=>map.clear(),
    key:index=>[...map.keys()][index]??null,
    get length(){return map.size;}};
}
function environment({reduced=false,random=.1,sessionStorage=memoryStorage(),width=1280}={}){
  const time=clock();let randomValue=random;
  const math=Object.create(Math);math.random=()=>randomValue;
  const context={console,Math:math,Set,Promise,Float32Array,sessionStorage,setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,setInterval:()=>0,clearInterval:()=>{},
    performance:{now:time.now},document:{hidden:false},matchMedia:()=>({matches:reduced}),innerWidth:width,innerHeight:900,scrollTo:()=>{},navigator:{},
    requestAnimationFrame:fn=>time.setTimeout(()=>fn(time.now()),16)};
  context.listeners={};
  context.addEventListener=(type,fn)=>{(context.listeners[type]??=[]).push(fn);};
  context.dispatchEvent=(type,event={})=>{for(const fn of context.listeners[type]||[])fn.call(context,{type,target:context,...event});};
  context.window=context;context.globalThis=context;
  vm.createContext(context);
  return {context,time,random(value){randomValue=value;},run(file){vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});}};
}
module.exports={environment,memoryStorage};

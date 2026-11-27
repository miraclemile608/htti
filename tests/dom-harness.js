// 小型无渲染 DOM 桩：用于执行真实页面脚本及点击流程；不替代浏览器视觉/音频验收。
const fs=require('node:fs');
const vm=require('node:vm');
const {environment}=require('./helpers');
class Element {
  constructor(tag='div'){
    this.tagName=tag.toUpperCase();this.attrs={};this.children=[];this.events={};this.parent=null;this._text='';this.dataset={};this.value='';this.disabled=false;this.checked=false;
    this.style={setProperty(name,value){this[name]=value;}};
    const el=this;
    this.classList={contains(x){return el.className.split(/\s+/).includes(x);},add(...xs){el.className=[...new Set([...el.className.split(/\s+/).filter(Boolean),...xs])].join(' ');},remove(...xs){el.className=el.className.split(/\s+/).filter(x=>!xs.includes(x)).join(' ');},toggle(x,on){const next=on===undefined?!this.contains(x):on;if(next)this.add(x);else this.remove(x);return next;}};
  }
  get className(){return this.attrs.class||'';}set className(value){this.attrs.class=value;}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='disabled')this.disabled=true;if(k==='checked')this.checked=true;}
  getAttribute(k){return this.attrs[k]??null;}
  appendChild(child){child.parent=this;this.children.push(child);return child;}
  removeChild(child){this.children=this.children.filter(x=>x!==child);child.parent=null;}
  set textContent(value){this.children=[];this._text=String(value);}get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  set innerHTML(value){this.children=[];this._text='';parse(String(value),this);}get innerHTML(){return this._text;}
  matches(selector){
    const attribute=selector.match(/\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/);
    if(attribute&&(this.getAttribute(attribute[1])===null||(attribute[2]!==undefined&&this.getAttribute(attribute[1])!==attribute[2])))return false;
    selector=selector.replace(/\[[^\]]+\]/g,'');
    const tag=selector.match(/^[\w-]+/);if(tag&&this.tagName!==tag[0].toUpperCase())return false;
    const id=selector.match(/#([\w-]+)/);if(id&&this.getAttribute('id')!==id[1])return false;
    return [...selector.matchAll(/\.([\w-]+)/g)].every(m=>this.classList.contains(m[1]));
  }
  closest(selector){for(let el=this;el;el=el.parent)if(selector.split(',').some(s=>el.matches(s)))return el;return null;}
  querySelectorAll(selector){
    const parts=selector.trim().split(/\s+/),out=[];
    function walk(el){for(const child of el.children){
      if(child.matches(parts.at(-1))){let index=parts.length-2,parent=child.parent;while(index>=0&&parent){if(parent.matches(parts[index]))index--;parent=parent.parent;}if(index<0)out.push(child);}
      walk(child);
    }}walk(this);return out;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  addEventListener(type,fn){(this.events[type]??=[]).push(fn);}
  dispatch(type,event={}){for(const fn of this.events[type]||[])fn.call(this,{target:this,preventDefault(){},...event});}
  click(){if(!this.disabled)this.dispatch('click');}
  focus(){this.focused=true;}select(){}getContext(){return null;}
  getBoundingClientRect(){return {left:10,top:10,width:20,height:10};}
}
function parse(html,root){
  const stack=[root],voids=new Set(['AREA','BASE','BR','COL','EMBED','HR','IMG','INPUT','LINK','META','PARAM','SOURCE','TRACK','WBR']);
  for(const token of html.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){
    if(token.startsWith('<!--')||token.startsWith('<!'))continue;
    if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
    if(token.startsWith('<')){
      const tag=token.match(/^<([\w-]+)/);if(!tag)continue;const el=new Element(tag[1]);
      for(const match of token.slice(tag[0].length).matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))el.setAttribute(match[1],match[2]??match[3]??match[4]??'');
      stack.at(-1).appendChild(el);if(!voids.has(el.tagName)&&!token.endsWith('/>'))stack.push(el);
    }else stack.at(-1)._text+=token;
  }
}
function app(options={}){
  const env=environment({reduced:true,...options});
  const html=fs.readFileSync('index.html','utf8'),document=new Element('document');
  parse(html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g,''),document);
  document.body=document.querySelector('body');document.hidden=false;document.createElement=tag=>new Element(tag);document.execCommand=()=>true;
  env.context.document=document;env.context.navigator={clipboard:{writeText:async value=>{env.copied=value;}}};env.context.isSecureContext=true;
  for(const file of ['questions.js','audio.js','horror.js'])env.run(file);
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())vm.runInContext(match[1],env.context);
  return {...env,document,$:selector=>document.querySelector(selector),$$:selector=>document.querySelectorAll(selector)};
}
module.exports={app};

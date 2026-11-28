const test=require('node:test');
const assert=require('node:assert/strict');
const {environment}=require('./helpers');

function setup(){
  const env=environment(),contexts=[];
  function param(){return {value:0,events:[],cancelAndHoldAtTime(t){this.events.push(['hold',t]);},cancelScheduledValues(t){this.events.push(['cancel',t]);},setValueAtTime(v,t){this.events.push(['set',v,t]);},linearRampToValueAtTime(v,t){this.events.push(['linear',v,t]);},exponentialRampToValueAtTime(v,t){this.events.push(['exponential',v,t]);},setTargetAtTime(v,t,c){this.events.push(['target',v,t,c]);}};}
  function node(){return {gain:param(),frequency:param(),Q:param(),pan:param(),playbackRate:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){},disconnect(){},start(){this.started=true;},stop(at){this.stopAt=at;if(at===undefined){this.cancelled=true;if(this.onended)this.onended();}}};}
  class Context{
    constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=8;this.destination=node();this.sources=[];this.gains=[];contexts.push(this);}
    createGain(){const n=node();this.gains.push(n);return n;}
    createOscillator(){const n=node();this.sources.push(n);return n;}
    createBufferSource(){const n=node();this.sources.push(n);return n;}
    createBiquadFilter(){return node();}
    createStereoPanner(){return node();}
    createDynamicsCompressor(){return node();}
    createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
    decodeAudioData(data){return Promise.resolve({asset:data.url,duration:data.url.includes('dread')?48:.62});}
    resume(){if(this.resumeImpl)return this.resumeImpl();this.state='running';return Promise.resolve();}
    suspend(){this.state='suspended';return Promise.resolve();}
    close(){this.state='closed';return Promise.resolve();}
  }
  env.context.AudioContext=Context;env.run('audio.js');
  return {...env,contexts,audio:env.context.HTTIAudio,Context};
}
async function flush(){for(let i=0;i<15;i++)await Promise.resolve();}

function samples(s,fetchImpl){
  s.requests=[];
  s.context.fetch=url=>{s.requests.push(url);return fetchImpl?fetchImpl(url):Promise.resolve({ok:true,arrayBuffer:async()=>({url})});};
}

test('音频等待手势且只初始化一次；静音、后台和重启释放声音与定时器',async()=>{
  const s=setup();assert.equal(s.contexts.length,0);assert.equal(s.audio.state().enabled,true);
  s.audio.start();await flush();s.audio.start();await flush();
  assert.equal(s.contexts.length,1);assert.equal(s.audio.state().running,true);assert.equal(s.time.tasks.size,1);
  s.audio.update(.9,false);s.audio.scare('knock');const knock=s.contexts[0].sources.at(-1);
  s.context.document.hidden=true;s.audio.visibility();await flush();
  assert.equal(knock.cancelled,true);assert.equal(s.audio.state().running,false);assert.equal(s.time.tasks.size,0);
  s.context.document.hidden=false;s.audio.visibility();await flush();
  assert.equal(s.audio.state().running,true);assert.equal(s.time.tasks.size,1);
  s.audio.setEnabled(false);assert.equal(s.contexts[0].state,'closed');assert.equal(s.time.tasks.size,0);
  s.audio.setEnabled(true);await flush();assert.equal(s.contexts.length,2);assert.equal(s.audio.state().running,true);
  s.audio.stop();assert.equal(s.contexts[1].state,'closed');assert.equal(s.time.tasks.size,0);
});

test('结尾露牙只用一记短促低频冲击（hit），不走长音',async()=>{
  const s=setup();s.audio.start();await flush();
  const ctx=s.contexts[0];
  const before=ctx.sources.length;
  s.audio.hit(.34);
  assert.equal(ctx.sources.length,before+1,'一记冲击就是一个振荡器');
  assert.equal(typeof s.audio.longTone,'undefined','长音已经从库里移除，演出不再拖长音');
  s.audio.stop();
});

test('浏览器拒绝恢复音频后可重试；迟到的恢复回调不会在隐藏页面重建心跳',async()=>{
  const s=setup();let allowResume=false;
  s.Context.prototype.resume=function(){if(!allowResume)return Promise.reject(Error('gesture required'));this.state='running';return Promise.resolve();};
  s.audio.start();await flush();assert.equal(s.audio.state().failed,false);assert.equal(s.time.tasks.size,0);
  allowResume=true;s.audio.start();await flush();assert.equal(s.audio.state().running,true);assert.equal(s.contexts.length,1);
  s.context.document.hidden=true;s.audio.visibility();await flush();
  s.context.document.hidden=false;
  let completeResume;s.contexts[0].resumeImpl=()=>new Promise(resolve=>{completeResume=resolve;});
  s.contexts[0].resume=function(){return this.resumeImpl();};
  s.audio.start();s.context.document.hidden=true;s.audio.visibility();completeResume();await flush();
  assert.equal(s.time.tasks.size,0);s.audio.stop();
});

test('手势后加载本地采样；背景只循环一份，静音重开复用已解码资源',async()=>{
  const s=setup();samples(s);assert.equal(s.requests.length,0);
  s.audio.start();await flush();
  assert.equal(s.audio.state().samples,'ready');
  assert.deepEqual(s.requests.sort(),['assets/audio/dread-loop.mp3','assets/audio/jumpscare.mp3']);
  const ctx=s.contexts[0],loops=()=>ctx.sources.filter(n=>n.buffer?.asset&&n.loop);
  assert.equal(loops().length,1);assert.equal(loops()[0].started,true);
  s.audio.start();s.audio.update(.8,false);await flush();assert.equal(loops().length,1);
  s.audio.setEnabled(false);assert.equal(loops()[0].cancelled,true);
  s.audio.setEnabled(true);await flush();
  assert.equal(s.requests.length,2);assert.equal(s.contexts[1].sources.filter(n=>n.buffer?.asset&&n.loop).length,1);
  s.audio.stop();
});

test('突脸使用短采样并压低背景；取消效果恢复背景且停止所有一次性声音',async()=>{
  const s=setup();samples(s);s.audio.start();await flush();const ctx=s.contexts[0];
  s.audio.scare('face');
  const sting=ctx.sources.find(n=>n.buffer?.asset?.includes('jumpscare'));
  assert.ok(sting,'应播放采样而非只用振荡器');assert.ok(sting.stopAt<=.65,'音效必须能在主突脸结束前收尾');
  const duck=ctx.gains.find(n=>n.gain.events.some(e=>e[0]==='linear'&&e[1]<.2));
  assert.ok(duck,'突发声到来时应压低背景总线');
  s.audio.cancelEffects();assert.equal(sting.cancelled,true);
  assert.ok(duck.gain.events.some(e=>e[0]==='target'&&e[1]===1),'取消时恢复背景');s.audio.stop();
});

test('某个采样挂起不阻塞已就绪的背景，超时后可重新加载失败项',async()=>{
  const s=setup();let networkRecovered=false;
  samples(s,url=>url.includes('jumpscare')&&!networkRecovered?new Promise(()=>{}):Promise.resolve({ok:true,arrayBuffer:async()=>({url})}));
  s.audio.start();await flush();
  assert.equal(s.contexts[0].sources.filter(n=>n.buffer?.asset&&n.loop).length,1,'背景应该独立启动');
  s.time.advance(12001);await flush();assert.equal(s.audio.state().samples,'fallback');
  networkRecovered=true;s.audio.setEnabled(false);s.audio.setEnabled(true);await flush();
  assert.equal(s.audio.state().samples,'ready');assert.equal(s.requests.length,3,'仅重试失败的突发资源');s.audio.stop();
});

test('短暂断网恢复后重新开启声音可以重试，不永久缓存失败结果',async()=>{
  const s=setup();let online=false;
  samples(s,url=>online?Promise.resolve({ok:true,arrayBuffer:async()=>({url})}):Promise.reject(Error('offline')));
  s.audio.start();await flush();assert.equal(s.audio.state().samples,'fallback');
  online=true;s.audio.setEnabled(false);s.audio.setEnabled(true);await flush();
  assert.equal(s.audio.state().samples,'ready');assert.equal(s.requests.length,4);s.audio.stop();
});

test('在背景恢复斜坡中取消突脸保持当前增益，不退回压低的起点',async()=>{
  const s=setup();samples(s);s.audio.start();await flush();const ctx=s.contexts[0];
  s.audio.scare('face');const bed=ctx.gains.find(n=>n.gain.events.some(e=>e[0]==='linear'&&e[1]===.12));
  ctx.currentTime=.65;s.audio.cancelEffects();
  assert.ok(bed.gain.events.some(e=>e[0]==='hold'&&e[1]===.65));
  bed.gain.cancelAndHoldAtTime=undefined;bed.gain.value=.58;ctx.currentTime=.7;s.audio.cancelEffects();
  assert.ok(bed.gain.events.some(e=>e[0]==='set'&&e[1]===.58&&e[2]===.7),'旧浏览器回退应记录当前增益');s.audio.stop();
});

test('采样迟到时不能在静音或后台创建播放源，回到前台才启动背景',async()=>{
  const s=setup(),pending=[];samples(s,url=>new Promise(resolve=>pending.push(()=>resolve({ok:true,arrayBuffer:async()=>({url})}))));
  s.audio.start();await flush();const ctx=s.contexts[0];
  s.context.document.hidden=true;s.audio.visibility();pending.forEach(fn=>fn());await flush();
  assert.equal(ctx.sources.filter(n=>n.buffer?.asset).length,0);
  s.context.document.hidden=false;s.audio.visibility();await flush();
  assert.equal(ctx.sources.filter(n=>n.buffer?.asset&&n.loop).length,1);
  s.audio.stop();
  const muted=setup(),late=[];samples(muted,url=>new Promise(resolve=>late.push(()=>resolve({ok:true,arrayBuffer:async()=>({url})}))));
  muted.audio.start();muted.audio.setEnabled(false);late.forEach(fn=>fn());await flush();
  assert.equal(muted.contexts[0].sources.filter(n=>n.buffer?.asset).length,0);assert.equal(muted.time.tasks.size,0);
});

test('采样下载或解码失败时合成音继续可用，file 协议不发失败请求',async()=>{
  for(const failure of ['network','http','decode']){
    const s=setup();samples(s,()=>failure==='network'?Promise.reject(Error('offline')):Promise.resolve({ok:failure!=='http',arrayBuffer:async()=>({})}));
    if(failure==='decode')s.Context.prototype.decodeAudioData=()=>Promise.reject(Error('decode'));
    s.audio.start();await flush();assert.equal(s.audio.state().failed,false);assert.equal(s.audio.state().samples,'fallback');
    const ctx=s.contexts[0],before=ctx.sources.length;s.audio.scare('face');assert.ok(ctx.sources.length>before);s.audio.stop();
  }
  const s=setup();samples(s);s.context.location={protocol:'file:'};s.audio.start();await flush();assert.equal(s.requests.length,0);assert.equal(s.audio.state().running,true);s.audio.stop();
});

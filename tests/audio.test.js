const test=require('node:test');
const assert=require('node:assert/strict');
const {environment}=require('./helpers');

function setup(){
  const env=environment(),contexts=[];
  function param(){return {value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}};}
  function node(){return {gain:param(),frequency:param(),Q:param(),pan:param(),playbackRate:param(),threshold:param(),knee:param(),ratio:param(),connect(){},disconnect(){},start(){},stop(at){if(at===undefined){this.cancelled=true;if(this.onended)this.onended();}}};}
  class Context{
    constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=8;this.destination=node();this.sources=[];contexts.push(this);}
    createGain(){return node();}
    createOscillator(){const n=node();this.sources.push(n);return n;}
    createBufferSource(){const n=node();this.sources.push(n);return n;}
    createBiquadFilter(){return node();}
    createStereoPanner(){return node();}
    createDynamicsCompressor(){return node();}
    createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
    resume(){if(this.resumeImpl)return this.resumeImpl();this.state='running';return Promise.resolve();}
    suspend(){this.state='suspended';return Promise.resolve();}
    close(){this.state='closed';return Promise.resolve();}
  }
  env.context.AudioContext=Context;env.run('audio.js');
  return {...env,contexts,audio:env.context.HTTIAudio,Context};
}
async function flush(){await Promise.resolve();await Promise.resolve();}

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

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./helpers');
function setup(options){
  const env=environment(options);env.run('horror.js');
  const layer={className:''},state={locked:false,quiz:true,qi:20,total:32,blackout:false},sounds=[];
  const haunt=env.context.HTTIHaunt;
  haunt.init(layer,()=>state,k=>sounds.push(k));
  return {...env,layer,state,sounds,haunt};
}
test('早期、对话、锁定、隐藏页面和关闭效果时均不触发',()=>{
  for(const change of [{qi:9},{locked:true},{quiz:false},{hidden:true},{off:true}]){
    const s=setup();Object.assign(s.state,change);s.context.document.hidden=!!change.hidden;if(change.off)s.haunt.setEnabled(false);
    s.haunt.schedule(s.state.qi);s.time.advance(10000);assert.deepEqual(s.sounds,[]);
  }
  const early=setup();early.state.qi=9;early.haunt.schedule(9);
  assert.equal(early.haunt.target(),-1,'第 10 题之前不该指定突脸');
});
test('那一次突脸：qi>=10 时指定一道题，进入那道题立刻触发，限时消失',()=>{
  const s=setup();
  s.state.qi=10;s.haunt.schedule(10);                                  /* 第 11 题：开始指定，但不在这一题 */
  const target=s.haunt.target();
  assert.equal(target,12,'指定题应当由随机数落在第 11–32 题之间（固定种子为第 13 题）');
  assert.equal(s.haunt.fired(),false);
  s.time.advance(1000);
  assert.ok(!s.sounds.includes('face'),'没到指定那一题不该有突脸');

  s.state.qi=target;s.haunt.schedule(target);
  assert.match(s.layer.className,/face/,'一进入指定题就该突脸，不再等 500ms');
  assert.deepEqual(s.sounds,['face'],'突脸声音只响一次');
  assert.equal(s.haunt.fired(),true);
  s.time.advance(700);
  assert.equal(s.layer.className,'scare-layer','突脸应当自己消失');
});
test('一轮只有那一次：之后的题不再有突脸，只剩氛围事件',()=>{
  const s=setup();
  s.state.qi=10;s.haunt.schedule(10);s.state.qi=s.haunt.target();
  s.haunt.schedule(s.state.qi);
  assert.deepEqual(s.sounds,['face']);
  const target=s.haunt.target();
  for(let qi=target+1;qi<32;qi++){s.state.qi=qi;s.haunt.schedule(qi);s.time.advance(20000);}
  assert.equal(s.sounds.filter(k=>k==='face').length,1,'整轮只该出现一次 face');
  assert.equal(s.sounds.filter(k=>k==='blackout').length,0);
});
test('指定题在黑屏段会换成黑场',()=>{
  const s=setup();
  s.state.qi=10;s.haunt.schedule(10);
  s.state.blackout=true;
  s.state.qi=s.haunt.target();s.haunt.schedule(s.state.qi);
  assert.match(s.layer.className,/blackout/,'黑屏段里那一次应当走黑场');
  assert.deepEqual(s.sounds,['blackout']);
});
test('切后台时指定题不触发；回前台后进下一题立刻补上',()=>{
  const s=setup();
  s.state.qi=10;s.haunt.schedule(10);
  s.context.document.hidden=true;
  s.state.qi=s.haunt.target();s.haunt.schedule(s.state.qi);
  s.time.advance(10000);
  assert.deepEqual(s.sounds,[],'切后台期间不该在后台放突脸');
  assert.equal(s.haunt.fired(),false);

  s.context.document.hidden=false;
  s.state.qi=13;s.haunt.schedule(13);
  assert.match(s.layer.className,/face/,'没赶上的那一次应当在下一题开头补上');
  assert.deepEqual(s.sounds,['face']);
  assert.equal(s.haunt.fired(),true);
});
test('切题、关闭或重开测试会清理待触发和已显示的事件',()=>{
  for(const action of ['cancel','reset']){
    const s=setup({reduced:true});
    s.state.qi=10;s.haunt.schedule(10);
    s.state.qi=s.haunt.target();s.haunt.schedule(s.state.qi);
    assert.match(s.layer.className,/cue/,'减少动态下先停在预告');
    s.haunt[action]();
    s.time.advance(10000);
    assert.equal(s.sounds.length,0,'预告中被清掉，不该再有声音');
    assert.equal(s.layer.className,'scare-layer');
  }
  const s=setup();
  s.state.qi=10;s.haunt.schedule(10);s.state.qi=s.haunt.target();s.haunt.schedule(s.state.qi);
  s.time.advance(200);
  s.haunt.setEnabled(false);
  assert.equal(s.layer.className,'scare-layer','关掉效果要立刻收掉正在显示的突脸');
});
test('减少动态效果下仍会突脸，只是先预告、再静止',()=>{
  const reduced=setup({reduced:true});
  reduced.state.qi=10;reduced.haunt.schedule(10);
  reduced.state.qi=reduced.haunt.target();
  reduced.haunt.schedule(reduced.state.qi);
  reduced.time.advance(700);
  assert.match(reduced.layer.className,/cue/,'减少动态下应先给预告');
  assert.equal(reduced.sounds.length,0,'预告阶段还没有声音');
  reduced.time.advance(1700);
  assert.match(reduced.layer.className,/still/,'预告之后应当出现静止的突脸');
  assert.match(reduced.layer.className,/face/);
  assert.equal(reduced.sounds.length,1,'突脸的声音保留');
  reduced.time.advance(1600);
  assert.equal(reduced.layer.className,'scare-layer','突脸应当自己消失');
});
test('氛围事件仍是随机冷却：每轮最多 5 次，池子里没有突脸和黑场，重新开始清零',()=>{
  const s=setup();
  s.state.qi=10;s.haunt.schedule(10);s.state.qi=s.haunt.target();s.haunt.schedule(s.state.qi);
  assert.deepEqual(s.sounds,['face']);
  const run=()=>{
    const before=s.sounds.length;
    for(const qi of [13,16,19,22,25,28,31]){s.state.qi=qi;s.haunt.schedule(qi);s.time.advance(20000);}
    return s.sounds.slice(before);
  };
  const ambient=run();
  assert.equal(ambient.length,5,'氛围事件上限 5 次');
  for(const kind of ambient) assert.ok(kind==='shadow'||kind==='knock'||kind==='whisper','氛围事件不该是 '+kind);

  s.haunt.reset();
  s.state.qi=10;s.haunt.schedule(10);s.state.qi=s.haunt.target();s.haunt.schedule(s.state.qi);
  assert.equal(s.sounds.filter(k=>k==='face').length,2,'重开之后重新拥有那一次突脸');
  assert.equal(run().length,5,'重开之后氛围计数也清零，可以再来 5 次');
});
test('突脸使用专用独立图片；减少动态仍显示静止帧',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'..','effects.css'),'utf8');
  assert.match(html,/<img class="scare-face" src="assets\/haunt-face\.webp"/);
  const reduced=css.slice(css.indexOf('@media(prefers-reduced-motion:reduce)'));
  assert.ok(!/\.scare-layer\.face[^{]*\{[^}]*display:none/.test(reduced),'减少动态下不应当把突脸 display:none');
  assert.match(reduced,/\.face \.scare-face\{animation:none/, '减少动态下应当保留静止帧');
  assert.match(css,/\.scare-layer\.cue::after\{content:/, '应当有可预期的文字预告');
});

test('减少动态的预告被打断时不扣掉主突脸，答题等待会解除',()=>{
  const s=setup({reduced:true,random:0});
  s.state.qi=10;s.haunt.schedule(10);
  assert.equal(s.haunt.fired(),false);
  let advanced=0;
  s.haunt.afterTarget(()=>advanced++);
  s.time.advance(1000);
  assert.equal(advanced,0);
  s.context.document.hidden=true;s.haunt.cancel();
  assert.equal(advanced,1);
  assert.equal(s.haunt.fired(),false);
  s.context.document.hidden=false;s.state.qi=11;s.haunt.schedule(11);
  s.time.advance(1600);
  assert.match(s.layer.className,/still face/);
  assert.equal(s.haunt.fired(),true);
  assert.deepEqual(s.sounds,['face']);
});
test('不支持 AudioContext 时降级；默认偏好为开但不会自动播放',()=>{
  const s=environment();s.run('audio.js');const audio=s.context.HTTIAudio;
  assert.equal(audio.state().enabled,true);assert.equal(audio.state().running,false);
  audio.start();assert.equal(audio.state().failed,true);assert.equal(audio.state().running,false);
  audio.setEnabled(true);assert.equal(audio.state().enabled,false);
});

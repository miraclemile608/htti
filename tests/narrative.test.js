const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {app}=require('./dom-harness');

const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const HORROR=fs.readFileSync(path.join(__dirname,'..','horror.js'),'utf8');

function start(s){
  s.$('#warnContinue').click();s.time.advance(600);
  s.$('#startBtn').click();s.time.advance(400);
}
function pick(s,value){ s.$$('#scale .scale-btn')[value].click(); }
function answerCurrent(s,value){
  s.time.advance(400);
  pick(s,value);
  s.time.advance(5000);
}
/* 一路答到最后（表层封存页），每题都选同一档，只看进度 */
function playAll(s){
  for(let i=0;i<60;i++){
    s.time.advance(400);
    if(s.$('#screen-front').classList.contains('active'))return;
    const options=s.$$('#options .option');
    if(s.$('#qCount').textContent==='对话'){
      options[1].click();
    }else{
      pick(s,4);
    }
    s.time.advance(5000);
  }
  assert.fail('没有走到表层封存页');
}
function comms(s){
  return s.$('#presenceLog').children.filter(el=>el.classList.contains('line'));
}
function commsText(s){
  return s.$('#presenceLog').textContent;
}
function toBack(s){
  assert.ok(s.$('#screen-front').classList.contains('active'));
  s.$('#revealBtn').click();s.time.advance(3000);
  s.$('#fateBtn').click();
}

test('对讲记录按答题进度逐条出现，从例行报到只剩电流',()=>{
  const s=app();
  start(s);
  assert.equal(comms(s).length,0,'还没进入地下层时不该有通联');

  for(let i=0;i<6;i++) answerCurrent(s,4);
  const early=comms(s).length;
  assert.ok(early>=1,'进入 B2 后至少该有一条例行报到');

  for(let i=0;i<14;i++) answerCurrent(s,4);
  const mid=comms(s).length;
  assert.ok(mid>early,'答到中段应当解锁更多通联：'+early+' → '+mid);

  playAll(s);
  s.time.advance(8000);   // 逐字打完最后一条
  const all=comms(s);
  assert.ok(all.length>=8&&all.length<=10,'通联应当在 8–10 条之间，实际 '+all.length);
  assert.equal(all.length,9);
  assert.ok(commsText(s).includes('她很危险。重复，她很危险。'),'必须有那句「她很危险」');
  assert.ok(commsText(s).includes('已进入 B2'),'第一条应当是例行报到');
  assert.ok(/只剩电流/.test(commsText(s)),'最后应当只剩电流');
  assert.ok(!/第二居住者|预期居住者|扫描房间/.test(commsText(s)),'旧的环境扫描文案必须清掉');
  assert.ok(!/空魇|千面相|加入我们/.test(commsText(s)),'通联不能提前说破结局');
  assert.equal(s.$('#presence').classList.contains('show'),true);
  assert.match(s.$('.presence-head').textContent,/CH-07/);
});

test('恐怖事件会在对讲里插一行 [noise]；低刺激与减少动态下不插也不抖',()=>{
  const loud=app({reduced:false,random:.1});
  start(loud);playAll(loud);
  const noise=loud.$('#presenceLog').children.filter(el=>el.classList.contains('noise'));
  assert.ok(noise.length>=1,'随机事件落下时应当有 [noise] 行');
  assert.match(noise[0].textContent,/^\[noise\] ▓/);
  assert.match(HTML,/body\.presence-shake \.presence\{animation:panelShake/,'面板应当有抖动样式');
  assert.match(HTML,/@keyframes panelShake/);

  const soft=app({reduced:true,random:.1});
  start(soft);soft.$('#effectsBtn').click();      // 用户主动关掉突发效果
  playAll(soft);
  assert.equal(soft.context.document.body.classList.contains('soft-effects'),true);
  const softNoise=soft.$('#presenceLog').children.filter(el=>el.classList.contains('noise'));
  assert.equal(softNoise.length,0,'低刺激下不该有杂音行');
});

test('通联逐字打出来，打完停一下再接下一行；最后一条给读屏播报一次',()=>{
  const s=app({reduced:false,random:.5});
  start(s);
  for(let i=0;i<5;i++) answerCurrent(s,4);
  // 第 6 题答完之后黑屏才结束，通联从这一刻开始打字；小步推进抓住打字中的那一帧
  s.time.advance(400);pick(s,4);
  let first=null;
  for(let i=0;i<50&&!first;i++){ s.time.advance(60);first=comms(s)[0]||null; }
  assert.ok(first,'进入 B2 后应当已有第一条通联');
  const body=first.children[1];
  const full=first._text;
  assert.ok(full && full.length>4,'这条应当有完整文案');
  assert.ok(body.textContent.length<full.length,'第一帧只该有几个字，不该整行跳出');

  s.time.advance(150);
  const typed=body.textContent.length;
  assert.ok(typed>0 && typed<full.length,'应当在一字一字地打');

  s.time.advance(4000);
  assert.equal(body.textContent.trim(),full,'打完之后要是完整一句');

  playAll(s);
  s.time.advance(8000);
  assert.match(s.$('#srStatus').textContent,/只剩电流/,'最后一条要给读屏播报一次');
  assert.equal(s.$('#presence').getAttribute('aria-hidden'),'true','面板本身仍然对读屏隐藏，避免刷屏');
});

test('窄屏 ticker 只留最新一行：历史行不会再叠在同一个位置',()=>{
  const s=app({width:900});
  start(s);
  for(let i=0;i<20;i++) answerCurrent(s,4);
  playAll(s);
  s.time.advance(9000);
  const lines=comms(s);
  assert.ok(lines.length>=3,'窄屏下也已经出现多条通联，实际 '+lines.length);
  const on=lines.filter(el=>el.classList.contains('on'));
  assert.equal(on.length,1,'≤1240px 时只能有一行带 .on，否则绝对定位会全部叠在一起');
  assert.equal(on[0],lines[lines.length-1],'留下的应当是最新一行');
  assert.match(HTML,/\.presence p\{position:absolute/,'窄屏确实走绝对定位的 ticker');
  assert.match(HTML,/overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/,'ticker 里的长行要省略而不是压出面板');

  const wide=app();
  start(wide);
  for(let i=0;i<20;i++) answerCurrent(wide,4);
  playAll(wide);
  wide.time.advance(9000);
  const wideLines=comms(wide);
  assert.ok(wideLines.length>=3);
  assert.equal(wideLines.filter(el=>el.classList.contains('on')).length,wideLines.length,
    '宽屏是流式多行，整段记录都要留着');
});

test('救援频道只占正文之外：面板不吃点击，内容屏底部留出占位',()=>{
  assert.match(HTML,/\.presence\{[^}]*pointer-events:none/s,'面板是 aria-hidden 装饰层，不该吃点击');
  assert.match(HTML,/width:clamp\(150px,calc\(\(100vw - 760px\) \/ 2 - 40px\),246px\)/,
    '面板宽度跟着两侧留白收，1240–1500px 不会压进正文');
  assert.match(HTML,/max-height:min\(196px,30vh\);overflow:hidden/,'面板自己有高度上限，不向下溢出');
  assert.match(HTML,/--presence-pad:96px/,'宽屏底部给面板留 96px');
  assert.match(HTML,/@media \(max-width:1240px\)\{\s*\/\*[\s\S]*?\*\/\s*:root\{--presence-pad:54px\}/,
    'ticker 模式底部留 54px');
  for(const sel of ['#screen-quiz','#screen-front','#screen-found','#screen-back','#screen-loading']){
    assert.match(HTML,new RegExp(sel.replace('#','#')+'\\{[^}]*var\\(--presence-pad\\)'),
      sel+' 要按 --presence-pad 留出面板占位');
  }
  /* 正文是居中的 760px 窄栏：按 CSS 的同一套算式核一遍，面板矩形不能越过正文左边缘 */
  for(const w of [1920,1440,1280,1241,1024,768]){
    const contentLeft=Math.max(0,(w-760)/2);
    if(w>1240){
      const panelRight=14+Math.min(246,Math.max(150,(w-760)/2-40));
      assert.ok(panelRight<=contentLeft,
        w+'px：面板右边缘 '+panelRight+' 不该越过正文左边缘 '+contentLeft);
    }else{
      assert.ok(w<=1240,'≤1240px 走底部通栏 ticker');
    }
  }
  assert.ok(54>=Math.round(8+5+1.9*9.5+5),'窄屏 54px 占位要盖得住 ticker 自己的高度');
});

test('结尾用三张同构肖像逐步露出笑容，连点不会跳过演出',()=>{
  const s=app({reduced:false,random:.5});
  start(s);playAll(s);
  s.$('#revealBtn').click();s.time.advance(3000);
  assert.deepEqual(s.$$('.found-portrait img').map(img=>img.getAttribute('src')),
    ['assets/reveal-neutral.webp','assets/reveal-mid.webp','assets/reveal-smile.webp']);
  assert.equal(s.$('.ghost-grin'),null);
  assert.ok(!s.document.body.classList.contains('finale-smile'));
  s.$('#fateBtn').click();
  s.document.dispatch('keydown',{key:'Enter'});
  s.$('#fateBtn').click();
  assert.equal(s.context.HTTITrace.join('>'),'smile');
  assert.equal(s.document.body.style['--smile-duration'],'2400ms');
  assert.ok(s.$('#fateBtn').disabled);
  assert.ok(!s.$('#screen-back').classList.contains('active'));
  s.time.advance(2399);
  assert.equal(s.context.HTTITrace.join('>'),'smile');
  s.time.advance(1);
  assert.equal(s.context.HTTITrace.join('>'),'smile>tear');
  s.time.advance(4400);
  assert.equal(s.context.HTTITrace.join('>'),'smile>tear>welcome>back');
});


test('结尾演出按 微笑 → 撕裂 → 欢迎加入我们 → 档案 的顺序走',()=>{
  const s=app({reduced:false,random:.5});
  start(s);playAll(s);toBack(s);

  assert.equal(s.context.HTTITrace.join('>'),'smile','点下命运之后先露牙');
  assert.equal(s.$('#screen-back').classList.contains('active'),false);
  assert.ok(s.context.document.body.classList.contains('finale-smile'));

  s.time.advance(2450);
  assert.equal(s.context.HTTITrace.join('>'),'smile>tear','笑容完成后才进入撕裂');
  assert.ok(s.context.document.body.classList.contains('finale-tear'));
  assert.equal(s.$('#finaleLayer').classList.contains('active'),false);

  s.time.advance(1500);
  assert.equal(s.context.HTTITrace.join('>'),'smile>tear>welcome');
  assert.ok(s.context.document.body.classList.contains('finale-black'));
  assert.match(s.$('#finaleLayer').textContent,/欢迎加入我们/);
  assert.equal(s.$('#screen-back').classList.contains('active'),false,'黑场文字期间还不能露出档案');

  s.time.advance(3200);
  assert.equal(s.context.HTTITrace.join('>'),'smile>tear>welcome>back');
  assert.equal(s.$('#screen-back').classList.contains('active'),true);
  const cls=s.context.document.body.className;
  assert.ok(!/finale|tear-frame/.test(cls),'收尾后要清掉演出用的 class：'+cls);
  assert.ok(s.context.document.body.classList.contains('result-mode'));
});

test('减少动态下三段都在，只是换成静止帧与可预期提示',()=>{
  const s=app({reduced:true});
  start(s);playAll(s);toBack(s);

  s.time.advance(200);
  const body=s.context.document.body;
  assert.ok(body.classList.contains('finale-smile'),'静止露牙帧要在');
  assert.ok(body.classList.contains('finale-still'),'减少动态要标记 still');
  assert.match(s.$('#finaleLayer').textContent,/静止的微笑画面/,'要有可预期提示');
  assert.equal(s.$('.found-portrait-smile').getAttribute('src'),'assets/reveal-smile.webp');

  s.time.advance(950);
  assert.equal(s.context.HTTITrace.join('>'),'smile>tear');
  assert.ok(body.classList.contains('tear-frame'),'要有一次静止闪帧');

  s.time.advance(900);
  assert.ok(body.classList.contains('finale-black'));
  assert.match(s.$('#finaleLayer').textContent,/欢迎加入我们/);

  s.time.advance(2200);
  assert.equal(s.context.HTTITrace.join('>'),'smile>tear>welcome>back');
  assert.equal(s.$('#screen-back').classList.contains('active'),true);
});

test('撕裂强度高于随机事件，且与 horror.js 的冷却互不相干',()=>{
  const flash=HTML.slice(HTML.indexOf('@keyframes tearFlash'),HTML.indexOf('@keyframes tearFlash')+260);
  assert.equal((flash.match(/opacity:1/g)||[]).length,3,'撕裂应当是三次黑场快闪（随机黑场只有一次）');
  assert.match(HTML,/body\.finale-tear #app\{animation:tearApp/);
  assert.match(HTML,/drop-shadow\(4px 0 rgba\(255,0,50/,'要有 RGB 通道分离');
  assert.match(HTML,/@keyframes tearSlices/, '要有横向切片错位');
  assert.match(HTML,/body\.finale-tear \.scanlines\{opacity:\.6/, '扫描线要更强');
  assert.match(HTML,/tearMs = reduced \? 700 : 1400/,'默认撕裂 1.4 秒');
  assert.ok(HORROR.includes("kind==='face'?650:kind==='blackout'?950:1600"),'随机事件时长未改');
  assert.ok(!/finale|tear/i.test(HORROR),'结尾演出不许写进 horror.js，冷却互不影响');
});

test('作者链接：首页页脚与档案页页脚共两处，地址干净、新窗口打开、不牵动答题',()=>{
  const s=app();
  assert.equal(s.$('.welcome-author'),null,'结尾黑场那处已经删掉');
  const footers=s.$$('a.author-link');
  assert.equal(footers.length,2,'首页页脚与档案页页脚各一处');
  const intro=footers[0],back=footers[1];
  assert.ok(s.$('#screen-intro').textContent.includes('miracle-mile'),'第一处要在首页页脚');
  assert.ok(s.$('#screen-back').textContent.includes('miracle-mile'),'另一处要在档案页页脚');

  for(const link of [intro,back]){
    assert.equal(link.getAttribute('href'),'https://space.bilibili.com/288422918','去掉 spm 跟踪参数，只留 UID 地址');
    assert.equal(link.getAttribute('target'),'_blank','要在新标签打开');
    assert.equal(link.getAttribute('rel'),'noopener noreferrer');
    assert.equal(link.textContent,'关注作者 · miracle-mile','文案不再带 bilibili：');
  }

  /* 首页那一处在脚注之后，且不挤占开始按钮 */
  const introScreen=s.$('#screen-intro');
  const introOrder=introScreen.children.map(function(el){return el.className||el.tagName||'';});
  assert.ok(introOrder.indexOf('author-row intro-author')>introOrder.indexOf('intro-footnote'),'排在脚注之后');
  assert.ok(s.$('#startBtn'),'开始按钮仍在');
  assert.equal(s.$('#startBtn').textContent,'sink','开始按钮固定 sink，没被挤掉');

  /* 档案页那一处跟免责声明排在同一块页脚小字里 */
  assert.ok(s.$('#screen-back').textContent.includes('miracle-mile'));

  /* 减少动态与低刺激下都照常显示，不许被隐藏 */
  const reducedBlocks=HTML.slice(HTML.indexOf('prefers-reduced-motion'));
  assert.ok(!/author-link[^{]*\{[^}]*display:none/.test(reducedBlocks),'减少动态下也不隐藏页脚链接');
  assert.ok(!/soft-effects[^{]*\.author-link[^{]*\{[^}]*display:none/.test(HTML),'低刺激下不隐藏链接');

  /* 点它不改变当前屏幕，也不进任何答题逻辑 */
  const before=s.$('#screen-intro').classList.contains('active');
  intro.click();back.click();
  assert.equal(before,true);
  assert.ok(s.$('#screen-intro').classList.contains('active'),'点链接不改变当前屏幕');
});

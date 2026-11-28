const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {app}=require('./dom-harness');
const {memoryStorage}=require('./helpers');
const {questions}=require('../questions');

const byText=new Map(questions.map(q=>[q.q,q]));
const SAVE='htti.session.v1';

function start(s){
  assert.equal(s.$('#startBtn').textContent,'sink','首页开始按钮固定文案 sink');
  assert.equal(s.$('#startBtn').disabled,false,'首页开始按钮就可点');
  s.$('#warnContinue').click();s.time.advance(600);
  assert.equal(s.$('#startBtn').textContent,'sink','开始按钮固定 sink，不需要输入名字');
  assert.equal(s.$('#startBtn').disabled,false,'开始按钮永远可用');
  s.$('#startBtn').click();s.time.advance(400);
}
function scale(s){ return s.$$('#scale .scale-btn'); }
function pick(s,value){
  const btns=scale(s);
  assert.equal(btns.length,5,'每题应当有五个档位');
  assert.equal(btns[value].getAttribute('data-value'),String(value));
  btns[value].click();
}
function answerCurrent(s,value){
  s.time.advance(400);          /* 跨过换题后 160ms 的惯性点击门限 */
  pick(s,value);
  s.time.advance(5000);
}
function run(s,code){
  const want={gate:code[0]==='O',freq:code[1]==='R',will:code[2]==='Y',trace:code[3]==='P'};
  let qCount=0,dialogues=0;
  for(let i=0;i<60;i++){
    s.time.advance(400);
    if(s.$('#screen-front').classList.contains('active'))break;
    if(s.$('#qCount').textContent==='对话'){
      const options=s.$$('#options .option');
      assert.equal(options.length,3,'对话应当是三个回应');
      dialogues++;options[1].click();
    }else{
      const question=byText.get(s.$('#qText').textContent);
      assert.ok(question,'题面应当能对回题库：'+s.$('#qText').textContent);
      qCount++;
      const open=want[question.dim];
      pick(s,question.dir>0?(open?4:0):(open?0:4));
    }
    s.time.advance(5000);
  }
  assert.equal(qCount,32);
  assert.equal(dialogues,4);
  assert.ok(s.$('#screen-front').classList.contains('active'),'应当停在表层封存页');
}
function reveal(s){
  assert.ok(s.$('#screen-front').classList.contains('active'));
  s.$('#revealBtn').click();s.time.advance(3000);
  assert.ok(s.$('#fateBtn').classList.contains('show'));
  s.$('#fateBtn').click();
  s.time.advance(9000); // 结尾演出：微笑 → 撕裂 → 欢迎加入我们 → 档案
  assert.ok(s.$('#screen-back').classList.contains('active'));
}

test('真实页面脚本走完 16 条类型路径：32 题 + 4 段对话，配图与代码一一对应',()=>{
  const coordinates=new Set();
  for(const g of ['O','C'])for(const f of ['R','D'])for(const w of ['Y','H'])for(const t of ['P','F']){
    const letters=[g,f,w,t];
    const s=app();start(s);run(s,letters.join(''));
    assert.equal(s.$('#codeText').textContent,letters.join('-'));
    assert.equal(s.$('#codeRow').children.length,4);
    const art=s.$('#projectionImage');
    coordinates.add(art.style['--art-x']+':'+art.style['--art-y']);
    assert.ok(art.getAttribute('aria-label').includes(s.$('#typeCn').textContent));
    assert.equal(s.$('#progressFill').style.width,'100%');
    assert.equal(s.$('#hostText').children.length,0,'宿主行只放纯文本编号');
    assert.match(s.$('#hostText').textContent,/^编号 \d{4}$/,'宿主行应当是四位编号');
    assert.equal(s.$('#invalidHint').textContent,'');
    reveal(s);
  }
  assert.equal(coordinates.size,16);
});

test('全选同一档：类型名与配图不挂任何标签，页面也不写提示',()=>{
  const s=app();start(s);
  for(let i=0;i<60;i++){
    s.time.advance(400);
    if(s.$('#screen-front').classList.contains('active'))break;
    if(s.$('#qCount').textContent==='对话') s.$$('#options .option')[1].click();
    else pick(s,4);
    s.time.advance(5000);
  }
  assert.ok(s.$('#screen-front').classList.contains('active'));
  reveal(s);
  /* 32 个回答完全相同：四维恒为 16 分，仍然是确定的那一个码，页面上不挂任何标签、也不写提示 */
  const banned=['空壳','BLANK','无效卷'];
  for(const word of banned){
    assert.ok(!s.$('#typeCn').textContent.includes(word),'类型名不该带「'+word+'」');
    assert.ok(!s.$('#typeEn').textContent.includes(word),'英文名不该带「'+word+'」');
    assert.ok(!s.$('#artCaption').textContent.includes(word),'配图说明不该带「'+word+'」');
    assert.ok(!s.$('#projectionImage').getAttribute('aria-label').includes(word),'读屏标签不该带「'+word+'」');
  }
  assert.equal(s.$('#invalidHint').textContent,'','结果页不再写「这份没有可读的方向」');
  assert.ok(!s.$('#invalidHint').classList.contains('show'));
  /* 连源码里都不再留这些词和那句提示：复制文本、档案文案、等级名都在这份 HTML 里 */
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  for(const word of banned.concat(['没有可读的方向'])) assert.ok(!html.includes(word),'index.html 不该再出现「'+word+'」');
});

test('键盘 1–5 选择对应档位；连点只记一次；回退保留已选档位',()=>{
  const s=app();start(s);
  assert.equal(s.$('#qCount').textContent,'01 / 32');
  s.document.dispatch('keydown',{key:'3'});
  assert.ok(scale(s)[2].classList.contains('selected'),'数字键 3 应当选中第三档');
  assert.equal(scale(s)[2].getAttribute('aria-checked'),'true');
  pick(s,0);                                   /* 紧接着的连点不该覆盖 */
  assert.ok(scale(s)[2].classList.contains('selected'));
  assert.equal(scale(s)[0].getAttribute('aria-checked'),'false');
  s.time.advance(300);
  assert.equal(s.$('#qCount').textContent,'02 / 32');
  assert.equal(s.$('#progressFill').style.width,(1/32*100)+'%');

  s.$('#backBtn').click();s.time.advance(400);
  assert.equal(s.$('#qCount').textContent,'01 / 32');
  assert.ok(scale(s)[2].classList.contains('selected'),'回退后应当看到刚才选的那一档');
  pick(s,4);s.time.advance(400);
  assert.equal(s.$('#qCount').textContent,'02 / 32');
  assert.equal(s.$('#progressFill').style.width,(1/32*100)+'%','改答案不重复计数');
  s.$('#backBtn').click();s.time.advance(400);
  assert.ok(scale(s)[4].classList.contains('selected'),'回退后应当看到改过的档位');
});

test('信号中断的黑屏期间不接受作答，不会跳过一题',()=>{
  const s=app();start(s);
  for(let i=0;i<5;i++)answerCurrent(s,4);
  s.time.advance(400);pick(s,4);s.time.advance(300);   /* 第 6 题：答完即进入黑屏 */
  assert.equal(s.$('#qCount').textContent,'06 / 32','黑屏期间题目不该前进');
  assert.ok(s.$('#quizHint').textContent.includes('不要回头'));
  s.document.dispatch('keydown',{key:'1'});
  assert.equal(s.$('#qCount').textContent,'06 / 32','黑屏期间按键不该跳过这一题');
  s.time.advance(2000);
  assert.equal(s.$('#qCount').textContent,'07 / 32');
  assert.ok(s.document.body.classList.contains('dark-mode'));
});

test('重新测试清除上一轮进度、结果和随机事件；低刺激偏好保留',()=>{
  const s=app();s.$('#warnLeave').click();
  start(s);run(s,['O','R','Y','P'].join(''));reveal(s);
  s.$('#restartBtn').click();s.time.advance(400);
  assert.ok(s.$('#screen-intro').classList.contains('active'));
  assert.equal(s.context.HTTIHaunt.isEnabled(),false);
  assert.ok(s.document.body.classList.contains('soft-effects'));
  assert.equal(s.$('#scareLayer').className,'scare-layer');
  assert.equal(s.context.sessionStorage.getItem(SAVE),null,'重开应当清掉存档');
  s.$('#startBtn').click();s.time.advance(400);
  assert.equal(s.$('#qCount').textContent,'01 / 32');
  assert.equal(s.$('#progressFill').style.width,'0%');
  assert.ok(!s.$('#resumeBox').classList.contains('show'));
});

test('中途离开后重新打开，可以从原进度接着答',()=>{
  const store=memoryStorage();
  const first=app({sessionStorage:store});
  start(first);
  answerCurrent(first,4);
  answerCurrent(first,2);
  assert.ok(JSON.parse(store.getItem(SAVE)).answers.length===32);

  const second=app({sessionStorage:store});
  assert.ok(second.$('#resumeBox').classList.contains('show'),'应当提示可以继续');
  assert.equal(second.$('#resumeAt').textContent,'3');
  second.$('#warnContinue').click();second.time.advance(600);
  second.$('#resumeBtn').click();second.time.advance(400);
  assert.equal(second.$('#qCount').textContent,'03 / 32');
  assert.equal(second.$('#progressFill').style.width,(2/32*100)+'%');
  assert.ok(!second.$('#resumeBox').classList.contains('show'));
  assert.ok(second.$('#screen-quiz').classList.contains('active'));
});

test('刷新后继续同一轮时，已显示的主突脸不会再播一次',()=>{
  const store=memoryStorage();
  const first=app({sessionStorage:store,reduced:false,random:0});
  start(first);
  for(let i=0;i<11;i++){
    if(first.$('#qCount').textContent==='对话'){
      first.$$('#options .option')[0].click();first.time.advance(5000);
    }else answerCurrent(first,2);
  }
  assert.equal(first.$('#qCount').textContent,'11 / 32');
  const saved=JSON.parse(store.getItem(SAVE));
  assert.equal(saved.scareTarget,10);
  assert.equal(saved.scareShown,true);
  const second=app({sessionStorage:store,reduced:false,random:.99});
  second.$('#warnContinue').click();second.time.advance(600);
  second.$('#resumeBtn').click();
  assert.equal(second.context.HTTIHaunt.target(),10);
  assert.equal(second.context.HTTIHaunt.fired(),true);
  assert.equal(second.$('#qCount').textContent,'11 / 32');
  assert.equal(second.$('#scareLayer').className,'scare-layer');
});

test('对话段不挂「她」与序号；最后一题是 32 / 32；找到你了显示「型名-编号」',()=>{
  const s=app();start(s);
  let sawDialogue=false,lastCount='';
  for(let i=0;i<90;i++){
    s.time.advance(400);
    if(s.$('#screen-front').classList.contains('active'))break;
    if(s.$('#qCount').textContent==='对话'){
      sawDialogue=true;
      assert.equal(s.$('#qKicker').textContent,'INTERLUDE','对话段的角标只写 INTERLUDE');
      assert.ok(!s.$('#qCount').textContent.includes('她'));
      assert.ok(!s.$('#qKicker').textContent.includes('她'));
      s.$$('#options .option')[1].click();
    }else{
      lastCount=s.$('#qCount').textContent;
      assert.match(lastCount,/^\d{2} \/ 32$/,'题号应当是「nn / 32」');
      pick(s,2);
    }
    s.time.advance(5000);
  }
  assert.ok(sawDialogue,'应当走过对话段');
  assert.equal(lastCount,'32 / 32','最后一题必须停在 32 / 32');
  assert.equal(s.$('#progressFill').style.width,'100%');
  assert.ok(s.$('#screen-front').classList.contains('active'));

  s.$('#revealBtn').click();s.time.advance(3000);
  const name=s.$('#foundName').textContent;
  assert.match(name,/^.+-编号\d{4}$/,'「找到你了」后面应当跟「型名-编号0000」');
  assert.ok(name.startsWith(s.$('#typeCn').textContent),'编号前的型名要和结果一致');

  s.$('#fateBtn').click();s.time.advance(9000);
  assert.ok(s.$('#screen-back').classList.contains('active'));
  assert.match(s.$('#hostText').textContent,/^编号 \d{4}$/,'档案页宿主行用编号');
});

test('那一次突脸：第 11 题起指定，进入指定题立刻出现，暗场阶段仍是 face 不是 blackout',()=>{
  const s=app({reduced:false,random:.1});
  start(s);
  let atEleven=false,sawFace=false;
  for(let i=0;i<80;i++){
    s.time.advance(400);
    const count=s.$('#qCount').textContent;
    if(count==='11 / 32'&&!atEleven){
      atEleven=true;
      assert.equal(s.context.HTTIHaunt.target(),12,'第 11 题时应当已经指定了后面某一题');
      assert.equal(s.context.HTTIHaunt.fired(),false);
      assert.equal(s.$('#scareLayer').className,'scare-layer','指定不等于立刻触发');
    }
    if(count==='13 / 32'){
      sawFace=true;
      assert.match(s.$('#scareLayer').className,/scare-layer active face/,'进入指定题就该是 face（第 6 题的黑屏早已结束，不该误判成 blackout）');
      assert.equal(s.context.HTTIHaunt.fired(),true);
      break;
    }
    if(count==='对话') s.$$('#options .option')[1].click();
    else pick(s,4);
    s.time.advance(300);
    if(s.$('#qCount').textContent==='13 / 32'){
      sawFace=true;
      assert.match(s.$('#scareLayer').className,/scare-layer active face/,'换题渲染的同一刻就该出现 face');
      assert.equal(s.context.HTTIHaunt.fired(),true);
      break;
    }
  }
  assert.ok(atEleven&&sawFace,'应当经过第 11 题并在第 13 题看到那一次突脸');
  s.time.advance(160);
  pick(s,1);
  s.time.advance(300);
  assert.equal(s.$('#qCount').textContent,'13 / 32','作答可以记分，换题须等突脸播完');
  assert.match(s.$('#scareLayer').className,/face/);
  s.time.advance(700);
  assert.equal(s.$('#scareLayer').className,'scare-layer','突脸应当在 650ms 后自己消失');
  assert.equal(s.$('#qCount').textContent,'14 / 32');
});

test('输入框已取消；字母快捷键不误触；无音频能力也能打开预览并保存结果图',async()=>{
  const s=app();
  assert.equal(s.$('#userName'),null,'开局不再要求输入名字');
  assert.equal(s.$$('.id-field').length,0,'名字输入框整块删掉');
  s.$('#warningAudio').checked=true;
  s.document.dispatch('keydown',{key:'m',target:s.$('#warningAudio')});
  assert.equal(s.context.HTTIAudio.state().enabled,true,'输入控件里的 m 不该被当成静音');
  start(s);run(s,['C','D','H','F'].join(''));
  assert.equal(s.context.HTTIAudio.state().failed,true);
  reveal(s);
  assert.equal(s.$('#exportLayer').classList.contains('show'),false,'还没点按钮时没有预览');
  s.$('#copyBtn').click();
  await Promise.resolve();
  assert.ok(s.$('#exportLayer').classList.contains('show'),'无音频也能打开结果图预览');
  assert.equal(s.downloads.length,0,'打开预览不等于下载');
  s.$('#exportSave').click();
  assert.equal(s.downloads.length,1,'点保存才下载一次');
});

test('结果页按钮先弹预览：1080×1600 竖版 PNG，型名/代码/四维分数/16 分中位线/两本账/判词/页脚都在图上',async()=>{
  const s=app();start(s);run(s,'CDHF');reveal(s);
  assert.ok(s.$('#copyBtn').textContent.includes('查看结果图'),'按钮语义是预览结果图');
  assert.equal(s.downloads.length,0,'点按钮不再直接下载');
  s.$('#copyBtn').click();
  await Promise.resolve();

  assert.ok(s.$('#exportLayer').classList.contains('show'),'先弹全屏预览');
  assert.equal(s.$('#exportLayer').getAttribute('role'),'dialog','预览是对话框语义');
  assert.equal(s.$('#exportLayer').getAttribute('aria-modal'),'true');
  assert.equal(s.$('#exportLayer').getAttribute('aria-hidden'),'false');
  assert.equal(s.$('#exportImage').getAttribute('src'),'blob:htti-report','预览用的是生成的 blob URL');
  assert.ok(s.$('#exportImage').getAttribute('alt').includes(s.$('#typeCn').textContent),'图片 alt 带型名');
  assert.equal(s.$('#exportClose').focused,true,'打开时焦点进入弹层');
  assert.equal(s.downloads.length,0,'打开预览不触发下载');
  assert.equal(s.canvases.length,1,'应当只画一张图');
  assert.equal(s.objectURLs.length,1,'blob URL 只建一次');
  assert.equal(s.canvases[0].width,1080,'竖版 1080 宽（桩里 devicePixelRatio 为 1）');
  assert.equal(s.canvases[0].height,1600,'竖版 1600 高');

  const said=s.canvasCalls[0].map(call=>call.text).join('');
  const typeCn=s.$('#typeCn').textContent;
  assert.ok(said.includes('HTTI · 虚界投影'),'页眉有站名');
  assert.match(said,/档案编号 · 编号\d{4}/,'页眉有档案编号');
  assert.ok(said.includes(typeCn),'图上有型名：'+typeCn);
  ['C','D','H','F'].forEach(letter=>assert.ok(said.includes(letter),'图上有代码字母 '+letter));
  assert.ok(said.includes('门')&&said.includes('频')&&said.includes('权')&&said.includes('痕'),'四维中文名都在');
  assert.ok(said.includes('16 中位线'),'标注 16 分中位线');
  assert.equal((said.match(/\/ 32/g)||[]).length,4,'四维各有一个 / 32 分刻度');
  assert.equal((said.match(/\/ 100/g)||[]).length,2,'两本账各有一个 / 100');
  assert.ok(said.includes(String(s.$('#dualSurface').textContent)),'图上有表层账');
  assert.ok(said.includes(String(s.$('#dualInner').textContent)),'图上有里层账');
  assert.match(said,/\d{4}-\d{2}-\d{2}/,'页脚有日期');
  assert.ok(said.includes('HTTI · 娱乐向概念框架，非心理测量'),'页脚有免责声明');
  assert.ok(said.includes('作者 miracle-mile'),'页脚有作者');

  s.$('#exportSave').click();
  assert.equal(s.downloads.length,1,'保存图片触发一次下载');
  assert.match(s.downloads[0].name,/^HTTI-.+-编号\d{4}\.png$/,'文件名形如 HTTI-闪影-编号7777.png');
  assert.equal(s.downloads[0].href,'blob:htti-report');
  assert.equal(s.blobs[0].type,'image/png');
  assert.ok(s.$('#exportLayer').classList.contains('show'),'保存后预览不自动关');
  assert.match(s.$('#toast').textContent,/图片已保存/);
});

test('结果图把该型那一格画进右上角：按 TYPES 顺序取 4×4 图集',async()=>{
  const s=app();start(s);run(s,'CDHF');reveal(s);
  s.$('#copyBtn').click();
  await Promise.resolve();
  assert.ok(s.$('#exportLayer').classList.contains('show'),'预览照常打开');
  assert.equal(s.drawImages.length,1,'应当只画一次配图');
  const [img,sx,sy,sw,sh,dx,dy,dw,dh]=s.drawImages[0];
  assert.ok(img,'第一个参数是图集图');
  assert.equal(sx/sw,3,'C-D-H-F 是图集第 16 格，取最后一列');
  assert.equal(sy/sh,3,'C-D-H-F 取最后一行');
  assert.ok(dx>500&&dx<960,'配图落在右侧');
  assert.ok(dw>=300,'配图给到 300px 以上');
  assert.equal(Math.round(dw),Math.round(dh),'配图是正方形');
  const said=s.canvasCalls[0].map(call=>call.text).join('');
  assert.ok(said.includes('虚界投影 / PROJECTION'),'配图带图注');
});

test('file:// 画布被配图污染：重画一张没有配图的，照样预览和保存',async()=>{
  const s=app({taintOnImage:true});start(s);run(s,'CDHF');reveal(s);
  s.$('#copyBtn').click();
  await Promise.resolve();await Promise.resolve();
  assert.ok(s.$('#exportLayer').classList.contains('show'),'污染时也要出预览，不能白屏');
  assert.equal(s.canvases.length,2,'第一张被污染，第二张不带配图');
  assert.equal(s.canvases[1]._drew,0,'第二张不再画配图');
  assert.match(String(s.$('#toast').textContent),/没有形象/,'要给一句轻提示');
  s.$('#exportSave').click();
  assert.equal(s.downloads.length,1,'无配图版本同样可以保存');
  assert.match(s.downloads[0].name,/^HTTI-.+-编号\d{4}\.png$/);
});

test('配图加载失败：照常出图，并在图上写明配图未载入',async()=>{
  const s=app({imageError:true});start(s);run(s,'CDHF');reveal(s);
  s.$('#copyBtn').click();
  await Promise.resolve();
  assert.ok(s.$('#exportLayer').classList.contains('show'),'配图没加载也要出图');
  assert.equal(s.drawImages.length,0,'加载失败就不该 drawImage');
  const said=s.canvasCalls[0].map(call=>call.text).join('');
  assert.ok(said.includes('配图未载入'),'空位要写上「配图未载入」，不留白');
  assert.ok(said.includes('HTTI · 虚界投影'),'页眉照旧');
  assert.match(String(s.$('#toast').textContent),/没有形象/);
});

test('拿不到 canvas 时退回原文字复制并提示，不弹空预览也不下载',async()=>{
  const s=app({noCanvas:true});start(s);run(s,'CDHF');reveal(s);
  assert.equal(s.canvasCalls.length,0,'桩里没有 2d 上下文');
  s.$('#copyBtn').click();
  await Promise.resolve();await Promise.resolve();
  assert.equal(s.downloads.length,0,'没画布就不该有下载');
  assert.equal(s.$('#exportLayer').classList.contains('show'),false,'没画布不该弹空预览');
  assert.match(String(s.context.copied),/找到你了/,'退回文字版');
  assert.match(String(s.context.copied),/虚界投影/);
  assert.match(s.$('#toast').textContent,/已复制文字版/);
});

test('预览可以关：×、Esc、点遮罩空白处，关闭后焦点回到按钮',async()=>{
  const s=app();start(s);run(s,'CDHF');reveal(s);
  function open(){
    s.$('#copyBtn').click();
    assert.ok(s.$('#exportLayer').classList.contains('show'),'预览已打开');
  }
  open();
  s.$('#exportClose').click();
  assert.equal(s.$('#exportLayer').classList.contains('show'),false,'× 关闭');
  assert.equal(s.$('#copyBtn').focused,true,'关闭后焦点回到按钮');

  open();
  s.document.dispatch('keydown',{key:'Escape',target:s.document});
  assert.equal(s.$('#exportLayer').classList.contains('show'),false,'Esc 关闭');
  assert.equal(s.$('#copyBtn').focused,true,'Esc 关闭后焦点回到按钮');

  open();
  s.$('#exportLayer').click();
  assert.equal(s.$('#exportLayer').classList.contains('show'),false,'点遮罩空白处关闭');
  assert.equal(s.$('#copyBtn').focused,true,'遮罩关闭后焦点回到按钮');

  open();
  s.$('#exportShare').click();
  assert.ok(s.$('#exportPlatforms').classList.contains('show'),'平台行已展开');
  s.document.dispatch('keydown',{key:'Escape',target:s.document});
  assert.equal(s.$('#exportLayer').classList.contains('show'),false,'平台行展开时 Esc 也能关');
  assert.equal(s.$('#exportPlatforms').classList.contains('show'),false,'关闭时收起平台行');
  assert.equal(s.$('#exportShare').getAttribute('aria-expanded'),'false','aria-expanded 复位');
  assert.equal(s.$('#copyBtn').focused,true,'收起平台行关闭后焦点仍回按钮');
});

test('预览有焦点陷阱：Tab 在关闭/保存/分享与平台项之间循环，不跑回档案页',async()=>{
  const s=app();start(s);run(s,'CDHF');reveal(s);
  s.$('#copyBtn').click();
  assert.equal(s.$('#exportClose').focused,true,'打开时焦点落在关闭按钮');

  s.$('#exportShare').focus();s.document.activeElement=s.$('#exportShare');
  s.document.dispatch('keydown',{key:'Tab',target:s.document});
  assert.equal(s.$('#exportClose').focused,true,'Tab 从最后一个回到第一个');

  s.$('#exportClose').focus();s.document.activeElement=s.$('#exportClose');
  s.document.dispatch('keydown',{key:'Tab',shiftKey:true,target:s.document});
  assert.equal(s.$('#exportShare').focused,true,'Shift+Tab 从第一个回到最后一个');

  /* 平台行展开后，可用项进 Tab 序列；置灰项跳过 */
  s.$('#exportShare').click();
  const chips=s.$$('.export-chip').filter(el=>!el.disabled);
  assert.equal(chips.length,4,'微信/QQ/QQ空间/哔哩哔哩可用，系统分享与复制图片置灰被跳过');
  const last=chips[chips.length-1];
  last.focus();s.document.activeElement=last;
  s.document.dispatch('keydown',{key:'Tab',target:s.document});
  assert.equal(s.$('#exportClose').focused,true,'Tab 从最后一个可用平台项回到关闭');
});

test('预览固定有「分享」：展开六个平台，能力不足置灰但不隐藏',()=>{
  const s=app();start(s);run(s,'CDHF');reveal(s);
  s.$('#copyBtn').click();
  const share=s.$('#exportShare');
  assert.ok(share,'分享按钮恒在');
  assert.equal(share.textContent.trim(),'分享','按钮语义固定是分享');
  assert.equal(share.disabled,false,'不依赖 Web Share，永远可点');
  assert.equal(share.getAttribute('aria-expanded'),'false');
  for(const id of ['shareWechat','shareQQ','shareQzone','shareBilibili','shareSystem','shareCopy']){
    assert.ok(s.$('#'+id),id+' 恒在');
  }
  assert.equal(s.$('#shareWechat').disabled,false,'微信不靠浏览器分享接口');
  assert.equal(s.$('#shareQQ').disabled,false,'QQ 走官方分享页');
  assert.equal(s.$('#shareQzone').disabled,false,'QQ 空间走官方分享页');
  assert.equal(s.$('#shareBilibili').disabled,false,'哔哩哔哩改用复制');
  assert.equal(s.$('#shareSystem').disabled,true,'无 canShare 时系统分享置灰');
  assert.match(s.$('#shareSystem').textContent,/不支持图片分享/,'置灰要写原因');
  assert.equal(s.$('#shareCopy').disabled,true,'无 ClipboardItem 时复制图片置灰');
  assert.match(s.$('#shareCopy').textContent,/不支持复制/,'置灰要写原因');
  share.click();
  assert.ok(s.$('#exportPlatforms').classList.contains('show'),'点分享展开平台行');
  assert.equal(share.getAttribute('aria-expanded'),'true');
  assert.equal(s.$('#exportPlatforms').getAttribute('role'),'group','平台行是分组语义');
});

test('QQ / QQ 空间：新窗口打开官方分享页，链接、标题、摘要编码正确',()=>{
  const s=app();start(s);run(s,'CDHF');reveal(s);
  s.$('#copyBtn').click();
  s.$('#exportShare').click();

  s.$('#shareQQ').click();
  assert.equal(s.opened.length,1,'QQ 打开一个新窗口');
  const qq=new URL(s.opened[0].href);
  assert.equal(qq.origin+qq.pathname,'https://connect.qq.com/widget/shareqq/index.html');
  assert.equal(qq.searchParams.get('url'),'https://miraclemile608.github.io/htti/','file:// 下用已发布地址');
  assert.match(qq.searchParams.get('title'),/^HTTI · .+-\d{4}$/,'标题是 HTTI · 型名-编号');
  assert.match(qq.searchParams.get('summary'),/门 \d+\/32 · 频 \d+\/32 · 权 \d+\/32 · 痕 \d+\/32；表层 \d+ \/ 100 · 里层 \d+ \/ 100/,'摘要是四维分数一句话');
  assert.equal(s.opened[0].target,'_blank');
  assert.match(String(s.opened[0].features),/noopener/);

  s.$('#shareQzone').click();
  assert.equal(s.opened.length,2,'QQ 空间打开第二个窗口');
  const qz=new URL(s.opened[1].href);
  assert.equal(qz.origin+qz.pathname,'https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey');
  assert.equal(qz.searchParams.get('url'),'https://miraclemile608.github.io/htti/');
  assert.match(qz.searchParams.get('title'),/^HTTI · .+-\d{4}$/);
  assert.match(qz.searchParams.get('summary'),/表层 \d+ \/ 100/);
});

test('微信：能复制图片时一次写入 PNG+链接文字；ClipboardItem 不可用就退成复制链接',async()=>{
  /* a. 有 ClipboardItem：图片与链接文字进同一次剪贴板写入 */
  const a=app();start(a);run(a,'CDHF');reveal(a);
  let written=null;
  a.context.Blob=class{constructor(parts,opts){this.parts=parts;this.type=opts&&opts.type;}};
  a.context.ClipboardItem=class{constructor(items){this.items=items;}};
  a.context.navigator.clipboard.write=async items=>{written=items;};
  a.$('#copyBtn').click();a.$('#exportShare').click();
  a.$('#shareWechat').click();
  await Promise.resolve();await Promise.resolve();
  assert.ok(written&&written.length===1,'写入一个剪贴板项');
  assert.equal(written[0].items['image/png'].type,'image/png','图片是 PNG blob');
  assert.ok(written[0].items['text/plain'],'同一次写入带上结果链接文字');
  assert.ok(written[0].items['text/plain'].parts[0].includes('https://miraclemile608.github.io/htti/'),'文字里有页面链接');
  assert.match(a.$('#toast').textContent,/图片和链接已复制，去微信粘贴发送/);

  /* b. 没有 ClipboardItem：退化为复制链接 */
  const b=app();start(b);run(b,'CDHF');reveal(b);
  b.$('#copyBtn').click();b.$('#exportShare').click();
  b.$('#shareWechat').click();
  await Promise.resolve();await Promise.resolve();
  assert.match(String(b.context.copied),/https:\/\/miraclemile608\.github\.io\/htti\//,'复制的是页面链接');
  assert.match(String(b.context.copied),/HTTI · /,'链接里带型名与编号');
  assert.match(b.$('#toast').textContent,/已复制链接，去微信粘贴发送/);
});

test('哔哩哔哩：同样只复制图片与链接，不伪造平台接口',async()=>{
  const s=app();start(s);run(s,'CDHF');reveal(s);
  let written=null;
  s.context.ClipboardItem=class{constructor(items){this.items=items;}};
  s.context.navigator.clipboard.write=async items=>{written=items;};
  s.$('#copyBtn').click();s.$('#exportShare').click();
  s.$('#shareBilibili').click();
  await Promise.resolve();await Promise.resolve();
  assert.ok(written&&written[0].items['image/png'],'复制的是图片');
  assert.equal(s.opened.length,0,'不打开任何伪造的 B 站接口');
  assert.match(s.$('#toast').textContent,/去 B 站动态里粘贴/);
});

test('系统分享：canShare 认图片才可用，调 navigator.share 带 PNG；不可用置灰不隐藏',async()=>{
  const a=app();start(a);run(a,'CDHF');reveal(a);
  let shared=null;
  a.context.File=class{constructor(parts,name,opts){this.parts=parts;this.name=name;this.type=opts&&opts.type;}};
  a.context.navigator.canShare=files=>Array.isArray(files.files)&&files.files.length===1;
  a.context.navigator.share=data=>{shared=data;return Promise.resolve();};
  a.$('#copyBtn').click();a.$('#exportShare').click();
  assert.equal(a.$('#shareSystem').disabled,false,'能分享时系统分享可用');
  assert.match(a.$('#shareSystem').textContent,/带图片/);
  a.$('#shareSystem').click();
  await Promise.resolve();
  assert.ok(shared,'应当调 navigator.share');
  assert.equal(shared.files.length,1,'分享带一张图片文件');
  assert.match(shared.files[0].name,/^HTTI-.+-编号\d{4}\.png$/,'文件名与下载一致');
  assert.equal(shared.files[0].type,'image/png');
  assert.equal(a.downloads.length,0,'系统分享不触发下载');

  const b=app();start(b);run(b,'CDHF');reveal(b);
  b.context.navigator.canShare=()=>false;
  b.$('#copyBtn').click();b.$('#exportShare').click();
  assert.equal(b.$('#shareSystem').disabled,true,'不能分享时置灰');
  assert.ok(b.$('#shareSystem'),'置灰也不能从 DOM 里消失');
  assert.match(b.$('#shareSystem').textContent,/不支持图片分享/);
});

test('复制图片：只写 PNG；不支持时按钮置灰并提示原因',async()=>{
  const a=app();start(a);run(a,'CDHF');reveal(a);
  let written=null;
  a.context.ClipboardItem=class{constructor(items){this.items=items;}};
  a.context.navigator.clipboard.write=async items=>{written=items;};
  a.$('#copyBtn').click();a.$('#exportShare').click();
  assert.equal(a.$('#shareCopy').disabled,false,'有 ClipboardItem 时可用');
  a.$('#shareCopy').click();
  await Promise.resolve();await Promise.resolve();
  assert.ok(written&&written[0].items['image/png'],'写入 PNG');
  assert.equal(Object.keys(written[0].items).length,1,'只放图片，不塞文字');
  assert.match(a.$('#toast').textContent,/图片已复制/);

  const b=app();start(b);run(b,'CDHF');reveal(b);
  b.$('#copyBtn').click();b.$('#exportShare').click();
  assert.equal(b.$('#shareCopy').disabled,true,'没有 ClipboardItem 时置灰');
});

test('预览层在减少动态下不加入场动画，照常能保存',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.match(html,/\.export-layer\{[^}]*position:fixed/,'预览层是全屏遮罩');
  assert.match(html,/@media \(prefers-reduced-motion:reduce\)\{[\s\S]*?\.export-dialog\{animation:none\}/,'减少动态下不加过渡');
  const s=app({reduced:true});start(s);run(s,'CDHF');reveal(s);
  s.$('#copyBtn').click();
  assert.ok(s.$('#exportLayer').classList.contains('show'),'减少动态下照样弹出');
  s.$('#exportSave').click();
  assert.equal(s.downloads.length,1);
});

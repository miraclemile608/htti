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
  s.time.advance(700);
  assert.equal(s.$('#scareLayer').className,'scare-layer','突脸应当在 650ms 后自己消失');
});

test('输入框已取消；字母快捷键不误触；无音频能力仍可完成并复制结果',async()=>{
  const s=app();
  assert.equal(s.$('#userName'),null,'开局不再要求输入名字');
  assert.equal(s.$$('.id-field').length,0,'名字输入框整块删掉');
  s.$('#warningAudio').checked=true;
  s.document.dispatch('keydown',{key:'m',target:s.$('#warningAudio')});
  assert.equal(s.context.HTTIAudio.state().enabled,true,'输入控件里的 m 不该被当成静音');
  start(s);run(s,['C','D','H','F'].join(''));
  assert.equal(s.context.HTTIAudio.state().failed,true);
  reveal(s);
  s.$('#copyBtn').click();
  await Promise.resolve();
  assert.ok(s.context.navigator.clipboard);
  assert.match(s.$('#toast').textContent,/投影已复制/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {questions,score,SCALE,DIMS,MID,MAX_DIM,TIE_MARK} = require('../questions');

const pairs = {gate:['O','C'],freq:['R','D'],will:['Y','H'],trace:['P','F']};

/* 把「目标极」翻译成一份作答：要让某维靠开放极，正向题选 4、反向题选 0，反之亦然。 */
function answersFor(open){
  return questions.map(q=>{
    const wantOpen = open[q.dim] === true;
    return q.dir > 0 ? (wantOpen ? 4 : 0) : (wantOpen ? 0 : 4);
  });
}
function codeOf(open){ return DIMS.map(d=>open[d.key] ? d.open : d.closed).join('-'); }

test('32 个不同情境；每维 8 题、正向 4 反向 4；五档量表',()=>{
  assert.equal(questions.length,32);
  assert.equal(new Set(questions.map(q=>q.id)).size,32);
  assert.equal(new Set(questions.map(q=>q.q)).size,32);
  assert.deepEqual(SCALE,['完全不符合','比较不符合','不确定','比较符合','完全符合']);
  assert.equal(MID,16);
  assert.equal(MAX_DIM,32);
  for(const dim of Object.keys(pairs)){
    const group=questions.filter(q=>q.dim===dim);
    assert.equal(group.length,8,dim);
    assert.equal(group.filter(q=>q.dir===1).length,4,dim+' 正向题');
    assert.equal(group.filter(q=>q.dir===-1).length,4,dim+' 反向题');
  }
  for(const q of questions){
    assert.ok(q.dir===1||q.dir===-1,'dir 只能 ±1：'+q.id);
    assert.ok([0,1,2,3].includes(q.tier),'tier 0–3：'+q.id);
    assert.equal(typeof q.q,'string');
  }
  assert.equal(new Set(questions.map(q=>q.tier)).size,4);
});

test('连续分：每维 0–32，全开/全闭落在两端，16 型代码与分数一致',()=>{
  const allOpen={gate:true,freq:true,will:true,trace:true};
  const allClosed={gate:false,freq:false,will:false,trace:false};

  const a=score(questions,answersFor(allOpen));
  assert.equal(a.code,'O-R-Y-P');
  assert.equal(a.inner,100);
  assert.equal(a.surface,0);
  assert.equal(a.ifaceCount,4);
  assert.equal(a.tieCount,0);
  for(const d of a.dims){assert.equal(d.sum,32);assert.equal(d.ratio,1);}

  const b=score(questions,answersFor(allClosed));
  assert.equal(b.code,'C-D-H-F');
  assert.equal(b.inner,0);
  assert.equal(b.surface,100);
  assert.equal(b.ifaceCount,0);
  for(const d of b.dims){assert.equal(d.sum,0);assert.equal(d.ratio,0);}
});

test('双账本拆开：门只进里层；表层与里层的和不再是同一个门算出来的定值',()=>{
  /* 只开一扇门：里层 25、表层 100 —— 门不进表层。 */
  const onlyGate=score(questions,answersFor({gate:true,freq:false,will:false,trace:false}));
  assert.equal(onlyGate.code,'O-D-H-F');
  assert.equal(onlyGate.inner,25);
  assert.equal(onlyGate.surface,100);

  /* 只开频：里层 25、表层 67 —— 与上一条接口数相同（都是 1），两本账却完全不同。 */
  const onlyFreq=score(questions,answersFor({gate:false,freq:true,will:false,trace:false}));
  assert.equal(onlyFreq.code,'C-R-H-F');
  assert.equal(onlyFreq.inner,25);
  assert.equal(onlyFreq.surface,67);

  /* 同一档接口数下 surface+inner 不是同一个数，说明不再是「共用 O 的固定和」。 */
  assert.equal(onlyGate.ifaceCount,onlyFreq.ifaceCount);
  assert.notEqual(onlyGate.surface+onlyGate.inner,onlyFreq.surface+onlyFreq.inner);

  /* 全开 / 全闭的两端仍然相反，但中间不再被同一个门绑死。 */
  const sums=[];
  for(let mask=0;mask<16;mask++){
    const open={};
    Object.keys(pairs).forEach((dim,i)=>{open[dim]=((mask>>i)&1)===1;});
    const r=score(questions,answersFor(open));
    assert.equal(r.code,codeOf(open));
    sums.push(r.surface+r.inner);
  }
  assert.ok(new Set(sums).size>=4,'表层与里层的和应当随方向变化，实际只有 '+new Set(sums).size+' 种');
  assert.equal(Math.min(...sums),75);
  assert.equal(Math.max(...sums),125);
});

test('直线作答只会停在 16/32：不靠「一档到底」拿极端，且每次都得到同一份结果',()=>{
  const codes=new Set();
  for(let v=0;v<=4;v++){
    const flat=Array(32).fill(v);
    const r=score(questions,flat);
    for(const d of r.dims){
      assert.equal(d.sum,16,'全选 '+v+' 时 '+d.key+' 应当持中');
      assert.equal(d.ratio,0.5);
      assert.ok(d.tie);
      assert.ok(d.letter===d.openPole||d.letter===d.closedPole);
    }
    assert.equal(r.tieCount,4);
    assert.equal(r.inner,50);
    assert.equal(r.surface,50);
    assert.ok(r.invalid,'32 个回答完全相同应标为无效卷');
    assert.equal(r.spread,0);
    codes.add(r.code);
    assert.equal(score(questions,flat).code,r.code,'同一份作答必须得到同一个类型');
  }
  assert.equal(codes.size,5,'五个档位各自对应一个确定的代码');
  assert.ok(!codes.has('C-D-H-F'),'直线作答不能落到「空魇」这种闭极奖励位');
});

test('恰好 16 分不再默认归闭极：两极点由作答指纹显式决定，且在人群里两边都出现',()=>{
  const seenTieLetters=new Set();
  let ties=0;
  let seed=1;
  function rand(){ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; }
  for(let i=0;i<4000;i++){
    const answers=questions.map(()=>Math.floor(rand()*5));
    const r=score(questions,answers);
    if(!r.dims[0].tie) continue;
    ties++;
    seenTieLetters.add(r.dims[0].letter);
    for(const d of r.dims){
      assert.ok(d.letter===d.openPole||d.letter===d.closedPole);
      if(d.tie) assert.equal(d.letter===d.openPole||d.letter===d.closedPole,true);
      else assert.equal(d.letter,d.sum>MID?d.openPole:d.closedPole,'非持平时由分数决定');
    }
  }
  assert.ok(ties>100,'随机样本里应当出现足够多的持中维度');
  assert.deepEqual([...seenTieLetters].sort(),['C','O'],'持中的维度不能总落在闭极');
});

test('16 型均可到达；题目/答案顺序打乱后按题目 ID 计分不变',()=>{
  const types=new Set();
  for(let mask=0;mask<16;mask++){
    const open={};
    Object.keys(pairs).forEach((dim,i)=>{open[dim]=((mask>>i)&1)===1;});
    const answers=answersFor(open);
    const result=score(questions,answers);
    types.add(result.code);
    const shuffled=questions.slice().reverse();
    assert.deepEqual(score(shuffled,answers.slice().reverse()),result);
  }
  assert.equal(types.size,16);
});

test('缺答或越界答案直接报错，不会被当成某个选项',()=>{
  assert.throws(()=>score(questions,Array(32).fill(null)),/无效/);
  assert.throws(()=>score(questions,Array(32).fill(5)),/无效/);
  assert.throws(()=>score(questions,Array(32).fill(-1)),/无效/);
  assert.throws(()=>score(questions,Array(32).fill(1.5)),/无效/);
  assert.throws(()=>score(questions,Array(32).fill('x')),/无效/);
  assert.throws(()=>score(questions,[]),/32/);
  assert.throws(()=>score(questions.slice(0,31),Array(31).fill(2)),/32/);
});

test('页面脚本语法有效；答题 UI 只保留五级量表；本地脚本、样式和图集均可定位',()=>{
  const html=fs.readFileSync('index.html','utf8');
  for(const match of html.matchAll(/<(script|style)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)){
    if(match[1]==='script') new vm.Script(match[2]);
  }
  assert.ok(html.includes('id="scale"'),'页面里应当有五级量表的容器');
  assert.ok(html.includes('#scale .scale-btn'),'键盘应当直接落到量表档位上');
  assert.ok(!html.includes("'4':3"),'快捷键不应再映射四个选项');
  assert.ok(html.includes('MILD_IDS.length - 1'),'信号中断的位置应当跟着轻松题走');
  for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
    /* 本地资源必须能找到；外链（作者主页）不在这套相对路径里 */
    if(/^(?:data:|https?:)/.test(match[1]))continue;
    assert.ok(fs.existsSync(match[1]),match[1]);
  }
  assert.ok(!/\/\s*32\b/.test(html),'不要再用硬编码的 32');
  const image=fs.readFileSync('assets/endings.webp');
  assert.equal(image.toString('ascii',0,4),'RIFF');
  assert.equal(image.toString('ascii',8,12),'WEBP');
  assert.ok(image.length<500000);
  assert.ok(TIE_MARK.length>0);
});

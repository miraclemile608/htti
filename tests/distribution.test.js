'use strict';
/* 分布回归：别让某一种类型悄悄吃掉所有人。
 * 只看计分本身——每题独立均匀取 0–4，16 型各应落在 6.25% 附近。
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const sandbox = {console, Math: Object.create(Math)};
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'questions.js'), 'utf8'), sandbox, {filename: 'questions.js'});
const {questions, score} = sandbox.HTTI;

const CODES = ['O-R-Y-P','O-R-Y-F','O-R-H-P','O-R-H-F','O-D-Y-P','O-D-Y-F','O-D-H-P','O-D-H-F',
  'C-R-Y-P','C-R-Y-F','C-R-H-P','C-R-H-F','C-D-Y-P','C-D-Y-F','C-D-H-P','C-D-H-F'];

function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = 20000;
const rand = mulberry32(7);
const counts = Object.fromEntries(CODES.map(c => [c, 0]));
let invalid = 0;
for(let i = 0; i < N; i++){
  const answers = questions.map(() => Math.floor(rand() * 5));
  const r = score(questions, answers);
  assert.ok(Object.prototype.hasOwnProperty.call(counts, r.code), 'score() 给出了未知代码 ' + r.code);
  counts[r.code] += 1;
  if(r.invalid) invalid += 1;
}

test('2 万次随机作答：16 型各占 6.25% 上下，没有哪个类型被系统性放大', () => {
  for(const code of CODES){
    const pct = counts[code] / N * 100;
    assert.ok(Math.abs(pct - 6.25) < 1.2, code + ' 占比 ' + pct.toFixed(2) + '%，偏离 6.25% 超过 1.2 个百分点');
  }
});

test('随机作答里没有哪种结局吞掉其他人：最高与最低相差不到 3 个百分点', () => {
  const pcts = CODES.map(c => counts[c] / N * 100);
  const spread = Math.max(...pcts) - Math.min(...pcts);
  assert.ok(spread < 3, '极差 ' + spread.toFixed(2) + ' 个百分点');
});

test('随机作答不会撞上「无效卷」：全 32 题同档的概率是 5 / 5^32', () => {
  assert.strictEqual(invalid, 0);
});

test('直线作答不会靠「一档到底」拿到最开的那一型', () => {
  const codes = [0, 1, 2, 3, 4].map(v => {
    const answers = questions.map(() => v);
    const r = score(questions, answers);
    assert.ok(r.invalid, '全选第 ' + (v + 1) + ' 档应判为无效卷');
    assert.strictEqual(r.surface, 50, '全选第 ' + (v + 1) + ' 档表层应为 50');
    assert.strictEqual(r.inner, 50, '全选第 ' + (v + 1) + ' 档里层应为 50');
    return r.code;
  });
  assert.strictEqual(new Set(codes).size, 5, '五种直线作答应落到五个不同代码，实际：' + codes.join(' / '));
  assert.ok(!codes.includes('O-R-Y-P'), '直线作答拿到了千面相');
  assert.ok(!codes.includes('C-D-H-F'), '直线作答拿到了空魇'); 
});

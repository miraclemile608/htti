#!/usr/bin/env node
/*
 * 模拟：看看五级量表的类型分布到底长什么样。
 *   node tools/simulate.js            默认 100000 次随机作答
 *   node tools/simulate.js 20000      指定次数
 * 每题独立均匀取 0–4（真实作答不会这么均匀，这里只看计分本身有没有结构性偏差）。
 */
'use strict';
const {questions, score, DIMS, MID} = require('../questions');

const NAMES = {
  'O-R-Y-P':'千面相','O-R-Y-F':'掠占','O-R-H-P':'余痕','O-R-H-F':'虚鸣',
  'O-D-Y-P':'缚魂','O-D-Y-F':'途经者','O-D-H-P':'烙印','O-D-H-F':'浮游',
  'C-R-Y-P':'暗胚','C-R-Y-F':'残调','C-R-H-P':'眠者','C-R-H-F':'退行',
  'C-D-Y-P':'寄宿','C-D-Y-F':'闪影','C-D-H-P':'穿心','C-D-H-F':'空魇'
};
const CODES = Object.keys(NAMES);

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

function tally(list, n){
  const counts = {};
  CODES.forEach(c => { counts[c] = 0; });
  list.forEach(r => { counts[r.code] += 1; });
  const rows = CODES.map(code => ({
    code, name: NAMES[code],
    count: counts[code],
    pct: n ? counts[code] / n * 100 : 0
  })).sort((a, b) => b.count - a.count);
  return rows;
}

function bar(pct, width){
  const fill = Math.max(0, Math.round(pct / 100 * width * 16 / 6.25 / 16 * 6.25));
  return '█'.repeat(Math.min(width, Math.round(pct / 6.25 * width / 2)));
}

function table(title, rows, n){
  console.log('');
  console.log(title + '（' + n + ' 次）');
  console.log('  代码    类型      次数      占比');
  for(const r of rows){
    console.log('  ' + r.code + '  ' + padCn(r.name) + '  ' + String(r.count).padStart(7) +
      '  ' + r.pct.toFixed(2).padStart(6) + '%  ' + bar(r.pct, 40));
  }
  const pcts = rows.map(r => r.pct);
  console.log('  最低 ' + Math.min(...pcts).toFixed(2) + '% · 最高 ' + Math.max(...pcts).toFixed(2) + '%' +
    ' · 极差 ' + (Math.max(...pcts) - Math.min(...pcts)).toFixed(2) + ' 个百分点');
}

function padCn(s){ return s + '　'.repeat(Math.max(0, 4 - s.length)); }

function flat(value){ return Array(questions.length).fill(value); }

function randomAnswers(rand){
  return questions.map(() => Math.floor(rand() * 5));
}

function summarize(list, label){
  const n = list.length;
  const ties = DIMS.map((d, i) => list.filter(r => r.dims[i].tie).length / n * 100);
  const invalid = list.filter(r => r.invalid).length;
  const sums = list.map(r => r.surface + r.inner);
  const surf = list.reduce((a, r) => a + r.surface, 0) / n;
  const inner = list.reduce((a, r) => a + r.inner, 0) / n;
  console.log('');
  console.log('  ' + label + '：');
  console.log('    四维持中率  ' + DIMS.map((d, i) => d.name + ' ' + ties[i].toFixed(2) + '%').join(' · '));
  console.log('    无效卷      ' + (invalid / n * 100).toFixed(3) + '%（32 个回答完全相同）');
  console.log('    表层均值 ' + surf.toFixed(1) + ' · 里层均值 ' + inner.toFixed(1) +
    ' · 两账之和 ' + Math.min(...sums) + '–' + Math.max(...sums) +
    '（均值 ' + (sums.reduce((a, b) => a + b, 0) / n).toFixed(1) + '）');
  console.log('    空魇占比    ' + (list.filter(r => r.code === 'C-D-H-F').length / n * 100).toFixed(2) + '%');
}

function main(){
  const n = Number(process.argv[2]) || 100000;
  const rand = mulberry32(20261127);

  const random = [];
  for(let i = 0; i < n; i++){
    const answers = randomAnswers(rand);
    random.push(score(questions, answers));
  }
  table('① 随机作答（每题独立均匀 0–4）', tally(random, n), n);
  summarize(random, '随机作答');

  const straights = [0, 1, 2, 3, 4].map(v => score(questions, flat(v)));
  console.log('');
  console.log('② 直线作答（32 题全选同一档）—— 每维恒为 16 / 32，只看指纹定极');
  console.log('  档位            代码      类型      表层  里层  接口');
  [0, 1, 2, 3, 4].forEach((v, i) => {
    const r = straights[i];
    console.log('  ' + String(v + 1) + ' ' + padCn(['完全不符合','比较不符合','不确定','比较符合','完全符合'][v]) +
      '  ' + r.code + '  ' + padCn(NAMES[r.code]) + '  ' + String(r.surface).padStart(4) + '  ' +
      String(r.inner).padStart(4) + '  ' + r.ifaceCount + ' / 4');
  });

  const corners = [];
  for(let mask = 0; mask < 16; mask++){
    const open = {};
    DIMS.forEach((d, i) => { open[d.key] = ((mask >> i) & 1) === 1; });
    const answers = questions.map(q => {
      const wantOpen = open[q.dim] === true;
      return q.dir > 0 ? (wantOpen ? 4 : 0) : (wantOpen ? 0 : 4);
    });
    corners.push(score(questions, answers));
  }
  const uniq = new Set(corners.map(r => r.code));
  console.log('');
  console.log('③ 极端作答：把每一维都推到底（16 种角）');
  console.log('  可到达类型 ' + uniq.size + ' / 16 · 表层 ' + Math.min(...corners.map(r => r.surface)) +
    '–' + Math.max(...corners.map(r => r.surface)) + ' · 里层 ' +
    Math.min(...corners.map(r => r.inner)) + '–' + Math.max(...corners.map(r => r.inner)) +
    ' · 两账之和 ' + Math.min(...corners.map(r => r.surface + r.inner)) +
    '–' + Math.max(...corners.map(r => r.surface + r.inner)));

  const random2 = [];
  for(let i = 0; i < n; i++) random2.push(score(questions, randomAnswers(rand)));
  console.log('');
  console.log('④ 换一组随机种子再跑一次，确认分布不是撞出来的');
  const again = tally(random2, n);
  console.log('  最低 ' + Math.min(...again.map(r => r.pct)).toFixed(2) + '% · 最高 ' +
    Math.max(...again.map(r => r.pct)).toFixed(2) + '%');
  console.log('');
}

main();

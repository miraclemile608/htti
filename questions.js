(function(root){
  'use strict';
  /*
   * 五级量表：每题一句陈述，作答 0–4。
   *   0 完全不符合 · 1 比较不符合 · 2 不确定 · 3 比较符合 · 4 完全符合
   * 每题只测一个维度；dir:+1 为正向题（越符合越靠开放极），dir:-1 为反向题（按 4-分 翻转）。
   * 每维 8 题、正向 4 题、反向 4 题。全选同一档时，8 题合计恒为 4×v + 4×(4-v) = 16，
   * 即「直线作答」在每一维都只得到持中，不会因为一档到底而拿到极端结果。
   */
  var SCALE = ['完全不符合','比较不符合','不确定','比较符合','完全符合'];
  var DIMS = [
    {key:'gate',  name:'门', open:'O', closed:'C'},
    {key:'freq',  name:'频', open:'R', closed:'D'},
    {key:'will',  name:'权', open:'Y', closed:'H'},
    {key:'trace', name:'痕', open:'P', closed:'F'}
  ];
  var MID = 16;          // 每维 8 题 × 4 分 = 32，中点为 16
  var MAX_DIM = 32;
  var TIE_MARK = '≈';    // 结果页用来标记持平的维度

  var questions = [
    // tier 0：日常、轻松的第一层
    {id:'G1',dim:'gate',tier:0,dir: 1,q:'朋友分享了一档悬疑音频，第一集只有十分钟，我会直接点开听完。'},
    {id:'F1',dim:'freq',tier:0,dir: 1,q:'游戏里的电梯突然响起警报，我的肩膀会猛地一缩、心跳加快。'},
    {id:'W1',dim:'will',tier:0,dir: 1,q:'旁白说「请相信我，左边才是出口」，我会先按它的说法走。'},
    {id:'T1',dim:'trace',tier:0,dir: 1,q:'晚上整理书桌时，下午看过的那张诡异海报会自己浮现出来。'},
    {id:'G2',dim:'gate',tier:0,dir:-1,q:'展览有一段可以跳过的黑暗声景，入口写明没有演员互动，我会绕开它。'},
    {id:'F2',dim:'freq',tier:0,dir:-1,q:'视频会议里传来失真的低语、确认是麦克风故障后，我的身体基本没有反应。'},
    {id:'W2',dim:'will',tier:0,dir:-1,q:'沉浸式游戏要求把一张车票当成「最后的通行证」，我会一直记着它其实是张车票。'},
    {id:'T2',dim:'trace',tier:0,dir:-1,q:'朋友讲完一个不安的梦、随后聊了很久日常，散场后我就基本忘了那个梦。'},

    // tier 1：开始不对劲
    {id:'G3',dim:'gate',tier:1,dir: 1,q:'整理旧手机时发现一条来源不明的录音，标题是「走廊」，我会戴上耳机听一遍。'},
    {id:'F3',dim:'freq',tier:1,dir: 1,q:'夜里电梯停在无人按下的楼层、门打开的一刻，我的心口会一沉。'},
    {id:'W3',dim:'will',tier:1,dir: 1,q:'密室里的录音要求所有人闭眼数到十，队友已经开始照做，我会跟着数。'},
    {id:'T3',dim:'trace',tier:1,dir: 1,q:'经过和视频里相似的楼梯间时，那个画面会突然叠到眼前的楼梯上。'},
    {id:'G4',dim:'gate',tier:1,dir:-1,q:'旧照片背面写着「放大窗户，别看其他地方」，我会合上它。'},
    {id:'F4',dim:'freq',tier:1,dir:-1,q:'墙另一边突然响起三下沉重敲击，声音停下后我很快恢复原来的呼吸和动作。'},
    {id:'W4',dim:'will',tier:1,dir:-1,q:'一个不可信的角色求我别关灯，我会先把他的请求和已有证据分开考虑。'},
    {id:'T4',dim:'trace',tier:1,dir:-1,q:'一段低语让我不舒服之后，运动、吃饭、聊天已经把那种感觉冲淡了。'},

    // tier 2：越过某条线
    {id:'G5',dim:'gate',tier:2,dir: 1,q:'门底滑进一张写着「你想知道隔壁住着谁吗？」的纸，我会翻到背面看。'},
    {id:'F5',dim:'freq',tier:2,dir: 1,q:'镜子里的倒影似乎比我晚半拍才转头时，我的身体会先往后撤。'},
    {id:'W5',dim:'will',tier:2,dir: 1,q:'她说「只有按我的节奏呼吸，你才看得见门」，我会跟上那个节奏。'},
    {id:'T5',dim:'trace',tier:2,dir: 1,q:'确认床边的人影只是衣服之后，第二晚睡前我的目光还是会落到那个位置。'},
    {id:'G6',dim:'gate',tier:2,dir:-1,q:'监控回放里空椅子自己转了过来，我会关掉剩下还没看的部分。'},
    {id:'F6',dim:'freq',tier:2,dir:-1,q:'耳机里的声音突然移到耳边叫我的名字，我也只是微微一颤就恢复呼吸。'},
    {id:'W6',dim:'will',tier:2,dir:-1,q:'纸条说「不要相信你自己的时间」，我会用还能观察到的线索重新判断时间。'},
    {id:'T6',dim:'trace',tier:2,dir:-1,q:'测试结束、门口的影子消失之后，第二天经过那里我不会再联想到它。'},

    // tier 3：她已经在这里
    {id:'G7',dim:'gate',tier:3,dir: 1,q:'黑暗里传来我自己的声音说「再往前一页，就能看到我」，我会把下一页翻开。'},
    {id:'F7',dim:'freq',tier:3,dir: 1,q:'屏幕反光里看见一张脸贴在我肩后，最初一秒我会猛地弹开。'},
    {id:'W7',dim:'will',tier:3,dir: 1,q:'她说「你留下的每一个答案，都是你允许我靠近的证据」，我会按这层关系回应她。'},
    {id:'T7',dim:'trace',tier:3,dir: 1,q:'她说「关掉以后，我还在」，这句话会在没有提示的时候自己响起来。'},
    {id:'G8',dim:'gate',tier:3,dir:-1,q:'档案最后有一张盖住的照片，背面写着我的名字，我会先把它封好。'},
    {id:'F8',dim:'freq',tier:3,dir:-1,q:'明明没有回头，却听见身后的东西也屏住了呼吸，我仍能自然地呼吸、肌肉不紧。'},
    {id:'W8',dim:'will',tier:3,dir:-1,q:'她把出口和自己的名字写在同一扇门上，我会依据自己能确认的线索决定怎么走。'},
    {id:'T8',dim:'trace',tier:3,dir:-1,q:'一周后看到和那天页面相同的颜色，我只会觉得颜色相似，情绪没有被带回来。'}
  ];

  function points(q, value){ return q.dir < 0 ? (4 - value) : value; }

  /*
   * 无效卷：32 个回答完全相同（没有任何波动）时，四个维度都停在正中，
   * 这一份没有可读的方向。此时按作答档位落到下面五个空壳型之一，
   * 结果是确定的、彼此不同，且都不占用 C-D-H-F（那个位置留给真正没有接口的人）。
   * 计算照旧、不随机分配；结果页不再挂任何标签，只在提示行照实写
   * 「32 个回答完全相同，四维都停在 50%」。
   */
  var BLANK_CODES = ['C-R-Y-P','O-D-H-F','C-D-Y-F','O-R-H-P','C-R-H-F'];

  // 作答指纹：对「按题目 ID 排序」的答案串做 FNV-1a，32 位，最后再走一遍雪崩。
  // 用途只有一处——某维恰好 16 / 32 时用它定极，保证同一份答案永远得到同一个类型，
  // 且各维取位不同、在人群上不偏向任何一极。它是显式规则，不是「平分归闭极」。
  function fingerprint(deck, answers){
    var rows = deck.map(function(q, i){ return {id: q.id, v: answers[i]}; });
    rows.sort(function(a, b){ return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); });
    var h = 0x811c9dc5;
    for(var i = 0; i < rows.length; i++){
      var s = rows[i].id + ':' + rows[i].v;
      for(var j = 0; j < s.length; j++){
        h ^= s.charCodeAt(j);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
    }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  function score(deck, answers){
    var total = questions.length;
    if(!Array.isArray(deck) || deck.length !== total) throw new Error('需要完成 ' + total + ' 道题');
    if(!Array.isArray(answers) || answers.length !== deck.length) throw new Error('需要完成 ' + total + ' 道题');

    var values = answers.map(function(raw){
      var n = typeof raw === 'string' ? Number(raw) : raw;
      if(!Number.isInteger(n) || n < 0 || n > 4) throw new Error('存在未作答或无效的答案');
      return n;
    });

    var sums = {gate:0, freq:0, will:0, trace:0};
    deck.forEach(function(q, i){
      if(!sums.hasOwnProperty(q.dim)) throw new Error('题目维度未知：' + q.dim);
      sums[q.dim] += points(q, values[i]);
    });

    var hash = fingerprint(deck, values);
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    var invalid = lo === hi;

    var dims = DIMS.map(function(d, i){
      var sum = sums[d.key];
      var tie = sum === MID;
      var open = tie ? ((hash >>> i) & 1) === 1 : sum > MID;
      return {
        key: d.key, name: d.name,
        openPole: d.open, closedPole: d.closed,
        sum: sum, max: MAX_DIM, ratio: sum / MAX_DIM,
        tie: tie, letter: open ? d.open : d.closed
      };
    });

    if(invalid){
      var blank = BLANK_CODES[lo].split('-');
      dims.forEach(function(d, i){ d.letter = blank[i]; d.tie = true; d.blank = true; });
    }

    // 双账本拆开：门只进里层；频/权/痕在表层里以「反过来」的形式出现。
    // 因此表层与里层不共用任何有向项，两者相加不是固定值。
    var inner = (dims[0].ratio + dims[1].ratio + dims[2].ratio + dims[3].ratio) / 4 * 100;
    var surface = ((1 - dims[1].ratio) + (1 - dims[2].ratio) + (1 - dims[3].ratio)) / 3 * 100;
    var letters = dims.map(function(d){ return d.letter; });

    return {
      dims: dims,
      letters: letters,
      code: letters.join('-'),
      surface: Math.round(surface),
      inner: Math.round(inner),
      ifaceCount: dims.filter(function(d){ return d.letter === d.openPole; }).length,
      ties: dims.map(function(d){ return d.tie; }),
      tieCount: dims.filter(function(d){ return d.tie; }).length,
      invalid: invalid,
      blank: invalid ? BLANK_CODES[lo] : null,
      spread: hi - lo,
      hash: hash
    };
  }

  var api = {questions: questions, score: score, SCALE: SCALE, DIMS: DIMS, MID: MID, MAX_DIM: MAX_DIM, TIE_MARK: TIE_MARK};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTTI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

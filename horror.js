(function(root){
  'use strict';
  /*
   * 恐怖事件分两类，互不干扰：
   *
   * 1. 「那一次」突脸——可预期、每轮只有一次。
   *    通过第 10 题之后（进入第 11 题起，qi>=10）从剩下的题里随机指定一道 targetQi，
   *    每轮只挑一次；那道题一进入就立刻触发 face（0 延迟），
   *    只有当那一刻正卡在 corrupt() 的 1.6 秒黑屏里才改用 blackout。
   *    没有 3 题冷却、没有 16 秒间隔、没有每轮 5 次上限——因为它只来一次。
   *    减少动态效果下仍然是「1.6s 预告 → 静止突脸帧 → 声音」，只是不给动画。
   *
   * 2. 氛围事件（shadow / knock / whisper）——保留原来的随机逻辑：
   *    第 11 题起、间隔 ≥3 题、≥16 秒、每轮最多 5 次，池子里不再有 face / blackout。
   */
  var ambientTimer=null,cueTimer=null,hideTimer=null;
  var enabled=true,lastQuestion=-10,lastAt=-Infinity,lastKind='',count=0;
  var targetQi=-1,fired=false;
  var layer,context,sound;
  var AMBIENT=['shadow','knock','whisper'];
  var FIRST_TARGET=10;          /* 第 11 题的下标：通过第 10 题之后 */
  var AMBIENT_FROM=10;

  function reduced(){return !!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);}
  function ctx(){return context?context():{};}
  function clearTimers(){
    clearTimeout(ambientTimer);clearTimeout(cueTimer);clearTimeout(hideTimer);
    ambientTimer=cueTimer=hideTimer=null;
  }
  function stopLayer(){if(layer)layer.className='scare-layer';}
  function cancel(){clearTimers();stopLayer();if(root.HTTIAudio)root.HTTIAudio.cancelEffects();}
  /* 答题时只收掉还在排队的氛围事件；已经指定的那一次突脸不会因为答得快而消失 */
  function leave(){clearTimeout(ambientTimer);ambientTimer=null;}

  function show(kind){
    /* 减少动态效果不是「取消突脸」，是把它变得可预期：
       先给一句静止的预告，再给一张不缩放、不闪的脸（停留更久），声音照旧。 */
    if(reduced()){
      layer.className='scare-layer active cue';
      cueTimer=setTimeout(function(){
        cueTimer=null;
        layer.className='scare-layer active still '+kind;
        if(sound)sound(kind);
        hideTimer=setTimeout(cancel,kind==='face'?1500:kind==='blackout'?1700:1900);
      },1600);
      return;
    }
    layer.className='scare-layer active '+kind;
    if(sound)sound(kind);
    hideTimer=setTimeout(cancel,kind==='face'?650:kind==='blackout'?950:1600);
  }

  function pickTarget(qi){
    var total=ctx().total||32,from=Math.max(FIRST_TARGET,qi),last=total-1;
    if(last<from)return -1;
    return from+Math.floor(Math.random()*(last-from+1));
  }

  /* 「那一次」：进入指定题就立刻触发，不再等 500–700ms */
  function scheduleTarget(qi){
    if(fired)return false;
    if(targetQi<0)targetQi=pickTarget(qi);
    if(targetQi<0)return false;
    /* 指定题被切后台/锁住错过时，进下一题立刻补上，保证一轮只有这一次、且一定会有 */
    if(targetQi<qi){
      fired=true;
      show(ctx().blackout?'blackout':'face');
      return true;
    }
    if(targetQi!==qi)return false;
    fired=true;
    show(ctx().blackout?'blackout':'face');
    return true;
  }

  /* 氛围事件：原来的随机逻辑与冷却原样保留，只是池子里不再有突脸 */
  function scheduleAmbient(qi){
    if(qi<AMBIENT_FROM)return;
    if(qi-lastQuestion<3||performance.now()-lastAt<16000||count>=5)return;
    var total=ctx().total||32;
    if(Math.random()>.22+(qi/(total-1))*.34)return;
    ambientTimer=setTimeout(function(){
      ambientTimer=null;
      if(!enabled||document.hidden)return;
      var pool=AMBIENT.filter(function(k){return k!==lastKind;});
      var kind=pool[Math.floor(Math.random()*pool.length)];
      lastQuestion=qi;lastAt=performance.now();lastKind=kind;count++;
      show(kind);
    },1800+Math.random()*5200);
  }

  function schedule(qi){
    cancel();
    var s=ctx();
    if(!enabled||document.hidden||!s.quiz||s.qi!==qi||s.locked)return;
    if(qi>=FIRST_TARGET&&scheduleTarget(qi))return;
    scheduleAmbient(qi);
  }

  root.HTTIHaunt={
    init:function(el,getContext,play){layer=el;context=getContext;sound=play;},
    schedule:schedule,leave:leave,cancel:cancel,
    reset:function(){cancel();lastQuestion=-10;lastAt=-Infinity;lastKind='';count=0;targetQi=-1;fired=false;},
    setEnabled:function(value){enabled=!!value;if(!enabled)cancel();},
    isEnabled:function(){return enabled;},
    /* 调试/测试用：本轮指定的那道题，以及那一次是否已经发生 */
    target:function(){return targetQi;},
    fired:function(){return fired;}
  };
})(window);

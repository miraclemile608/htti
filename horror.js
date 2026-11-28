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
  var targetQi=-1,fired=false,targetActive=false,advance;
  var layer,context,sound,onTargetChange;
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
  function cancel(){
    var wasPlaying=hideTimer!=null;
    var next=advance;
    advance=null;
    targetActive=false;
    clearTimers();
    stopLayer();
    if(wasPlaying&&root.HTTIAudio)root.HTTIAudio.cancelEffects();
    if(next)next();
  }

  function reset(savedTarget,savedFired){
    advance=null;
    cancel();
    lastQuestion=-10;lastAt=-Infinity;lastKind='';count=0;
    targetQi=Number.isInteger(savedTarget)&&savedTarget>=FIRST_TARGET&&savedTarget<(ctx().total||32)?savedTarget:-1;
    fired=targetQi>=0&&savedFired===true;
  }

  function leave(){clearTimeout(ambientTimer);ambientTimer=null;}
  function afterTarget(fn){
    if(targetActive)advance=fn;
    else fn();
  }

  function present(kind,still,isTarget){
    layer.className='scare-layer active '+(still?'still ':'')+kind;
    if(isTarget){
      fired=true;
      if(onTargetChange)onTargetChange();
    }
    var duration=still?(kind==='face'?1500:kind==='blackout'?1700:1900):
      (kind==='face'?650:kind==='blackout'?950:1600);
    hideTimer=setTimeout(cancel,duration);
    if(sound)sound(kind);
  }

  function show(kind,isTarget){
    targetActive=!!isTarget;
    if(reduced()){
      layer.className='scare-layer active cue';
      cueTimer=setTimeout(function(){
        cueTimer=null;
        if(!enabled||document.hidden){cancel();return;}
        present(kind,true,isTarget);
      },1600);
      return;
    }
    present(kind,false,isTarget);
  }

  function pickTarget(qi){
    var total=ctx().total||32,from=Math.max(FIRST_TARGET,qi),last=total-1;
    if(last<from)return -1;
    return from+Math.floor(Math.random()*(last-from+1));
  }

  /* 「那一次」：进入指定题就立刻触发，不再等 500–700ms */
  function scheduleTarget(qi){
    if(fired)return false;
    if(targetQi<0){
      targetQi=pickTarget(qi);
      if(targetQi>=0&&onTargetChange)onTargetChange();
    }
    if(targetQi<0||targetQi>qi)return false;
    show(ctx().blackout?'blackout':'face',true);
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
      if(!allowed(qi))return;
      var pool=AMBIENT.filter(function(k){return k!==lastKind;});
      var kind=pool[Math.floor(Math.random()*pool.length)];
      lastQuestion=qi;lastAt=performance.now();lastKind=kind;count++;
      show(kind);
    },1800+Math.random()*5200);
  }

  function allowed(qi){
    var s=ctx();
    return enabled&&!document.hidden&&s.quiz&&s.qi===qi&&!s.locked;
  }

  function schedule(qi){
    cancel();
    if(!allowed(qi))return;
    if(qi>=FIRST_TARGET&&scheduleTarget(qi))return;
    scheduleAmbient(qi);
  }

  root.HTTIHaunt={
    init:function(el,getContext,play,onChange){layer=el;context=getContext;sound=play;onTargetChange=onChange;stopLayer();},
    schedule:schedule,leave:leave,afterTarget:afterTarget,cancel:cancel,reset:reset,
    setEnabled:function(value){enabled=!!value;if(!enabled)cancel();},
    isEnabled:function(){return enabled;},
    /* 调试/测试用：本轮指定的那道题，以及那一次是否已经发生 */
    target:function(){return targetQi;},
    fired:function(){return fired;}
  };
})(window);

(function(root){
  'use strict';
  // 本地 CC0 采样 + 程序化低频；来源及处理记录见 assets/audio/README.md。
  var ctx, master, bed, drone, air, pad, noise, heartbeat, ambience, ambienceGain, ambienceFilter, voices=new Set();
  var samples={},loading={},sampleState='idle';
  var sampleURLs={ambience:'assets/audio/dread-loop.mp3',scare:'assets/audio/jumpscare.mp3'};
  var enabled=true, failed=false, dread=0, ending=false, onChange=function(){};
  function state(){return {enabled:enabled,failed:failed,running:!!ctx&&ctx.state==='running',samples:sampleState};}
  function notify(){onChange(state());}
  function running(){return enabled&&ctx&&ctx.state==='running'&&!document.hidden;}
  function track(node){return node;}
  function loadSamples(current){
    if(!root.fetch||(root.location&&root.location.protocol==='file:')){sampleState='fallback';return;}
    Object.keys(sampleURLs).forEach(function(key){
      if(samples[key])return;
      if(!loading[key]){
        var timer,controller=root.AbortController?new root.AbortController():null;
        loading[key]=new Promise(function(resolve,reject){
          timer=setTimeout(function(){reject(new Error('Audio timeout'));if(controller)controller.abort();},12000);
          Promise.resolve(root.fetch(sampleURLs[key],controller?{signal:controller.signal}:undefined)).then(function(response){
            if(!response.ok)throw new Error('Audio unavailable');
            return response.arrayBuffer();
          }).then(function(data){return current.decodeAudioData(data);}).then(resolve,reject);
        }).then(function(buffer){samples[key]=buffer;}).catch(function(){
          // 资源缺失或浏览器不支持解码时保留合成音，问卷无需等待。
        }).finally(function(){
          clearTimeout(timer);delete loading[key];
          sampleState=Object.keys(loading).length?'loading':samples.ambience&&samples.scare?'ready':'fallback';
        });
      }
      // 两份素材独立就绪；旧 context 的迟到回调不能创建新的播放源。
      loading[key].then(function(){if(ctx===current){ensureAmbience();update(dread,ending);notify();}});
    });
    sampleState=Object.keys(loading).length?'loading':samples.ambience&&samples.scare?'ready':'fallback';
  }
  function hold(param,t){
    if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(t);
    else{var value=param.value;param.cancelScheduledValues(t);param.setValueAtTime(value,t);}
  }
  function ensureAmbience(){
    if(!running()||!samples.ambience||ambience)return;
    ambience=ctx.createBufferSource();ambience.buffer=samples.ambience;ambience.loop=true;
    ambienceFilter=ctx.createBiquadFilter();ambienceFilter.type='lowpass';ambienceFilter.Q.value=.6;
    ambienceGain=ctx.createGain();ambienceGain.gain.value=0;
    ambience.connect(ambienceFilter);ambienceFilter.connect(ambienceGain);ambienceGain.connect(bed);ambience.start();
    update(dread,ending);
  }
  function duckBed(){
    var t=ctx.currentTime;
    hold(bed.gain,t);
    bed.gain.linearRampToValueAtTime(.12,t+.012);
    bed.gain.setValueAtTime(.12,t+.32);bed.gain.linearRampToValueAtTime(1,t+.95);
  }
  function connectVoice(source,filter,gain,pan,duration){
    var p=ctx.createStereoPanner();p.pan.value=pan;
    source.connect(filter);filter.connect(gain);gain.connect(p);p.connect(master);
    voices.add(source);
    source.onended=function(){voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();p.disconnect();};
    source.start();source.stop(ctx.currentTime+duration);
  }
  function hit(volume){
    if(!running())return;
    var t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();
    o.frequency.setValueAtTime(82,t);o.frequency.exponentialRampToValueAtTime(31,t+.32);
    f.type='lowpass';f.frequency.value=180;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+.4);
    connectVoice(o,f,g,0,.45);
  }
  function whisper(){
    if(!running())return;
    var t=ctx.currentTime,s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
    s.buffer=noise;s.playbackRate.value=.7+Math.random()*.3;
    f.type='bandpass';f.Q.value=5;f.frequency.setValueAtTime(550,t);f.frequency.exponentialRampToValueAtTime(2300,t+1.3);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.13,t+.35);g.gain.linearRampToValueAtTime(0,t+1.6);
    connectVoice(s,f,g,Math.random()<.5?-.85:.85,1.7);
  }
  function scare(kind){
    if(!running())return;
    if(kind==='whisper'||kind==='shadow'){whisper();return;}
    var t=ctx.currentTime;
    if(kind==='knock'){
      var s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
      s.buffer=noise;f.type='bandpass';f.frequency.value=310;f.Q.value=3;
      g.gain.setValueAtTime(0,t);
      [0,.27,.7].forEach(function(d){g.gain.linearRampToValueAtTime(0,t+d);g.gain.linearRampToValueAtTime(.23,t+d+.008);g.gain.exponentialRampToValueAtTime(.001,t+d+.15);});
      connectVoice(s,f,g,-.8,1);return;
    }
    if(kind==='face'||kind==='blackout'){
      duckBed();hit(.40);
      if(samples.scare){
        var sample=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
        sample.buffer=samples.scare;filter.type='lowpass';filter.frequency.value=6800;filter.Q.value=.7;
        gain.gain.setValueAtTime(.94,t);gain.gain.setValueAtTime(.94,t+.48);gain.gain.linearRampToValueAtTime(0,t+.62);
        connectVoice(sample,filter,gain,0,.64);return;
      }
      // 离线 / file:// 回退仍有宽频瞬态，避免只剩很轻的低音。
      var burst=ctx.createBufferSource(),bf=ctx.createBiquadFilter(),bg=ctx.createGain();
      burst.buffer=noise;bf.type='highpass';bf.frequency.value=700;
      bg.gain.setValueAtTime(0,t);bg.gain.linearRampToValueAtTime(.8,t+.004);bg.gain.exponentialRampToValueAtTime(.001,t+.5);
      connectVoice(burst,bf,bg,0,.62);
    }else hit(.26);
    var o=ctx.createOscillator(),b=ctx.createBiquadFilter(),v=ctx.createGain();
    o.type='sawtooth';o.frequency.setValueAtTime(176,t);o.frequency.exponentialRampToValueAtTime(49,t+.8);
    b.type='lowpass';b.frequency.value=1800;
    v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(.13,t+.006);v.gain.exponentialRampToValueAtTime(.001,t+.58);
    connectVoice(o,b,v,.25,.62);
  }
  function pulse(){
    clearTimeout(heartbeat);
    if(!running())return;
    if(dread>.6&&!ending)hit(.055+dread*.06);
    heartbeat=setTimeout(pulse,850+Math.random()*1800-dread*300);
  }
  function update(value,isEnding){
    dread=Math.max(0,Math.min(1,Number(value)||0));ending=isEnding;
    if(!ctx||!master)return;
    var t=ctx.currentTime,scale=ending?.35:1,synthetic=ambience?.35:1;
    drone.gain.setTargetAtTime((.018+Math.pow(dread,1.5)*.09)*scale,t,1.1);
    air.gain.setTargetAtTime((.018+dread*.055)*scale*synthetic,t,1.1);
    pad.gain.setTargetAtTime((.025+dread*.035)*scale*synthetic,t,1.1);
    if(ambienceGain){
      ambienceGain.gain.setTargetAtTime((.30+dread*.42)*scale,t,1.1);
      ambienceFilter.frequency.setTargetAtTime(950+dread*4200,t,1.6);
    }
  }
  function fail(){failed=true;enabled=false;dispose();notify();}
  function start(){
    if(!enabled||failed||document.hidden)return;
    if(ctx&&ctx.state==='running')return;
    try{
      if(!ctx){
        var AC=root.AudioContext||root.webkitAudioContext;if(!AC){fail();return;}
        ctx=new AC();
        var compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-10;compressor.knee.value=6;compressor.ratio.value=12;
        compressor.attack.value=.003;compressor.release.value=.18;
        master=ctx.createGain();master.gain.value=.78;master.connect(compressor);compressor.connect(ctx.destination);
        bed=ctx.createGain();bed.gain.value=1;bed.connect(master);
        drone=ctx.createGain();air=ctx.createGain();pad=ctx.createGain();
        drone.gain.value=air.gain.value=pad.gain.value=0;
        [drone,air,pad].forEach(function(g){g.connect(bed);});
        [38,40.3,56.8].forEach(function(hz){var o=track(ctx.createOscillator());o.type='triangle';o.frequency.value=hz;o.connect(drone);o.start();});
        // 缓慢失谐的高层泛音，不再使用明亮的大三和弦。
        [146.8,155.6].forEach(function(hz,i){
          var o=track(ctx.createOscillator()),lfo=track(ctx.createOscillator()),lg=ctx.createGain();
          o.type='sine';o.frequency.value=hz;lfo.frequency.value=.09+i*.04;lg.gain.value=3;
          lfo.connect(lg);lg.connect(o.frequency);o.connect(pad);o.start();lfo.start();
        });
        noise=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);
        var data=noise.getChannelData(0),last=0;
        for(var i=0;i<data.length;i++){last=(last+.035*(Math.random()*2-1))/1.035;data[i]=last*5;}
        var s=track(ctx.createBufferSource()),f=ctx.createBiquadFilter();s.buffer=noise;s.loop=true;f.type='bandpass';f.frequency.value=830;f.Q.value=.7;
        s.connect(f);f.connect(air);s.start();
        ctx.onstatechange=notify;
      }
      var current=ctx;
      loadSamples(current);update(dread,ending);
      Promise.resolve(ctx.resume()).then(function(){if(ctx===current){ensureAmbience();notify();pulse();}}).catch(function(){if(ctx===current)notify();});
    }catch(e){fail();}
  }
  function dispose(){
    clearTimeout(heartbeat);heartbeat=null;
    cancelEffects();
    if(ambience){try{ambience.stop();}catch(e){}ambience.disconnect();ambienceFilter.disconnect();ambienceGain.disconnect();}
    ambience=ambienceFilter=ambienceGain=null;
    if(ctx){ctx.onstatechange=null;var closing=ctx;ctx=null;Promise.resolve(closing.close()).catch(function(){});}
    master=bed=drone=air=pad=noise=null;
  }
  function cancelEffects(){
    voices.forEach(function(source){try{source.stop();}catch(e){}});voices.clear();
    if(bed&&ctx){hold(bed.gain,ctx.currentTime);bed.gain.setTargetAtTime(1,ctx.currentTime,.12);}
  }
  function setEnabled(value){enabled=!!value&&!failed;if(enabled)start();else dispose();notify();}
  function visibility(){
    clearTimeout(heartbeat);
    cancelEffects();
    if(document.hidden&&ctx)Promise.resolve(ctx.suspend()).catch(function(){});
    else if(enabled&&ctx)start();
  }
  root.HTTIAudio={start:start,stop:dispose,cancelEffects:cancelEffects,setEnabled:setEnabled,state:state,update:update,hit:hit,whisper:whisper,scare:scare,visibility:visibility,
    onChange:function(fn){onChange=fn;notify();}};
})(window);

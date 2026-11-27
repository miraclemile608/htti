(function(root){
  'use strict';
  // 全部声音由 Web Audio 本地合成，不加载第三方音轨。
  var ctx, master, drone, air, pad, noise, heartbeat, voices=new Set();
  var enabled=true, failed=false, dread=0, ending=false, onChange=function(){};
  function state(){return {enabled:enabled,failed:failed,running:!!ctx&&ctx.state==='running'};}
  function notify(){onChange(state());}
  function running(){return enabled&&ctx&&ctx.state==='running'&&!document.hidden;}
  function track(node){return node;}
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
    hit(.26);
    var o=ctx.createOscillator(),b=ctx.createBiquadFilter(),v=ctx.createGain();
    o.type='sawtooth';o.frequency.setValueAtTime(176,t);o.frequency.exponentialRampToValueAtTime(49,t+.8);
    b.type='lowpass';b.frequency.value=900;
    v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(.075,t+.04);v.gain.exponentialRampToValueAtTime(.001,t+.85);
    connectVoice(o,b,v,.45,.9);
  }
  function pulse(){
    clearTimeout(heartbeat);
    if(!running())return;
    if(dread>.6&&!ending)hit(.055+dread*.06);
    heartbeat=setTimeout(pulse,850+Math.random()*1800-dread*300);
  }
  function update(value,isEnding){
    dread=value;ending=isEnding;
    if(!ctx||!master)return;
    var t=ctx.currentTime,scale=ending?.3:1;
    drone.gain.setTargetAtTime(Math.pow(dread,1.5)*.055*scale,t,.8);
    air.gain.setTargetAtTime((.004+dread*.026)*scale,t,.8);
    pad.gain.setTargetAtTime((.012+dread*.006)*scale,t,.8);
  }
  function fail(){failed=true;enabled=false;dispose();notify();}
  function start(){
    if(!enabled||failed||document.hidden)return;
    if(ctx&&ctx.state==='running')return;
    try{
      if(!ctx){
        var AC=root.AudioContext||root.webkitAudioContext;if(!AC){fail();return;}
        ctx=new AC();
        var compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=16;compressor.ratio.value=8;
        master=ctx.createGain();master.gain.value=.36;master.connect(compressor);compressor.connect(ctx.destination);
        drone=ctx.createGain();air=ctx.createGain();pad=ctx.createGain();
        drone.gain.value=air.gain.value=pad.gain.value=0;
        [drone,air,pad].forEach(function(g){g.connect(master);});
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
      update(dread,ending);
      var current=ctx;
      Promise.resolve(ctx.resume()).then(function(){if(ctx===current){notify();pulse();}}).catch(function(){if(ctx===current)notify();});
    }catch(e){fail();}
  }
  function dispose(){
    clearTimeout(heartbeat);heartbeat=null;
    cancelEffects();
    if(ctx){ctx.onstatechange=null;var closing=ctx;ctx=null;Promise.resolve(closing.close()).catch(function(){});}
    master=drone=air=pad=noise=null;
  }
  function cancelEffects(){voices.forEach(function(source){try{source.stop();}catch(e){}});voices.clear();}
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

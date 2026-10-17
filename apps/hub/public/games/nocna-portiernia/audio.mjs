// Small procedural sound bank: no downloads, voice synthesis or runtime services.
export function createAudio(){
  let context=null,master=null,humGain=null,noiseBuffer=null,enabled=true;
  const active=new Set();
  function init(){
    if(context)return;
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    context=new Audio();master=context.createGain();master.gain.value=enabled?.3:0;master.connect(context.destination);
    const hum=context.createOscillator();humGain=context.createGain();hum.type='sine';hum.frequency.value=50;humGain.gain.value=.025;hum.connect(humGain).connect(master);hum.start();
    noiseBuffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate);
    const samples=noiseBuffer.getChannelData(0);let seed=9137;
    for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=(seed/2147483648-1);}
  }
  function connect(source,duration,volume,delay=0,filter=null){
    const t=context.currentTime+delay,g=context.createGain();
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    if(filter){source.connect(filter);filter.connect(g);}else source.connect(g);
    g.connect(master);active.add(source);source.start(t);source.stop(t+duration+.02);
    source.onended=()=>{active.delete(source);source.disconnect();filter?.disconnect();g.disconnect();};
  }
  function tone(frequency,end,duration,volume=.1,delay=0,type='sine'){
    const source=context.createOscillator(),t=context.currentTime+delay;source.type=type;
    source.frequency.setValueAtTime(frequency,t);source.frequency.exponentialRampToValueAtTime(Math.max(1,end),t+duration);connect(source,duration,volume,delay);
  }
  function noise(duration,frequency,volume=.1,delay=0,type='bandpass'){
    const source=context.createBufferSource(),filter=context.createBiquadFilter();source.buffer=noiseBuffer;filter.type=type;filter.frequency.value=frequency;filter.Q.value=2;connect(source,duration,volume,delay,filter);
  }
  function stopEffects(){for(const source of active){try{source.stop();}catch{}}active.clear();}
  return {
    async resume(){try{init();if(context){if(enabled)await context.resume();else await context.suspend();}}catch{}},
    pause(){context?.suspend().catch(()=>{});},stopEffects,
    ambience(value){if(humGain)humGain.gain.setTargetAtTime(.025*value,context.currentTime,.15);},
    enabled(value){enabled=value;if(master)master.gain.value=value?.3:0;if(!value)context?.suspend().catch(()=>{});},
    cue(kind){
      if(!context||!enabled||context.state!=='running')return;
      switch(kind){
        case 'error':tone(180,65,.45,.16,0,'triangle');break;
        case 'step':noise(.18,150,.14,0,'lowpass');tone(88,42,.16,.08);break;
        case 'run':for(let i=0;i<7;i++){noise(.13,220,.13-i*.012,i*.19,'lowpass');tone(95,45,.13,.08,i*.19);}break;
        case 'door':tone(92,35,.4,.15);noise(.25,500,.08);break;
        case 'paper':noise(.3,1700,.07);break;
        case 'tap':tone(1400,410,.09,.09,0,'triangle');break;
        case 'pipe':tone(420,385,.7,.11,0,'triangle');tone(830,790,.5,.035);break;
        case 'handle':tone(380,150,.2,.07,0,'triangle');noise(.24,1100,.07);break;
        case 'crack':noise(.12,3400,.14);tone(900,90,.11,.05);break;
        case 'breath':noise(1.7,650,.08);noise(.8,1100,.05,.9);break;
        case 'intercom':noise(2.5,950,.09);tone(130,65,1.6,.04,0,'triangle');break;
        case 'laugh':for(let i=0;i<3;i++){tone(360-i*35,210-i*25,.22,.055,i*.25,'triangle');noise(.16,700,.035,i*.25);}break;
        case 'key':tone(2200,1300,.14,.055,0,'triangle');tone(2800,1900,.12,.04,.13,'triangle');noise(.25,1800,.05,.3);break;
        case 'creak':tone(155,330,1.5,.065,0,'sawtooth');noise(1.4,500,.035);break;
      }
    },
  };
}

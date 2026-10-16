export function createAudio(){
  let context=null,master=null,enabled=true;
  function init(){
    if(context)return;
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    context=new Audio();master=context.createGain();master.gain.value=enabled?.3:0;master.connect(context.destination);
    const hum=context.createOscillator(),gain=context.createGain();hum.type='sine';hum.frequency.value=50;gain.gain.value=.035;hum.connect(gain).connect(master);hum.start();
  }
  return {
    async resume(){try{init();if(context){if(enabled)await context.resume();else await context.suspend();}}catch{}},
    pause(){context?.suspend().catch(()=>{});},
    enabled(value){enabled=value;if(master)master.gain.value=value?.3:0;if(!value)context?.suspend().catch(()=>{});},
    cue(kind){
      if(!context||!enabled||context.state!=='running')return;
      const t=context.currentTime,osc=context.createOscillator(),g=context.createGain();
      osc.type=kind==='error'?'triangle':'sine';osc.frequency.setValueAtTime(kind==='error'?160:kind==='door'?72:kind==='paper'?800:95,t);
      osc.frequency.exponentialRampToValueAtTime(kind==='paper'?140:40,t+.25);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(kind==='error'?.25:.12,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.32);
      osc.connect(g).connect(master);osc.start(t);osc.stop(t+.35);osc.onended=()=>{osc.disconnect();g.disconnect();};
    },
  };
}

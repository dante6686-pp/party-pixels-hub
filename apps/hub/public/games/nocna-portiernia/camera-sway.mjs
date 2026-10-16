const RAD=Math.PI/180;
// Deterministic additive angles, not an accumulated camera transform. Time freezes in pause.
export function createCameraSway({enabled=true}={}){
  let time=0,weight=0,reading=false,last={yaw:0,pitch:0,roll:0};
  return {
    setEnabled(value){enabled=Boolean(value);},
    setReading(value){reading=value;},
    update(dt,paused=false){
      if(paused)return {...last};
      dt=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,.05));time+=dt;
      const target=!enabled||reading==='modal'?0:reading==='documents'?.15:1;
      weight+=(target-weight)*(1-Math.exp(-dt*4));if(Math.abs(target-weight)<.00001)weight=target;
      if(weight===0){last={yaw:0,pitch:0,roll:0};return {...last};}
      last={yaw:Math.sin(time*Math.PI*2/7.7)*.25*RAD*weight,pitch:Math.sin(time*Math.PI*2/6.3)*.20*RAD*weight,roll:Math.sin(time*Math.PI*2/8.9)*.06*RAD*weight};
      return {...last};
    },
  };
}

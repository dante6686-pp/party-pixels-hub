// The sandbox has no cookies/localStorage access. The parent owns identity and persistence.
export function connectPlatform(callbacks) {
  let port=null,request=0;
  const pending=new Set();
  const send=data=>port?.postMessage(data);
  const parentOrigin=(()=>{try{return new URL(document.referrer).origin;}catch{return null;}})();
  const init=event=>{
    if(port||event.source!==parent||event.origin!==parentOrigin||event.data?.type!=='pp:init'||event.data.protocol!==1||event.data.build!=='magazyn-auto-pp-1'||event.ports.length!==1)return;
    port=event.ports[0];window.removeEventListener('message',init);
    port.onmessage=event=>{
      const data=event.data;if(!data||typeof data!=='object')return;
      if(data.type==='pause')callbacks.pause();
      if(data.type==='resume')callbacks.resume();
      if(data.type==='start'&&typeof data.continued==='boolean')callbacks.start(data.continued);
      if(data.type==='input'&&(data.mode==='touch'||data.mode==='keyboard'))callbacks.input(data.mode);
      if(data.type==='saved'&&pending.delete(data.requestId))callbacks.saved(data.ok===true);
    };
    port.start();callbacks.init(event.data);callbacks.input(event.data.mode==='touch'?'touch':'keyboard');
  };
  window.addEventListener('message',init);
  let lastDetected='';
  function detected(mode){if(mode!==lastDetected){lastDetected=mode;send({type:'input-detected',mode});}}
  window.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')detected('touch');else if(event.pointerType==='mouse')detected('keyboard');});
  window.addEventListener('keydown',event=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))detected('keyboard');});
  return {
    ready(){if(parentOrigin&&parent!==window)parent.postMessage({type:'pp:ready',protocol:1,build:'magazyn-auto-pp-1'},parentOrigin);},
    state(state){send({type:'state',state});},
    error(){send({type:'error'});},
    save(checkpoint){
      if(!port||pending.size>=10){callbacks.saved(false);return;}
      const requestId=++request;pending.add(requestId);send({type:'save',checkpoint,requestId});
      setTimeout(()=>{if(pending.delete(requestId))callbacks.saved(false);},4000);
    },
  };
}

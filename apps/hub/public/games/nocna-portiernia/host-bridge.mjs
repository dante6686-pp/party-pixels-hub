// Opaque iframe: only guest checkpoint data crosses this capability port.
export const NIGHT_BUILD='night-demo-d7d8-v1';
export function connectNightHost(win=window){
 if(win.parent===win)return Promise.resolve(null);
 return new Promise((resolve,reject)=>{
  let done=false,timer,timeout;
  const stop=()=>{done=true;clearInterval(timer);clearTimeout(timeout);win.removeEventListener('message',receive);};
  const receive=e=>{if(done||e.source!==win.parent||e.data?.type!=='PP_NIGHT_INIT'||e.data?.build!==NIGHT_BUILD||e.ports?.length!==1)return;const port=e.ports[0];stop();resolve({port,checkpoint:e.data.checkpoint??null});};
  win.addEventListener('message',receive);
  const ready=()=>win.parent.postMessage({type:'PP_NIGHT_READY',build:NIGHT_BUILD},'*');
  timer=setInterval(ready,300);timeout=setTimeout(()=>{stop();reject(Error('HOST_UNAVAILABLE'));},12000);ready();
 });
}

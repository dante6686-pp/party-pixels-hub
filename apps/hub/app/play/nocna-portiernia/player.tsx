'use client';
import {useEffect,useRef,useState} from 'react';
import {useViewer} from '../../use-viewer';
import {usePresence} from '../../player-extras';
import {recordPlayed} from '../../../lib/library';
import {validCheckpoint} from '../../../public/games/nocna-portiernia/logic.mjs';
const BUILD='night-demo-d7d8-v1',KEY='pp:night-demo:guest:v1';
export default function NightPlayer(){
 const frame=useRef<HTMLIFrameElement>(null),shell=useRef<HTMLDivElement>(null),port=useRef<MessagePort|null>(null),identity=useRef<string|undefined>(undefined);
 const viewer=useViewer();identity.current=viewer.owner;
 const [started,setStarted]=useState(false),[notice,setNotice]=useState('');
 usePresence(viewer.owner,started?'nocna-portiernia':undefined);
 useEffect(()=>{
  const receive=(e:MessageEvent)=>{
   if(e.source!==frame.current?.contentWindow||e.origin!=='null'||e.data?.type!=='PP_NIGHT_READY'||e.data?.build!==BUILD||port.current)return;
   let checkpoint=null;try{const raw=localStorage.getItem(KEY);if(raw){const candidate=JSON.parse(raw);if(validCheckpoint(candidate,2))checkpoint=candidate;}}catch{setNotice('Zapis lokalny jest niedostępny. Możesz grać bez zapisu.');}
   const channel=new MessageChannel();port.current=channel.port1;
   channel.port1.onmessage=event=>{
    const message=event.data;
    if(message?.type==='STARTED'){setStarted(true);const owner=identity.current;if(owner)void recordPlayed(owner,'nocna-portiernia').catch(()=>{});}
    else if(message?.type==='CHECKPOINT'){
     if(!validCheckpoint(message.checkpoint,2)){channel.port1.postMessage({type:'SAVE_RESULT',id:message.id,ok:false});return;}
     try{localStorage.setItem(KEY,JSON.stringify(message.checkpoint));channel.port1.postMessage({type:'SAVE_RESULT',id:message.id,ok:true});}catch{channel.port1.postMessage({type:'SAVE_RESULT',id:message.id,ok:false});}
    }
   };
   channel.port1.start();frame.current?.contentWindow?.postMessage({type:'PP_NIGHT_INIT',build:BUILD,checkpoint},'*',[channel.port2]);
  };
  window.addEventListener('message',receive);return()=>{window.removeEventListener('message',receive);port.current?.close();port.current=null;};
 },[]);
 async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await shell.current?.requestFullscreen?.();}catch{setNotice('Pełny ekran systemowy jest niedostępny. Gra nadal zajmuje całe okno.');}}
 return <div className="night-shell" ref={shell}><div className="night-toolbar"><a href="/#games">← Hub</a><strong>Nocna portiernia <small>DEMO · 2 WIZYTY</small></strong><button onClick={()=>void fullscreen()} aria-label="Przełącz pełny ekran">⛶</button></div><iframe ref={frame} src="/games/nocna-portiernia/index.html" title="Nocna portiernia — demo" sandbox="allow-scripts" allow="fullscreen" allowFullScreen/>{notice&&<div className="night-notice" role="status">{notice}<button aria-label="Zamknij komunikat" onClick={()=>setNotice('')}>×</button></div>}</div>;
}

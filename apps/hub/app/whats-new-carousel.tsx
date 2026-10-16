'use client';

import Link from 'next/link';
import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {updates,updateDate} from '../lib/updates';

const latest=updates.slice(0,4);
export default function WhatsNewCarousel(){
 const track=useRef<HTMLDivElement>(null);
 const drag=useRef<{id:number;x:number;scroll:number}|null>(null);
 const [edges,setEdges]=useState({start:true,end:false});
 useEffect(()=>{
  const el=track.current;if(!el)return;
  const sync=()=>{const start=el.scrollLeft<=2,end=el.scrollLeft+el.clientWidth>=el.scrollWidth-2;setEdges(old=>old.start===start&&old.end===end?old:{start,end});};
  sync();el.addEventListener('scroll',sync,{passive:true});
  const resize=new ResizeObserver(sync);resize.observe(el);
  return()=>{el.removeEventListener('scroll',sync);resize.disconnect();};
 },[]);
 function move(direction:number){const el=track.current;if(!el)return;el.scrollBy({left:direction*(el.firstElementChild?.getBoundingClientRect().width??el.clientWidth)+direction*14,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 function startDrag(event:PointerEvent<HTMLDivElement>){
  if(event.pointerType!=='mouse'||event.button!==0)return;
  drag.current={id:event.pointerId,x:event.clientX,scroll:event.currentTarget.scrollLeft};
  event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.dataset.dragging='true';
 }
 function stopDrag(event:PointerEvent<HTMLDivElement>){
  drag.current=null;delete event.currentTarget.dataset.dragging;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 }
 return <section className="whats-new" aria-labelledby="whats-new-heading" aria-roledescription="karuzela">
  <div className="news-heading"><div><p className="eyebrow">PARTY PIXELS SIĘ ROZWIJA</p><h2 id="whats-new-heading">Co nowego?</h2></div><Link href="/whats-new">Wszystkie nowości <span aria-hidden="true">↗</span></Link></div>
  <div className="news-track" ref={track} id="latest-updates" tabIndex={0} role="region" aria-label="Cztery najnowsze aktualizacje. Przesuwaj lub użyj strzałek." onPointerDown={startDrag} onPointerMove={event=>{const current=drag.current;if(current&&event.pointerId===current.id)event.currentTarget.scrollLeft=current.scroll-(event.clientX-current.x);}} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={event=>{drag.current=null;delete event.currentTarget.dataset.dragging;}} onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(event.key==='ArrowRight'?1:-1);}}}>
   {latest.map((entry,index)=><article className="news-card" key={entry.id} aria-label={`${index+1} z ${latest.length}: ${entry.title}`}><div className="news-meta"><span>{entry.category}</span><time dateTime={entry.date}>{updateDate(entry.date)}</time></div><span className="news-number" aria-hidden="true">0{index+1} / 04</span><h3>{entry.title}</h3><p>{entry.description}</p></article>)}
  </div>
  <div className="news-bottom"><span>Najnowsze → wcześniejsze</span><div className="news-controls"><button aria-label="Nowsze aktualizacje" aria-controls="latest-updates" disabled={edges.start} onClick={()=>move(-1)}>←</button><button aria-label="Starsze aktualizacje" aria-controls="latest-updates" disabled={edges.end} onClick={()=>move(1)}>→</button></div></div>
 </section>;
}

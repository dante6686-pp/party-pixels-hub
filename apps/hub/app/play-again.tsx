'use client';
import {useEffect,useState} from 'react';
import {getClient} from '../lib/client';
import {games} from '../lib/catalog';
export default function PlayAgain({owner,active}:{owner:string;active:boolean}){
 const [last,setLast]=useState<typeof games[number]|null>(null);
 useEffect(()=>{
  if(!active)return;
  let alive=true,revision=0;
  const refresh=async()=>{
   const client=getClient();if(!client)return;const current=++revision;
   try{
    const {data,error}=await client.rpc('pp_library',{p_owner:owner,p_action:'get'}).abortSignal(AbortSignal.timeout(10000));
    if(!alive||current!==revision)return;
    if(error)throw error;
    const entries=(data?.games??[]) as {game_id:string;last_played_at:string|null}[];
    const latest=entries.filter(e=>e.last_played_at&&Number.isFinite(Date.parse(e.last_played_at))&&games.some(g=>g.id===e.game_id)).sort((a,b)=>Date.parse(b.last_played_at!)-Date.parse(a.last_played_at!))[0];
    setLast(games.find(g=>g.id===latest?.game_id)??null);
   }catch{if(alive&&current===revision)setLast(null);}
  };
  void refresh();window.addEventListener('focus',refresh);window.addEventListener('party-pixels:library',refresh);
  return()=>{alive=false;revision++;window.removeEventListener('focus',refresh);window.removeEventListener('party-pixels:library',refresh);};
 },[owner,active]);
 if(!last)return null;
 return <a className="play-again" href={'/play/'+last.id}><img src={last.logo} alt="" width={44} height={44}/><span><small>OSTATNIO GRANE</small><strong>{last.title}</strong></span><b>Zagraj ponownie →</b></a>;
}

'use client';
import {useEffect,useState} from 'react';
import {getClient} from '../lib/client';
export function useCatalogRatings(){
 const [ratings,setRatings]=useState<Record<string,{average:number;votes:number}>|null>(null);
 useEffect(()=>{
  let alive=true,revision=0;const client=getClient();if(!client)return;
  const load=async()=>{const version=++revision;const {data,error}=await client.rpc('pp_game_feedback').abortSignal(AbortSignal.timeout(12000));if(alive&&version===revision&&!error)setRatings(Object.fromEntries((data as {game_id:string;average:number;votes:number}[]).map(r=>[r.game_id,r])));};
  void load();const focus=()=>{if(!document.hidden)void load();};window.addEventListener('focus',focus);
  return()=>{alive=false;window.removeEventListener('focus',focus);};
 },[]);
 return ratings;
}

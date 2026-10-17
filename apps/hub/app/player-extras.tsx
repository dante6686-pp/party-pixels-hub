'use client';
import {useEffect,useState} from 'react';
import {getClient} from '../lib/client';
import {platformApi} from '../lib/platform';
export const badgeNames:Record<string,{title:string;description:string;symbol:string}>={
 'first-profile':{title:'Hej, to ja!',description:'Utworzono profil gracza.',symbol:'☺'},
 'first-round':{title:'Pierwszy krok',description:'Zapisano wynik pierwszej rundy.',symbol:'▶'},
 'perfect-five':{title:'Idealna piątka',description:'Serwer potwierdził 5/5 w Szybkiej piątce.',symbol:'★'},
 'first-friend':{title:'Gramy razem',description:'Przyjęto pierwszą znajomość.',symbol:'♧'},
 'first-comment':{title:'Mam coś do powiedzenia',description:'Opublikowano pierwszy komentarz.',symbol:'✎'},
};
export function PlayerBadges({player}:{player:string}){
 const [rows,setRows]=useState<{badge:string;earned_at:string}[]|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let alive=true;const client=getClient();if(client)void client.rpc('pp_badges',{p_player:player}).abortSignal(AbortSignal.timeout(12000)).then(({data,error})=>{if(alive){setError(!!error);if(!error)setRows(data);}});return()=>{alive=false;};},[player]);
 return <section className="player-badges" aria-label="Odznaki gracza"><h2>Odznaki</h2>{error?<p>Nie udało się wczytać odznak.</p>:rows===null?<p>Wczytuję odznaki…</p>:rows.length?<ul>{rows.map(b=>{const meta=badgeNames[b.badge];return meta?<li key={b.badge}><span aria-hidden="true">{meta.symbol}</span><div><strong>{meta.title}</strong><small>{meta.description}</small></div></li>:null;})}</ul>:<p>Brak publicznych odznak.</p>}</section>;
}
export function usePresence(owner?:string,game?:string){
 useEffect(()=>{if(!owner)return;let pending=false;
  const tick=()=>{if(document.hidden||!document.hasFocus()||pending)return;pending=true;void platformApi(owner,'pp_settings',{p_action:'heartbeat',p_game:game??null}).catch(()=>{}).finally(()=>{pending=false;});};
  tick();const timer=setInterval(tick,30000);window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);
  return()=>{clearInterval(timer);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick);};
 },[owner,game]);
}
export function useFriendsPresence(owner:string,active:boolean){
 const [rows,setRows]=useState<Record<string,string|null>>({}),[available,setAvailable]=useState(false);
 useEffect(()=>{if(!active)return;let alive=true,version=0;
  const load=async()=>{if(document.hidden)return;const current=++version;try{const data=await platformApi(owner,'pp_settings',{p_action:'friends'});if(alive&&current===version){setRows(Object.fromEntries(data.map((p:{player_id:string;game:string|null})=>[p.player_id,p.game])));setAvailable(true);}}catch{if(alive)setAvailable(false);}};
  void load();const timer=setInterval(load,30000);window.addEventListener('focus',load);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',load);};
 },[owner,active]);return {rows,available};
}

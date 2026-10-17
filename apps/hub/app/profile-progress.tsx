'use client';
import {useEffect,useState} from 'react';
import {getClient} from '../lib/client';
import {badgeArt,type ProgressProfile} from '../lib/progression';
export default function ProfileProgress({player}:{player:string}){
 const [data,setData]=useState<ProgressProfile|null>(null);
 useEffect(()=>{let alive=true;const refresh=async()=>{const c=getClient();if(!c)return;try{const {data,error}=await c.rpc('pp_progress_public',{p_player:player}).abortSignal(AbortSignal.timeout(10000));if(alive&&!error)setData(data);}catch{}};void refresh();window.addEventListener('focus',refresh);window.addEventListener('party-pixels:progress',refresh);return()=>{alive=false;window.removeEventListener('focus',refresh);window.removeEventListener('party-pixels:progress',refresh);};},[player]);
 useEffect(()=>{const node=document.getElementById('profile-'+player);if(!node||!data)return;node.classList.toggle('starter-framed',data.frame);node.classList.toggle('starter-banner',data.banner);return()=>{node.classList.remove('starter-framed','starter-banner');};},[data,player]);
 if(!data)return null;
 const picked=(data.pinned.length?data.pinned:data.badges).filter((b,i,a)=>data.badges.includes(b)&&a.indexOf(b)===i).slice(0,3);
 return <div className="profile-progression">{data.level!==null&&<span className="profile-level">Poziom {data.level}</span>}{data.welcome&&<span className="profile-level">✓ Pierwsze kroki</span>}{data.title&&<strong className="profile-player-title">{data.title}</strong>}{picked.length>0&&<ul className="profile-medals" aria-label="Wyróżnione odznaki">{picked.map(b=>badgeArt[b]&&<li key={b}><img src={'/progression/'+b+'-v01.webp'} alt={badgeArt[b].title} title={badgeArt[b].description} width={64} height={64}/></li>)}</ul>}</div>;
}

'use client';
import {useEffect,useRef,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import type {GameId} from '@party-pixels/sdk';
import {getClient,type Profile} from '../../../lib/client';
import Arcade from '../../arcade';
import {usePresence} from '../../player-extras';
const titles={'quick-math':'Szybka piątka','two-seconds':'Złap 2 sekundy'};
export default function NativePlayer({gameId}:{gameId:GameId}){
 const [user,setUser]=useState<User|null>(null),[profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(true),[profileLoading,setProfileLoading]=useState(false),[error,setError]=useState('');
 usePresence(user?.id,gameId);
 const shell=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const client=getClient();if(!client){setLoading(false);setError('Nie udało się połączyć z kontem.');return;}
  let alive=true;let revision=0;
  const {data:{subscription}}=client.auth.onAuthStateChange((_e,session)=>{revision++;if(alive){setUser(session?.user??null);setLoading(false);}});
  const current=revision;void client.auth.getUser().then(({data,error})=>{if(alive&&current===revision){setUser(data.user);setLoading(false);if(error&&data.user)setError('Nie udało się potwierdzić konta.');}}).catch(()=>{if(alive){setLoading(false);setError('Nie udało się sprawdzić konta. Odśwież stronę.');}});
  return()=>{alive=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  let alive=true;setProfile(null);setProfileLoading(!!user);if(!user)return;
  const client=getClient();if(!client){setProfileLoading(false);return;}
  void client.from('profiles').select('player_id,handle,display_name,avatar_key').eq('player_id',user.id).abortSignal(AbortSignal.timeout(10000)).maybeSingle().then(({data,error})=>{if(alive){setProfileLoading(false);if(error)setError('Nie udało się wczytać profilu. Odśwież stronę.');else setProfile(data as Profile|null);}});
  return()=>{alive=false;};
 },[user?.id]);
 useEffect(()=>{document.title=titles[gameId]+' · Party Pixels';},[gameId]);
 async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await shell.current?.requestFullscreen?.();}catch{setError('Pełny ekran systemowy jest niedostępny. Możesz grać w tym oknie.');}}
 return <div className="native-shell" ref={shell}><header className="native-toolbar"><a href="/#games">← Hub</a><strong>{titles[gameId]}</strong><button onClick={()=>void fullscreen()} aria-label="Przełącz pełny ekran">⛶</button></header><main className="native-content">
 {loading||profileLoading?<p role="status">Wczytuję konto gracza…</p>:user&&profile?.player_id===user.id?<Arcade key={user.id+gameId} profile={profile} gameId={gameId}/>:<section className="native-login"><span aria-hidden="true">✳</span><h1>{titles[gameId]}</h1><p>{user?'Uzupełnij profil, aby rozpocząć rozgrywkę.':'Zaloguj się, aby grać i zapisywać wyniki.'}</p><a className="primary" href="/#profile">Przejdź do konta <span>→</span></a><a className="text-button" href={'/game/'+gameId}>O grze</a></section>}
 {gameId==='quick-math'&&<a className="news-back" href="/duel">Zagraj ze znajomym — pojedynek →</a>}{error&&<p role="status" className="notice">{error}</p>}
 </main></div>;
}

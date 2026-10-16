'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {getClient} from '../lib/client';
import type {LibraryGame} from '../lib/library';
type Entry={game_id:LibraryGame;favorite:boolean;last_played_at:string|null};
type Library={games:Entry[];checkpoint:{mission:number;updated_at:string}|null};
const catalog=[
 {id:'magazyn-auto',title:'MAGAZYN AUTO',symbol:'▰',detail:'3D · Kampania solo',href:'/play/magazyn-auto'},
 {id:'quick-math',title:'Szybka piątka',symbol:'＋',detail:'Pięć działań · Rekordy',href:'#arcade-quick-math'},
 {id:'two-seconds',title:'Złap 2 sekundy',symbol:'◷',detail:'Refleks · Rekordy',href:'#arcade-two-seconds'},
] as const;
export default function PlayerLibrary({owner,active}:{owner:string;active:boolean}){
 const [data,setData]=useState<Library|null>(null),[filter,setFilter]=useState<'favorites'|'recent'>('favorites'),[notice,setNotice]=useState(''),[busy,setBusy]=useState<LibraryGame|null>(null);
 const alive=useRef(true),version=useRef(0),locked=useRef(false);
 const refresh=useCallback(async()=>{
  if(locked.current)return;
  const client=getClient();if(!client)return;const v=++version.current;
  try{
   const {data,error}=await client.rpc('pp_library',{p_owner:owner,p_action:'get'}).abortSignal(AbortSignal.timeout(10000));
   if(!alive.current||v!==version.current)return;
   if(error)throw error;setData(data);setNotice('');
  }catch{if(alive.current&&v===version.current)setNotice('Nie udało się odświeżyć biblioteki. Spróbuj ponownie.');}
 },[owner]);
 useEffect(()=>{
  alive.current=true;if(active)void refresh();
  const tick=()=>{if(active&&!document.hidden)void refresh();};
  window.addEventListener('focus',tick);window.addEventListener('party-pixels:library',tick);
  return()=>{alive.current=false;version.current++;window.removeEventListener('focus',tick);window.removeEventListener('party-pixels:library',tick);};
 },[refresh,active]);
 async function favorite(game:LibraryGame){
  if(locked.current||!data)return;locked.current=true;version.current++;setBusy(game);setNotice('');
  const value=!data.games.find(e=>e.game_id===game)?.favorite;
  try{
   const {error}=await getClient()!.rpc('pp_library',{p_owner:owner,p_action:'favorite',p_game:game,p_favorite:value}).abortSignal(AbortSignal.timeout(10000));
   if(error)throw error;if(!alive.current)return;
   setData(old=>old?{...old,games:old.games.some(e=>e.game_id===game)?old.games.map(e=>e.game_id===game?{...e,favorite:value}:e):[...old.games,{game_id:game,favorite:value,last_played_at:null}]}:old);
   window.dispatchEvent(new Event('party-pixels:library'));
   setNotice(value?'Dodano do ulubionych.':'Usunięto z ulubionych.');
  }catch{if(alive.current)setNotice('Nie potwierdzono zmiany. Odśwież bibliotekę i spróbuj ponownie.');}
  finally{locked.current=false;if(alive.current)setBusy(null);}
 }
 const favoriteCount=data?.games.filter(g=>g.favorite).length??0;
 const rows=catalog.filter(g=>(filter==='favorites'?data?.games.find(e=>e.game_id===g.id)?.favorite:data?.games.find(e=>e.game_id===g.id)?.last_played_at)).sort((a,b)=>filter==='recent'?Date.parse(data?.games.find(e=>e.game_id===b.id)?.last_played_at??'1970-01-01')-Date.parse(data?.games.find(e=>e.game_id===a.id)?.last_played_at??'1970-01-01'):0);
 return <section className="player-library" aria-labelledby="player-library-title">
 <div className="library-heading"><div><p className="eyebrow">TWOJE GRY. ZAWSZE POD RĘKĄ.</p><h2 id="player-library-title">Twoja biblioteka.</h2></div><button className="library-refresh" onClick={()=>void refresh()}>Odśwież</button></div>
 {data?.checkpoint&&data.games.some(g=>g.game_id==='magazyn-auto'&&(g.favorite||g.last_played_at))&&<a className="continue-card" href="/play/magazyn-auto"><span className="continue-symbol" aria-hidden="true">↗</span><div><small>WRÓĆ DO ROZGRYWKI</small><strong>MAGAZYN AUTO</strong><p>{data.checkpoint.mission>=3?'Kampania ukończona · Wolna jazda':'Zapis kampanii · Misja '+(data.checkpoint.mission+1)+'/3'}</p></div><b>Kontynuuj →</b></a>}
 <div className="library-filters" role="group" aria-label="Filtr biblioteki">{(['favorites','recent'] as const).map(f=><button key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f==='favorites'?'★ Ulubione · '+favoriteCount:'Ostatnio grane'}</button>)}</div>
 {notice&&<p role="status" className="notice">{notice}</p>}
 {!data?<p role="status" className="muted">Wczytuję bibliotekę…</p>:rows.length?<div className="personal-game-grid">{rows.map(g=>{const entry=data.games.find(e=>e.game_id===g.id);return <article className={'personal-game personal-'+g.id} key={g.id}><div className="personal-game-top"><span aria-hidden="true">{g.symbol}</span><button disabled={busy!==null} aria-pressed={!!entry?.favorite} aria-label={(entry?.favorite?'Usuń z ulubionych: ':'Dodaj do ulubionych: ')+g.title} onClick={()=>void favorite(g.id)}>{busy===g.id?'…':entry?.favorite?'★':'☆'}</button></div><h3>{g.title}</h3><p>{g.detail}</p>{entry?.last_played_at&&<small>Ostatnio: {new Date(entry.last_played_at).toLocaleDateString('pl-PL')}</small>}<a href={'/game/'+g.id}>{g.id==='magazyn-auto'?'Otwórz grę':'Przejdź do gry'} <span>↗</span></a></article>;})}</div>:<div className="library-empty"><strong>{filter==='favorites'?'Zostaw tu swoich faworytów.':'Jeszcze jedna runda?'}</strong><p>{filter==='favorites'?'Dodaj grę gwiazdką w Odkrywaj, a pojawi się tutaj.':'Uruchom grę — pojawi się tutaj po rozpoczęciu rozgrywki.'}</p><a className="library-discover" href="#games">Przejdź do Odkrywaj ↗</a></div>}
 <small className="library-note">Ulubione i ostatnio grane są wspólne dla Twojego konta. „Kontynuuj” korzysta z zapisu kampanii; krótkie gry rozpoczynają nową rundę.</small>
 </section>;
}


export function FavoriteButton({owner,game,title}:{owner?:string;game:LibraryGame;title:string}){
 const [favorite,setFavorite]=useState(false),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const alive=useRef(true),locked=useRef(false),version=useRef(0);
 useEffect(()=>{
  alive.current=true;setFavorite(false);setLoaded(false);
  const refresh=async()=>{
   if(!owner||locked.current)return;const v=++version.current;const client=getClient();if(!client)return;
   try{const {data,error}=await client.rpc('pp_library',{p_owner:owner,p_action:'get'}).abortSignal(AbortSignal.timeout(10000));
    if(alive.current&&v===version.current){if(error){setNotice('Nie udało się odczytać ulubionych. Odśwież stronę.');return;}setFavorite(!!data.games.find((g:Entry)=>g.game_id===game)?.favorite);setLoaded(true);}
   }catch{}
  };
  void refresh();window.addEventListener('party-pixels:library',refresh);window.addEventListener('focus',refresh);
  return()=>{alive.current=false;version.current++;window.removeEventListener('party-pixels:library',refresh);window.removeEventListener('focus',refresh);};
 },[owner,game]);
 if(!owner)return <a href="#profile" className="catalog-favorite guest-favorite" aria-label={'Zaloguj się, aby dodać do ulubionych: '+title}>☆ <span>Zapisz grę</span></a>;
 async function toggle(){
  if(locked.current)return;locked.current=true;version.current++;setBusy(true);setNotice('');
  try{const {error}=await getClient()!.rpc('pp_library',{p_owner:owner,p_action:'favorite',p_game:game,p_favorite:!favorite}).abortSignal(AbortSignal.timeout(10000));if(error)throw error;
   if(alive.current){setFavorite(!favorite);window.dispatchEvent(new Event('party-pixels:library'));setNotice(favorite?'Usunięto z ulubionych.':'Dodano do ulubionych.');}
  }catch{if(alive.current)setNotice('Nie potwierdzono zapisu. Spróbuj ponownie.');}
  finally{locked.current=false;if(alive.current)setBusy(false);}
 }
 return <div className="catalog-star-wrap"><button type="button" className="catalog-favorite" disabled={busy||!loaded} aria-pressed={favorite} aria-label={(favorite?'Usuń z ulubionych: ':'Dodaj do ulubionych: ')+title} onClick={()=>void toggle()}>{busy||!loaded?'…':favorite?'★':'☆'} <span>{favorite?'W ulubionych':'Zapisz grę'}</span></button>{notice&&<small role="status">{notice}</small>}</div>;
}

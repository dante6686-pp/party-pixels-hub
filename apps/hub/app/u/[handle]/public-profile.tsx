'use client';
import {useEffect,useState} from 'react';
import {getClient,type Profile} from '../../../lib/client';
import ProfileCard from '../../profile-card';
export default function PublicProfile({handle}:{handle:string}){
 const [profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let alive=true;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
  setLoading(true);setError('');setProfile(null);
  async function load(){
   try{
    if(!/^[a-z0-9_]{3,20}$/.test(handle)){if(alive)setError('Nie znaleziono gracza o tym nicku.');return;}
    const client=getClient();if(!client)throw new Error();
    const {data,error}=await client.from('profiles').select('player_id,handle,display_name,avatar_key,bio,banner_key').eq('handle',handle).abortSignal(controller.signal).maybeSingle();
    if(!alive)return;if(error)throw error;
    if(data){setProfile(data as Profile);document.title=data.display_name+' · Party Pixels';}else setError('Nie znaleziono gracza o tym nicku.');
   }catch{if(alive)setError('Nie udało się wczytać profilu. Spróbuj ponownie.');}
   finally{clearTimeout(timer);if(alive)setLoading(false);}
  }
  void load();return()=>{alive=false;clearTimeout(timer);controller.abort();};
 },[handle,attempt]);
 return <main className="hub public-player-page"><header className="public-page-header"><a className="brand" href="/#games"><span className="brand-icon">✳</span>party<span>pixels</span></a><a href="/#friends" className="public-back">← Wróć do huba</a></header><div className="public-page-content">
 {loading?<p role="status" className="muted">Wczytuję profil gracza…</p>:profile?<ProfileCard profile={profile}/>:<section className="social-gate"><h1>Profil gracza</h1><p role="status">{error}</p><button className="profile-edit" onClick={()=>setAttempt(a=>a+1)}>Spróbuj ponownie</button></section>}
 <p className="public-privacy-note">Profil gracza · Party Pixels</p></div></main>;
}

'use client';
import {useEffect,useState} from 'react';
import {getClient} from '../lib/client';
export function useViewer(){
 const [owner,setOwner]=useState<string|undefined>(),[readyOwner,setReadyOwner]=useState<string|undefined>(),[loading,setLoading]=useState(true);
 useEffect(()=>{
  const client=getClient();if(!client){setLoading(false);return;}
  let active=true,revision=0;
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{revision++;if(active){setOwner(session?.user.id);setLoading(false);}});
  const first=revision;
  void client.auth.getUser().then(({data})=>{if(active&&first===revision){setOwner(data.user?.id);setLoading(false);}}).catch(()=>{if(active)setLoading(false);});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  setReadyOwner(undefined);let active=true;const client=getClient();if(owner&&client)void client.from('profiles').select('player_id').eq('player_id',owner).maybeSingle().then(({data,error})=>{if(active)setReadyOwner(data&&!error?owner:undefined);});
  return()=>{active=false;};
 },[owner]);
 return {owner,ready:!!owner&&readyOwner===owner,loading};
}

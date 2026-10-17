'use client';
import {useEffect} from 'react';
import {getClient} from '../lib/client';
import {appearanceVars,validateAppearance} from '../lib/appearance';
export default function AppearanceProvider(){
 useEffect(()=>{
  let active=true,previewing=false;
  const apply=(raw:unknown)=>{const settings=validateAppearance(raw);if(settings&&active)for(const [key,value] of Object.entries(appearanceVars(settings)))document.documentElement.style.setProperty(key,value);};
  const preview=new URLSearchParams(window.location.search).get('appearance-preview')==='1'&&window.parent!==window;
  const refresh=async()=>{if(previewing)return;const client=getClient();if(!client)return;try{const {data,error}=await client.from('hub_appearance').select('settings').eq('id',true).abortSignal(AbortSignal.timeout(8000)).single();if(!error&&!previewing)apply(data?.settings);}catch{}};
  const message=(event:MessageEvent)=>{if(preview&&event.origin===window.location.origin&&event.source===window.parent&&event.data?.type==='pp:appearance-preview'){previewing=true;apply(event.data.settings);}};
  const local=(event:Event)=>apply((event as CustomEvent).detail);
  window.addEventListener('message',message);window.addEventListener('party-pixels:appearance',local);window.addEventListener('focus',refresh);
  void refresh();if(preview)window.parent.postMessage({type:'pp:appearance-ready'},window.location.origin);
  return()=>{active=false;window.removeEventListener('message',message);window.removeEventListener('party-pixels:appearance',local);window.removeEventListener('focus',refresh);};
 },[]);
 return null;
}

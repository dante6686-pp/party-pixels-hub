'use client';
import {useEffect,useState} from 'react';
import {getClient} from '../lib/client';
export default function BrandMark({variant:preview}:{variant?:string}){
 const [variant,setVariant]=useState('base');
 useEffect(()=>{if(preview)return;let alive=true;const refresh=async()=>{try{const c=getClient();if(!c)return;const {data,error}=await c.from('hub_brand').select('variant').eq('id',true).abortSignal(AbortSignal.timeout(8000)).single();if(alive&&!error&&['base','halloween','valentine'].includes(data.variant))setVariant(data.variant);}catch{}};void refresh();window.addEventListener('focus',refresh);return()=>{alive=false;window.removeEventListener('focus',refresh);};},[preview]);
 const theme=preview??variant;
 return <span className={'brand-mark mark-'+theme} aria-hidden="true"><img src="/progression/brand-v01.webp" width={44} height={44} alt=""/>{theme!=='base'&&<b>{theme==='halloween'?'🎃':'♥'}</b>}</span>;
}

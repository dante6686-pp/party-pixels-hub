import ProfileProgress from './profile-progress';
import {PlayerBadges} from './player-extras';
import {avatars,type Profile} from '../lib/client';
export const banners={orbit:'Nocna zmiana',forest:'Złota szychta',arcade:'Szybka runda'} as const;
export const bannerImages={orbit:'/profile-covers/night-porter-v01.webp',forest:'/profile-covers/warehouse-v01.webp',arcade:'/profile-covers/arcade-v01.webp'} as const;
export function bannerKey(key?:string):keyof typeof banners{return key&&Object.hasOwn(banners,key)?key as keyof typeof banners:'orbit';}
export function profileHref(handle:string){return '/u/'+encodeURIComponent(handle);}
export default function ProfileCard({profile,onEdit}:{profile:Profile;onEdit?:()=>void}){
 return <article id={'profile-'+profile.player_id} className="public-profile" aria-label={'Profil gracza '+profile.display_name}>
 <div className="profile-banner" aria-hidden="true"><img src={bannerImages[bannerKey(profile.banner_key)]} alt="" width={1536} height={512}/></div>
 <div className="public-profile-body"><div className="public-profile-top"><span className="public-avatar" aria-hidden="true">{avatars[profile.avatar_key]??'👻'}</span><ProfileProgress player={profile.player_id}/>{onEdit&&<div className="profile-owner-tools" role="group" aria-label="Zarządzanie profilem"><button className="profile-edit" onClick={onEdit}>Edytuj profil</button><a className="profile-edit" href="/settings">Ustawienia</a><a className="profile-edit" href={profileHref(profile.handle)}>Podgląd ↗</a></div>}</div>
 <p className="eyebrow">GRACZ PARTY PIXELS</p><h1>{profile.display_name}</h1><p className="public-handle">@{profile.handle}</p>
 <p className={'public-bio'+(!profile.bio?' empty-bio':'')}>{profile.bio||'Ten gracz jeszcze nic o sobie nie napisał.'}</p>
 {onEdit&&<a className="news-back" href="/starter">Starter Challenge, nagrody i odznaki →</a>}<PlayerBadges key={profile.player_id} player={profile.player_id}/><div className="public-profile-footer"><span className="dot"/> DO ZOBACZENIA W GRZE.</div></div>
 </article>;
}

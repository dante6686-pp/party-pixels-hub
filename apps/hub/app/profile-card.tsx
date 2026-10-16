import {avatars,type Profile} from '../lib/client';
export const banners={orbit:'Kosmiczny fiolet',arcade:'Neonowa limonka',forest:'Nocny las',sunset:'Zachód słońca'} as const;
export function profileHref(handle:string){return '/u/'+encodeURIComponent(handle);}
export default function ProfileCard({profile,onEdit}:{profile:Profile;onEdit?:()=>void}){
 return <article className="public-profile" aria-label={'Profil gracza '+profile.display_name}>
 <div className={'profile-banner banner-'+(profile.banner_key??'orbit')} aria-hidden="true"><span>✳</span><i/><b>GOOD TIMES<br/>GREAT COMPANY.</b></div>
 <div className="public-profile-body"><div className="public-profile-top"><span className="public-avatar" aria-hidden="true">{avatars[profile.avatar_key]??'👻'}</span>{onEdit&&<button className="profile-edit" onClick={onEdit}>Edytuj profil ↗</button>}</div>
 <p className="eyebrow">GRACZ PARTY PIXELS</p><h1>{profile.display_name}</h1><p className="public-handle">@{profile.handle}</p>
 <p className={'public-bio'+(!profile.bio?' empty-bio':'')}>{profile.bio||'Ten gracz jeszcze nic o sobie nie napisał.'}</p>
 <div className="public-profile-footer"><span className="dot"/> DO ZOBACZENIA W GRZE.</div></div>
 </article>;
}

export const styleFields={
 titleSize:{label:'Tytuły gier',min:16,max:28,default:22,unit:'px'},
 coverRatio:{label:'Proporcje ilustracji (szerokość / wysokość)',min:2,max:3,default:2.5,unit:''},
 logoSize:{label:'Wielkość ikon gier',min:56,max:100,default:90,unit:'px'},
 cardPadding:{label:'Odstępy wewnątrz kafelków',min:14,max:28,default:22,unit:'px'},
 cardGap:{label:'Odstępy między kafelkami',min:10,max:28,default:18,unit:'px'},
 cardRadius:{label:'Zaokrąglenie kafelków',min:0,max:28,default:20,unit:'px'},
 borderWidth:{label:'Grubość ramek',min:1,max:3,default:1,unit:'px'},
 textSize:{label:'Opisy gier',min:12,max:16,default:12,unit:'px'},
 pagePadding:{label:'Boczne marginesy na telefonie',min:12,max:28,default:18,unit:'px'},
} as const;
export type StyleKey=keyof typeof styleFields;
export type Appearance=Record<StyleKey,number>&{accent:string;background:string};
export const defaultAppearance:Appearance={titleSize:22,coverRatio:2.5,logoSize:90,cardPadding:22,cardGap:18,cardRadius:20,borderWidth:1,textSize:12,pagePadding:18,accent:'#d7fa72',background:'#111116'};
export function validateAppearance(value:unknown):Appearance|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(Object.keys(v).length!==Object.keys(defaultAppearance).length)return null;
 for(const key of Object.keys(styleFields) as StyleKey[]){const n=v[key],f=styleFields[key];if(typeof n!=='number'||!Number.isFinite(n)||n<f.min||n>f.max)return null;}
 if(typeof v.accent!=='string'||!/^#[0-9a-f]{6}$/i.test(v.accent)||typeof v.background!=='string'||!/^#[0-9a-f]{6}$/i.test(v.background))return null;
 // Restrict publication to a light accent and dark canvas, preserving readable controls.
 const rgb=(s:string)=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
 if((rgb(v.accent).some(n=>n<64)||rgb(v.accent).reduce((a,b)=>a+b,0)<480)||rgb(v.background).some(n=>n>48))return null;
 return {...v} as Appearance;
}
export function appearanceVars(value:Appearance):Record<string,string>{
 const vars:Record<string,string>={'--acid':value.accent,'--bg':value.background};
 for(const key of Object.keys(styleFields) as StyleKey[])vars['--pp-'+key]=value[key]+styleFields[key].unit;
 return vars;
}

import {notFound} from 'next/navigation';
import NativePlayer from './native-player';
export default async function NativeGamePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(id!=='quick-math'&&id!=='two-seconds')notFound();
 return <NativePlayer gameId={id}/>;
}

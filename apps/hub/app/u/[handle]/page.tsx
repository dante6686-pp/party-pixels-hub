import PublicProfile from './public-profile';
export default async function PlayerPage({params}:{params:Promise<{handle:string}>}){
 const {handle}=await params;return <PublicProfile handle={handle}/>;
}

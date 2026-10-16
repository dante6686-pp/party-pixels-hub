import type {Metadata} from 'next';
import GameHost from './player';
export const metadata:Metadata = {title:'MAGAZYN AUTO · Party Pixels'};
export default function GamePage() {return <GameHost/>;}

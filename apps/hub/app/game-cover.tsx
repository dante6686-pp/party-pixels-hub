import type {CatalogGame} from '../lib/catalog';
export default function GameCover({game,priority=false}:{game:CatalogGame;priority?:boolean}){
 return <div className="discovery-cover cover-illustration" aria-hidden="true"><img src={game.art} width={1536} height={1024} alt="" loading={priority?'eager':'lazy'} fetchPriority={priority?'high':undefined} decoding="async"/></div>;
}

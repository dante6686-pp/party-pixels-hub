import type {CatalogGame} from '../lib/catalog';
export default function GameCover({game,priority=false,compact=false}:{game:CatalogGame;priority?:boolean;compact?:boolean}){
 return <div className={'discovery-cover cover-illustration'+(compact?' cover-compact':'')} aria-hidden="true"><img className="cover-art" src={game.art} width={1536} height={1024} alt="" loading={priority?'eager':'lazy'} fetchPriority={priority?'high':undefined} decoding="async"/>{compact&&<img className="game-logo" src={game.logo} width={512} height={512} alt="" loading="lazy" decoding="async"/>}</div>;
}

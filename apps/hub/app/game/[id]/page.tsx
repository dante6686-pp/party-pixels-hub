import {notFound} from 'next/navigation';
import GameCommunity from '../../game-community';
import {games} from '../../../lib/catalog';
export function generateStaticParams(){return games.map(g=>({id:g.id}));}
export default async function GameDetails({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const game=games.find(g=>g.id===id);if(!game)notFound();
 return <main className="hub public-player-page"><header className="public-page-header"><a className="brand" href="/#games"><span className="brand-icon">✳</span>party<span>pixels</span></a><a href="/#games" className="public-back">← Odkrywaj</a></header><article className="game-details"><div className={'discovery-cover discovery-'+game.id}><span aria-hidden="true">{game.symbol}</span><b>{game.title}</b><small>{game.subtitle}</small></div><div className="game-details-body"><p className="eyebrow">{game.dimension.toUpperCase()} · SOLO · {game.category.toUpperCase()}</p><h1>{game.title}</h1><p className="lead">{game.description}</p><a href={game.play} className="primary">Graj <span>→</span></a><div className="game-detail-grid"><section><h2>Długość rozgrywki</h2><p>{game.duration}</p></section><section><h2>Sterowanie</h2><p>{game.controls}</p></section></div></div></article><GameCommunity game={game.id}/></main>;
}

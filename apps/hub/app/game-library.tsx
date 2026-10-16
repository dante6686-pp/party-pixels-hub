'use client';
import Link from 'next/link';
import {useState} from 'react';
import {FavoriteButton} from './player-library';
import {filterGames,games} from '../lib/catalog';
export default function GameLibrary({owner}:{owner?:string}){
 const [query,setQuery]=useState(''),[dimension,setDimension]=useState('all'),[mode,setMode]=useState('all'),[category,setCategory]=useState('all');
 const rows=filterGames(query,dimension,mode,category);
 return <section id="games" className="game-library" aria-label="Gry Party Pixels">
 <div className="library-heading"><div><p className="eyebrow">ZNAJDŹ SWOJĄ NASTĘPNĄ GRĘ</p><h2>Odkrywaj gry.</h2></div><span className="dev-label">{games.length} GRY</span></div>
 <div className="catalog-filters"><label>Szukaj gry<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tytuł lub opis…"/></label><label>Grafika<select value={dimension} onChange={e=>setDimension(e.target.value)}><option value="all">2D i 3D</option><option value="2d">2D</option><option value="3d">3D</option></select></label><label>Tryb<select value={mode} onChange={e=>setMode(e.target.value)}><option value="all">Wszystkie tryby</option><option value="solo">Solo</option><option value="multiplayer">Multiplayer</option></select></label><label>Kategoria<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Wszystkie</option><option>Akcja</option><option>Logiczne</option><option>Zręcznościowe</option></select></label></div>
 <p className="catalog-result" role="status">{rows.length} z {games.length} gier{mode==='multiplayer'?' · Pierwsze gry multiplayer są jeszcze przed nami.':''}</p>
 {rows.length?<div className="discovery-grid">{rows.map(g=><article className={'discovery-card discovery-'+g.id} key={g.id}><a className="discovery-cover" href={'/game/'+g.id} aria-label={'Szczegóły gry '+g.title}><span aria-hidden="true">{g.symbol}</span><b>{g.title}</b><small>{g.subtitle}</small></a><div className="discovery-copy"><div className="game-tags"><span>{g.dimension.toUpperCase()}</span><span>Solo</span><span>{g.category}</span></div><h3><Link href={'/game/'+g.id}>{g.title}</Link></h3><p>{g.description}</p><FavoriteButton key={owner??'guest'} owner={owner} game={g.id} title={g.title}/><Link className="primary" href={'/game/'+g.id}>Zobacz grę <span>↗</span></Link></div></article>)}</div>:<div className="library-empty"><strong>Nie znaleźliśmy gry z tymi filtrami.</strong><p>Zmień wyszukiwanie lub pokaż cały katalog.</p><button className="profile-edit" onClick={()=>{setQuery('');setMode('all');setDimension('all');setCategory('all');}}>Wyczyść filtry</button></div>}
 </section>;
}

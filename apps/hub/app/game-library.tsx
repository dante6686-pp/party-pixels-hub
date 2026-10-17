'use client';
import Link from 'next/link';
import GameCover from './game-cover';
import {useCatalogRatings} from './catalog-ratings';
import {useState} from 'react';
import {FavoriteButton} from './player-library';
import {filterGames,games} from '../lib/catalog';
export default function GameLibrary({owner}:{owner?:string}){
 const ratings=useCatalogRatings();
 const [expanded,setExpanded]=useState(false);
 const [query,setQuery]=useState(''),[dimension,setDimension]=useState('all'),[mode,setMode]=useState('all'),[category,setCategory]=useState('all');
 const rows=filterGames(query,dimension,mode,category);
 const hasFilters=query!==''||dimension!=='all'||mode!=='all'||category!=='all';
 const clearFilters=()=>{setQuery('');setDimension('all');setMode('all');setCategory('all');};
 return <section id="games" className="game-library" aria-label="Gry Party Pixels">
 <div className="library-heading"><div><p className="eyebrow">ZNAJDŹ SWOJĄ NASTĘPNĄ GRĘ</p><h2>Odkrywaj gry.</h2></div><span className="dev-label">{games.length} GRY</span></div>
 <div className="catalog-compact"><button className="catalog-search-trigger" aria-expanded={expanded} aria-controls="catalog-filter-panel" onClick={()=>setExpanded(v=>!v)}><span aria-hidden="true">⌕</span> {query||'Szukaj gry…'}</button><button className="catalog-filter-trigger" aria-label="Pokaż lub ukryj filtry" aria-expanded={expanded} aria-controls="catalog-filter-panel" onClick={()=>setExpanded(v=>!v)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>{(dimension!=='all'||mode!=='all'||category!=='all')&&<i/>}</button>{hasFilters&&<button className="catalog-reset" onClick={clearFilters}>Wyczyść filtry</button>}</div>
 <div id="catalog-filter-panel" hidden={!expanded} className="catalog-filters"><label>Szukaj gry<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tytuł lub opis…"/></label><label>Grafika<select value={dimension} onChange={e=>setDimension(e.target.value)}><option value="all">2D i 3D</option><option value="2d">2D</option><option value="3d">3D</option></select></label><label>Tryb<select value={mode} onChange={e=>setMode(e.target.value)}><option value="all">Wszystkie tryby</option><option value="solo">Solo</option><option value="multiplayer">Multiplayer</option></select></label><label>Kategoria<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Wszystkie</option><option>Akcja</option><option>Logiczne</option><option>Zręcznościowe</option><option>Horror</option></select></label></div>
 <p className="catalog-result" role="status">{rows.length} z {games.length} gier{mode==='multiplayer'?' · Pierwsze gry multiplayer są jeszcze przed nami.':''}</p>
 {rows.length?<div className="discovery-grid">{rows.map(g=><article className={'discovery-card discovery-'+g.id} key={g.id}><GameCover game={g}/><div className="discovery-copy"><div className="game-tags"><span>{g.dimension.toUpperCase()}</span><span>Solo</span><span>{g.category}</span></div><div className="discovery-title-row"><h3><Link className="discovery-card-link" href={'/game/'+g.id}>{g.title}</Link></h3><FavoriteButton key={owner??'guest'} owner={owner} game={g.id} title={g.title}/></div><p>{g.description}</p><small className="game-duration">{g.duration}</small><small className="catalog-rating">{ratings?(ratings[g.id]?`★ ${Number(ratings[g.id].average).toLocaleString('pl-PL',{maximumFractionDigits:1})} / 5 · głosów: ${ratings[g.id].votes}`:'☆ Jeszcze bez ocen'):'Oceny na stronie gry'}</small></div></article>)}</div>:<div className="library-empty"><strong>Nie znaleźliśmy gry z tymi filtrami.</strong><p>Zmień wyszukiwanie lub pokaż cały katalog.</p><button className="profile-edit" onClick={clearFilters}>Wyczyść filtry</button></div>}
 </section>;
}

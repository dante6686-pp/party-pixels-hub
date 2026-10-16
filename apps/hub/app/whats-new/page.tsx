import type {Metadata} from 'next';
import Link from 'next/link';
import {updates,updateDate} from '../../lib/updates';

export const metadata:Metadata={title:'Co nowego? · Party Pixels',description:'Nowe gry, funkcje i usprawnienia. Historia zmian Party Pixels.'};
export default function WhatsNewPage(){
 const dates=[...new Set(updates.map(entry=>entry.date))];
 return <main className="news-archive"><Link className="news-back" href="/#games">← Wróć do huba</Link><header><p className="eyebrow">HISTORIA PARTY PIXELS</p><h1>Co nowego?</h1><p>Nowe gry, nowe możliwości i małe zmiany, dzięki którym gra się lepiej. Od najnowszych do najstarszych.</p></header><nav className="news-dates" aria-label="Daty aktualizacji">{dates.map(date=><a key={date} href={'#date-'+date}>{updateDate(date)}</a>)}</nav>{dates.map(date=><section className="news-day" key={date} aria-labelledby={'date-'+date}><h2 id={'date-'+date}><time dateTime={date}>{updateDate(date)}</time></h2><ol>{updates.filter(entry=>entry.date===date).map(entry=><li key={entry.id} id={entry.id}><article><span className="news-category">{entry.category}</span><h3>{entry.title}</h3><p>{entry.description}</p></article></li>)}</ol></section>)}<Link className="news-back" href="/#games">Wybierz grę ↗</Link></main>;
}

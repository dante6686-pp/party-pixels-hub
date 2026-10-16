import Link from 'next/link';

export default function GameLibrary() {
  return <section id="games" className="game-library" aria-label="Gry Party Pixels">
    <div className="library-heading"><div><p className="eyebrow">TWOJA NASTĘPNA ROZGRYWKA</p><h2>Wskakuj do gry.</h2></div><span className="dev-label">PIERWSZA GRA 3D</span></div>
    <article className="featured-game">
      <div className="warehouse-cover" aria-hidden="true"><span>HALA 03</span><div className="warehouse-rack rack-a"/><div className="warehouse-rack rack-b"/><div className="warehouse-rack rack-c"/><div className="warehouse-cart">▰</div><b>MAGAZYN<br/><em>AUTO</em></b><small>WIELKA SZYCHTA</small></div>
      <div className="featured-copy"><p className="eyebrow">3D · SOLO · TELEFON I PC</p><h3>Mały skok.<br/>Duża inwentaryzacja.</h3><p>Przejmij wózek, wywieź złotą paletę i zgub ochronę. Trzy misje, otwarta hala i wolna jazda po godzinach.</p><div className="game-tags"><span>Dotyk</span><span>Klawiatura</span><span>Pełny ekran</span></div><Link href="/play/magazyn-auto" className="primary">Graj w MAGAZYN AUTO <span aria-hidden="true">↗</span></Link><small>Zaloguj się, aby kontynuować misje na telefonie i PC. Gość ma zapis tylko na tym urządzeniu.</small></div>
    </article>
  </section>;
}

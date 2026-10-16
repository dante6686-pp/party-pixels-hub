export type UpdateCategory = 'Nowość' | 'Gry' | 'Profile' | 'Społeczność' | 'Usprawnienie';
export type HubUpdate = {id:string; date:string; category:UpdateCategory; title:string; description:string};

// Public release notes only. Keep stable IDs and list newest releases first,
// including the editorial order of releases published on the same day.
export const updates: readonly HubUpdate[] = [
 {id:'2026-10-16-08',date:'2026-10-16',category:'Nowość',title:'Nowości mają swoje miejsce',description:'Zobacz najświeższe zmiany nad katalogiem gier. Przesuwaj kafelki i zajrzyj do pełnej historii, żeby nic Cię nie ominęło.'},
 {id:'2026-10-16-07',date:'2026-10-16',category:'Usprawnienie',title:'Wszystkie filtry? Jeden klik.',description:'Przycisk „Wyczyść filtry” usuwa wybrane filtry i tekst wyszukiwania. Jest pod ręką także po zwinięciu panelu.'},
 {id:'2026-10-16-06',date:'2026-10-16',category:'Gry',title:'Łatwiej znaleźć coś do grania',description:'Szukaj po tytule lub opisie i filtruj gry według grafiki, trybu oraz kategorii. Wyszukiwarka rozwija się dopiero wtedy, gdy jej potrzebujesz.'},
 {id:'2026-10-16-05',date:'2026-10-16',category:'Społeczność',title:'Więcej kontroli nad kontaktami',description:'Możesz blokować i odblokowywać graczy oraz zgłaszać profile i otrzymane wiadomości.'},
 {id:'2026-10-16-04',date:'2026-10-16',category:'Profile',title:'Twój profil, Twój styl',description:'Pokaż avatar, baner i kilka słów o sobie. Kliknij nazwę lub avatar gracza, żeby odwiedzić jego publiczny profil.'},
 {id:'2026-10-16-03',date:'2026-10-16',category:'Gry',title:'Twoja biblioteka pod ręką',description:'Ulubione i ostatnio grane gry znajdziesz w osobnej Bibliotece oraz na swoim profilu. Pełny katalog czeka w Odkrywaj.'},
 {id:'2026-10-16-02',date:'2026-10-16',category:'Społeczność',title:'Zbierz swoją ekipę',description:'Znajduj graczy po nicku, wysyłaj zaproszenia do znajomych i rozmawiaj z nimi w prywatnych wiadomościach.'},
 {id:'2026-10-16-01',date:'2026-10-16',category:'Gry',title:'Pierwsze gry już czekają',description:'Wskocz do MAGAZYNU AUTO, rozwiąż Szybką piątkę albo sprawdź wyczucie czasu w grze Złap 2 sekundy.'},
];

export function updateDate(date:string) {
 return new Intl.DateTimeFormat('pl-PL',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Warsaw'}).format(new Date(date+'T12:00:00Z'));
}

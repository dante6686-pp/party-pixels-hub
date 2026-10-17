# Nocna portiernia — prototyp A

Źródło projektu: [GDD v1.0](https://docs.google.com/document/d/1oyYlC_X3huLJtyzAsr_7DxwtnrXZWLuUK4sUQh95o60/edit), odczyt 16.10.2026. Gałąź robocza: `feat/nocna-portiernia-prototype`.

## Zakres i stan

Kod odrębnej gry w `apps/hub/public/games/nocna-portiernia/`. Nie zmieniono aplikacji huba, katalogu, infrastruktury, bazy ani hosta. Patryk zatwierdził osobny, stale aktualizowany podgląd do testów; integracja i dodanie do katalogu huba pozostają osobnym zleceniem.

Prototyp obejmuje pierwsze dwie wizyty (Jan Wrona i Teresa Mazur), jedną proceduralną scenę Three.js, ograniczony obrót kamery, fikcyjną kartę mieszkańca i spis sześciu lokatorów. Zdjęcia powstają z tych samych modeli co goście. Kontrola nazwiska/mieszkania/twarzy, obejrzenie dokumentów w pierwszej wizycie, blokada decyzji w przejściach, widoczna liczba naruszeń, podsumowanie dwóch wizyt, restart z potwierdzeniem, pauza, lokalny checkpoint i domyślny fullscreen po świadomym starcie (z fallbackiem).

Wszystkie osiem wizyt jest zapisanych jako dane scenariusza. Publiczny prototyp ma limit **2**, nie udostępnia wizyt 3–8 ani końcowych scen całej gry. Logika pełnej wersji (3 pomyłki, 8 wizyt) ma testy, ale nie stanowi implementacji pełnej prezentacji. Zakończenie prototypu jest odrębne od przetrwania zmiany. Nie przewijamy czasu do 06:00 po dwóch wizytach.

Decyzje wykonawcze: Three.js 0.170.0 z istniejącego `../magazyn-auto/vendor/three.module.js` (MIT); brak nowych zależności, importów CDN i modeli pobieranych w trakcie gry. Modele geometryczne i syntezowane dźwięki są materiałem prototypowym. Migotanie domyślnie wyłączone. Brak nagranych dialogów; wypowiedzi i sygnały mają polskie napisy. Nie zmieniono zasad GDD.

## Uruchomienie lokalne

Z katalogu głównego repozytorium:

```sh
python -m http.server 8080 --directory apps/hub/public
```

Otwórz `http://localhost:8080/games/nocna-portiernia/index.html`. Wymagany HTTP, nie `file://`. Alternatywnie gra jest zasobem statycznym lokalnego Next.js po `npm ci` i `npm run dev`; nie wymaga logowania, API ani konfiguracji środowiska.

Do samodzielnego skopiowania prototypu zachowaj oba katalogi: `nocna-portiernia/` i `magazyn-auto/vendor/` wraz z licencją Three.js. Nie jest potrzebna pozostała gra MAGAZYN AUTO.

Testy gry: `node --test tests/nocna-portiernia*.test.mjs`. Całe repozytorium: `npm test`.

## Obsługa i zapis

- Telefon: portret, przeciąganie sceny, dotykanie dokumentów/przycisków. Poziom opcjonalny. UI używa `100dvh`, safe-area i celów co najmniej 44 px.
- PC: mysz oraz Tab/Enter do przycisków, Escape zamyka powiększenie/dokumenty i otwiera pauzę. Bez pointer lock.
- Dotyk i mysz pozostają równocześnie aktywne; podpowiedź reaguje na faktyczne wejście. Resize anuluje gest, pozostawiając wybrany wpis i stan gry.
- Utrata fokusu/widoczności pauzuje logikę przejść, scenę i audio. Powrót wymaga Wznów. Nie dodaje błędu.
- Zapis wyłącznie lokalnego gościa, klucz `pp:nocna-portiernia:prototype-a:guest:v1`. Żadnego odczytu sesji huba. Walidacja obejmuje wersję scenariusza, limit prototypu, sekwencję decyzji, liczniki i zakończenie.
- Checkpoint po reakcji i odejściu; opuszczenie karty przed zakończeniem przejścia odtwarza tę wizytę od początku. Zakończenie dwóch wizyt także jest zapisywane. Błąd zapisu pokazuje komunikat i nie blokuje sesji.

## Przekazanie programiście huba

To niezintegrowany build standalone; uruchomienie wewnątrz iframe jest celowo blokowane komunikatem. Nie podłączaj obecnego buildu do produkcyjnego hosta MAGAZYN AUTO. Jego protokół akceptuje inny build, checkpoint `mission/cash` oraz inne komendy startu. Gra nie tworzy konkurencyjnego SDK.

Po osobnym zleceniu integracji: zarejestrować zatwierdzony build i gameId `nocna-portiernia`, przygotować adapter do istniejącego hosta/MessagePort, walidator nowego checkpointu oraz kontrolowany odczyt/zapis właściwego gracza; dodać grę do dozwolonych identyfikatorów biblioteki/katalogu. Wprowadzić politykę iframe/CSP/CORS zgodną z rzeczywistym sposobem hostowania. W sandboxie zapis musi należeć do hosta, nie do `localStorage` dziecka. Wstrzymać powiadomienia huba w scenie. Powrót do huba ma być operacją hosta.

Kontekst konta nie jest jeszcze przyjmowany i nic nie jest zapisywane na koncie. Lokalny zapis prototypu nie jest automatycznie importowany do konta. Brak rankingu, XP, walut i nagród. Zapis chmurowy wymaga osobnego zakresu, implementacji i testów. Przed integracją rozbudować prezentację do pełnego etapu B albo świadomie oznaczyć build jako dwuwizytowe demo.

## Weryfikacja 16.10.2026

9 nowych testów Node: dane scenariusza, pełna sekwencja decyzji, trzecia pomyłka (także ósma wizyta), maksymalnie 2 błędy/przetrwanie, duplikaty, walidacja/wznowienie checkpointów. Testy kontrolera z atrapami DOM/audio/renderera sprawdzają oglądanie dokumentów, zachowanie wpisu po spojrzeniu na gościa, przejście obu wizyt, pauzę podczas przejścia, obie błędne decyzje, restart/potwierdzenie, terminalną kontynuację, niedostępność zapisu i utratę fokusu. To symulacja kontrolera, **nie test przeglądarki ani WebGL/dotyku**.

Pełna pula: 48/48 testów Node zaliczonych; składnia trzech modułów prezentacji sprawdzona przez `node --check`. Bez nowych zależności i bez zmian kodu Next.js — produkcyjnego builda huba nie uruchamiano w tym etapie.

Podgląd przeglądarkowy zablokowany przez środowisko: `sites-preview start` kończy się `bwrap: Can't mount proc on /newroot/proc: Operation not permitted`; status potwierdza zatrzymany podgląd. Nie uruchamiano alternatywnego serwera ani nie obchodzono ograniczenia. Nie wykonano wizualnego QA, pomiarów FPS ani testu rzeczywistego WebGL, dotyku, audio/fullscreen w przeglądarce.

Do potwierdzenia na Androidzie w pionie i PC: czytelność twarzy/karty/spisu, widoczność obu dokumentów, kadrowanie sceny, klik/gest i przeciąganie, portret/poziom/resize, brak przypadkowych decyzji, pauza i dźwięk, odmowa fullscreen, przerwanie i wznowienie zapisu. Celem jest zrozumienie obu decyzji bez pomocy. Animacje podania/oglądania karty i skinienie Jana są uproszczone; oprawa dźwiękowa prototypowa. Kolejny etap: poprawki po wizualnym teście, potem wizyty 3–8 i pełne zakończenia.

## Podgląd na telefonie — aktualizacja 16.10.2026

[Nocna portiernia — prywatny podgląd](https://nocna-portiernia-test.aglowheron10.chatgpt.site)

Otwórz samodzielnie w Chrome na telefonie. Jeżeli pojawi się logowanie ChatGPT, użyj tego samego konta właściciela. Nie instaluj niczego. To dwie wizyty z zapisem wyłącznie w tej przeglądarce i pod tym adresem; bez synchronizacji z hubem.

Rutynowe aktualizowanie tego podglądu podczas dalszej pracy jest zatwierdzone przez Patryka. Zachowuj adres i projekt Sites `appgprj_6ad28f60ccc08191a07a9bf1eb3b59e5` (owner-private). Lokalny checkout pakietu: `/workspace/sites/nocna-portiernia-test`; gdy nie istnieje, odtwórz źródło tego samego projektu zgodnie z Sites skill. Kod gry rozwijaj w GitHub; do pakietu kopiuj katalog gry i istniejący vendor Three.js z licencją. Pakiet root przekierowuje do `/games/nocna-portiernia/index.html`. Nie zmieniaj przypadkowo katalogu ani wdrożenia huba.

Usługa potwierdziła succeeded: deployment `appgdep_6ad28f9404d88191959d5186c49fcfcd`, commit pakietu `18a23830dd3f1186934f69970876089f22f47cbb` z kodu gry `734e81260983f5e1b7d768af471f30b0785dd975`. Nie jest to dowód testu dotyku/WebGL. Ograniczenia QA opisane wyżej pozostają aktualne.

## Stanowisko kontroli — rozdział 21 GDD, 16.10.2026

Wdrożony kod fba8fbf2d02d52e72b911940d5b62105e0688f74: kompaktowy HUD, osobny obszar sceny z bliższą kamerą i neutralniejszym światłem, krótki dialog z rozwinięciem, automatyczna karta i niemodalne porównanie dwóch dokumentów z ręcznym wyborem lokatora. Twarz pozostaje nad panelem; decyzja możliwa bez zamykania dokumentów. Powiększenie zdjęcia jest modalem i blokuje decyzję. Samo kliknięcie spisu nie zalicza obejrzenia: konieczna jest widoczność treści. Wybrany wpis, format checkpointu i reguły pozostają zachowane. Sukces zapisu znika po 2,7 s, błąd pozostaje w HUD i pauzie. Fullscreen nie jest ponawiany po świadomym wyjściu użytkownika.

Testy: 52/52 Node. Symulacja kontrolera obejmuje powyższe ścieżki oraz pauzę/restart/wznowienie. Geometria kamery mieści sześć głów/fryzur w pięciu przykładowych obszarach sceny. Nie wykonano wizualnego QA, screenshotów ani testu fizycznego dotyku. To nadal testy logiki/geometrii, nie testy viewportów przeglądarki. Ograniczenie infrastruktury podglądu opisane wyżej pozostaje aktualne. Do odbioru: 360×640, 390×844, 412×915, niski poziom, PC 1366×768 i rzeczywista próba telefonu; także pomiar kontrastu całego UI.

Ten sam [prywatny podgląd](https://nocna-portiernia-test.aglowheron10.chatgpt.site) wdrożony ze statusem succeeded, deployment `appgdep_6ad29606077881919798de64bc0497e9`, pakiet `111c96adfa9f3c9f8c7b37877a6d4a0e8665f74b`. Gra nadal poza katalogiem huba.

## Rozdział 23 GDD — 17.10.2026

Kod `e7d1d6fc962f20607497ee99d9ef73b82b2c9eb3`: subtelne addytywne kołysanie kamery (yaw 0,25°, pitch 0,20°, roll 0,06°; okresy 7,7 / 6,3 / 8,9 s), płynne tłumienie do 15% przy dokumentach i do zera przy modalu. Przełącznik „Kołysanie kamery” w menu/pauzie; domyślnie wyłączone przy prefers-reduced-motion. Pauza zamraża fazę, UI pozostaje nieruchome. Strojenie amplitud wymaga telefonu.

Gość przedstawia „Podane informacje” i „Przedstawione zdjęcie”; prawdziwy wpis to „Karta lokatora”. Powiększenie zdjęcia nie ujawnia automatycznie nazwiska modelu. Każda wizyta zaczyna się z pustym spisem i placeholderem „Wybierz lokatora…”. Wyświetlenie wybranego lokatora dopiero po ręcznym wyborze; wybór zachowany w tej samej wizycie, zerowany przy następnej/nowej zmianie/wznowieniu. Pusta sekcja nie zalicza samouczka; druga wizyta nie ma nowej blokady. Reguły i checkpoint bez zmian.

57/57 testów Node zaliczonych: nowy zakres kontrolera/reduced-motion i kołysania, regresja reguł/zapisu/fullscreen oraz geometria kadru ze skrajnymi kątami. To testy symulowane, nie WebGL/dotyk ani ocena wyglądu na urządzeniu. Potrzebny test odczucia ruchu, podpisów, pustego spisu i czytelności na telefonie.

Ten sam [prywatny podgląd](https://nocna-portiernia-test.aglowheron10.chatgpt.site), succeeded: `appgdep_6ad29ed5fc608191b04fffe527dabb7d`, pakiet Sites `291a4f17f428f50ca3051a5d90916ce4861794b6`. Nadal dwuwizytowy prototyp poza katalogiem huba.

## Wejście gościa i etapowe UI — 17.10.2026

Na bezpośrednie polecenie Patryka: najpierw podejście gościa (1,35 s), potem UI i tekst wypowiedzi, po dalszej 1 s fade-in podanych informacji. Przejścia opacity 1,1 s; reduced-motion wyłącza je bez zmiany kolejności. Po pierwszym gościu UI zostaje przez resztę aktywnej zmiany. Kolejna wizyta czyści wyłącznie poprzednią wypowiedź i informacje oraz powtarza ich opóźnienia. Na starcie nowej zmiany/wznowienia z menu UI czeka na pierwszego napotkanego gościa. Rezerwacja layoutu ogranicza przeskoki kadru. Kontrolki są niedostępne przed ukończeniem prezentacji, a tutorial nadal wymaga rzeczywistej widoczności dokumentów. Pauza zatrzymuje odliczanie; menu/restart anulują je. Reguły i checkpoint bez zmian.

Kod `77234f4735ce7fb9bf38dc7c006fe6472d059687`, 59/59 testów Node, w tym dwa nowe testy sekwencji i regresja dotychczasowego kontrolera. Odczyt GitHuba potwierdzony. Wygląd CSS fade, WebGL i fizyczny dotyk pozostają testem urządzenia. Zapis dla designera znajduje się w rozdziale 25 wspólnego GDD.

Ten sam [podgląd](https://nocna-portiernia-test.aglowheron10.chatgpt.site), deployment `appgdep_6ad2a1c52ea88191b28e8baddc591d57` succeeded; pakiet `c47ae975823486c16145b40759e9e3877d7d8f9c`. Nadal poza katalogiem huba.


## Karuzela kart mieszkańców — 16.10.2026
Usunięto pasek Informacje / Porównaj ze spisem, listę wyboru lokatora, przycisk patrzenia na gościa oraz powiększanie fotografii. Nowa kolejność: wypowiedź lub komunikat wydarzenia, Podane informacje gościa, pozioma karuzela wszystkich sześciu kart mieszkańców w formie identyfikatorów (zdjęcie, nazwisko, mieszkanie). Karty przegląda się ręcznie palcem, przeciągając myszą lub strzałkami klawiatury po ustawieniu fokusu na karuzeli. Nie ma wybierania osoby, automatycznego dopasowania ani podświetlania prawidłowej karty. „?” przeniesiono do prawego górnego rogu, obok pauzy. Odmów / Wpuść pozostają dostępne przy porównywaniu; twarz gościa jest widoczna w osobnym obszarze sceny.
Zachowano sekwencję wejścia z rozdziału 25: pierwsze UI i dialog po podejściu, dane po kolejnej sekundzie, fade 1,1 s; reduced-motion bez animacji. Karty pojawiają się wraz z podstawowym UI i pozostają między wizytami. Ich pozycja przewinięcia jest zachowana przy pauzie, zmianie rozmiaru i następnej wizycie. Nowa zmiana zaczyna przegląd od początku, bez dopasowania do gościa. W pierwszej wizycie decyzję odblokowuje widoczność danych i dowolnej karty mieszkańca, bez dodatkowego kliknięcia i bez wymagania poprawnego dopasowania. Modal lub trwający fade nie zalicza zapoznania. Scenariusz dwóch wizyt, zasady oceny i format zapisu bez zmian.
Kod GitHub: d7d8d4fd995220e32f127c70be9834a557d57385, gałąź feat/nocna-portiernia-prototype. Wdrożono ten sam prywatny podgląd https://nocna-portiernia-test.aglowheron10.chatgpt.site — deployment appgdep_6ad2a5a2427081918ed5f649798e2611, succeeded. Gra nadal poza katalogiem huba.
Weryfikacja: 59/59 testów Node; symulacja kontrolera obejmuje komplet sześciu kart, brak wyboru osoby, mysz/klawiaturę, natywną ścieżkę dotyku, zachowanie przewinięcia, blokadę modali, opóźnione UI, obie wizyty, restart, zapis i zakończenie. Odczyt GitHuba potwierdził treści zmienionych plików. To nie jest test fizycznego dotyku ani renderowania WebGL. Zarządzany podgląd przeglądarkowy pozostaje zablokowany błędem środowiska bwrap. Do odbioru na urządzeniu: swipe, czytelność identyfikatorów i danych, widoczność twarzy i decyzji na telefonie pionowo, niski poziom i komputer.


## Realizacja rozdziału 27 GDD — naprawa portretu


Realizacja rozdziału 27 — programistka, 17.10.2026, Europe/Warsaw
Status: poprawka wdrożona do tego samego podglądu; odbiór wizualny i dotykowy na telefonie nadal wymagany.
Usunięto w kodzie możliwość rozszerzania głównej kolumny przez zawartość karuzeli: jawne minmax(0,1fr), min-width:0 na rodzicach grid/flex, ograniczenie szerokości kontenerów do dostępnego miejsca. Karty mają szerokość widocznego obszaru karuzeli minus 30 px, z fragmentem następnej karty. To korekta ograniczeń layoutu; nie wykonano pomiarów DOM w przeglądarce i nie uznano hipotezy ze screena za potwierdzoną pomiarem.
Przebudowano stanowisko na przewijaną część informacyjną i osobny dolny rząd decyzji. Odmów/Wpuść mają równe kolumny, wysokość minimum 54 px i odstęp safe-area. Przy małej wysokości najpierw kurczy się scena do minimum 112 px w pionie, następnie przewija się treść nad decyzjami. Dialog pokazuje dwie linie i udostępnia pełną treść we własnym przewijaniu. Nazwiska zawijają się; portrety i dane są kompaktowe. Nie zmniejszono treści decyzji ani nazwisk do mikrodruku. Zachowano opóźnienia UI i fade.
Dodano Wycentruj widok na obszarze sceny. Dotychczasowy reset obrotu przy wejściu gościa i dopasowanie kamery do rzeczywistego rozmiaru sceny pozostają aktywne; nie zmieniano FOV w celu maskowania błędu szerokości. Karuzela ma własne zdarzenia, zatrzymuje propagację gestów i nie wywołuje obrotu sceny ani decyzji. Dotyk/rysik korzystają z natywnego przewijania i CSS snap; mysz po zwolnieniu przyciąga do najbliższej karty. Licznik w nagłówku pokazuje aktualną kartę, np. 4/6. Strzałki/Home/End poruszają po kartach; po resize zachowana jest ta sama karta. Między wizytami i po pauzie pozycja pozostaje ręczna, bez automatycznego dopasowania.
Obserwatory zapoznania z danymi liczą widoczność względem viewportu, z uwzględnieniem przewijanej części UI, oraz nadal ignorują modal/pauzę/fade. Testowy DOM nie tworzy już automatycznie brakujących elementów, aby wyłapywać niespójności HTML i kontrolera.
Kod: ab1148b9a8957876ae50693c6c9a2db3dda4e7a4, feat/nocna-portiernia-prototype, dante6686-pp/party-pixels-hub. Odczyt pięciu zmienionych plików z GitHuba potwierdził zgodność. Podgląd https://nocna-portiernia-test.aglowheron10.chatgpt.site — deployment appgdep_6ad2f9459b98819182315a1b0760dfa2, succeeded; pakiet d830124924095180cbca22482a9de756169541c2.
Wykonano 22/22 testy Node dotyczące Nocnej portierni (nie cały zestaw huba): kontroler, dwie wizyty i wynik 2/2, błędne decyzje/restart/checkpoint, prezentacja/fade/pauza, fullscreen, kołysanie oraz geometria głów/fryzur sześciu postaci. Rozszerzono geometrię o obszary sceny 360×112, 390×112 i 412×112; to rozmiary sceny w teście projekcji, nie zrzuty viewportów. Dodane testy sprawdzają licznik, zachowanie karty po zmianie szerokości, centrowanie niezależne od kart oraz granice klawiaturowej nawigacji.
Ograniczenia: zarządzany podgląd nie uruchomił się — bwrap: Can't mount proc on /newroot/proc: Operation not permitted; status stopped. Nie wykonano screenshotów, pomiarów szerokości DOM/canvas, rzeczywistego WebGL ani fizycznego swipe. Nie oznaczać odbioru wizualnego jako zaliczonego. Do testu Patryka: 360×640, 390×844, 412×915, niski poziom i PC 1366×768; zwykłe okno i fullscreen; oba przyciski i pauza w całości, pełna twarz, tylko karuzela przewijana poziomo, swipe bez ruchu kamery, Wpuść/Odmów → 2/2, błędna decyzja i restart. Wizyty 3–8 czekają na odbiór UI. Bez zmian huba, katalogu i bazy.

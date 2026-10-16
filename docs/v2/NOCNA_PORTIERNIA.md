# Nocna portiernia — prototyp A

Źródło projektu: [GDD v1.0](https://docs.google.com/document/d/1oyYlC_X3huLJtyzAsr_7DxwtnrXZWLuUK4sUQh95o60/edit), odczyt 16.10.2026. Gałąź robocza: `feat/nocna-portiernia-prototype`.

## Zakres i stan

Kod odrębnej gry w `apps/hub/public/games/nocna-portiernia/`. Nie zmieniono aplikacji huba, katalogu, infrastruktury, bazy ani hosta. Patryk zatwierdził osobny, stale aktualizowany podgląd do testów; integracja i dodanie do katalogu huba pozostają osobnym zleceniem.

Prototyp obejmuje pierwsze dwie wizyty (Jan Wrona i Teresa Mazur), jedną proceduralną scenę Three.js, ograniczony obrót kamery, fikcyjną kartę mieszkańca i spis sześciu lokatorów. Zdjęcia powstają z tych samych modeli co goście. Kontrola nazwiska/mieszkania/twarzy, obejrzenie dokumentów w pierwszej wizycie, blokada decyzji w przejściach, widoczna liczba naruszeń, podsumowanie dwóch wizyt, restart z potwierdzeniem, pauza, lokalny checkpoint i opcjonalny fullscreen.

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

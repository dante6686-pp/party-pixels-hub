# Odtwarzacz gier i MAGAZYN AUTO — 16.10.2026

## Standard produktu

Party Pixels obsługuje głównie bardziej rozbudowane gry 3D oraz gry 2D. Jedna gra musi działać na telefonie z dotykiem oraz na PC z klawiaturą i myszą. Grę otwieramy w osobnym widoku na całe dostępne okno, bez przewijania huba. Przycisk Graj prosi o systemowy fullscreen w obsługujących go przeglądarkach. Brak tej funkcji lub odmowa nie blokują rozgrywki. Telefon projektujemy w pierwszej kolejności dla orientacji pionowej. Host nie wymusza poziomu i nie proponuje obrotu. Fullscreen zachowuje orientację wybraną przez użytkownika; poziom pozostaje opcjonalnym responsywnym układem.

Tryb Auto bierze pod uwagę pointer:coarse oraz faktyczne wejście dotykowe/klawiaturowe w obu dokumentach. Ręczny wybór Dotyk/Klawiatura ma pierwszeństwo. Przy obrocie/resize czyścimy przytrzymane wejścia; rozmiar canvasu i kamery śledzi dostępną przestrzeń. UI ma podstawowy układ portretowy: cel u góry, kompaktowe status/minimapa, sterowanie kciukami na dole. Krótki poziomy ekran pozostaje obsługiwany; safe-area i przyciski dotykowe co najmniej 44 px są wymagane.

## Pierwsza podłączona gra

`/play/magazyn-auto` — pełny host. Karta w katalogu na `/` jest dostępna również dla gościa. Oryginalny Site https://magazyn-auto.aglowheron10.chatgpt.site/ zachowuje swoje ustawienia i wersję; do gałęzi huba przeniesiono zasoby źródłowe commitu `47fe50a31f72f5fe40e7366462faa8300ee86b86` i dodano adapter platformy. Three.js 0.170.0 i MIT w vendor; wszystko lokalne, bez pobierania bibliotek podczas gry. Referencyjne zdjęcia hali nie są częścią buildu.

Mechanika: chodzenie, 7 pojazdów, 3 misje, ochrona, minimapa, wolna jazda. Host obsługuje powrót do katalogu, ładowanie/timeout/retry, start, fullscreen, zmianę sterowania i pauzę. Gra pauzuje po utracie fokusu, zmianie karty lub wyjściu z fullscreen; wznowienie wymaga działania gracza. Klawiatura: WASD/strzałki, E, Spacja, Shift, P/Escape. Dotyk: wielodotykowy joystick, wsiadanie/akcja i przytrzymanie nitro; pointercancel/lostpointercapture zerują wejście.

## Granica host–gra

Iframe ma sandbox `allow-scripts allow-pointer-lock allow-orientation-lock`, bez `allow-same-origin`, nawigacji top i popupów. CSP na ścieżce zasobów powtarza sandbox i blokuje połączenia sieciowe oraz formularze. CORS `*` obejmuje wyłącznie statyczne zasoby gry, potrzebne modułom z opaque origin; nie obejmuje Auth lub API huba.

Host przyjmuje handshake wyłącznie od `iframe.contentWindow`, z origin `null`, protokołem 1 i zatwierdzonym buildem `magazyn-auto-pp-1`. Po handshake przekazuje osobny MessagePort. Gwiazdka targetOrigin w jednorazowym init jest konieczna dla opaque origin; sprawdzenie źródła, originu i buildu następuje przed transferem portu. Dziecko sprawdza rodzica, jego origin z referrera, wersję i port. Port zamykamy po zmianie profilu, ponownym uruchomieniu lub opuszczeniu strony.

Do gry trafiają tylko nazwa i emoji avatara. Bez e-maila, tokenu sesji, klienta Supabase ani roli. Dozwolone komunikaty z gry: stan, wykryta metoda wejścia, ograniczony checkpoint i błąd. Wyniki/XP i dowolne operacje SDK nie są obsługiwane przez ten port. Nie jest to jeszcze uniwersalna integracja obcych URL ani pełne zamknięcie PP-013.

## Zapis postępu — aktualizacja 16.10.2026

Zalogowany gracz ma checkpoint na koncie Supabase, w prywatnej tabeli pp_private.game_checkpoints. Funkcje pp_load_checkpoint / pp_store_checkpoint są jedynym API: wymagają potwierdzonego konta, profilu i zgodności p_expected_player z auth.uid(). Gra nie wybiera konta, klucza ani poziomu zaufania; host przekazuje żądanie przez wąski adapter. Prywatne tabele mają RLS i nie mają grantów dla ról klienckich. Kontrola formatu obejmuje mission 0..3 i cash 0..1000000000, bez dodatkowych pól.

Zapis ma rosnącą revision i request_id. Retry z tym samym ID i payloadem zwraca ten sam zapis. Zapis z nieaktualnej revision daje SAVE_CONFLICT; starsze urządzenie nie nadpisze nowszego. Host pauzuje grę i prosi o wczytanie zapisu konta, zachowując lokalną kolejkę jako kopię konfliktu. Lokalna kolejka jest utrwalona przed potwierdzeniem do gry; potwierdzenie lokalne/pending jest odróżnione od „Zapis na koncie”. Błąd sieci nie jest sukcesem chmurowym. Powrót online i przycisk Ponów zapis ponawiają tę samą kolejkę.

Przy wejściu host pobiera zapis konta. Gdy konto nie ma jeszcze checkpointu, importuje dotychczasowy lokalny zapis wyłącznie z klucza tego samego konta. Gość ma osobny lokalny slot i nie jest automatycznie importowany do konta. Dane pochodzące z klienta nie są dowodem uczciwej gry i nie przyznają punktów rankingu ani nagród.

Checkpoint obejmuje etap kampanii i gotówkę, bez pozycji w połowie misji. Powstaje po misji, zatrzymaniu, sprzedaży w wolnej jeździe oraz po świadomym rozpoczęciu kampanii od nowa. Nowa kampania zapisuje mission=0,cash=0; restart nie omija kontroli rewizji.

Przebieg kampanii: misja 1 — złota paleta; misja 2 — trzy terminale z grafikiem (pieszo); misja 3 — worek do Bramy 03. Po misji 3 następuje wolna jazda z niekończącymi się dostawami. Ekran wejścia, HUD i pauza pokazują ten stan, a wejście oferuje nową kampanię od początku. Zgłoszenia powtarzalnych dostaw nie odtworzono jako błędu logiki kampanii; były podstawą poprawienia czytelności stanu.

## Walidacja

Build Next.js i 37 testów Node przeszły: kontrakty dotychczasowych dwóch gier, kontrola źródła/originu/wspólnego protokołu, walidacja checkpointów i rozdzielenie kluczy, oryginalne testy mechaniki oraz geometrii 3D (278 meshes, 43741 wierzchołków). Pełna kampania przechodzi test symulacji bez teleportowania pozycji. Wdrożenie dev uruchomiło hosta i moduły gry w sandboxie. Przeglądarka cloud nie udostępnia WebGL (GL_VENDOR i GL_RENDERER: Disabled), więc test rzeczywistego renderowania i sterowania sceną pozostaje do wykonania na fizycznym urządzeniu. Dodatkowy test kontroluje przekazanie błędu grafiki sprzed połączenia i odrzucenie obcego init. Stan wdrożenia jest zapisany w IMPLEMENTATION_PROGRESS.md.

Następne rozszerzenia: test chmurowego zapisu na dwóch fizycznych urządzeniach oraz iOS, potwierdzony regulamin wyników tej gry, kolejne zatwierdzone buildy. Zapisy i rankingi dwóch małych gier pozostają oddzielne.

Aktualizacja weryfikacji: testy CheckpointSync sprawdzają dwie instancje urządzeń, retry po utracie odpowiedzi, kolejkę offline, konflikt, migrację lokalnego slotu i rozdzielenie gościa/kont. tests/game-checkpoints.sql w transakcji rollback przeszedł na bazie dev: zapis/odczyt, CAS, idempotencja, walidacja, odmowa dla innego konta i anon, brak dostępu do tabel, świadomy reset. Zero kont-fixture pozostało. Test telefonu wcześniejszego buildu zaliczony według relacji Patryka „wszystko działa elegancko”. Test aktualnego zapisu po zalogowaniu na dwóch rzeczywistych urządzeniach pozostaje do potwierdzenia.

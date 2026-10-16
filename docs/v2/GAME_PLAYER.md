# Odtwarzacz gier i MAGAZYN AUTO — 16.10.2026

## Standard produktu

Party Pixels obsługuje głównie bardziej rozbudowane gry 3D oraz gry 2D. Jedna gra musi działać na telefonie z dotykiem oraz na PC z klawiaturą i myszą. Grę otwieramy w osobnym widoku na całe dostępne okno, bez przewijania huba. Przycisk Graj prosi o systemowy fullscreen w obsługujących go przeglądarkach. Brak tej funkcji lub odmowa nie blokują rozgrywki. Próba blokady orientacji poziomej dotyczy dotyku i następuje po wejściu w fullscreen; fallback to responsywny widok pionowy z podpowiedzią obrotu.

Tryb Auto bierze pod uwagę pointer:coarse oraz faktyczne wejście dotykowe/klawiaturowe w obu dokumentach. Ręczny wybór Dotyk/Klawiatura ma pierwszeństwo. Przy obrocie/resize czyścimy przytrzymane wejścia; rozmiar canvasu i kamery śledzi dostępną przestrzeń. UI ma osobny układ dla krótkiego poziomego ekranu telefonu, safe-area i przyciski dotykowe co najmniej 44 px.

## Pierwsza podłączona gra

`/play/magazyn-auto` — pełny host. Karta w katalogu na `/` jest dostępna również dla gościa. Oryginalny Site https://magazyn-auto.aglowheron10.chatgpt.site/ zachowuje swoje ustawienia i wersję; do gałęzi huba przeniesiono zasoby źródłowe commitu `47fe50a31f72f5fe40e7366462faa8300ee86b86` i dodano adapter platformy. Three.js 0.170.0 i MIT w vendor; wszystko lokalne, bez pobierania bibliotek podczas gry. Referencyjne zdjęcia hali nie są częścią buildu.

Mechanika: chodzenie, 7 pojazdów, 3 misje, ochrona, minimapa, wolna jazda. Host obsługuje powrót do katalogu, ładowanie/timeout/retry, start, fullscreen, zmianę sterowania i pauzę. Gra pauzuje po utracie fokusu, zmianie karty lub wyjściu z fullscreen; wznowienie wymaga działania gracza. Klawiatura: WASD/strzałki, E, Spacja, Shift, P/Escape. Dotyk: wielodotykowy joystick, wsiadanie/akcja i przytrzymanie nitro; pointercancel/lostpointercapture zerują wejście.

## Granica host–gra

Iframe ma sandbox `allow-scripts allow-pointer-lock allow-orientation-lock`, bez `allow-same-origin`, nawigacji top i popupów. CSP na ścieżce zasobów powtarza sandbox i blokuje połączenia sieciowe oraz formularze. CORS `*` obejmuje wyłącznie statyczne zasoby gry, potrzebne modułom z opaque origin; nie obejmuje Auth lub API huba.

Host przyjmuje handshake wyłącznie od `iframe.contentWindow`, z origin `null`, protokołem 1 i zatwierdzonym buildem `magazyn-auto-pp-1`. Po handshake przekazuje osobny MessagePort. Gwiazdka targetOrigin w jednorazowym init jest konieczna dla opaque origin; sprawdzenie źródła, originu i buildu następuje przed transferem portu. Dziecko sprawdza rodzica, jego origin z referrera, wersję i port. Port zamykamy po zmianie profilu, ponownym uruchomieniu lub opuszczeniu strony.

Do gry trafiają tylko nazwa i emoji avatara. Bez e-maila, tokenu sesji, klienta Supabase ani roli. Dozwolone komunikaty z gry: stan, wykryta metoda wejścia, ograniczony checkpoint i błąd. Wyniki/XP i dowolne operacje SDK nie są obsługiwane przez ten port. Nie jest to jeszcze uniwersalna integracja obcych URL ani pełne zamknięcie PP-013.

## Zapis i jego ograniczenia

Host zapisuje wyłącznie `{mission: 0..3, cash: 0..1000000000}` (liczby całkowite), pod własnym kluczem `party-pixels:save:v1:magazyn-auto:<player_id|guest>`. Gra nie wybiera konta ani nazwy klucza. Walidacja także przy odczycie; potwierdzenie zapisu po localStorage.setItem, błąd lub brak potwierdzenia są widoczne. Checkpoint jest zapisywany po misji, zatrzymaniu lub sprzedaży w wolnej jeździe; nie odtwarza bieżącej pozycji w połowie misji.

To zapis lokalny w tej przeglądarce, nie synchronizacja Supabase. Gość i każde konto mają osobny slot. Czyszczenie danych przeglądarki usuwa zapis; różne konta systemowe/przeglądarki/urządzenia nie synchronizują postępu. Ten zapis klienta nie jest dowodem uczciwego wyniku, nie jest rankingiem i nie daje nagród. UI mówi o tym przed startem.

## Walidacja

Build Next.js i 29 testów Node przeszły: kontrakty dotychczasowych dwóch gier, kontrola źródła/originu/wspólnego protokołu, walidacja checkpointów i rozdzielenie kluczy, oryginalne testy mechaniki oraz geometrii 3D (278 meshes, 43741 wierzchołków). Pełna kampania przechodzi test symulacji bez teleportowania pozycji. Wdrożenie dev uruchomiło hosta i moduły gry w sandboxie. Przeglądarka cloud nie udostępnia WebGL (GL_VENDOR i GL_RENDERER: Disabled), więc test rzeczywistego renderowania i sterowania sceną pozostaje do wykonania na fizycznym urządzeniu. Dodatkowy test kontroluje przekazanie błędu grafiki sprzed połączenia i odrzucenie obcego init. Stan wdrożenia jest zapisany w IMPLEMENTATION_PROGRESS.md.

Następne rozszerzenia: test fizycznym telefonem Android/iOS, chmurowe checkpointy z RLS, potwierdzony regulamin wyników tej gry, kolejne zatwierdzone buildy. Zapisy i rankingi dwóch małych gier pozostają oddzielne.

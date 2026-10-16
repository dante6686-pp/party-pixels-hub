# Party Pixels SDK i Scores — kontrakt v0.1

16 października 2026. Specyfikacja do implementacji; nazwy metod i endpointów są projektowane, nie są istniejącym API.

## Minimalny zestaw operacji SDK

- init({ protocolVersion }): uzgodnienie zgodnej wersji z hostem; host rozpoznaje game_id z uruchomionego buildu, nie z dowolnego żądania gry.
- player.get(): player_id, handle, display_name, avatar_url, locale; dla gościa jawny guest context. Brak e-maila, sekretów i ról administracyjnych.
- player.onChange(callback): aktualizacja profilu, wylogowanie lub zakończenie sesji. Po zmianie użytkownika nie można dokończyć poprzedniej próby jako nowe konto.
- sessions.start({ modeId }): serwer nadaje session_id, przypina game_id, game_version, ruleset_version, właściciela, czas i ewentualny seed.
- scores.submit({ sessionId, requestId, result, evidence }): zgłoszenie rezultatu; bez user_id, XP i flagi „verified” wprowadzanej przez grę.
- leaderboards.get({ boardId, cursor }): publiczny, ograniczony widok rankingu i własnej pozycji.
- lobby.getContext(), lobby.onChange(callback), lobby.sendCommand(command): opcjonalne capability dla gry online; szczegóły komend są wersjonowane dla danej gry.
- share.request({ kind, id }): host przygotowuje dozwolony link do gry, wyniku lub zaproszenia. Wysłanie odbywa się dopiero przez działanie użytkownika.

SDK zawiera typy i ujednoliconą obsługę retry, anulowania oraz wygaśnięcia sesji. Gra potrzebuje tylko adaptera platformy; wybór silnika 2D/3D nie zmienia umowy konta i wyników.

## Przebieg zapisu wyniku

1. Hub uwierzytelnia gracza i prosi serwer o rozpoczęcie próby.
2. Serwer zapisuje niezmienne powiązanie gracz–gra–wersja–tryb–reguły. Próba ma termin ważności.
3. Gra wykonuje rozgrywkę i przekazuje rezultat z dowodami wymaganymi przez walidator gry.
4. Serwer sprawdza zalogowanego właściciela, stan próby, format danych, limity i reguły. Wynik punktowy oblicza lub weryfikuje stosownie do poziomu zaufania.
5. Transakcja zapisuje rezultat i aktualizuje najlepszy wynik, statystyki oraz ewentualne XP. Duplikat zwraca ten sam receipt; nie powtarza nagrody.
6. Hub odświeża ranking i profil. Brak odpowiedzi sieciowej jest stanem pending, nie potwierdzeniem sukcesu.

## Model rezultatu

Wspólne pola serwera: submission_id, player_id, game_id, game_version, mode_id, ruleset_version, session_id, match_id (opcjonalnie), metric_key, value, unit, started_at, submitted_at, verification_status, validator_version.

Gra zgłasza dane result/evidence zgodne z własnym schematem. Przykład: quiz przesyła odpowiedzi oraz identyfikator zestawu, a serwer oblicza liczbę poprawnych. Wyścig może raportować czas w milisekundach; jeżeli nie ma niezależnego dowodu, rezultat ma niższy poziom zaufania.

Wynik przechowujemy w jednostce całkowitej, jeśli to możliwe: milliseconds, points, wins. Limity wartości i długości payloadu wynikają z definicji trybu. Nie traktujemy pustej wartości ani NaN jako zera.

## Idempotencja i aktualizacja rekordu

Klucz idempotencji: player_id + request_id. Powtórzenie identycznego payloadu zwraca dotychczasowy rezultat; inna treść pod tym kluczem daje konflikt. Dodatkowe ograniczenie session_id + metric_key dopuszcza tylko jeden finałowy wynik danej metryki z próby.

Zapis wyniku, player_bests i xp_ledger jest atomowy lub korzysta z transakcyjnego outboxa z deduplikacją po stronie odbiorcy. Dwie równoległe odpowiedzi nie mogą przyznać podwójnego XP ani zastąpić lepszego rekordu gorszym.

Odrzuconych zgłoszeń nie kasujemy po cichu; przechowujemy powód i kontrolowany okres historii. Wycofanie zaakceptowanego wyniku powoduje przeliczenie rekordu i wpis korygujący XP. Statystyki dają się odbudować z zaakceptowanych rezultatów.

## Zakresy rankingów

Definicja rankingu określa grę, tryb, metrykę, zgodną wersję reguł, sezon/okno czasowe i dopuszczalny poziom weryfikacji. Nie mieszamy wyników po zmianie trudności bez jawnej polityki zgodności.

Kierunek rankingu: malejąco dla punktów, rosnąco dla czasu. Przykładowa reguła remisu: równy wynik daje wspólne miejsce, a data serwerowa i ID stabilizują kolejność wyświetlania. Ostateczna polityka jest częścią definicji gry i eventu.

Na profilu pokazujemy zestaw rekordów per gra, liczbę ukończonych prób i odznaki. Nie sumujemy sekund z wyścigu z punktami quizu. Wspólne XP to odrębny system nagród serwera, z wersją reguł, dziennymi limitami i zabezpieczeniem przed powtarzalnym naliczaniem tej samej nagrody.

## Weryfikacja i oszustwa

Poziomy: unverified — rezultat deklarowany przez klienta; validated — przeszedł zdefiniowane kontrole; authoritative — wynik wyliczony przez autorytatywny serwer lub odtworzony z weryfikowalnego przebiegu. To różne gwarancje, nie synonimy.

Logowanie, podpis sesji, seed i kontrola zakresu punktów nie dowodzą uczciwej gry. Automatyzacja i zmodyfikowany klient pozostają możliwe. Rankingi rekreacyjne mogą jawnie dopuścić validated; nagrody i rywalizacja wymagają osobno uzgodnionego poziomu oraz walidatora.

Dla każdej gry definiujemy: skąd pochodzi prawda o wyniku, jakie dowody zapisujemy, jak ograniczamy próby i jak odwołujemy wynik. Nie obiecujemy uniwersalnego systemu antycheat dla dowolnej gry w przeglądarce.

## Błędy i zgodność

Wspólne kody: AUTH_REQUIRED, SESSION_EXPIRED, PLAYER_CHANGED, FORBIDDEN, UNSUPPORTED_PROTOCOL, INVALID_RESULT, DUPLICATE_CONFLICT, RATE_LIMITED, NETWORK_ERROR.

Publiczne komunikaty nie ujawniają sekretów walidacji. Pending receipt można odczytać ponownie. Automatyczny retry stosujemy tylko tam, gdzie operacja jest idempotentna. Po wylogowaniu stare zapisy są blokowane.

Każdy build deklaruje wersję protokołu i capabilities. Zmiana łamiąca kontrakt oznacza nową główną wersję SDK; host odmawia uruchomienia niezgodnej gry z czytelnym komunikatem.

## Minimalne kryteria integracji nowej gry

- Gra A i gra B korzystają z tego samego gracza i avatara bez osobnego logowania.
- Konto B nie może odczytać prywatnej sesji A ani zapisać wyniku jako A.
- Retry po zerwaniu połączenia daje jeden rekord i jedną nagrodę.
- Nieprawidłowy origin, nieznane żądanie i niezgodna wersja SDK są odrzucane.
- Przy zmianie konta lub wygaśnięciu sesji gra nie zapisuje punktów na niewłaściwym profilu.
- Punkty i czas mają odrębne rankingi z poprawnym sortowaniem; profil pokazuje oba.
- Gość ma jawnie lokalny rezultat, a interfejs nie udaje zapisu online.
- Dwie gry nie wymagają zmian w module tożsamości i ogólnym mechanizmie Scores; mogą wymagać osobnych walidatorów reguł.

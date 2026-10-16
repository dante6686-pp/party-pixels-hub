# Gry integracyjne i Scores — 2026-10-16

## Implementacja

`packages/party-pixels-sdk` zawiera adapter z `player.get`, `sessions.start`, `scores.submit`. Dwie gry w `apps/hub/app/arcade.tsx` korzystają z tych samych operacji. Host sprawdza bieżące konto przed wywołaniem RPC; gra nie podaje player_id ani flagi zaufania wyniku. Profil i avatar pochodzą z jednego konta.

- `quick-math`, reguły 1: serwer losuje pięć działań, sprawdza tablicę odpowiedzi i wylicza 0–5 punktów. Rekord malejąco, poziom `validated`. To sprawdzenie odpowiedzi, nie zabezpieczenie przed automatyzacją.
- `two-seconds`, reguły 1: klient raportuje bezwzględny błąd od celu 2000 ms, zakres 0–10000. Rekord rosnąco, poziom `unverified`. Serwer nie potwierdza uczciwości pomiaru czasu.

Publiczne rankingi pokazują top 5, wspólne miejsca przy równej wartości oraz stabilną kolejność po player_id. Profil pokazuje rekordy i liczbę zaakceptowanych prób. Brak sumowania jednostek, XP i nagród.

## Dane i uprawnienia

Migracja `game_sessions_scores` jest zastosowana wyłącznie w dev `udmbzcabkkotedprspar`.

Sesje i zgłoszenia pozostają w nieeksponowanym schemacie `pp_private`, z RLS i bez dostępu do tabel dla `anon`/`authenticated`. Uprzywilejowane funkcje w tym schemacie sprawdzają auth.uid(), potwierdzenie e-mail, aktualny ban, profil, właściciela sesji i wygaśnięcie. Ich search_path jest pusty, odwołania do tabel kwalifikowane. Publiczne wrappery działają jako invoker; EXECUTE jest odebrane PUBLIC i anon, przyznane authenticated. Nie używamy service_role w aplikacji.

Każdy zapis blokuje operacje danego gracza w transakcji. Unikalność: player_id + request_id oraz session_id. Ponowiony identyczny payload zwraca ten sam receipt. Inny payload pod tym samym kluczem daje konflikt. Zapis zgłoszenia i rekordu jest atomowy. Najlepszy wynik i liczba prób zmieniają się raz. Start rund ma limit 20/minutę na gracza; sesja wygasa po 10 minutach.

## Weryfikacja i ograniczenia

Test `tests/game-scores.sql` działa na dwóch fikcyjnych użytkownikach w transakcji kończonej rollback. Sprawdza punktację, retry, konflikty, zakresy, poziom zaufania, dwa rekordy jednego gracza, blokadę cudzego zapisu, wygaśnięcie, zakaz bezpośrednich zapisów tabel, prywatność sesji i brak dostępu anonimowego. Test SDK sprawdza publiczną projekcję gracza, brak tokenu w API i stabilny klucz retry.

Security advisors zwróciło dwa komunikaty INFO `rls_enabled_no_policy` dla prywatnych tabel. To celowy deny-by-default: tabele mają zerowy dostęp klienta i są obsługiwane przez kontrolowane funkcje. Nie dodajemy polityki dostępu, by ukryć ten stan.

Brak jeszcze izolacji iframe/origin i protokołu postMessage; adapter działa wyłącznie dla zaufanych gier wewnątrz hubu. Nie jest to ukończony SDK do zewnętrznych buildów. Zmiana konta usuwa rundę z interfejsu; host ponownie sprawdza tożsamość przed zapisem, a serwer odrzuca cudze sesje.

Retry w interfejsie zachowuje requestId i payload do czasu opuszczenia strony. Nie ma trwałej kolejki offline. W pełni ukończony M1 wymaga jeszcze testu rejestracji/poczty i zalogowanej rozgrywki w przeglądarce; test SQL nie zastępuje tej ścieżki. Nie testowano obciążenia i retencji danych; wymagane przed otwartą betą.

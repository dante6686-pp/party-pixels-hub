# Oceny, komentarze, rankingi i powiadomienia — 2026-10-17

## Gracze
- Strony `/game/{id}`: publiczne oceny oraz komentarze (najnowsze na początku, po 20, przycisk starszych). Autorzy prowadzą do publicznych profili.
- Jedna zmienialna ocena 1–5 na konto/grę. Średnia i liczba głosów na stronie oraz kartach katalogu.
- Publikacja wymaga zalogowanego konta, potwierdzonego e-maila i profilu. Komentarz: 1–1000 znaków, zwykły tekst. Maks. 3/min i 30/dobę. Retry UUID zachowuje dokładnie tę samą treść i nie powiela komentarza.
- Własny komentarz można usunąć po potwierdzeniu (soft delete). Cudzy można zgłosić: powód + snapshot na serwerze, 10 zgłoszeń/dobę, UUID retry. Kolejka `pp_private.game_comment_reports`, ręczna obsługa przez operatora w Supabase; bez panelu admina i automatycznych kar.
- Zalogowany gracz nie widzi komentarzy kont z obustronną blokadą. Komentarze są publiczne i mogą być widoczne po wylogowaniu — blokada nie jest ochroną prywatności publicznych treści.
- Ranking top 20 i własny rekord/miejsce/próby działają dla quick-math i two-seconds. Remisy = miejsce 1 + liczba lepszych wyników. Ranking korzysta wyłącznie z istniejących `player_bests`, ruleset 1. Quick-math malejąco (odpowiedzi sprawdzone), two-seconds rosnąco (czas przeglądarki niezweryfikowany). MAGAZYN AUTO ma komunikat o braku punktacji, bez fikcyjnego rankingu.
- Dzwonek po zalogowaniu i zapisaniu profilu: aktywne przychodzące zaproszenia i rozmowy z nieprzeczytanymi wiadomościami. Licznik liczy zaproszenia + rozmowy, nie liczbę pojedynczych wiadomości. Linki prowadzą do Znajomych lub konkretnej rozmowy.
- Panel powiadomień odświeża się po otwarciu, co 15 s podczas widoczności i po powrocie do okna; liczniki korzystają z istniejących odświeżeń znajomych/wiadomości. Otwarcie dzwonka nie oznacza odczytu wiadomości. Brak push/e-mail, historii zakończonych powiadomień i powiadomień o odpowiedziach na komentarze (brak jeszcze wątków odpowiedzi).

## Kontrakty
- `pp_game_feedback(p_game?,p_before?)`: brak gry zwraca podsumowania ocen katalogu; konkretna gra zwraca rating `{average,votes,mine}` i komentarze. Kursor to tekstowe bigint ID ostatniego komentarza. Publiczny odczyt, osobista ocena wyłącznie dla `auth.uid()`.
- `pp_game_feedback_write(p_owner,p_game,p_action,...)`: rate/comment/remove/report. Walidacja świeżego użytkownika w DB, ownership, limity pod blokadą per użytkownik; bez bezpośrednich uprawnień tabel dla klienta.
- `pp_game_ranking(p_game)`: publiczny SECURITY INVOKER, czyta istniejące RLS `player_bests` i `profiles`; `mine` pochodzi z `auth.uid()`.
- Prywatne tabele: game_ratings, game_comments, game_comment_reports. RLS deny default, brak grants do tabel/sekwencji. Uprzywilejowane funkcje tylko w nieeksponowanym pp_private, jawny pusty search_path, odrębne publiczne wrappery SECURITY INVOKER. Anon ma usage pp_private wyłącznie dla jawnie przyznanej funkcji publicznego odczytu, bez prawa do pozostałych operacji.
- Żadnych zmian w starym hubie, zapisie gier ani zaufaniu do wyników. Brak ujawniania auth tokenów lub e-maili.

## Weryfikacja
`tests/sql/game-community.sql` uruchamiany transakcyjnie na tymczasowych fixture accounts z ROLLBACK: ownership, limity, retry, public read/anon write denial, blokady, soft delete, snapshot zgłoszenia, kursor, ranking remisy/kierunek/własne miejsce, wejściowe RPC powiadomień i mark-read. Nie publikuje komentarzy ani wiadomości do rzeczywistych użytkowników.

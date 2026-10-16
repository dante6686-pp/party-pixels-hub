# Party Pixels Hub 2.0 — architektura v0.1

16 października 2026. Propozycja techniczna; nie opis wdrożonego systemu.

## Usługi i odpowiedzialności

GitHub: kod, wersjonowane kontrakty, migracje bazy, testy, Issues i pull requesty. Postęp wykonania zadania potwierdzamy dowodem: zmianą kodu, wynikiem testu lub adresem wdrożenia.

Vercel: hub i jego API, środowiska Preview i Production. Proponowany frontend: Next.js z TypeScript. Dokładne stabilne wersje wybieramy przy inicjalizacji i zapisujemy z lockfile. Nie dobieramy dodatkowego frameworka agentowego do samego hubu.

Supabase: Auth, PostgreSQL, Storage na avatary oraz Realtime dla czatu, obecności i powiadomień lobby. Baza przechowuje trwały stan; transmisja Realtime informuje o jego zmianach.

Google Drive: dokument produktu, bieżący stan projektu, decyzje, briefy gier i praca pięciu GPT. Nie jest bazą danych graczy ani miejscem przechowywania haseł czy kluczy.

Podział wiedzy: Drive odpowiada na „co i dlaczego robimy”; GitHub na „co jest zaimplementowane”; Vercel na „co jest wdrożone”; Supabase na „jakie dane posiada aplikacja”. Podsumowania wskazują źródło, datę i dowód. Nie utrzymujemy dwóch niezależnych backlogów z konkurującymi statusami.

## Granica zaufania między hubem a grami

Proponujemy hostowanie gier w iframe na odrębnym originie od hubu. Hub obsługuje zalogowaną sesję. Gra dostaje jedynie publiczne pola gracza i udostępnione operacje SDK, nie otrzymuje sesji Supabase, refresh tokenu ani klucza uprzywilejowanego.

Komunikacja iframe–hub: wersjonowany protokół postMessage/MessageChannel. Sprawdzamy dokładny origin, event.source, typ i rozmiar wiadomości oraz nonce uzgodniony przy inicjalizacji. Nie używamy wildcard jako docelowego originu. Zmiana adresu gry unieważnia wcześniejszy kanał. Uprawnienia iframe są minimalne; sam atrybut sandbox nie zastępuje sprawdzania originu.

Host wiąże uruchomioną grę z wpisem katalogu i zatwierdzonym buildem. Każda operacja serwera ponownie weryfikuje tożsamość, uprawnienia i stan sesji gry. Parametry odebrane od JavaScript są niezaufane.

Osobny origin i proxy hosta są projektem do implementacji. Dla gry uruchamianej poza hubem potrzebny będzie osobny, krótko żyjący mechanizm nadania dostępu ograniczonego do gry i sesji; samo localStorage z hubu nie zapewnia współdzielenia logowania między domenami.

## Konto użytkownika

Stałym kluczem jest UUID użytkownika Supabase Auth. Nazwa, e-mail i identyfikator Google/Facebooka nie są kluczem wyniku. Jeden użytkownik może mieć kilka tożsamości logowania.

Publiczny profil: player_id, unikalny handle, wyświetlana nazwa, avatar i opcjonalny opis. Prywatne ustawienia obejmują widoczność, powiadomienia i preferencje kontaktu. Adres e-mail pozostaje w systemie uwierzytelnienia; gry i publiczne profile go nie dostają.

Logowanie: e-mail i hasło, weryfikacja adresu, reset hasła, Google, Facebook, wylogowanie i obsługa wygasłej sesji. Łączenie kont korzysta z mechanizmów Supabase i dowodu kontroli nad tożsamością. Nie łączymy rekordów na podstawie e-maila przesłanego przez przeglądarkę.

Google wymaga konfiguracji klienta OAuth, a Facebook aplikacji deweloperskiej i jej danych w Supabase. Adresy callback i dozwolone przekierowania konfigurujemy dla właściwego środowiska. Klucze trafiają do konfiguracji usług, nie do dokumentów czy kodu klienta. Uruchomienie produkcyjne sprawdzamy kontem spoza grona testerów aplikacji.

Źródła: https://supabase.com/docs/guides/auth/social-login/auth-google ; https://supabase.com/docs/guides/auth/social-login/auth-facebook ; https://supabase.com/docs/guides/auth/auth-identity-linking

## Model danych — plan logiczny

- profiles: 1:1 z auth.users; publiczne pola gracza. user_settings: prywatne ustawienia. Relacja usuwa lub anonimizuje dane według później przyjętej polityki.
- games i game_versions: katalog, status publikacji, obsługiwane urządzenia, liczba graczy, dozwolony origin/build, wersja SDK i reguł gry.
- game_modes i leaderboard_definitions: metric_key, jednostka, kierunek sortowania, reguła najlepszego wyniku, sezon oraz poziom weryfikacji wymagany przez ranking.
- game_sessions: właściciel, gra, wersja, tryb, start i wygaśnięcie ustalone na serwerze; opcjonalny match_id oraz server seed.
- score_submissions: niezmienny rezultat próby, dowód lub odwołanie do niego, status weryfikacji, reguła walidatora i identyfikator żądania.
- player_bests: wyliczony najlepszy rezultat w zakresie rankingu; aktualizowany atomowo. player_game_stats: odbudowywalna agregacja statystyk.
- xp_ledger: dodatnie i ujemne wpisy nagród z source_id i reward_rule_version; unikalność zapobiega podwójnej wypłacie XP. Sumę wylicza serwer.
- favorites: unikalne player_id + game_id. game_lists i game_list_items: własność, widoczność private/public i kolejność.
- comments: gra, autor, treść, daty i stan moderacji. reports i moderation_actions: zgłoszenia oraz historia rozstrzygnięć.
- friendships i user_blocks: potwierdzone kontakty, blokady i ustawienia wiadomości.
- conversations, conversation_members i messages: czat globalny, prywatny i pokojowy; każda rozmowa ma jawną politykę dostępu.
- lobbies, lobby_members, invitations i matches: dołączenie, gotowość, limit graczy, wygasające zaproszenia, stan meczu i rozłączenia.
- events, event_entries i event_game_rules: okno czasowe, udział, przypięte gry i wersje zasad oraz warunki ukończenia.
- notifications: zdarzenia dla konkretnego odbiorcy, odczyt i ustawienia dostarczania.

To lista docelowych bytów, nie polecenie utworzenia wszystkich tabel od razu. M1 wdraża tylko konto, katalog testowy, sesję, wynik i agregację; kolejne migracje realizują następne etapy.

## Dostęp do danych

RLS obejmuje wszystkie wystawione tabele; uprawnienia GRANT i polityki RLS projektujemy razem. Sam fakt bycia zalogowanym nie daje dostępu do cudzych rekordów. Prywatna lista należy do właściciela; prywatny czat wymaga członkostwa; zapis wyniku jest operacją serwera.

Użytkownik edytuje tylko dozwolone pola własnego profilu. Nie nadaje sobie roli administratora, nie zmienia XP i nie akceptuje własnego wyniku. Uprawnienia nie mogą pochodzić z edytowalnego user_metadata. Uprzywilejowane klucze pozostają wyłącznie na serwerze.

Bany i usuwanie kont wymagają sprawdzenia aktualnego stanu konta przy wrażliwych operacjach, a nie tylko odczytu starego JWT. Publiczne widoki wyników muszą respektować RLS lub zwracać wyłącznie celowo udostępnione dane.

## Czat i multiplayer

Wiadomości zapisujemy w bazie, a Realtime rozsyła zmiany. Prywatne kanały wymagają własnej autoryzacji członkostwa; nazwa pokoju nie jest zabezpieczeniem. Sprawdzamy dostęp również do historii wiadomości i po wyjściu z pokoju. Blokada użytkownika wpływa na nowe zaproszenia i możliwość wysyłania prywatnych wiadomości.

Zaproszenie ma typ, odbiorcę lub losowy token, termin ważności oraz limit użyć. Dołączenie i kontrola liczby miejsc są atomowe. Zapisujemy identyfikator meczu i wynik graczy po stronie autorytatywnej logiki, nie według komunikatu „wygrałem” od hosta w przeglądarce.

Realtime jest kanałem komunikacji, nie pełnym silnikiem multiplayer ani walidatorem zasad. Dla pierwszej gry turowej/prostej party game proponujemy autorytatywne komendy serwera i zapis stanu z numerem wersji. Dla szybkiej gry akcji osobno sprawdzimy opóźnienia i potrzebę procesu serwera gry. Rozłączenie hosta nie może usuwać trwałej tożsamości gracza ani wyników.

Źródło konfiguracji kanałów: https://supabase.com/docs/guides/realtime/authorization

## Eventy, moderacja i eksploatacja

Event wiąże konkretne wersje reguł i definicje rankingów z czasem rozpoczęcia/zakończenia w UTC. Interfejs pokazuje czas lokalny. Wyniki po zakończeniu, remisy i rozłączenia mają opisane reguły. Nie wprowadzamy nagród za niezweryfikowane wyniki klienta.

Przed otwartą betą: zgłaszanie i blokowanie, ograniczenia częstotliwości wiadomości/komentarzy/wyników, widok moderatora, log działań, bezpieczny upload avatarów i brak interpretowania HTML w treści użytkownika. Grupa wiekowa, retencja i zasady prywatności są decyzjami produktu do zamknięcia przed publicznym uruchomieniem.

Środowiska developerskie i preview nie korzystają z danych produkcyjnych graczy. Migracje przechodzą przegląd, test dostępu na dwóch kontach i plan odtworzenia danych. Monitorujemy błędy logowania, zapisów wyników, opóźnienia, liczbę wiadomości Realtime i zużycie transferu. Dobór dodatkowych dostawców oraz limitów kosztów pozostaje otwarty.

Vercel opisuje środowiska tutaj: https://vercel.com/docs/deployments/environments

## Proponowana struktura nowej implementacji

- apps/hub — strony, panel gracza i API platformy.
- apps/game-host — osobny origin dla buildów gier.
- games/<game-id> — kod i zasoby poszczególnych gier.
- packages/party-pixels-sdk — adapter dla gier, protokół hosta, obsługa błędów.
- packages/contracts — wspólne typy i schematy walidacji.
- packages/ui — współdzielone komponenty interfejsu.
- supabase/migrations — kolejne zmiany bazy; generowane właściwym CLI.
- tests/integration — konto, RLS, SDK, wyniki i multiplayer.
- docs — zatwierdzone kontrakty techniczne i decyzje architektury.

To proponowane monorepo, nie utworzone foldery działającej aplikacji.

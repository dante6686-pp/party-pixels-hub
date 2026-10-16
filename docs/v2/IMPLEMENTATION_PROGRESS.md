# Fundament implementacji — 2026-10-16

Gałąź: `feat/v2-platform-foundation`, oparta na dokumentacji `docs/party-pixels-v2-foundation`.

## Wykonane

- Workspace npm i pierwszy moduł TypeScript `@party-pixels/contracts`.
- Publiczna projekcja profilu bez pól logowania.
- Walidacja podstawowego zgłoszenia wyniku: tożsamość z kontekstu serwera, właściciel próby, wygaśnięcie, identyfikatory, dozwolone pola i całkowite wartości w zakresie gry.
- Wspólna reguła najlepszego wyniku: punkty malejąco, czas rosnąco.
- Testy uruchamiane przez `npm test` na Node 24, bez dodatkowych zależności.

## Granica tego etapu

To pierwszy moduł kodu, nie działający hub ani kompletny SDK. Brak interfejsu, Auth, bazy developerskiej, API, trwałego zapisu, transakcji, idempotencji, kanału iframe i wdrożenia. Wynik klienta pozostaje `unverified`; kontrola zakresu nie potwierdza uczciwej gry.

## Kolejność dalszych prac

1. Oddzielny Supabase dev i Preview Vercel dla nowej aplikacji. Zweryfikować dostępność oraz koszt przed utworzeniem płatnych zasobów. Obecna baza zawiera dane i nie służy do testów nowego schematu.
2. Hub Next.js/TypeScript, sesja Auth, rejestracja e-mail i profil. Google/Meta wymagają konfiguracji OAuth.
3. Serwerowe sesje i transakcyjny zapis wyników z RLS, deduplikacją i testami na dwóch kontach.
4. Kanał SDK na oddzielnym originie i dwie małe gry integracyjne.

Wybrano osobną gałąź w istniejącym repo jako odwracalną lokalizację pracy. Nie jest to zatwierdzenie zmian w produkcji ani dodatkowego budżetu. Osobny projekt Vercel musi jawnie wskazywać nowy katalog aplikacji. Nie zmieniać konfiguracji istniejącego wdrożenia przez przypadkowe dodanie konfiguracji frameworka w katalogu głównym.

## Aktualizacja: konto i profil

Przygotowano `apps/hub`: Next.js 16.4.2, React 19.3.1, klient Supabase 2.118.0. Kod obsługuje rejestrację, logowanie, wylogowanie, reset hasła i zapis profilu z nickiem, nazwą oraz jednym z czterech avatarów. Sesja działa w przeglądarce; RLS zabezpiecza API danych.

Osobny Supabase dev: `udmbzcabkkotedprspar`. Migracja `player_profiles` zastosowana. Test SQL w transakcji zakończonej rollback potwierdził własny zapis, odrzucenie cudzej edycji, unikalność nicka, ochronę właściciela, publiczny odczyt i brak zapisu anonimowego. Security advisors: brak uwag.

`npm run build` i 7 dotychczasowych testów przeszło. Nie przeprowadzono jeszcze pełnej rejestracji z pocztą i testu interfejsu w przeglądarce. Potwierdzenia i reset wymagają właściwych adresów Auth URL Configuration; Google/Facebook i upload zdjęć pozostają poza zakresem tej zmiany.

Próba utworzenia osobnego Preview Vercel `party-pixels-hub-v2-dev` została odrzucona przez automatyczną kontrolę: wymagana wyraźna zgoda na przesłanie źródeł i konfiguracji do hostingu. Brak potwierdzonego nowego deploymentu. Do budowania potrzebne są jedynie publiczny URL i publishable key nowego Supabase, bez service role.

## Aktualizacja: wdrożenie i gry integracyjne

Patryk zatwierdził publikację i sam skonfigurował osobny projekt Vercel po błędzie 403 konektora. Wersja konta d0600cf została wdrożona: https://party-pixels-hub-v2-dev.vercel.app/ . HTTP 200 i formularze potwierdzono w przeglądarce. To adres developerski, choć środowisko Vercel nazywa się Production; stary hub pozostaje osobnym projektem.

Dodano następnie wspólny adapter SDK, gry `quick-math` i `two-seconds`, rekordy profilu oraz rankingi top 5. Migracja dev i testy bazy przeszły; szczegóły i ograniczenia w `GAMES_M1.md`. Pełny test konta z pocztą i zalogowanej rozgrywki nadal jest otwarty. Brak izolacji gier na osobnym originie. Nie oznaczać całego M1 jako ukończonego.

## 2026-10-16 — odtwarzacz i pierwsza gra 3D

Dodano katalog i `/play/magazyn-auto`: widok aplikacji, żądanie fullscreen z przycisku Graj, fallback viewport, dotyk/klawiatura/Auto, responsywny canvas, safe-area, układ telefonu poziomo, pauza i powrót do huba. Przeniesiono kod MAGAZYN AUTO z potwierdzonego źródła Sites, bez zmian w oryginalnym opublikowanym projekcie. Iframe ma opaque origin, kontrolowany handshake i ograniczony MessagePort; do gry nie trafiają tokeny konta. Checkpointy lokalne, rozdzielone profile/gość, z potwierdzeniem zapisu; brak synchronizacji chmurowej i rankingu tej gry. Szczegóły: GAME_PLAYER.md.

Weryfikacja przed wdrożeniem: 28 testów Node i produkcyjny build Next przeszły. Podgląd wewnętrzny renderuje stronę, ale nie hydratuje kodu klienta — kontrola przeglądarkowa rozgrywki wymaga wdrożenia dev. Nie oznaczamy jeszcze całego M1 ani testu fizycznego telefonu jako zaliczonych.

Wdrożenie pierwszego buildu: commit GitHub 9e7668cadfe1cccc8f6f51662d28d01aa72cb298, Vercel dpl_41aUmaWHtoZMkkf9dEYAFe3EHvTs READY z aliasem party-pixels-hub-v2-dev.vercel.app. Przeglądarka potwierdziła start hosta, gościa, iframe i pobranie modułów 3D. Jej GPU/WebGL jest wyłączone (GL_VENDOR / GL_RENDERER Disabled), więc nie potwierdzono renderowania ani rzeczywistego ruchu. Poprawiono propagowanie wczesnego błędu grafiki do hosta i dodano test; końcowy build i 29 testów przechodzą. Fizyczny Android/iOS i PC, wielodotyk i ponowne wczytanie checkpointu konta pozostają do testu.

## 2026-10-16 — checkpointy na koncie i czytelność kampanii

Patryk zaliczył wcześniejszy test telefonu („wszystko działa elegancko”). Następnie zgłosił powtarzalne dostawy; kod i test pełnej kampanii potwierdzają 3 misje oraz pętlę dostaw po ukończeniu. Dodano oznaczenia misji/wolnej jazdy, przegląd 3 etapów, informację o następnym celu i świadomy start nowej kampanii.

Zastosowano migrację 20261016170318_game_checkpoints w izolowanym Supabase dev. Prywatny zapis konta, kontrola auth.uid i oczekiwanego właściciela, CAS/revision, idempotencja, lokalna kolejka pending, wykrywanie konfliktu między urządzeniami, retry i bezpieczny import lokalnego slotu konta. Gość pozostaje lokalny. Brak nagród/rankingu na podstawie checkpointu.

37 testów Node, test SQL z rollback i build przeszły. Testy dwóch instancji kontrolera oraz odczytu po drugim wywołaniu RPC potwierdzają przenośność zapisu; rzeczywisty telefon→PC po nowym wdrożeniu wymaga jeszcze potwierdzenia. Advisors: trzy INFO o celowym deny-by-default prywatnych tabel oraz WARN auth_leaked_password_protection (ustawienie Auth poza zakresem tej migracji; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection ).

## 2026-10-16 — Friends MVP
- Patryk confirmed checkpoint synchronization works, then explicitly moved focus back to the hub.
- Added signed-in Friends panel: nickname prefix search (3–20 chars, 20 results), incoming/outgoing invitations, accept/decline/cancel, mutual friends, removal with confirmation.
- Private friendships table, RLS deny-by-default/no direct client grants; authenticated checked RPC with expected owner, confirmed/unbanned account, immutable pair and generation UUID. Only recipient accepts/declines and sender cancels. Pair/user advisory locks serialize transitions; no automatic acceptance for reverse invitations.
- Limits: 20 outgoing pending, 200 active relationships including pending per player; 24h cooldown after close. Closed records remain private to enforce cooldown. No email, chat messages or invitations sent to real users during testing.
- UI polls every 30s while visible and on focus; retries manual, account-keyed component, outdated responses ignored, 12s request timeout. No presence or multiplayer invitations in this milestone.
- Production build/TypeScript and existing 37 Node tests passed. tests/friendships.sql passed against dev in rollback: lifecycle, duplicate/reverse send, private lists, owner/recipient enforcement, stale UUID, self/wildcard rejection, cooldown, anon/direct table denial. Real two-account browser test remains for users.
- Advisors: intentional private RLS-without-policy INFO; existing leaked-password protection WARN remains outside this change. Remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

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

## 2026-10-16 — Immediate retry after cancelling an invitation
- Fixed excessive 24h cooldown: sender cancellation now permits immediate resend. Decline/removal still enforce cooldown.
- Added closed_reason without guessing historical reasons. Corrected only the single closed test relationship involving dante6686, based on Patryk's report that he cancelled it. No invitation sent and no friendship accepted on his behalf.
- SQL lifecycle suite passed with immediate cancel/resend, new request generation, rejection of old cancel, and preserved decline/removal cooldown.

## 2026-10-16 — Private messages MVP
- Patryk confirmed invitations work on his two accounts, then authorized private messages.
- Friends now have a Napisz action. Inbox shows up to 200 most recent conversations and unread indicators. Thread supports plain text (1–2000 characters), timestamps, own/peer bubbles, and older history in pages of 50.
- New messages poll every 5 seconds while visible, inbox every 10 seconds; focus refresh. Read markers advance only for the selected focused/visible conversation at its bottom, and only through the latest fetched message.
- Sending requires current accepted friendship; former friends retain their shared history but cannot send. No automatic sends to real users were performed.
- Private tables direct_messages and direct_message_reads with RLS and no direct client grants. Controlled RPC checks auth.uid against expected owner and confirmed/unbanned user; pair-specific participant filtering, locks shared with friendship mutations, per-sender 30/min limit. Sender/request UUID gives idempotent retries and rejects changed payload.
- Failed send keeps immutable payload/UUID in the open thread for explicit retry. Draft/retry state is in memory only; changing conversations or reloading discards it. No attachments, online presence, push notifications or end-to-end encryption are claimed.
- Production build/TypeScript and existing 37 Node tests passed. New SQL rollback suite tested history privacy (third account), spoofed owner/read marker, direct/anonymous access denial, missing friendship, removal, length, retry/conflict, unread bounds, pagination and rate limit. Pagination test caught text-sort alias bug, fixed in a follow-up migration using numeric qualified message id.
- Advisors: six intentional private-table deny-by-default INFOs and existing leaked-password protection WARN. https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Full signed-in browser test of new messaging remains user verification; cloud browser has no signed-in account.

## 2026-10-16 — Hub application UI
- Patryk confirmed private messages work and selected navigation/UI as next priority.
- Four hash-addressed views: Odkrywaj, Znajomi, Wiadomości, Twój profil. Desktop sidebar, mobile bottom bar with safe-area padding, sticky account header, redesigned home/featured game/cards/social/profile surfaces.
- Incoming-invite and unread-conversation counters reuse existing checked APIs; reset on account change. Napisz switches directly to Messages. View state works with back/forward and reload.
- Components retain in-memory drafts when moving between hub views. Hidden message threads stop polling and never mark content read; inbox counters remain refreshed. Account recovery navigates to Profile, auth fragments are not parsed as application routes.
- Guest social views guide to login/profile; native forms, skip link, focus outlines, reduced-motion preference and 44px controls retained.
- No database/API changes. Production build/TypeScript and existing 37 Node tests passed. Deployed browser navigation and visual review follow; authenticated/mobile-device review remains user verification.

## 2026-10-16 — Account game library
- Patryk confirmed the redesigned hub works on his phone and authorized the next step: favorites, recently played and campaign continuation.
- Added Twoja biblioteka to Odkrywaj for signed-in profiles, with filters All/Favorites/Recently played, stars for the three existing games, dates and an account checkpoint Continue card for MAGAZYN AUTO.
- Continue opens the existing game host, which loads the checkpoint and presents its continuation button; it does not auto-start gameplay/fullscreen. Short games link to their actual playable cards and start a fresh round.
- Recents are recorded when a native round starts successfully or the 3D host's launch button is pressed, not merely on catalog clicks. Tracking failure does not prevent gameplay. History starts from deployment, with no backfill from old sessions.
- Private player_library keyed by player/game, RLS deny-default/no direct client grants, checked pp_library RPC requiring expected auth owner, confirmed/unbanned account and profile. Allowlist of three game ids; favorite updates set explicit booleans (safe retry), played updates preserve favorite and monotonic server timestamp. Get returns only that account's preferences and checkpoint mission/date.
- Library refreshes on games-view activation, browser focus, successful local play tracking and manual refresh. No local-storage account data or guest cloud library.
- Build/TypeScript and existing 37 Node tests passed. SQL rollback suite passed: favorite idempotency, recent/favorite independence, all catalog ids, invalid operations, checkpoint metadata, third-account read/write protection, anonymous/direct table denial. Advisors: 7 intentional private RLS-without-policy INFO, pre-existing leaked password WARN outside scope. https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Signed-in browser/two-device UI test remains user confirmation; current cloud browser is logged out.

## 2026-10-16 — Personal library placement and portrait-first games
- Patryk corrected scope: personal library must contain favorites and recently played only, live in a separate navigation view and on Profile, and never be the full catalog or appear on Discover.
- Added Biblioteka as the fifth responsive navigation entry. One shared library component appears only in Library/Profile. Removed All filter; defaults to favorites. Empty states link to Discover. Continue requires a saved campaign that also belongs to favorites/recents.
- Discover retains full catalog and now hosts favorite controls on 3D and native game cards. Changes synchronize with the account library through the existing checked API. Native library links switch to Discover and scroll to the playable card.
- MAGAZYN AUTO no longer requests landscape orientation or asks users to rotate. Removed orientation-lock capability from frame/CSP. Phone portrait camera uses wider FOV and steeper view; portrait HUD places objective at top, compact status/minimap below, thumb controls at bottom, adapted short portrait layout and safe areas.
- Updated GAME_PLAYER and shared product/designer guidance: portrait is the default priority for new mobile games; PC and optional landscape layouts remain supported.
- No database changes. Build/TypeScript and 37 tests passed, including full campaign/geometry/frame protocol tests. GPU gameplay and actual phone layout remain user verification because cloud WebGL is disabled.

## 2026-10-16 — Public player profiles and explicit editing
- Own Profile defaults to a read-only player page using the same ProfileCard as public /u/[handle] routes. Banner, avatar, display name, @handle and bio are visible; only owner has Edit button.
- Edytuj profil opens form, save returns to preview, cancel discards avatar/form changes. Initial profile creation and password recovery retain their forms. Added loading/error handling before owner profile edit to prevent replacing an unread profile.
- Bio limit 280 characters; four curated CSS banner themes (orbit/arcade/forest/sunset); existing four emoji avatars. No image upload/storage in this milestone.
- Public route reads explicit public fields only, with missing/error/retry states. Private library remains only in signed-in owner's Profile/Library views; public pages do not fetch it or private chats.
- Avatar/name links now open profiles in friend lists/search/invitations, inbox list, thread header, incoming message author and score rankings. Inbox identity link and Open conversation button are separate controls, no nested links/buttons.
- Migration adds bio/banner_key with constraints and column-specific authenticated insert/update grants under existing owner RLS. Existing profiles get empty bio/orbit banner.
- SQL rollback test passed: owner edits, cross-account mutation denied, bio length/banner allowlist, public anonymous read and anonymous write denial. No fixture accounts remain. Existing 37 Node tests passed.
- Final clean production build/TypeScript passed. A malformed local Turbopack cache was moved aside and rebuilt; no source work discarded. Advisors unchanged: private RLS deny-by-default INFO and prior leaked-password protection WARN. https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Browser public page and authenticated owner edit flow verification follow; cloud browser does not have an authenticated account.

## 2026-10-16 — Profile contact/safety and Discover catalog
- Patryk authorized both suggested directions together: profile contact/block/report controls, plus search/filter/detail pages for games.
- Public profile actions resolve the viewer account and checked friendship: send/accept/decline/cancel, Napisz deep-link into the actual conversation, block with confirmation, unblock, report. Own profile has a private blocked-player list with unblock.
- Blocking is bidirectional for new contact: friend sends/accepts denied, friendship closed, blocked users removed from friend searches/lists and inbox/unread counts. Existing shared history can be read, sending disabled. Public profiles remain public (blocking is contact control, not removal of anonymous profile access). Unblock restores no friendship; a new invitation is possible immediately.
- Migration player_safety adds private blocks/reports, RLS deny-default/no client table grants. Checked pp_safety enforces owner, confirmed/unbanned profile, same user/pair locks as friendship and messages. Updated friendship/message APIs enforce blocks on server.
- Reports support profile and received-message targets, reason + up to 1000-char detail, request UUID retry, rate 10/day. Server snapshots selected public profile fields or the exact received message, forbids third-party message reports and self reports. No report content exposed to targets. Queue is for manual review through Supabase; no moderator UI or automated sanctions in this milestone.
- Discover now lists all three existing games with client-side title/description search and combined category, 2D/3D, solo/multiplayer filters. Multiplayer correctly has no results yet. Personal library still contains only favorites/recents, separate from Discover.
- Static /game/[id] detail pages explain controls, portrait/PC support, account/save/verification requirements and link to actual playable game. Library cards link to detail pages; campaign Continue still opens the host directly.
- Verification: production build/TypeScript, 38 Node tests including combined catalog filters passed. New SQL rollback suite passed block lifecycle, both-direction contact denial, list/search/inbox filtering, report privacy, retries, bounds, rate limits and ownership. Re-ran prior friend and direct-message SQL lifecycle suites successfully after API changes. Advisors only expected private-table INFOs plus existing leaked-password protection WARN: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
- No messages, invitations, blocks or reports were created against real users during QA. Public browser catalog checks follow; signed-in profile/report/block UI still requires user confirmation.

## 2026-10-16 — Compact discovery and working native play routes
- Search/filter panel starts collapsed behind a compact search trigger and filter icon. Either opens/closes full controls; catalog remains visible below. Active filters retain state and show an indicator.
- Removed old embedded first-play/test section entirely from Home. Native games now have dedicated /play/quick-math and /play/two-seconds routes with account/profile gating, their own single-game UI, actual start/round, result/retry and ranking, hub return and optional fullscreen.
- Fixed catalog detail Graj links to dedicated play routes. Legacy #arcade-* links redirect to the correct play page. Personal library metadata updated.
- Two-seconds round is abandoned if the page hides while its clock runs, avoiding a misleading background interval. Existing server session/score contracts unchanged.
- Production build/TypeScript passed; existing 38 tests passed, plus a new route regression test confirming every catalog play URL is /play/<game-id>. Browser collapsed/expanded filters and detail-to-play navigation follow; authenticated rounds remain user verification.

# Backlog wdrożenia 2.0 — propozycja v0.1

Data: 16 października 2026. Statusy odnoszą się do nowej implementacji 2.0. Ten dokument jest początkowym planem; po uruchomieniu Issues to one przejmują statusy wykonania, a dokument pozostaje mapą etapów.

## M0 — rozpoczęcie

PP-001 — Fundamenty produktu, architektura, kontrakt SDK i podział ról GPT. Kryterium: komplet dokumentów ma wspólną wersję, aktualny stan i odnośniki do źródeł. Stan: specyfikacja przygotowana; implementacja jeszcze nie rozpoczęta.

PP-002 — Wybór miejsca nowej implementacji i izolacji danych. Kryterium: ustalone repo/gałąź, dev Supabase, Preview Vercel i adresy OAuth, bez niezamierzonej zamiany obecnego hubu. Stan: do ustalenia.

PP-003 — Uruchomienie menadżera i asystentki. Kryterium: każda rola odczytuje ten sam aktualny status; menadżer zapisuje próbny wpis, asystentka odczytuje go w nowej sesji z datą i źródłem. Stan: do zrobienia.

## M1 — konto i wynik w dwóch grach

PP-010 — Nowy szkielet hubu i środowisko preview. Kryterium: poprawny build, konfiguracja bez sekretów w kodzie, adres do testu na telefonie. Zależność: PP-002.

PP-011 — E-mail, hasło, potwierdzenie adresu, reset hasła i Google. Kryterium: pełna ścieżka nowego konta, wylogowanie i ponowne logowanie; źle podane lub wygasłe dane dają poprawny komunikat. Zależność: PP-010 oraz konfiguracja dostawcy.

PP-012 — Profil gracza i avatar. Kryterium: nick jest unikalny, avatar poprawnie walidowany, użytkownik edytuje własne dozwolone dane; drugie konto nie może ich nadpisać. Zależność: PP-011.

PP-013 — SDK i bezpieczny host gier. Kryterium: identyfikacja gry po zatwierdzonym buildzie, kontrola originu, wersji i zmian konta; gra nie otrzymuje tokenu całego konta. Zależność: PP-012.

PP-014 — Sesje, zgłoszenia wyników i ranking. Kryterium: serwer wyprowadza gracza z sesji, odrzuca cudze próby, kontroluje wynik, obsługuje retry bez duplikatów i sortuje leaderboard według definicji. Zależność: PP-013.

PP-015 — Dwie techniczne gry testowe oraz profil z oboma rekordami. Kryterium: test integracyjny z GAME_PLATFORM_CONTRACT.md przechodzi; dwie gry korzystają z tego samego SDK bez przebudowy kont. Zależność: PP-014. Dobór gier jest otwarty; nie oznacza automatycznie migracji starego katalogu.

## M2 — katalog i społeczność

PP-020 — Facebook oraz łączenie metod logowania. Kryterium: użytkownik zachowuje ten sam player_id; konta z różnymi adresami łączy tylko po potwierdzeniu kontroli; test kontem spoza zespołu deweloperskiego. Zależność: konfiguracja Google/Meta i PP-011.

PP-021 — Katalog, wyszukiwanie, strona gry i udostępnianie linku. Kryterium: gra ma opis, wymagania, sterowanie, ranking i działający adres; widoki są dostępne na telefonie.

PP-022 — Ulubione i własne listy. Kryterium: zapis jest trwały, powtórzenie nie tworzy duplikatu, prywatnej listy nie widzi drugie konto; świadomie udostępniona lista ma działający link.

PP-023 — Komentarze, zgłoszenia i moderacja. Kryterium: autor może edytować dozwoloną treść, cudze komentarze są chronione, zgłoszenie trafia do panelu, limity działają również przy bezpośrednim wywołaniu API.

## M3 — wspólna gra i rozmowy

PP-030 — Kontakty, blokady, zaproszenia i powiadomienia. Kryterium: zaakceptowanie, odrzucenie, wygaśnięcie i blokada działają spójnie na dwóch kontach.

PP-031 — Lobby i pierwsza gra multiplayer. Kryterium: użytkownik dołącza z linku, liczba miejsc jest atomowo ograniczona, serwer kontroluje stan i wynik, rozłączenie ma określone zachowanie.

PP-032 — Czat globalny, prywatny i lobby. Kryterium: historia po odświeżeniu istnieje, prywatną rozmowę czytają wyłącznie uczestnicy, trzeci użytkownik nie może podsłuchać kanału; blokada i odebranie dostępu obejmują API i Realtime.

PP-033 — Przygotowanie otwartej bety. Kryterium: zamknięte decyzje o wieku odbiorców, zasadach społeczności, retencji i prywatności; przetestowane konta Google/Facebook, moderacja, odzyskanie konta, kopia danych i pomiar awarii.

## M4 — wydarzenia i rozwój

PP-040 — Model wydarzenia i prosty event testowy. Kryterium: zapis uczestnika, rozpoczęcie, zakończenie i ranking respektują serwerowy czas oraz przypięte reguły.

PP-041 — Wspólne XP, odznaki i sezonowe zadania. Kryterium: reguły naliczania są jawne, limitowane i wersjonowane; cofnięty wynik koryguje nagrodę.

PP-042 — Monetyzacja i pomiar. Kryterium: jeden eksperyment ma hipotezę, ograniczony koszt, metrykę i warunek przerwania. Strategia do opracowania przez rolę finansową; brak zatwierdzonego modelu przychodów.

PP-043 — SEO, dystrybucja i utrzymanie graczy. Kryterium: indeksowalne strony gier, metadane, grafiki udostępniania, sitemap i mierzalna ścieżka od wejścia do pierwszej rozgrywki. Publiczne posty i kampanie wymagają polecenia publikacji.

## Definicja ukończenia zadania

Zmiana istnieje w kodzie lub dokumencie, spełnia opisane kryterium i ma dowód weryfikacji. „Gotowe do przeglądu”, „zmergowane” i „wdrożone” są osobnymi stanami. Samo przygotowanie planu, promptu lub widoku nie oznacza uruchomienia funkcji.

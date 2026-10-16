# Party Pixels Hub 2.0 — fundament projektu

Wersja dokumentacji: 0.1. Data: 16 października 2026.

Status: projekt funkcjonalny i techniczny do dalszego rozwijania. Ten katalog nie zawiera działającej aplikacji 2.0. Wymagania pochodzą z briefu właściciela; wybór frameworka, kolejność etapów i szczegóły kontraktów są propozycjami wykonawczymi.

## Cel

Party Pixels to społecznościowy hub gier przeglądarkowych: gracz odkrywa grę, gra sam lub zaprasza innych, rozmawia, zapisuje wyniki na swoim profilu i wraca na nowe gry oraz wydarzenia.

Wersję 2.0 projektujemy od podstaw. Docelowy kod aplikacji ma powstać jako nowa implementacja. Istniejący prototyp nie wyznacza architektury. Dokumentacja na osobnej gałęzi umożliwia rozpoczęcie pracy bez podmieniania obecnego wdrożenia.

## Wymagania ustalone przez właściciela

- GitHub jako miejsce kodu i historii zmian; Vercel do wdrożeń; Supabase do kont i danych. Inne narzędzia dobieramy do konkretnych potrzeb.
- Konto i profil gracza, rejestracja oraz logowanie przez e-mail i hasło, Google i Facebook.
- Gry przeglądarkowe, w tym gry online z zaproszeniami do wspólnej rozgrywki.
- Czat globalny i indywidualne rozmowy.
- Okresowe wydarzenia, w których użytkownicy mogą uczestniczyć.
- Ulubione gry, własne listy, udostępnianie i polecanie gier.
- Komentarze oraz tablica wyników przy każdej grze obsługującej punktację.
- Jeden profil, avatar i identyfikator używany przez wszystkie gry.
- Wspólny system wyników umożliwiający pokazanie rekordów z różnych gier na profilu i ich dalszą analizę.
- Pięć wewnętrznych ról GPT: menadżer projektu, designer gier i experiences, asystentka, finanse i monetyzacja, PR i rozwój społeczności.

## Proponowane doświadczenie użytkownika

Wejście na hub → wybór gry → gra od razu, jeśli obsługuje gościa → utworzenie konta, aby zachować wynik i korzystać ze społeczności → zaproszenie znajomego → powrót po nowe gry lub event.

Główne widoki: strona główna, katalog gier, strona gry z odtwarzaczem i rankingiem, profil, listy, lobby, wiadomości, wydarzenia i ustawienia. Panel administracyjny służy do katalogu, eventów, zgłoszeń i moderacji.

Propozycja dostępu: gość przegląda katalog i gra w wybrane gry solo bez trwałych wyników. Konto jest potrzebne do zapisów, komentarzy, czatu, lobby i eventów. Wyjątki dla konkretnej gry ustalamy w jej briefie.

Projektujemy od początku na telefon i komputer. Gra określa obsługiwane sterowanie, orientację ekranu, liczbę graczy i wymagania sprzętowe; hub pokazuje je przed uruchomieniem.

## Trzy wspólne elementy

Party Pixels Identity: stały identyfikator gracza, profil i uprawnienia; sposób logowania nie zmienia tożsamości.

Party Pixels SDK: mała biblioteka używana przez wszystkie gry do pobrania bezpiecznych danych profilu, rozpoczęcia sesji, zgłoszenia rezultatu i wejścia do lobby.

Party Pixels Scores: jednolity zapis wyników z identyfikatorem gry, trybu i reguł. Profil pokazuje oddzielne rekordy, a wspólne XP nalicza według jawnych reguł serwera.

## Kolejność prac

M0 — fundament organizacyjny: dokumentacja, stan projektu, podział ról GPT, decyzja o środowisku developerskim i miejscu nowego kodu.

M1 — działający przekrój systemu: rejestracja e-mail, Google, profil z avatarem, SDK, pierwsza gra testowa i ranking. Druga mała gra testowa potwierdza, że konto i zapis wyniku można wykorzystać bez zmiany rdzenia. To wersja developerska, nie pełny publiczny hub.

M2 — katalog i społeczność: Facebook, odzyskiwanie i łączenie kont, ulubione, listy, komentarze, udostępnianie, zgłoszenia i moderacja. Nie uznajemy wymogu Facebooka za zakończony na podstawie samego widocznego przycisku.

M3 — wspólna gra: znajomi lub zaakceptowane kontakty, zaproszenia, lobby, czat globalny, wiadomości prywatne, powiadomienia i pierwsza właściwa gra multiplayer. Weryfikujemy to na dwóch odrębnych kontach i urządzeniach.

M4 — eventy i powroty: harmonogram, zapisy, zadania, rankingi sezonowe, rezultaty wydarzeń, pierwsze eksperymenty monetyzacji oraz pozyskiwania użytkowników. Nagrody i warunki konkretnego eventu wymagają osobnego projektu.

Publiczna beta podstawowego hubu: po spełnieniu kryteriów M1–M3. M4 jest kolejną częścią zakresu, a nie usuniętym wymaganiem. Etapy nie są obietnicą terminów.

## Pierwszy kamień milowy

To samo konto uruchamia dwie gry. Obie wyświetlają ten sam nick i avatar. Każda zapisuje swój rezultat, a profil pokazuje oba rekordy. Ponowienie wysyłki nie tworzy drugiego wyniku ani dodatkowego XP. Konto B nie może zapisać punktów jako konto A.

## Otwarte decyzje

- Odbiorcy, docelowy wiek i początkowy język interfejsu; dokumentacja robocza pozostaje po polsku.
- Styl wizualny, nazwy ról i pierwsza docelowa gra multiplayer.
- Budżet infrastruktury i zasady monetyzacji.
- Osobne repozytorium czy nowa implementacja w istniejącym repo; osobny projekt Supabase dla developmentu i docelowy adres strony.
- Czy GPT będą skonfigurowane jako custom GPTs, czy dostępne na koncie role z pluginami; każda musi przejść rzeczywisty test dostępu.

## Dokumenty techniczne

- ARCHITECTURE.md — odpowiedzialności usług, model danych i granice dostępu.
- GAME_PLATFORM_CONTRACT.md — kontrakt integracji każdej gry i reguły wyników.
- IMPLEMENTATION_BACKLOG.md — kolejność zadań z kryteriami ukończenia.

Dokumenty operacyjne i instrukcje wewnętrznych GPT są przechowywane oddzielnie od publicznej dokumentacji technicznej.

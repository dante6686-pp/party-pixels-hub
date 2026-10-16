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

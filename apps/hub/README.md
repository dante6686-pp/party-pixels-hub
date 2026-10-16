# Hub 2.0 — konto i profil

Next.js 16 + React 19, klient Supabase Auth. Sesja jest zarządzana w przeglądarce; uprawnienia danych egzekwuje RLS, nie warunkowe renderowanie interfejsu. Nie ma jeszcze serwerowego SDK gier ani wyników.

## Konfiguracja

1. W osobnym projekcie Supabase dev zastosować `supabase/migrations/*`.
2. Skopiować `.env.example` do ignorowanego `.env.local`. Ustawić URL oraz **publishable** key projektu dev. Nie używać klucza service role.
3. Dla projektu Vercel ustawić Root Directory `apps/hub`, włączyć pliki spoza katalogu aplikacji i dodać te same dwie zmienne środowiskowe. Nie zmieniać starego projektu hubu.
4. Supabase Auth → URL Configuration: Site URL i Redirect URLs muszą obejmować właściwy adres podglądu. Włączyć potwierdzenie e-mail i sprawdzić dostarczanie poczty. Nie wyłączać potwierdzeń jako obejścia testów.
5. `npm ci` w repo, `npm run build`. Po konfiguracji środowiska `npm run dev --workspace @party-pixels/hub`.

Zakres: e-mail/hasło, potwierdzenie przez Supabase, reset hasła, logowanie, wylogowanie, nick, wyświetlana nazwa, cztery wbudowane avatary. Google/Facebook, upload zdjęć i gry nie są częścią tej implementacji.

## Test ręczny przed oznaczeniem Auth jako ukończonego

Nowe konto → wiadomość → potwierdzenie na właściwej domenie → logowanie → profil → odświeżenie → wylogowanie → ponowne logowanie → odzyskanie hasła. Osobno drugie konto: unikalny nick i brak możliwości zmiany pierwszego profilu. Test SQL `tests/profiles-rls.sql` sprawdza role w transakcji wycofywanej na końcu; nie zastępuje testu poczty i przeglądarki.

# Publiczne nowości Party Pixels

Źródło wpisów: `apps/hub/lib/updates.ts` (`updates`). To wspólna, wersjonowana baza publicznych informacji dla graczy. Dodanie wpisu i wdrożenie huba aktualizuje jednocześnie karuzelę oraz archiwum; nie ma osobnej ręcznie utrzymywanej listy.

- Wpis: stałe unikalne `id`, data publikacji `date` (YYYY-MM-DD), `category`, `title`, `description`.
- Kolejność: od najnowszego do najstarszego, nowe wpisy na początku. Przy kilku publikacjach jednego dnia kolejność redakcyjna tablicy rozstrzyga kolejność wyświetlania.
- Publikujemy wyłącznie wdrożone funkcje, zwykłym językiem dla graczy. Bez sekretów, danych osobowych, wewnętrznych problemów ani obietnic niegotowych funkcji.
- Home/Odkrywaj: dokładnie cztery ostatnie wpisy, między powitaniem a katalogiem (przed wyszukiwaniem i filtrami).
- Karuzela: natywny swipe dotykowy, przeciąganie lewym przyciskiem myszy, przyciski wstecz/dalej i strzałki klawiatury po ustawieniu fokusu na karuzeli. Bez automatycznego przewijania.
- `/whats-new`: pełne publiczne archiwum grupowane według dat z linkami do dni.
- Nowe wpisy dodajemy w ramach wdrożenia zmiany, której dotyczą. Sam pomysł lub plan nie jest informacją o wdrożeniu.
- Brak panelu administratora i osobnej bazy SQL w tym etapie; wpisy edytuje programista w repozytorium.

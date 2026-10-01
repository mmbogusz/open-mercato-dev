# Decyzje i odpowiedzi na otwarte pytania — 2026-10-01

> Dotyczy obu analiz: strony hurtowni (`ai-inbox-hurtownie-summary.md`, sekcja „Otwarte pytania”) i strony kupującej (`inputs/ai-zakupy-budowlane/`).
> Ograniczenie: dostęp do API GitHuba dla `open-mercato/open-mercato` nie był w tej sesji dostępny (tylko anonimowy odczyt gita). Stan PR-ów ustalony z refów `refs/pull/*` i historii `develop`; statusy recenzji pochodzą z analizy luk z 2026-10-01 i nie były sprawdzane ponownie.

## 1. Licencja enterprise — decyzja: budujemy w OSS

- Auto-akceptacja powyżej progu (story 5.3) powstaje w OSS, w `inbox_ops` (polityka progu pewności + bramki ryzyka po naszej stronie), a nie na `agent_orchestrator` z `packages/enterprise/`.
- Strona kupująca: bez zmian — R1 (każda wiadomość do oferenta przez akceptację człowieka) obowiązuje do czasu decyzji o polityce progowej; ta polityka też powstanie w OSS.
- Skutek dla backlogu hurtowni: C.2 traci wariant „enterprise”; nakład bez zmian (3 commity) do potwierdzenia w specyfikacji.

## 2. Otwarte PR-y: adoptować czy budować

### Tempo upstreamu (dane z historii `develop`)

| Miara | Wartość |
|---|---|
| PR-y zmergowane od 2026-06-01 | 2019 |
| Czas od otwarcia do merge'a (szacunek*) | mediana ok. 1 dzień, p75 4 dni, p90 10 dni; 94% w ciągu 14 dni |
| Autorzy z największą liczbą merge'y | zespół rdzeniowy (mediana ok. 1 dzień); autorzy spoza rdzenia: mediany 2–8,5 dnia (małe próbki) |
| Otwarte PR-y (z refem `merge`) | 236: ≤14 dni — 129, 15–30 dni — 50, 31–60 dni — 44, 61–120 dni — 10, >120 dni — 3 |
| Merge'e tygodniowo (ostatnie 8 tygodni) | 21–124, typowo 50–80 |

\* Data otwarcia szacowana z numeru PR (pierwszy dzień, w którym zmergowano PR o wyższym numerze). Statystyka liczy tylko PR-y zmergowane, więc zaniża czas oczekiwania — PR, który nie wszedł w ~2 tygodnie, zwykle wisi dalej (107 otwartych PR-ów jest starszych niż 14 dni).

**Reguła robocza:** PR bez merge'a po 14 dniach i bez commitów od 14 dni traktujemy jako uśpiony — planujemy bez niego.

### Ocena poszczególnych PR-ów

| PR | Rozmiar | Ostatni commit | Stan (refy) | Ocena | Rekomendacja |
|---|---|---|---|---|---|
| companion `official-modules` #20 — generatory PDF | +11 253 | **2026-08-10** (7 tyg. temu) | brak refu `merge` (konflikt albo zamknięty) | **Uśpiony — najmniejsza szansa** | Dla 5.4 nie czekać: prosty PDF oferty w aplikacji (szablon + istniejące `documents`/`attachments`). Opcjonalnie zapytać autora, czy możemy przejąć PR |
| #6709 — dostępność + grupy klientów | +26 728, 225 plików (107 w nowym `customer_groups`, 46 w `availability`) | 2026-10-01 (scalenie z develop) | otwarty, mergowalny; strona PR: zmiany zażądane 30.09 (1 bloker, 4 poważne — wszystkie z odpowiedziami autora), CI 26/26, brak konfliktów; czeka na zgodę maintainera na wyjątek i ręczne QA; etykieta `risk-high` = szeroki zasięg zmian (catalog, wms, auth, CrudForm), nie ocena jakości | **Dobry fundament dla „kto i na jakich warunkach”**: encja grupy z priorytetem, członkostwa w czasie, warunki grupy (termin płatności, limit kredytu jako ledger, progi akceptacji), kontrakt dostępności. **Nie daje rabatów % na grupę producenta (4.1)** — ceny grupowe to nadal absolutne wiersze cen per produkt | Projektować 4.1 jako rozszerzenie kluczowane `customer_group_id` lub kontrahentem: własna encja reguł „grupa/kontrahent + producent/grupa rabatowa → %” + `registerSalesLineCalculator`. Do merge'a #6709 kluczujemy kontrahentem, po merge'u zbiór grup z `customerGroupsService`. 4.3/4.4 (dostępność) budować na kontrakcie z #6709 |
| #6346 — spec „assisted selling” | +4 236 (spec) | **2026-10-01: rev 4 zamyka luki N1–N3** | otwarty | Aktywny, blisko akceptacji | Przeczytać rev 4 i dopasować do niej projekt; ryzyko niskie (to tylko specyfikacja) |
| #6297 — strażnik pochodzenia przy akceptacji oferty | +182 | 2026-09-22 (scalenie z develop) | otwarty | Mały, 9 dni bez commitów; uwaga o zaufaniu do `x-forwarded-*` nierozwiązana | Nie ruszać trasy akceptacji/konwersji oferty (5.5) do merge'a. Jeśli po 14 dniach nic — zaproponować poprawkę uwagi (mała, duża szansa) |
| #6702 — backfill mapy szyfrowania | +683 | 2026-10-01 | otwarty | Aktywny, jedna uwaga średniej wagi | Poczekać; wpływa tylko na 9.2 z nowymi kolumnami szyfrowanymi |

Pozostałe PR-y z analizy luk są aktywne (ostatnie commity 2026-09-25 – 2026-09-30): #6264, #6318, #6486, #6681, #6744. Wyjątek: #6293 (spec skrzynek działowych, ostatni commit 2026-09-20, dwa blokery) — kandydat na uśpiony za kilka dni.

## 3. ERP w PoC — rekomendacja: pominąć konektory na żywo

- **Strona kupująca:** ERP w PoC niepotrzebny. Wynik to zamówienia per hurtownia (PDF/mail/CSV).
- **Strona hurtowni:** kryteria go/no-go z researchu (top-1 ≥60%, top-3 ≥80%, czas oferty −50%) nie wymagają ERP. Zamiast konektorów:
  - katalog, ceny i stany: jednorazowy eksport z ERP do pliku (CSV/XLSX, w Subiekcie także EPP) i import do platformy;
  - wynik: oferta jako PDF/XLSX, opcjonalnie plik do importu w ERP. Format EPP (EDI++) jest wspólny dla programów InsERT i opisany głównie dla faktur — czy przyjmuje oferty i zamówienia od klienta (ZK), trzeba sprawdzić na pilocie. Comarch Optima ma import dokumentów z XML (do sprawdzenia dla ofert).
- **Ryzyko:** raport strony hurtowni wskazuje konektory do polskich ERP jako główną przewagę nad Mercurą. W teście cenowym (tydzień 6–7) zapytać wprost: „czy zapłacisz za pilotaż bez zapisu do ERP?”.
- **Backlog hurtowni:** A.10 i A.11 (10 commitów) przesunąć za go/no-go; w ich miejsce „import katalogu z pliku” (szacunek 2 commity).

## 4. Koszt wyszukiwania przy dużym katalogu — da się tanio

**Co platforma już ma** (`packages/search`):
- strategia `tokens` — w samym Postgresie, bez dodatkowej infrastruktury;
- strategia `vector` — sterownik **pgvector** (rozszerzenie Postgresa; osobna baza wektorowa niepotrzebna, Qdrant/Chroma są opcjonalne);
- strategia `fulltext` — wymaga Meilisearch (opcjonalny, open source, self-hosted);
- embeddingi: m.in. lokalny **Ollama** (`nomic-embed-text`, `mxbai-embed-large`) albo OpenAI `text-embedding-3-small`.

**Szacunek kosztu** (do potwierdzenia cennikiem i testem):
- embeddingi: 500 tys. SKU × ok. 40 tokenów = ok. 20 mln tokenów → przy ok. 0,02 USD/1 mln tokenów (`text-embedding-3-small`) to ok. 0,40 USD za pełne indeksowanie; z Ollamą — 0 zł poza CPU;
- miejsce: 1536 wymiarów × 4 B ≈ 6 KB/SKU → ok. 3 GB na 500 tys. SKU plus indeks HNSW; przy 512 wymiarach ok. 1 GB; przy 20 tys. SKU — ok. 40–120 MB;
- realny koszt to dysk i RAM Postgresa: rzędu dziesiątek złotych miesięcznie na hurtownię, nie tysięcy. Meilisearch w PoC można pominąć (`tokens` + `vector`).

**Ograniczenie do ok. 20 tys. SKU — tak, jako indeks główny:**
- indeksować wektorowo aktywny asortyment (sprzedawany/ofertowany w ostatnich 12–24 mies. albo ze stanem), resztę katalogu obsługiwać strategią `tokens` jako fallback;
- w PoC mierzyć odsetek pozycji, których dopasowanie było poza indeksem głównym — to rozstrzygnie, czy 20 tys. wystarcza.

**Strona kupująca:** wyszukiwanie w katalogu niepotrzebne — dopasowujemy setki pozycji ofert do setek pozycji specyfikacji.

## 5. Dane ETIM — co jest darmowe

- **Model ETIM** (klasy, cechy, wartości, jednostki) jest darmowy: pliki do pobrania i ETIM API. Darmowe wersje językowe to m.in. angielska i niemiecka; **polskiej nie ma na tej liście** — zapytać ETIM Polska (etim.org.pl) o warunki. Obejście: model angielski + tłumaczenie nazw cech przez LLM.
- **Format BMEcat** jest otwarty i bezpłatny.
- **Dane produktowe** (produkty z przypisanymi klasami i cechami) to inna sprawa:
  - najtańsze źródło to **pilotażowa hurtownia** — już dostaje od producentów pliki BMEcat/ETIM i cenniki; prosić o nie razem z eksportem katalogu (tydzień 3–4 walidacji);
  - producenci publikują własne pliki BMEcat/ETIM dla dystrybutorów;
  - Repozytorium ZHI — warunki dostępu nieznane, zapytać;
  - fallback: klasyfikacja produktu do klasy ETIM przez LLM z nazwy i opisu, z oceną pewności.
- **Strona kupująca:** potrzebny tylko darmowy model ETIM jako słownik cech do oceny równoważności zamienników.

## 6. Strategia upstreamu — zależy od rodzaju zmiany

Dane z punktu 2: upstream merguje szybko (mediana ok. 1 dzień, 94% w 14 dni), ale PR-y, które nie wejdą szybko, wiszą tygodniami, a autorzy spoza zespołu rdzeniowego czekają dłużej.

| Rodzaj zmiany | Strategia | Przykłady |
|---|---|---|
| Ogólna luka platformy, przydatna innym, mała i lokalna (<500 linii) | **Upstream-first**: PR do open-mercato, a do czasu merge'a łatka na gałęzi forka | załączniki w inboxie (issue #6282), jednostka i pewność na pozycjach, wysyłka załączników w adapterach kanałów, retencja/anonimizacja |
| Logika domenowa produktu | **Moduł aplikacji** (`apps/mercato/src/modules/…` albo osobny pakiet) | optymalny koszyk, projekty i harmonogram dostaw, zapytania ofertowe, macierz ofert, copilot negocjacji, ETIM |
| Zmiana potrzebna teraz, a PR upstream utknął | **Nakładka** (interceptory API, podmiana komponentów, encje-rozszerzenia) z terminem usunięcia | gdy PR upstream przekroczy 14 dni bez ruchu |
| Duża zmiana kontraktu platformy | Najpierw spec/issue upstream, potem kod | silnik cen, dostępność (patrz #6709) |

Zasady: małe PR-y; po 14 dniach bez merge'a i bez ruchu — nakładka w aplikacji, PR zostaje otwarty; lista łatek forka utrzymywana w jednym miejscu.

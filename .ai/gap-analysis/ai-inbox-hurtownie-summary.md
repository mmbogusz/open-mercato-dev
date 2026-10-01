---
project: ai-inbox-hurtownie
generated: 2026-10-01
source: ai-inbox-hurtownie.md
type: gap-analysis-summary
---

# Podsumowanie analizy luk — AI Inbox dla hurtowni instalacyjnych i elektrycznych

> Oceny są oparte na gałęzi `develop` platformy open-mercato/open-mercato (oraz open-mercato/official-modules), która może zawierać funkcje jeszcze niewydane w oznaczonym wydaniu. Liczba commitów przewagi nad gałęzią wydań była niedostępna (płytki klon).

## Podsumowanie dla zarządu

Platforma ma już kręgosłup produktu opisanego w researchu: moduł `inbox_ops` przyjmuje e-maile przez webhook, deduplikuje je, rozpoznaje kontrahenta i intencję (zapytanie / zamówienie), a następnie tworzy szkic oferty lub zamówienia, który handlowiec akceptuje, poprawia albo odrzuca — z ochroną przed jednoczesną edycją i pełną izolacją danych między hurtowniami. To dokładnie model „propozycja → akceptacja człowieka”, na którym research opiera wymóg kontroli handlowca. Z 52 story 6/52 jest w pełni gotowych, wszystkie w darmowym rdzeniu (OSS); 23/52 jest częściowo gotowych (22 w rdzeniu, 1 — auto-akceptacja — wyłącznie w warstwie enterprise); 23/52 nie istnieje. Pokrytych jest 37/105 kryteriów akceptacji.

Luki koncentrują się dokładnie tam, gdzie research lokuje przewagę konkurencyjną: silnik dopasowania produktów (top-3 kandydaci z pewnością, ETIM, zamienniki, uczenie z korekt), czytanie załączników (PDF, Excel, zdjęcia — dziś pomijane), rabaty klienta na grupy producenta oraz konektory do polskich ERP (Subiekt, Optima, enova — brak jakiegokolwiek). Zamknięcie wszystkich luk to 166 atomowych commitów w 48 story; ścieżka pilotażowa (Faza A backlogu) to 50 commitów w 14 story.

Największe ryzyko realizacyjne nie jest technologiczne, lecz organizacyjne: większość zmian dotyka współdzielonych modułów platformy (`inbox_ops`, `catalog`, `sales`), więc wymaga PR-ów do upstreamu i ich akceptacji, albo nakładek w aplikacji (podmiana komponentów, interceptory API). Rekomendowany start: pilot „wycena zestawienia z e-maila → szkic oferty → dokument w Subiekcie” dla hurtowni instalacyjnych, zgodnie z rekomendacją segmentu w researchu.

## Pokrycie w skrócie
| Werdykt | Story | Udział | Nakład (commity) |
|---|---|---|---|
| ✅ Gotowe (core / OSS) | 6 | 6/52 | 2 |
| ✅ Gotowe (enterprise / companion) | 0 | 0/52 | — |
| 🟡 Częściowe (core / OSS) | 22 | 22/52 | 75 |
| 🟡 Częściowe (enterprise) | 1 | 1/52 | 3 |
| ❌ Brak | 23 | 23/52 | 86 |
| ⚠️ Niejasne | 0 | 0/52 | — |

**Pokryte kryteria akceptacji**: 37/105 we wszystkich story (zweryfikowane bramką per story).
**Łączny nakład na domknięcie luk**: 166 atomowych commitów w 48 story (4 story gotowe bez pracy: 1.7, 5.1, 5.7, 9.1; 2 gotowe wymagają tylko konfiguracji: 5.6, 6.6).
**Wg priorytetu**: P0 — 15 story / 49 commitów; P1 — 31 story / 93 commity; P2 — 6 story / 24 commity.
**Weryfikacja**: 52/52 story `done`, 0 `needs-review`.

## Pokrycie wg epików
| Epik | Gotowe | Częściowe | Brak | Niejasne | Uwagi |
|---|---|---|---|---|---|
| 1. Wielokanałowy inbox | 1 | 6 | 1 | 0 | E-mail i deduplikacja działają; załączniki są gubione, brak scalania kanałów, brak WhatsApp/SMS |
| 2. Ekstrakcja pozycji | 0 | 2 | 4 | 0 | Pozycje tylko z treści maila; brak PDF/Excel/zdjęć, brak pewności per pozycja i jednostki |
| 3. Silnik dopasowania | 0 | 4 | 3 | 0 | Hybrydowe wyszukiwanie istnieje, ale nie jest użyte; brak top-3, zamienników i uczenia |
| 4. Ceny, rabaty, dostępność | 0 | 1 | 4 | 0 | Stany per magazyn są w WMS; brak rabatów na grupy producenta i cen projektowych |
| 5. Oferta z akceptacją | 3 | 4 | 1 | 0 | Najmocniejszy obszar; brakuje ekranu porównania pozycja-po-pozycji |
| 6. Integracja z ERP | 1 | 2 | 3 | 0 | Silnik synchronizacji i sejf poświadczeń są; brak jakiegokolwiek konektora ERP |
| 7. Dane ETIM / BMEcat | 0 | 0 | 4 | 0 | Słowo „ETIM” nie występuje w platformie; brak pola producenta |
| 8. Metryki | 0 | 1 | 2 | 0 | Znaczniki czasu są; brak mediany, konwersji ofert, trafności dopasowań |
| 9. SaaS, RODO, audyt, partnerzy | 1 | 3 | 1 | 0 | Izolacja tenantów pełna; brak retencji/anonimizacji, audyt decyzji AI nie działa |

## Top 5 ryzyk

1. **Silnik dopasowania — rdzeń wartości produktu nie istnieje (3.5 ❌ P0, 3.2 🟡 P0, 3.1 🟡 P0).** Dziś LLM dostaje 50 ostatnio edytowanych produktów, a dopasowanie to pierwsze trafienie podłańcuchem — przy katalogu 50–500 tys. SKU to nie zadziała. Kryterium go/no-go z researchu (top-1 trafnie dla co najmniej 60/100 pozycji, top-3 dla 80/100) zależy wprost od tej pracy. Odblokowuje: per-pozycyjne wyszukiwanie kandydatów na istniejącym `@open-mercato/search` (fulltext + wektor + RRF), plus infrastruktura Meilisearch i bazy wektorowej. PR #6486 (+277, APPROVED — recenzent: jedyny bloker usunięty, CI zielone) poprawia wyszukiwanie produktów na tej samej trasie API — koordynować, nie budować równolegle.

2. **Załączniki są gubione na obu ścieżkach przyjmowania poczty (1.1 🟡 P0, 2.1 🟡 P0, 2.2 ❌ P0).** Zestawienia przychodzą jako PDF/Excel/zdjęcia, a `inbox_ops` czyta tylko treść maila; XLSX nie jest obsługiwany nigdzie w platformie. PR #6264 (+591, APPROVED — recenzent: wszystkie trzy blokery naprawione, z testem ścieżki utraty danych) utwardza OCR, który ta praca wykorzysta — warto poczekać na merge. Wspólna skrzynka działu (handlowy@) jest tylko w specyfikacji PR #6293 (+731, CHANGES_REQUESTED — recenzent: dwa blokery, poszerzenie autoryzacji na dwie istniejące trasy wysyłki i rozluźnienie inwariantu prywatności skrzynek osobistych).

3. **Brak konektorów do polskich ERP (6.1 ❌ P0, 6.2 ❌, 6.3 ❌, 6.4 🟡 P0).** To główna przewaga nad Mercurą wg researchu, a każdy konektor to zależność zewnętrzna: Subiekt (Sfera) wymaga mostka .NET/COM na Windows u klienta. Silnik `data_sync` jest gotowy, ale jego kontrakt się zmienia: PR #6318 (+7381, CHANGES_REQUESTED — recenzent: dobrze wykonane, jedno ustalenie średniej wagi blokuje) oraz PR #6681 (+390, APPROVED — bez uwag). Konektory budować po ich merge'u.

4. **Ceny klienta: rabaty na grupy producenta nie istnieją (4.1 ❌ P0).** Silnik cen wybiera jedną absolutną cenę wiersza; brak rabatów procentowych, brak pola producenta, a dialog pozycji nie przekazuje nawet kontrahenta. PR #6709 (+26661, 221 plików, CHANGES_REQUESTED — recenzent: konflikt z `develop` jako bloker plus 3 poważne uwagi; poprawki bezpieczeństwa potwierdzone) wnosi kontrakt dostępności i grupy klientów — decyzja „adoptować vs budować” dla 4.1, 4.3 i 4.4 to największe rozwidlenie w obszarze cen. Planowana specyfikacja silnika cen kieruje rozszerzenia przez ten sam łańcuch resolverów.

5. **Zależność od upstreamu i RODO w modelu SaaS (9.2 🟡 P0, większość story z flagą „platform”).** 43/52 story ma w ścieżce wdrożenia flagę wkładu do platformy (część warunkowo — tylko przy wariancie „w rdzeniu”); każda taka zmiana we współdzielonych modułach to PR do open-mercato i czas na akceptację; alternatywą są nakładki w aplikacji (podmiana komponentów, interceptory, encje-rozszerzenia), które zwiększają koszt utrzymania. Jednocześnie produkt przetwarza maile z danymi osobowymi, a platforma nie ma retencji ani anonimizacji (tylko miękkie usuwanie) — to warunek sprzedaży SaaS wielu hurtowniom.

## Rekomendowana kolejność

1. **Faza A (pilot, 50 commitów):** załączniki → ekstrakcja z pewnością per pozycja → wyszukiwanie kandydatów i przeliczniki jednostek → top-3 → ekran porównania → rabaty klienta → import z ERP i zapis OF/ZK do Subiekta, plus RODO i pola producenta. To odwzorowuje kroki 4–6 planu walidacji z researchu (prototyp dopasowania) i daje pierwszy płatny pilotaż na Subiekcie, najpopularniejszym ERP w segmencie.
2. **Faza B (rdzeń produktu, 68 commitów):** ETIM/BMEcat i dopasowanie po cechach, zamienniki, poprawność cen i stanów, wysyłka oferty w wątku z PDF, audyt i role, metryki (czas do oferty, konwersja, trafność) — metryki są potrzebne, by obronić cenę 3–5 tys. zł/mies.
3. **Faza C (różnicowanie i rozszerzenie, 48 commitów):** uczenie z korekt, auto-akceptacja, kolejne ERP (Optima, enova), ceny projektowe, model partnerski dla grup zakupowych, telefon i komunikatory — zgodnie z researchem kanał głosowy to drugi etap.

Kolejność wewnątrz faz wynika z zależności: 2.1 → 3.1 → 3.5 → 5.2; 6.4 → 4.3; 7.1 + 7.2 → 7.3 → 3.2.

## Co już jest mocne

- **Potok propozycja → akceptacja** (`inbox_ops`): klasyfikacja intencji, szkic oferty (`create_quote`) i zamówienia (`create_order`) z jednego potoku, walidacja cen względem silnika cen, akceptacja/odrzucenie/edycja, blokada optymistyczna i atomowe zajęcie akcji — wszystko w OSS (5.1, 5.6, 5.7).
- **Deduplikacja i idempotencja** wiadomości na poziomie bazy (1.7).
- **Izolacja tenantów i organizacji** we wszystkich encjach i trasach (9.1).
- **Sejf poświadczeń integracji** z szyfrowaniem per tenant i maskowaniem sekretów (6.6).
- **Fundamenty do wykorzystania**: hybrydowe wyszukiwanie (`packages/search`), jednostki miary i przeliczniki w katalogu, stany per magazyn w WMS, silnik `data_sync` z harmonogramem i kursorem przyrostowym, konwersja oferty w zamówienie, hierarchia organizacji z brandingiem, model fieldsetów pod klasy ETIM.
- **Warstwa enterprise**: polityka auto-akceptacji powyżej progu z bramkami ryzyka (5.3, tylko licencja komercyjna) — przydatna w Fazie C.

## Otwarte pytania

- **Licencja enterprise**: czy produkt może opierać auto-akceptację (5.3) na `agent_orchestrator` z warstwy komercyjnej, czy budujemy wersję w OSS?
- **Adoptować vs budować** dla otwartych PR-ów: PR #6709 (dostępność + grupy klientów, CHANGES_REQUESTED), PR #6346 (+4236, specyfikacja „assisted selling”, CHANGES_REQUESTED — recenzent: rev 3 rozwiązała wszystkie wcześniejsze uwagi, zostały trzy luki w maszynie stanów tury), companion PR #20 (+11253, generatory PDF, CHANGES_REQUESTED — recenzent: dobra architektura, ale kilka problemów blokujących wydanie) dla PDF oferty w 5.4.
- **PR #6297** (+182, CHANGES_REQUESTED — recenzent: poważna uwaga o zaufaniu nagłówkom `x-forwarded-*` przy weryfikacji pochodzenia) dotyka trasy akceptacji i konwersji oferty (5.5) — poczekać przed zmianą tej trasy.
- **PR #6702** (+683, CHANGES_REQUESTED — jedno ustalenie średniej wagi) jest istotny, jeśli 9.2 doda nowe szyfrowane kolumny.
- **Kolejność ERP**: czy pilot zaczyna od Subiektu (Sfera wymaga mostka na Windows u klienta) i kto utrzymuje mostek?
- **Infrastruktura wyszukiwania**: koszt Meilisearch + bazy wektorowej + modelu embeddingów per tenant przy 500 tys. SKU — wpływa na cenę 3–5 tys. zł/mies.
- **Źródła danych ETIM**: dostęp i licencja do Repozytorium ZHI, ETIM Polska, MEGACENNIK.
- **Strategia upstreamu**: kontrybucja do open-mercato (wolniej, taniej w utrzymaniu) vs nakładki w aplikacji (szybciej, droższe w utrzymaniu).
- **Założenia z researchu wymagające walidacji**: wolumen zestawień i czas wyceny (krok 2–3 planu walidacji) — od nich zależy, czy Faza A w ogóle ma uzasadnienie biznesowe.

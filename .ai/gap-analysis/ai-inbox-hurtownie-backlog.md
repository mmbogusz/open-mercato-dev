---
project: ai-inbox-hurtownie
generated: 2026-10-01
source: ai-inbox-hurtownie.md
type: gap-analysis-backlog
---

# Backlog wdrożenia — AI Inbox dla hurtowni instalacyjnych i elektrycznych

> Fazy według kolejności zależności. Nakład to wynik w atomowych commitach (0–5), ta sama waluta co w analizie luk. Flaga zakresu: **app** — kod w module aplikacji; **platform** — zmiana we współdzielonym module open-mercato (wymaga PR do upstreamu i akceptacji, albo nakładki w aplikacji); **companion** — moduł w open-mercato/official-modules; **external** — zależność od systemu lub dostawcy zewnętrznego.

## Faza A — Fundament (pilot: zestawienie z e-maila → szkic oferty → Subiekt)

### A.1 — Załączniki w potoku inboxa
- **Story**: 1.1, 2.1
- **Kontekst werdyktu**: 🟡 Częściowe (2/3, 1/2)
- **Nakład**: 6
- **Zakres**: platform (`communication_channels`, `inbox_ops`)
- **Zależności**: brak
- **Rezultat**: załączniki PDF/XLSX/CSV/obrazy są zapisywane, powiązane z wiadomością, a tekst PDF trafia do ekstrakcji LLM.
- **Uwagi**: zapis przez moduł `attachments`, wypełnienie `InboxEmail.attachmentIds`, tekst z `attachments/lib/textExtraction.ts` doklejony w `extractionWorker.ts`; pole jednostki w `lineItems`. Poczekać na PR #6264 (APPROVED); wspólną skrzynkę uzgodnić z PR #6293.

### A.2 — Ekstrakcja z Excela i CSV
- **Story**: 2.2
- **Kontekst werdyktu**: ❌ Brak
- **Nakład**: 4
- **Zakres**: platform + external (nowa zależność do XLSX)
- **Zależności**: A.1
- **Rezultat**: arkusz o dowolnym układzie kolumn zamienia się w pozycje; handlowiec może poprawić mapowanie kolumn.
- **Uwagi**: detektor kolumn wzorowany na `sync_excel/lib/column-detector.ts` ze słownikiem PL/EN, z fallbackiem LLM.

### A.3 — Pewność per pozycja i pozycje nieczytelne
- **Story**: 2.5
- **Kontekst werdyktu**: ❌ Brak
- **Nakład**: 3
- **Zakres**: platform (`inbox_ops`)
- **Zależności**: A.1
- **Rezultat**: każda pozycja ma pewność; brak ilości/jednostki jest oznaczony, a nie zgadywany; akceptacja blokowana do wyjaśnienia.
- **Uwagi**: `confidence`, `unit`, `uncertainFields` w `lineItems`; nowe typy rozbieżności `missing_quantity`/`missing_unit`/`low_confidence_line`.

### A.4 — Wyszukiwanie produktów w dużym katalogu
- **Story**: 3.1
- **Kontekst werdyktu**: 🟡 Częściowe (1/2)
- **Nakład**: 3
- **Zakres**: platform (`catalog`/`sales`) + external (Meilisearch, baza wektorowa, embeddingi)
- **Zależności**: A.1
- **Rezultat**: wyszukiwanie hybrydowe działa w wyborze pozycji i w potoku inboxa, z potwierdzoną latencją przy 500 tys. SKU.
- **Uwagi**: reużyć `searchService` jak w `catalog.search_products`; koordynacja z PR #6486; test obciążeniowy na syntetycznym katalogu.

### A.5 — Przeliczniki jednostek z zaokrągleniem do opakowania
- **Story**: 3.4
- **Kontekst werdyktu**: 🟡 Częściowe (1/2)
- **Nakład**: 3
- **Zakres**: platform (`catalog`/`sales`); podpięcie do inboxa może być w app
- **Zależności**: A.4
- **Rezultat**: ilość w m²/mb jest przeliczana na paczki/palety/szt. z zaokrągleniem w górę.
- **Uwagi**: czysty helper w `catalog/lib/` na `CatalogProductUnitConversion`, zapis oryginalnej ilości w snapshocie UoM.

### A.6 — Top-3 kandydatów z oceną pewności
- **Story**: 3.5
- **Kontekst werdyktu**: ❌ Brak
- **Nakład**: 4
- **Zakres**: platform (`inbox_ops`)
- **Zależności**: A.4
- **Rezultat**: każda pozycja ma do 3 kandydatów ze score 0–1 zapisanych w payloadzie akcji.
- **Uwagi**: resolver zamiast dopasowania podłańcuchem w `payloadEnrichment.ts`; `candidates` w jsonb (bez migracji).

### A.7 — Ekran porównania „zapytanie vs propozycja”
- **Story**: 5.2
- **Kontekst werdyktu**: ❌ Brak
- **Nakład**: 4
- **Zakres**: platform (`inbox_ops`) lub app (podmiana komponentu przez `widgets/components.ts`)
- **Zależności**: A.6
- **Rezultat**: handlowiec widzi tekst źródłowy, kandydata i alternatywy, zmienia wybór/ilość przed akceptacją; niska pewność wyróżniona tokenami DS.
- **Uwagi**: `CreateOrderPayloadEditor` w `EditActionDialog.tsx`, zapis przez istniejący PATCH akcji.

### A.8 — Rozpoznanie nadawcy po domenie i telefonie
- **Story**: 1.3
- **Kontekst werdyktu**: 🟡 Częściowe (2/3)
- **Nakład**: 3
- **Zakres**: platform (`customers`, `inbox_ops`)
- **Zależności**: brak
- **Rezultat**: nadawca z domeny firmy jest przypisany do kontrahenta, także przy szyfrowanych danych.
- **Uwagi**: wdrożyć planowany blind index domen; kroki domeny i E.164 w `contactMatcher.ts`.

### A.9 — Rabaty klienta na grupy producenta
- **Story**: 4.1
- **Kontekst werdyktu**: ❌ Brak
- **Nakład**: 4
- **Zakres**: app (moduł `customer_discounts`) + platform (kontekst klienta w wycenie pozycji)
- **Zależności**: A.8, A.13
- **Rezultat**: wycena pozycji automatycznie stosuje rabat klienta dla producenta/grupy.
- **Uwagi**: `registerSalesLineCalculator` ustawia `discountPercent`; decyzja vs grupy klientów z PR #6709.

### A.10 — Import katalogu, cen i stanów z ERP
- **Story**: 6.4
- **Kontekst werdyktu**: 🟡 Częściowe (1/2)
- **Nakład**: 5
- **Zakres**: app/companion + external (API ERP)
- **Zależności**: brak
- **Rezultat**: przyrostowa, cykliczna synchronizacja towarów, cen, rabatów i stanów per magazyn.
- **Uwagi**: `DataSyncAdapter` wzorowany na `sync-akeneo`; po merge'u PR #6318 i PR #6681.

### A.11 — Konektor Subiekt GT/nexo (Sfera)
- **Story**: 6.1
- **Kontekst werdyktu**: ❌ Brak
- **Nakład**: 5
- **Zakres**: companion/app + external (mostek .NET Sfera na Windows)
- **Zależności**: A.10, A.7
- **Rezultat**: zaakceptowana oferta/zamówienie powstaje jako OF/ZK w Subiekcie, numer wraca na ofertę.
- **Uwagi**: eksport przez `data_sync`, zapis numeru w `externalReference` + `SyncExternalIdMapping`.

### A.12 — Retencja i anonimizacja (RODO)
- **Story**: 9.2
- **Kontekst werdyktu**: 🟡 Częściowe (1/2)
- **Nakład**: 4
- **Zakres**: platform (`inbox_ops`, `communication_channels`)
- **Zależności**: A.1
- **Rezultat**: konfigurowalna retencja maili i załączników, twarde czyszczenie, anonimizacja na żądanie.
- **Uwagi**: worker wzorowany na `log-pruner.ts`; komenda `inbox_ops.emails.anonymize`; uwaga na PR #6702.

### A.13 — Producent i kod producenta w katalogu
- **Story**: 7.2
- **Kontekst werdyktu**: ❌ Brak
- **Nakład**: 2
- **Zakres**: app (custom fields w `ce.ts`)
- **Zależności**: brak
- **Rezultat**: produkty mają producenta (słownik) i kod producenta, filtrowalne i indeksowane.
- **Uwagi**: istniejące filtry `cf_*` i `appendCustomFieldLines` dają wyszukiwanie bez zmian w rdzeniu.

## Faza B — Rdzeń produktu

### B.1 — ETIM: import, wzbogacanie, dopasowanie po cechach
- **Story**: 7.1, 7.3, 3.2
- **Kontekst werdyktu**: ❌, ❌, 🟡 (1/2)
- **Nakład**: 12
- **Zakres**: companion/app + external (dane ZHI, ETIM Polska, MEGACENNIK); platform dla filtrów cech
- **Zależności**: A.10, A.13, A.4
- **Rezultat**: produkty mają klasę i cechy ETIM, nieskojarzone pozycje trafiają na listę, dopasowanie porównuje parametry.
- **Uwagi**: moduł `sync_bmecat` wzorowany na `sync-akeneo`; parser SAX; scorer cech z normalizacją jednostek.

### B.2 — Brak dopasowania i zamienniki
- **Story**: 3.7, 3.3
- **Kontekst werdyktu**: 🟡 (1/2), ❌
- **Nakład**: 6
- **Zakres**: platform (`inbox_ops`) + app (encja `product_substitutes`)
- **Zależności**: A.6
- **Rezultat**: pozycja bez sensownego kandydata ma status „brak dopasowania”; niedostępny produkt dostaje oznaczony zamiennik.

### B.3 — Poprawność cen i stanów
- **Story**: 4.3, 4.4, 4.5
- **Kontekst werdyktu**: 🟡 (1/2), ❌, ❌
- **Nakład**: 9
- **Zakres**: platform (`wms`, `sales`, `inbox_ops`)
- **Zależności**: A.10, A.9
- **Rezultat**: dostępność per oddział na pozycjach, flagi „brak ceny / stan nieznany”, ostrzeżenie o zmianie ceny/stanu przed wysłaniem.
- **Uwagi**: decyzja vs kontrakt dostępności z PR #6709.

### B.4 — Wysłanie oferty w wątku z PDF
- **Story**: 5.4
- **Kontekst werdyktu**: 🟡 (1/2)
- **Nakład**: 4
- **Zakres**: platform (`sales`/`documents`, adaptery kanałów)
- **Zależności**: A.7
- **Rezultat**: PDF oferty wychodzi jako odpowiedź w wątku zapytania ze skrzynki handlowej.
- **Uwagi**: koordynacja z companion PR #20 (generatory PDF).

### B.5 — Konwersja oferty w zamówienie z ciągłością
- **Story**: 5.5
- **Kontekst werdyktu**: 🟡 (1/2)
- **Nakład**: 3
- **Zakres**: platform (`sales`) lub app (interceptor komendy)
- **Zależności**: A.11
- **Rezultat**: zamówienie zachowuje powiązanie z ofertą i sprawą.
- **Uwagi**: po PR #6297.

### B.6 — Odrzucenie z powodem
- **Story**: 5.8
- **Kontekst werdyktu**: 🟡 (1/2)
- **Nakład**: 3
- **Zakres**: platform (`inbox_ops`)
- **Zależności**: brak
- **Rezultat**: powód odrzucenia zapisany i raportowany.

### B.7 — Audyt decyzji AI i handlowca
- **Story**: 9.3
- **Kontekst werdyktu**: ❌
- **Nakład**: 3
- **Zakres**: platform (`inbox_ops`, `audit_logs`)
- **Zależności**: A.7
- **Rezultat**: każda propozycja, akceptacja, odrzucenie i zapis do ERP są w `action_logs`; widoczna różnica względem propozycji AI.
- **Uwagi**: naprawić niedziałający `executionAuditor`.

### B.8 — Role i uprawnienia
- **Story**: 9.5
- **Kontekst werdyktu**: 🟡 (1/2)
- **Nakład**: 3
- **Zakres**: platform (`inbox_ops`) + app (rola kierownika)
- **Zależności**: brak
- **Rezultat**: osobne uprawnienia akceptacji, progów i metryk; przyciski ukryte bez uprawnień.

### B.9 — Wiadomości nieprzetwarzalne i spam
- **Story**: 1.6, 1.8
- **Kontekst werdyktu**: 🟡 (1/2), 🟡 (1/2)
- **Nakład**: 5
- **Zakres**: platform (`inbox_ops`)
- **Zależności**: A.1
- **Rezultat**: obsługa ręczna nieudanych wiadomości ze śladem; spam nie trafia do LLM.

### B.10 — Ponowienia zapisu do ERP
- **Story**: 6.5
- **Kontekst werdyktu**: 🟡 (1/2)
- **Nakład**: 3
- **Zakres**: app/companion + platform (indeks unikalny w `integrations`)
- **Zależności**: A.11
- **Rezultat**: idempotentne ponowienia bez duplikatów OF/ZK, przyczyna błędu widoczna na ofercie.

### B.11 — Metryki wartości
- **Story**: 8.1, 8.2, 8.3
- **Kontekst werdyktu**: 🟡 (1/2), ❌, ❌
- **Nakład**: 12
- **Zakres**: platform (`dashboards` — mediana, `sales` — wynik oferty i właściciel, `inbox_ops` — wyniki dopasowań)
- **Zależności**: B.4, B.5, A.7
- **Rezultat**: czas do oferty, konwersja N/M i trafność top-1/top-3 per handlowiec i okres.

### B.12 — Duże zestawienia w tle z postępem
- **Story**: 2.6
- **Kontekst werdyktu**: 🟡 (1/2)
- **Nakład**: 3
- **Zakres**: platform (`inbox_ops` + `progress`)
- **Zależności**: A.1, A.4
- **Rezultat**: setki pozycji przetwarzane w paczkach z postępem w pasku górnym.

### B.13 — Zamówienia powtarzalne deterministycznie
- **Story**: 5.6
- **Kontekst werdyktu**: ✅ (1/1)
- **Nakład**: 1
- **Zakres**: app (prompt rules / `business_rules`)
- **Zależności**: A.8
- **Rezultat**: stały klient z językiem zamówienia zawsze dostaje propozycję zamówienia.

### B.14 — Poświadczenia konektorów ERP
- **Story**: 6.6
- **Kontekst werdyktu**: ✅ (2/2)
- **Nakład**: 1
- **Zakres**: app (konfiguracja pól `secret`, Vault)
- **Zależności**: A.11
- **Rezultat**: hasła i klucze ERP szyfrowane i niewidoczne w API.

## Faza C — Różnicowanie i rozszerzenie

### C.1 — Uczenie z korekt handlowca
- **Story**: 3.6 · **Werdykt**: ❌ · **Nakład**: 3 · **Zakres**: platform lub app · **Zależności**: A.6, A.7

### C.2 — Auto-akceptacja powyżej progu
- **Story**: 5.3 · **Werdykt**: 🟡 (1/2, enterprise) · **Nakład**: 3 · **Zakres**: platform (enterprise `agent_orchestrator` lub OSS `inbox_ops`) · **Zależności**: A.6, A.3

### C.3 — Scalanie spraw z wielu kanałów
- **Story**: 1.2 · **Werdykt**: 🟡 (1/3) · **Nakład**: 4 · **Zakres**: platform (`customers`, `communication_channels`) · **Zależności**: A.8 · **Uwagi**: sprawdzić PR #6744 (DRAFT)

### C.4 — Zdjęcia i skany
- **Story**: 2.3 · **Werdykt**: ❌ · **Nakład**: 3 · **Zakres**: app (agent AI) + platform (podpięcie do inboxa) · **Zależności**: A.1, A.3

### C.5 — Konektory Optima/XL i enova365
- **Story**: 6.2, 6.3 · **Werdykt**: ❌, ❌ · **Nakład**: 10 · **Zakres**: companion + external · **Zależności**: A.10, B.10

### C.6 — Ceny projektowe
- **Story**: 4.2 · **Werdykt**: ❌ · **Nakład**: 4 · **Zakres**: app + platform (`PricingContext`) · **Zależności**: A.9

### C.7 — Model partnerski grup zakupowych
- **Story**: 9.4 · **Werdykt**: 🟡 (2/3) · **Nakład**: 4 · **Zakres**: app (feed katalogu grupy) lub platform (dziedziczenie zakresu) · **Zależności**: B.1

### C.8 — Raport jakości katalogu
- **Story**: 7.4 · **Werdykt**: ❌ · **Nakład**: 3 · **Zakres**: app · **Zależności**: B.1, A.13

### C.9 — Telefon: transkrypcja w propozycję
- **Story**: 1.4 · **Werdykt**: 🟡 (1/2) · **Nakład**: 5 · **Zakres**: platform (`phone_calls`, `inbox_ops`) + external (STT) · **Zależności**: C.3, A.1

### C.10 — WhatsApp i SMS
- **Story**: 1.5 · **Werdykt**: ❌ · **Nakład**: 5 · **Zakres**: platform (pakiety kanałów) + external (Meta, bramka SMS) · **Zależności**: C.3

### C.11 — Import z programów kosztorysowych
- **Story**: 2.4 · **Werdykt**: ❌ · **Nakład**: 4 · **Zakres**: app · **Zależności**: A.6

## Poza zakresem (na razie)
Brak — kanał głosowy i komunikatory są w Fazie C zgodnie z rekomendacją researchu („telefon w drugim etapie”). Story gotowe bez pracy: 1.7, 5.1, 5.7, 9.1.

## Prace przekrojowe
- Strategia upstreamu: dla każdej pozycji z flagą `platform` zdecydować — PR do open-mercato czy nakładka w aplikacji (podmiana komponentów, interceptory, encje-rozszerzenia).
- Infrastruktura wyszukiwania (Meilisearch, baza wektorowa, embeddingi) — warunek A.4 i A.6.
- Śledzenie otwartych PR-ów: #6264, #6293, #6297, #6318, #6346, #6486, #6681, #6702, #6709, companion #20.

## Podsumowanie nakładu
| Faza | Pozycje | Story | Nakład (commity) |
|---|---|---|---|
| A — Fundament | 13 | 14 | 50 |
| B — Rdzeń | 14 | 22 | 68 |
| C — Różnicowanie | 11 | 12 | 48 |
| Przekrojowe | 3 | — | — |
| **Razem** | **41** | **48** | **166** |

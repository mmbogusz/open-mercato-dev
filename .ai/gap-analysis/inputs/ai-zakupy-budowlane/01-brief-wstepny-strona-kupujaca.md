# Brief wstępny — AI do zakupów materiałów dla firm budowlanych (strona kupująca)

> Status: materiał wejściowy do discovery i analizy luk. Każde twierdzenie ma oznaczony poziom pewności:
> **[FAKT-PDF]** — z researchu `00-research-hurtownie-wrzesien-2026.pdf`;
> **[FAKT-KOD]** — zweryfikowane bramką w analizie luk strony hurtowni (`.ai/gap-analysis/ai-inbox-hurtownie.md`);
> **[KOD-POBIEŻNIE]** — sprawdzone w kodzie platformy bez bramki;
> **[ZAŁOŻENIE]** — hipoteza zespołu do potwierdzenia.

## Wizja docelowa

Platforma dwustronna: firmy budowlane kupują materiały, hurtownie je sprzedają. **Start od strony kupującej (firmy budowlane).** Strona hurtowni (AI Inbox dla hurtowni) jest opisana w PDF i przeanalizowana w `ai-inbox-hurtownie*.md` — dołącza w drugim etapie. [ZAŁOŻENIE]

## Problem (strona kupująca)

Firma budowlana realizująca projekt musi kupić materiały u wielu hurtowni. Dziś: ręczne wyciąganie specyfikacji z dokumentacji projektu, rozsyłanie zapytań mailem i telefonicznie, zbieranie ofert w różnych formatach, porównywanie w Excelu, negocjacje rozproszone po kanałach bez wspólnego kontekstu. [ZAŁOŻENIE — brak danych o skali bólu]

Strona hurtowni potwierdza ten obraz od drugiej strony: zapytania przychodzą jako PDF/Excel/zdjęcia projektu, mailem i telefonicznie, a wykonawca „nie zmienia kanału kontaktu”. [FAKT-PDF, s. 2–3]

## Klient i role

| Rola | Kto | Co go obchodzi |
|---|---|---|
| Decydent | właściciel firmy wykonawczej / dyrektor kontraktu GW | marża na projekcie, budżet vs kosztorys [ZAŁOŻENIE] |
| Użytkownik główny | zaopatrzeniowiec, kierownik budowy, kosztorysant | czas zebrania ofert, kompletność, terminy dostaw [ZAŁOŻENIE] |
| Druga strona | handlowiec hurtowni (oferent) | szybkie i kompletne zapytanie [FAKT-PDF, s. 3] |

Skala rynku: ok. 442 tys. aktywnych firm budowlanych, 95,9% to mikrofirmy (GUS, IV kw. 2025) [FAKT-PDF, s. 6]. Segment docelowy (wielkość firmy, typ robót) — nieustalony.

## Proces docelowy (5 kroków)

1. **Projekt → specyfikacja materiałów.** Z dokumentacji projektu (przedmiar, kosztorys, zestawienia, specyfikacje techniczne; PDF, Excel, ATH z Normy/Zuzi/Rodosa) powstaje lista pozycji z ilością i jednostką.
2. **Harmonogram dostaw.** Każda pozycja/pakiet ma wymagany termin i miejsce dostawy, powiązane z etapami budowy.
3. **Rozesłanie zapytań i zbieranie ofert.** Pakiety idą do N hurtowni; oferty (PDF/Excel/treść maila/SMS/WhatsApp/telefon) są normalizowane do wspólnej macierzy: cena, jednostka, dostępność, termin vs harmonogram, zamienniki, warunki, transport.
4. **Negocjacje wielokanałowe.** Mail, SMS, WhatsApp (docelowo telefon). Per oferent: ciągłe podsumowanie kontekstu rozmowy. System podpowiada argumenty z ofert innych oferentów i szkicuje wiadomości; człowiek zatwierdza każdą wysyłkę.
5. **Wybór i zamówienie.** Wybór oferenta per pozycja/pakiet (możliwy podział), zamówienie, śledzenie dostaw względem harmonogramu.

### Doprecyzowanie kroku 3 (2026-10-01): optymalny koszyk

„Porównanie ofert” znaczy: od kilku hurtowni przyszło kilka ofert, a użytkownik potrzebuje narzędzia, które **zbuduje optymalne zamówienie** — podział pozycji między hurtownie o najniższym koszcie całkowitym, z uwzględnieniem rabatów (od cennika, od wartości koszyka, pakietowych), darmowej dostawy od kwoty, kosztów transportu/HDS, minimów logistycznych i opakowań, dostępności i terminów vs harmonogram, zamienników i terminu płatności. Wynik: rekomendowany podział z rozbiciem kosztu, scenariusze „co jeśli” (np. maks. N hurtowni) i cena docelowa per oferent/pakiet jako argument do negocjacji (krok 4). Szczegóły i uzasadnienie: `02-research-zakupy-budowlane-pazdziernik-2026.pdf`, sekcja „Optymalizacja koszyka”. [ZAŁOŻENIE — wartość do zmierzenia w walidacji]

## Kandydaci na epiki

| Epik | Krok procesu |
|---|---|
| E1. Specyfikacja z dokumentacji projektu (w tym import kosztorysów ATH) | 1 |
| E2. Projekt budowy i harmonogram dostaw | 2 |
| E3. Rejestr oferentów i rozsyłanie zapytań (jedna paczka → wielu odbiorców, terminy, przypomnienia) | 3 |
| E4. Przyjmowanie i normalizacja ofert do macierzy porównawczej | 3 |
| E4b. Optymalny koszyk: podział zamówienia między oferentów (rabaty, progi darmowej dostawy, transport, minima, terminy, termin płatności), scenariusze, cena docelowa | 3 |
| E5. Wątek z oferentem przez wszystkie kanały (mail, SMS, WhatsApp, telefon) | 4 |
| E6. Copilot negocjacji: podsumowanie kontekstu, argumenty, szkice wiadomości z akceptacją | 4 |
| E7. Wybór, zamówienie zakupu, śledzenie dostaw | 5 |
| E8. Metryki: oszczędność vs kosztorys, czas odpowiedzi oferentów | przekrój |
| E9. SaaS: izolacja danych, RODO, audyt, role | przekrój |

## Ponowne użycie z analizy strony hurtowni

| Story (strona hurtowni) | Werdykt | Rola po stronie kupującej |
|---|---|---|
| 1.1 Odbiór e-mail z załącznikami | 🟡 [FAKT-KOD] | krytyczne — oferty przychodzą jako załączniki; luka opisana w upstream issue #6282 (nieprzypisane) |
| 2.1 / 2.2 / 2.3 Ekstrakcja z PDF / Excela / zdjęć | 🟡 / ❌ / ❌ [FAKT-KOD] | krytyczne, podwójnie: z dokumentacji projektu i z ofert |
| 2.4 Import z programów kosztorysowych | ❌ [FAKT-KOD] | awans do P0 — naturalne źródło specyfikacji wykonawcy |
| 2.5 Pewność i jednostka per pozycja | ❌ [FAKT-KOD] | krytyczne dla wiarygodnego porównania ofert |
| 2.6 Duże zestawienia w tle | 🟡 [FAKT-KOD] | ważne — projekt to setki/tysiące pozycji |
| 3.4 Przeliczniki jednostek | 🟡 [FAKT-KOD] | krytyczne — normalizacja ofert do jednostek specyfikacji |
| 3.5 + 5.2 Kandydaci z pewnością + ekran porównania | ❌ / ❌ [FAKT-KOD] | mechanizm do ponownego użycia: pozycja specyfikacji ↔ pozycja oferty; ekran porównania → macierz ofert |
| 3.2 / 3.3 Cechy ETIM / zamienniki | 🟡 / ❌ [FAKT-KOD] | ocena równoważności zamienników proponowanych przez oferentów |
| 1.2 Sprawa łącząca kanały | 🟡 [FAKT-KOD] | rdzeń produktu — wątek z oferentem; upstream draft PR #6744 projektuje historię maili w CRM |
| 1.3 Rozpoznanie nadawcy po domenie/telefonie | 🟡 [FAKT-KOD] | przypisanie wiadomości do oferenta; upstream issue #5765 w toku |
| 1.4 / 1.5 Telefon / WhatsApp, SMS | 🟡 / ❌ [FAKT-KOD] | wymagane; WhatsApp zajęty w upstream issue #930 (bez ruchu od 2026-04-14) |
| 5.4 Wysyłka w wątku z załącznikiem | 🟡 [FAKT-KOD] | krytyczne — rozesłanie zapytania z zestawieniem; adaptery Gmail/IMAP nie wysyłają załączników |
| 1.6 / 1.7 / 1.8 Błędy, idempotencja, spam i prompt injection | 🟡 / ✅ / 🟡 [FAKT-KOD] | 1.8 ważniejsze — oferent może próbować manipulować negocjatorem AI |
| 5.3 / 5.7 / 5.8 / 9.3 Akceptacja przez człowieka, blokada edycji, odrzucenie, audyt | 🟡 / ✅ / 🟡 / ❌ [FAKT-KOD] | każda wychodząca wiadomość negocjacyjna przez akceptację i audyt |
| 9.1 / 9.2 / 9.5 Izolacja / RODO / role | ✅ / 🟡 / 🟡 [FAKT-KOD] | 9.2 ważniejsze — korespondencja z wieloma stronami |
| 4.x ceny klienta, 6.x konektory ERP hurtowni, 7.1 import ETIM, 5.1/5.6 szkic oferty sprzedaży | — | poza startem; wracają przy stronie hurtowni |

## Platforma — nowe obszary (sprawdzone pobieżnie)

- Brak modułu zakupów: brak encji dostawcy, zapytania do dostawcy, oferty dostawcy, zamówienia zakupu. [KOD-POBIEŻNIE]
- Brak encji projektu budowy i harmonogramu dostaw; `planner` to reguły dostępności personelu, `resources` to rezerwacja zasobów. [KOD-POBIEŻNIE]
- Firmy w CRM (`customers`) mogą reprezentować oferentów (tagi / pola własne); transakcje (deals) mają etapy oraz wynik wygrana/przegrana z powodem — kandydat na „negocjację per oferent”. [KOD-POBIEŻNIE]
- Wysyłka z podłączonej skrzynki pracownika z wątkowaniem istnieje (`communication_channels`); brak wysyłki jednej paczki do wielu odbiorców. [KOD-POBIEŻNIE]
- AI: agenci i akcja „summarize” w CRM działają na żądanie; brak trwałego, aktualizowanego podsumowania wątku. Wzorzec propozycji do akceptacji z `inbox_ops` nadaje się na szkice wiadomości negocjacyjnych. [KOD-POBIEŻNIE]

## Reguły biznesowe (propozycje)

- R1. Żadna wiadomość do oferenta nie wychodzi bez zatwierdzenia przez człowieka (do czasu decyzji o polityce progowej). [ZAŁOŻENIE]
- R2. Argumenty z ofert innych oferentów są zanonimizowane i zagregowane („oferta niższa o X na pozycję Y”); nie ujawniamy nazwy konkurenta ani nie przekazujemy jego dokumentów. [ZAŁOŻENIE — wymaga opinii prawnej]
- R3. Pozycja oferty bez jednoznacznego dopasowania do specyfikacji nie trafia do porównania bez weryfikacji. [ZAŁOŻENIE]

## Ryzyka

1. **Poufność ofert i prawo konkurencji** przy argumentach z ofert innych oferentów — do oceny prawnej przed zaprojektowaniem copilota.
2. **Jakość specyfikacji wejściowej** — jeśli wykonawcy mają głównie PDF projektu (bez kosztorysu ATH), wraca problem odczytu z rysunków, który PDF nazywa osobną kategorią (takeoff). [FAKT-PDF, s. 10]
3. **Zależność od upstreamu** — fundamenty (załączniki, ekstrakcja, schemat pozycji, wysyłka z załącznikami) wymagają zmian we współdzielonych modułach open-mercato.
4. **Kanały** — WhatsApp wymaga onboardingu Meta Business; nagrywanie i transkrypcja rozmów telefonicznych wymagają zgód.

## Otwarte pytania (do researchu)

- Kto kupuje i płaci: GW, średni wykonawca, instalator? Jaki segment na start?
- Jak dziś wygląda zakup: ile hurtowni na zapytanie, ile rund, ile czasu, jakie kanały?
- Jaka oszczędność uzasadni cenę; model cenowy (abonament, % od oszczędności, opłata za projekt)?
- Konkurencja po stronie zakupów w budownictwie (PL/UE): platformy zakupowe/przetargowe, moduły zakupów w programach kosztorysowych.
- Jak często specyfikacja jest w formie kosztorysu (ATH) vs tylko PDF projektu?
- Kiedy i jak dołącza strona hurtowni (portal odpowiedzi zamiast maila)?

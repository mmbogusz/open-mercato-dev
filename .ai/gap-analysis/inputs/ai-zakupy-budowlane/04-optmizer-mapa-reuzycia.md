# Mapa ponownego użycia: `mmbogusz/optmizer` → optymalny koszyk (strona kupująca)

> Status: materiał wejściowy do discovery i implementacji (krok 10). Kod **linkujemy, nie kopiujemy**: `optmizer` żyje dalej, a kopia w tym repozytorium by się zestarzała. Decyzję „biblioteka vs przeniesienie do modułu aplikacji” podejmujemy przy specyfikacji funkcji (`om-spec-writing`).
> Wersja referencyjna: commit [`bf0dbb5`](https://github.com/mmbogusz/optmizer/tree/bf0dbb597fc0f2008715daeea191c9d21f251426) (repozytorium prywatne).
> Uzasadnienie i mapa funkcji → budownictwo: raport `02-research-zakupy-budowlane-pazdziernik-2026.pdf`, sekcja „Prototyp referencyjny”.

## Co przenieść

| Plik | Co robi | Użycie po stronie kupującej | Sposób |
|---|---|---|---|
| [`src/core/optimize.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/core/optimize.ts) | Budowa modelu MILP (`buildModel`), drugie przejście „najmniej przy tej cenie” (`buildTrimmedModel`), dekodowanie wyniku, blokery przed solverem (`findBlockers`), powód nadwyżki (`canHitExactly`), wariant bez dostawcy (`withoutSuppliers`) | Rdzeń optymalnego koszyka | Przenieść i rozszerzyć (patrz „Rozszerzenia”) |
| [`src/core/promotions.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/core/promotions.ts) | Tryby zakupu = dozwolone kombinacje promocji; tylko tryby maksymalne | Rabaty ilościowe i ceny pakietowe hurtowni | Przenieść |
| [`src/core/lp.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/core/lp.ts) | Builder modelu liniowego, zapis do formatu CPLEX LP, wyjątek przy zduplikowanej nazwie ograniczenia | Bez zmian | Przenieść |
| [`src/main/solver.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/main/solver.ts) | HiGHS (WASM, MIT), `mip_rel_gap: 0`, obsługa limitu czasu | Uruchamiane w workerze kolejki platformy, nie w żądaniu HTTP | Przenieść logikę, zmienić host |
| [`src/core/money.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/core/money.ts) | Kwoty w groszach | Bez zmian | Przenieść |
| [`src/core/substitutes.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/core/substitutes.ts) | Rozwijanie zamienników do pozycji przed solverem; „tylko przy braku”; wyłączenia per pozycja | Zamienniki zapisane przez kupującego i zgłoszone przez hurtownię | Przenieść + stan akceptacji |
| [`src/core/runnerUp.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/core/runnerUp.ts) | „Następny najtańszy” — liczba do prośby o rabat | Wejście do copilota negocjacji (E6) | Przenieść, potem rozszerzyć o cenę docelową liczoną solverem |
| [`src/core/fillers.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/core/fillers.ts) | Najmniejsza kwota domykająca próg darmowej dostawy (plecak), tylko propozycja | Kandydaci = pozycje z kolejnych etapów harmonogramu | Przenieść, zmienić źródło kandydatów |
| [`src/core/quantity.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/core/quantity.ts) | Zawartość opakowania z nazwy („2 kg”, „0,5 l”) | Rozszerzyć o m², mb, krąg, paleta | Przenieść + słownik budowlany |
| [`src/core/import.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/core/import.ts) | Zapis odczytanego cennika: reguły blokujące (pusta lub niezgodna jednostka), skoki cen ≥10% | Realizacja R3 przy ofertach hurtowni | Przenieść reguły; zapis przez komendy platformy |
| [`src/main/extract.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/main/extract.ts) + [`src/core/providers.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/core/providers.ts) | Odczyt dokumentu przez LLM w sztywnym schemacie, `priceBasis`, ratowanie uciętej odpowiedzi, rejestr usług z kosztem | Ekstrakcja ofert PDF/Excel/mail | Wzorzec; w platformie przez `ai-assistant` i providerów platformy |
| [`src/core/demand.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/core/demand.ts) | Kartka zapotrzebowania → lista: dopasowanie dokładne / zgadnięte / remis | Import zestawienia lub przedmiaru | Wzorzec |
| [`src/core/history.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/core/history.ts), [`src/core/priceHistory.ts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/src/core/priceHistory.ts) | Odcisk danych i aktualność planu; dziennik cen | Aktualność planu + wygasanie ofert; historia rund negocjacji | Wzorzec; dane w encjach platformy |
| [`tests/golden.mts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/tests/golden.mts), [`tests/bruteforce.mts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/tests/bruteforce.mts) | Przypadki złote + pełny przegląd wariantów na losowych małych przypadkach | Standard jakości modułu | Przenieść i rozszerzyć o nowe reguły |
| [`scripts/compareModels.mts`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/scripts/compareModels.mts) | Ten sam plik czytany kilkoma modelami, różnice w cenach | Wybór modelu do ekstrakcji ofert | Przenieść jako skrypt |
| [`docs/DECYZJE.md`](https://github.com/mmbogusz/optmizer/blob/bf0dbb597fc0f2008715daeea191c9d21f251426/docs/DECYZJE.md) | Reguły biznesowe zaszyte w modelu, pułapki, „Do ustalenia” | Lista założeń do potwierdzenia z hurtowniami budowlanymi | Czytać przed zmianą modelu |

## Czego nie przenosić

- `src/renderer/*` (React + HeroUI) — UI powstaje w design systemie open-mercato (`CrudForm`, `DataTable`, tokeny DS).
- `src/main/storage.ts`, `secrets.ts`, `preload/*` — trwałość, sekrety i IPC zapewnia platforma (encje, szyfrowanie, sejf poświadczeń).
- `src/core/search.ts`, `text.ts` — w platformie wyszukiwanie dają `packages/search` i query engine.

## Rozszerzenia wymagane przez budownictwo

1. Rabaty od wartości zamówienia (progowe) i na grupę producenta — dziś promocja tylko na parę dostawca + produkt (DECYZJE, reguła 5).
2. Dostawy w czasie i na kilka adresów: koszt i próg per (hurtownia × termin × budowa); dostępność częściowa i termin realizacji vs harmonogram.
3. Termin płatności (koszt pieniądza w celu) i limit kredytu kupieckiego (ograniczenie).
4. Ważność oferty i rundy negocjacji jako wersje oferty.
5. Ilości ułamkowe (kabel na metry).
6. Przełącznik „jeden wariant / jeden system na pozycję” (DECYZJE: opisany jako przyszły).
7. Preferencje: limit liczby hurtowni, koszt obsługi dodatkowej dostawy, preferowany dostawca.
8. Zamknięcie „znanego ograniczenia” (dwie niełączące się promocje) przez big-M — przy progach rabatowych B2B przypadek częstszy.
9. Cena docelowa per oferent i pakiet liczona ponownym rozwiązaniem modelu (rozszerzenie `runnerUp`).

# Szkic issue do upstreamu: ekstrakcja tekstu z XLSX

> Wygenerowane przez `om-prepare-issue` w trybie szkicu (bez zapisu w trackerze — brak uprawnień do `open-mercato/open-mercato` z tej sesji).
> Do wklejenia ręcznie w https://github.com/open-mercato/open-mercato/issues/new
> Repozytorium: `open-mercato/open-mercato` · Etykiety: `feature`, `priority-medium`, `risk-medium` · Przypisanie: brak (zgłoszenie chęci w pierwszym komentarzu)
> Branch implementacji (fork): `mmbogusz/open-mercato-dev` → `feat/attachments-xlsx-text-extraction`, odbity od głowy PR #6264 (`877217d4`).
> Stan 2026-10-03: implementacja gotowa na tym branchu (`om-auto-create-pr` → `om-code-review` → `om-check-and-commit`); ODS wycięty z zakresu — szczegóły tylko w prywatnym zgłoszeniu do `hucre`, nie w tym publicznym repo.

## Wyszukiwanie duplikatów (2026-10-01, publiczne strony GitHuba)

- Issues/PR „xlsx”: 8 wyników, żaden nie dotyczy ekstrakcji z XLSX. Najbliższe: #1481 (merged — usunięcie markitdown, XLSX świadomie → `null`, „no pure-JS extractor available yet”), #1110 (merged — `sync_excel`, tylko CSV).
- Issues „excel OR spreadsheet OR markitdown”: 119 wyników, brak duplikatu; powiązane: #6282 (załączniki w `inbox_ops`), #6726 (resolvery dostępu do załączników — inny obszar).
- Spec obejmujący temat: brak. `.ai/specs/2026-04-27-ai-agent-attachment-processing-and-context.md` (linia 100) wymienia zaimplementowane formaty bez XLSX; `SPEC-040` (`document_parser`, Draft) nie jest zaimplementowany.
- Decyzja: nowe issue, bez specu (mała funkcja, oczywisty zakres zmian — krok 4 skilla).

---

**Title:** `Implement: pure-JS, bounded XLSX/XLSM text extraction for attachments`

**Body:**

## 🎯 Change

Spreadsheets are the most common format for supplier offers, price lists and order lists, and the platform already accepts `.xlsx` uploads (`attachments/lib/security.ts`). But `extractAttachmentContent` returns `null` for XLSX (`attachments/lib/textExtraction.ts`, "no safe pure-JS extractor available yet", since #1481 removed the markitdown shell-out). So `attachments.content` stays empty for every spreadsheet: attachment search, AI agents reading attachments as inline text, and any future inbox attachment flow (#6282, phase 2) cannot see what is inside.

Proposal: restore spreadsheet extraction in pure JS, in-process, with explicit resource bounds — the same direction #1481 and #6264 set for PDFs.

## 📋 Scope

- `packages/core/src/modules/attachments/lib/textExtraction.ts`: dispatch Open XML workbooks — `.xlsx`, `.xlsm`, `.xltx`, `.xltm` (one container and reader; macros are never read or run) — to a new `lib/spreadsheetText.ts`, which returns sheet names and cell values as plain text.
- Bounds configurable by env, following the `ocrLimits.ts` pattern from #6264.
- Docs (`apps/docs/docs/api/attachments.mdx`, the attachment bounds table in `framework/security/rate-limiting.mdx`) and both `.env.example` files.

Non-goals: legacy `.xls` (BIFF8) and `.xlsb` — the same library reads them, but not with the same guarantees yet: in 1.x `readXlsb` has no cell cap (added in the unreleased v2, productdevbook/hucre#570), and `.xls` is not covered by the library's fuzz tests and needs committed binary fixtures (the library cannot write `.xls`). `.ods` — deferred until a fix lands upstream in the library (reported to its maintainer). PPTX/MSG; formula evaluation; number formatting from styles; images in sheets; `.xlsx` support in `sync_excel` imports (possible follow-up reusing the same reader).

No DB, API or event changes; `extractAttachmentContent` keeps its signature. Only new uploads are affected.

## ✅ Done when

- Uploading an `.xlsx` or `.xlsm` to a partition with OCR/extraction enabled stores text containing each non-empty sheet's name and its cell values (shared strings, inline strings, numbers, booleans, dates, cached formula results).
- A corrupt or password-protected file, a zip bomb, or a workbook over the sheet/cell/text caps never fails the upload: extraction returns `null` or the text read so far, logs a warning, and failures reach `reportError`.
- No `child_process`; the HUNT-PARSER-01 regression guards still pass and also cover the new file.
- Unit tests cover the cases above with workbooks built in the test (no binary fixtures).

## 📝 Spec

None needed — single-function change with an obvious surface. Related: #1481, #6264, #6282, `.ai/specs/2026-04-27-ai-agent-attachment-processing-and-context.md` (format table to update).

<details>
<summary>🔍 Implementation notes</summary>

1. `isSpreadsheet(mimeType, ext)` in `textExtraction.ts` — `application/vnd.openxmlformats-officedocument.spreadsheetml.{sheet,template}`, `application/vnd.ms-excel.{sheet,template}.macroenabled.12`, or `.xlsx`/`.xlsm`/`.xltx`/`.xltm` — dispatching before the final `return null`; the comment narrows to the formats still unsupported.
2. `lib/spreadsheetText.ts` is the only file importing `hucre`, via `import('hucre/xlsx')` (as `pdfjs-dist` is loaded today). Sheet names come from `readXlsx` with a `sheets` predicate that selects nothing; rows come from `streamXlsxRows` one sheet at a time, so memory tracks one sheet rather than the workbook. Cell values are cached results; formulas are never evaluated.
3. Bounds (env, next to the OCR ones in `ocrLimits.ts`): `OM_ATTACHMENT_SPREADSHEET_MAX_UNCOMPRESSED_BYTES` (per archive entry, zip-bomb bound, default 10 MiB), `OM_ATTACHMENT_SPREADSHEET_MAX_SHEETS` (10), `OM_ATTACHMENT_SPREADSHEET_MAX_CELLS` (grid cells scanned, empty ones included, 1,000,000), `OM_ATTACHMENT_SPREADSHEET_MAX_TEXT_CHARS` (1,000,000). The text cap is checked cell by cell, so one long shared string referenced by many cells cannot inflate the output. Hitting a cap, or a read error part-way through, keeps the text read so far and `logger.warn`s; failures also go through `getTelemetryRuntime()?.reportError` with `attachments.spreadsheet_extraction_failed`.
4. Output: one `## <sheet name>` line per non-empty sheet, then tab-separated rows; empty rows skipped, trailing empty cells trimmed, whitespace inside a cell collapsed; dates as `YYYY-MM-DD` (or `YYYY-MM-DD HH:MM:SS`). The formatter already accepts the structured error cells of the upcoming v2 (`{ error }`), so the major-version migration stays inside the wrapper.
5. `hucre` ships ESM only, so `packages/core/jest.config.cjs` transforms `.mjs` and adds `hucre` to `transformIgnorePatterns`.
6. Declared as `^1.1.0` like the repo's other dependencies (the caret keeps it on 1.x).

Extraction runs synchronously in the upload request (`attachments/api/route.ts`, `lib/scoped-upload-service.ts`) and in the OCR overflow fallback (`lib/ocrQueue.ts`), so the bounds are what keep upload latency and memory predictable. Measured cost of the shared-strings table, which the reader parses once per sheet: ~1 s and ~0.5 GB peak at the 10 MiB cap; a realistic 100k-row price list (4 MB file) yields the first ~1M characters and stops at the text cap.

</details>

## ⚠️ Open questions

1. **Blocking — dependency sign-off.** Proposal: [`hucre`](https://github.com/productdevbook/hucre) (MIT, pure TypeScript, native ESM, zero dependencies, Node ≥ 24 like this repo) as one direct dependency of `@open-mercato/core`, imported only via `hucre/xlsx`. It exposes the bounds this needs (`maxDecompressedBytes`, `maxSpinCount`, streaming rows) and in a local check it rejected a 300 MB zip bomb at a 50 MB cap (on both the buffered and the streaming path), did not expand a "billion laughs" DTD, and read `.xlsm`, `x:`-prefixed parts, inline and rich-text strings and cached formula values correctly. Trade-off: the project is young (first release March 2026) with a small maintainer base — mitigated by staying on 1.x, by the conservative caps above, and by keeping it behind one wrapper file. It would sit next to `pdfjs-dist` and `mammoth`, which already serve the same function for PDF and DOCX.
   Considered and rejected: SheetJS `xlsx` (npm stops at 0.18.5 with known high-severity advisories, patched builds only from its own CDN — would fail the audit gate); `exceljs` (no release since 4.4.0 in 2023, nine runtime dependencies with open advisories, CommonJS); `read-excel-file` (mature and maintained, but no documented decompression or cell bounds for untrusted input).
   Fallback if a new package is unwanted: a minimal reader for the few OOXML elements needed on `jszip` (already a production dependency of `@open-mercato/documents`) — more code owned here, more edge cases to test.
2. Non-blocking — output format: tab-separated rows (compact for LLM context) vs markdown tables.
3. Non-blocking — default caps (10 MiB per entry, 10 sheets, 1M scanned cells, 1M characters). The entry cap is deliberately low because shared-strings parsing costs roughly 40–50× its size in memory.
4. Non-blocking — wrapper location: kept inside `attachments` for now, to be promoted to a `packages/shared` helper when the second consumer (e.g. `sync_excel` `.xlsx` import) lands, so its public shape is designed against two real callers rather than one. Happy to put it in `shared` from the start if preferred.

Builds on #6264 (same file, same limits pattern); the PR will be rebased after #6264 merges.

Out of scope here, but the same vetted dependency would let later, separate PRs add `.xls` (with committed fixtures), `.xlsb` (once a release carries its cell cap) and `.ods` extraction, drop hand-rolled code or add `.xlsx` where users now have to "save as CSV": `.xlsx` uploads in `sync_excel` and in the WMS inventory import (both CSV-only today), the dependency-free XLSX writer in `staff/lib/timesheets-reports/xlsx.ts` (written by hand because the repo has no spreadsheet library), and the two separate `parseCsvText` implementations in `sync_excel/lib/parser.ts` and `wms/lib/inventoryImportCsv.ts`. The financial module work points the same way: SPEC-024 lists Excel among high-priority report export formats and CSV bank-statement import, and the default chart-of-accounts spec (#6137) anticipates importing a "plan kont" from Excel.

<details>
<summary>🏷️ label rationale</summary>

- ✨ `feature` — restores a capability (text from spreadsheets) that the platform does not have today.
- 🟡 `priority-medium` — net-new feature, not release-blocking.
- 🟠 `risk-medium` — single-module change shipped with tests, but it parses untrusted uploads in the request path and adds a direct production dependency to `@open-mercato/core`.

</details>

---

## Pierwszy komentarz (zgłoszenie chęci, po utworzeniu issue)

> I'd like to take this. An implementation following the notes above is ready on my fork (built on top of #6264, with unit tests); I'll open the PR once #6264 merges. Before that I'd appreciate a 👍 / 👎 on the dependency choice (open question 1) from a maintainer — happy to switch to the jszip-only fallback if a new package is unwanted.

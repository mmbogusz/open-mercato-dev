# Szkic issue do upstreamu: ekstrakcja tekstu z XLSX

> Wygenerowane przez `om-prepare-issue` w trybie szkicu (bez zapisu w trackerze — brak uprawnień do `open-mercato/open-mercato` z tej sesji).
> Do wklejenia ręcznie w https://github.com/open-mercato/open-mercato/issues/new
> Repozytorium: `open-mercato/open-mercato` · Etykiety: `feature`, `priority-medium`, `risk-medium` · Przypisanie: brak (zgłoszenie chęci w pierwszym komentarzu)
> Branch implementacji (fork): `mmbogusz/open-mercato-dev` → `feat/attachments-xlsx-text-extraction`, odbity od głowy PR #6264 (`877217d4`).

## Wyszukiwanie duplikatów (2026-10-01, publiczne strony GitHuba)

- Issues/PR „xlsx”: 8 wyników, żaden nie dotyczy ekstrakcji z XLSX. Najbliższe: #1481 (merged — usunięcie markitdown, XLSX świadomie → `null`, „no pure-JS extractor available yet”), #1110 (merged — `sync_excel`, tylko CSV).
- Issues „excel OR spreadsheet OR markitdown”: 119 wyników, brak duplikatu; powiązane: #6282 (załączniki w `inbox_ops`), #6726 (resolvery dostępu do załączników — inny obszar).
- Spec obejmujący temat: brak. `.ai/specs/2026-04-27-ai-agent-attachment-processing-and-context.md` (linia 100) wymienia zaimplementowane formaty bez XLSX; `SPEC-040` (`document_parser`, Draft) nie jest zaimplementowany.
- Decyzja: nowe issue, bez specu (mała funkcja, oczywisty zakres zmian — krok 4 skilla).

---

**Title:** `Implement: pure-JS, bounded XLSX text extraction for attachments`

**Body:**

## 🎯 Change

Spreadsheets are the most common format for supplier offers, price lists and order lists, and the platform already accepts `.xlsx` uploads (`attachments/lib/security.ts`). But `extractAttachmentContent` returns `null` for XLSX (`attachments/lib/textExtraction.ts`, "no safe pure-JS extractor available yet", since #1481 removed the markitdown shell-out). So `attachments.content` stays empty for every spreadsheet: attachment search, AI agents reading attachments as inline text, and any future inbox attachment flow (#6282, phase 2) cannot see what is inside.

Proposal: restore XLSX extraction in pure JS, in-process, with explicit resource bounds — the same direction #1481 and #6264 set for PDFs.

## 📋 Scope

- `packages/core/src/modules/attachments/lib/textExtraction.ts`: an `.xlsx` branch that returns sheet names and cell values as plain text.
- Bounds configurable by env, following the `ocrLimits.ts` pattern from #6264.
- Docs (`apps/docs/docs/api/attachments.mdx`) and both `.env.example` files.

Non-goals: legacy `.xls` (BIFF), `.xlsm`, `.xlsb`, `.ods`, PPTX/MSG; formula evaluation; number/date formatting from styles; images in sheets; `.xlsx` support in `sync_excel` imports (possible follow-up reusing the same reader).

No DB, API or event changes; `extractAttachmentContent` keeps its signature. Only new uploads are affected.

## ✅ Done when

- Uploading an `.xlsx` to a partition with OCR/extraction enabled stores text containing each sheet name and its cell values (shared strings, inline strings, numbers, booleans, cached formula results).
- A corrupt file, a zip bomb (declared or actual uncompressed size over the cap) or a file over the cell cap never fails the upload: extraction returns `null` or truncated text and logs a warning.
- No `child_process`; the HUNT-PARSER-01 regression guards still pass.
- Unit tests cover the cases above with fixtures built in the test (no binary fixtures).

## 📝 Spec

None needed — single-function change with an obvious surface. Related: #1481, #6264, #6282, `.ai/specs/2026-04-27-ai-agent-attachment-processing-and-context.md` (format table to update).

<details>
<summary>🔍 Implementation notes</summary>

1. Add `isXlsx(mimeType, ext)` (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` or `.xlsx`) and `extractXlsxText(filePath)`; dispatch before the final `return null` and narrow the comment to the formats still unsupported.
2. Load `hucre/xlsx` with a dynamic `import()` (as `pdfjs-dist` is loaded today) and read with explicit bounds: `maxDecompressedBytes` (zip-bomb cap, per entry), `maxTotalCells`, and `sparse: true` or `streamXlsxRows` per sheet so a sparse sheet does not allocate its bounding box. Cell values come from cached results; formulas are never evaluated.
3. Keep the library behind `extractXlsxText(filePath)` so it can be swapped without touching callers; pin the exact version.
4. Output: one `## <sheet name>` line per sheet, then tab-separated rows; skip empty rows; stop at the output-length cap and `logger.warn` on truncation (as #6264 does for PDF pages). A `ZipError` / parse error → `null`, logged.
5. Limits next to the OCR ones (proposal): `OM_ATTACHMENT_XLSX_MAX_UNCOMPRESSED_BYTES`, `OM_ATTACHMENT_XLSX_MAX_CELLS`; mirror in `apps/mercato/.env.example` and the create-app template (`yarn template:sync:fix`).
6. Tests in `attachments/lib/__tests__/textExtraction.test.ts`, building workbooks in the test (no binary fixtures): shared/inline strings, rich text, `x:`-prefixed parts (OpenXML SDK exports), formula with cached value, multiple sheets, empty sheet, corrupt archive, zip bomb, cell-cap truncation. `hucre` ships ESM only (`.mjs`), so `packages/core/jest.config.cjs` needs it in `transformIgnorePatterns` with an `.mjs` transform (or the test runs it through the existing dynamic-import path).
7. Docs: add XLSX to the "Pure-JS extraction" section of `apps/docs/docs/api/attachments.mdx` and the format table in the 2026-04-27 spec.

Extraction runs synchronously in the upload request (`attachments/api/route.ts`, `lib/scoped-upload-service.ts`) and in the OCR overflow fallback (`lib/ocrQueue.ts`), so the bounds are what keep upload latency and memory predictable.

</details>

## ⚠️ Open questions

1. **Blocking — dependency sign-off.** Proposal: [`hucre`](https://github.com/productdevbook/hucre) (MIT, pure TypeScript, native ESM, zero dependencies, Node ≥ 24 like this repo) as one direct dependency of `@open-mercato/core`, imported only via `hucre/xlsx`. It exposes the bounds this needs (`maxDecompressedBytes`, `maxTotalCells`, `maxSpinCount`, `sparse`, streaming rows) and in a local check it rejected a 300 MB zip bomb at a 50 MB cap, did not expand a "billion laughs" DTD, and read `x:`-prefixed parts, inline and rich-text strings and cached formula values correctly. Trade-off: the project is young (first release March 2026) with a small maintainer base — mitigated by pinning and by the wrapper in note 3.
   Considered and rejected: SheetJS `xlsx` (npm stops at 0.18.5 with known high-severity advisories, patched builds only from its own CDN — would fail the audit gate); `exceljs` (no release since 4.4.0 in 2023, nine runtime dependencies with open advisories, CommonJS); `read-excel-file` (mature and maintained, but no documented decompression or cell bounds for untrusted input).
   Fallback if a new package is unwanted: a minimal reader for the few OOXML elements needed on `jszip` (already a production dependency of `@open-mercato/documents`) — more code owned here, more edge cases to test.
2. Non-blocking — output format: tab-separated rows (compact for LLM context) vs markdown tables.
3. Non-blocking — default caps (proposal: 50 MB uncompressed, 200k cells).
4. Non-blocking — dates stay as Excel serial numbers (no style-based formatting) in this change.

Builds on #6264 (same file, same limits pattern); the PR will be rebased after #6264 merges.

Out of scope here, but the same vetted dependency would let later, separate PRs drop hand-rolled code or add `.xlsx` where users now have to "save as CSV": `.xlsx` uploads in `sync_excel` and in the WMS inventory import (both CSV-only today), the dependency-free XLSX writer in `staff/lib/timesheets-reports/xlsx.ts` (written by hand because the repo has no spreadsheet library), and the two separate `parseCsvText` implementations in `sync_excel/lib/parser.ts` and `wms/lib/inventoryImportCsv.ts`.

<details>
<summary>🏷️ label rationale</summary>

- ✨ `feature` — restores a capability (text from spreadsheets) that the platform does not have today.
- 🟡 `priority-medium` — net-new feature, not release-blocking.
- 🟠 `risk-medium` — single-module change shipped with tests, but it parses untrusted uploads in the request path and adds a direct production dependency to `@open-mercato/core`.

</details>

---

## Pierwszy komentarz (zgłoszenie chęci, po utworzeniu issue)

> I'd like to take this. Plan: wait for #6264 to merge, then open a PR on top of it following the implementation notes above. Before writing code I'd appreciate a 👍 / 👎 on the dependency choice (open question 1) from a maintainer — happy to go with the jszip-only fallback if a new package is unwanted.

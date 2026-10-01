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
2. Open the archive with `jszip` (see `packages/documents/src/modules/documents/lib/docxRenderer.ts` for how it is loaded so the bundler traces it). Before inflating: reject when the entry count or the sum of declared uncompressed sizes exceeds the cap; while inflating, count real bytes and abort past the cap (headers can lie).
3. Resolve sheets via `xl/workbook.xml` + `xl/_rels/workbook.xml.rels`, read `xl/sharedStrings.xml`, walk each worksheet's `sheetData`. Cell types `s`, `inlineStr`, `str`, `n`, `b`, `e`; use the cached `<v>`, never evaluate `<f>`.
4. Output: one `## <sheet name>` line per sheet, then tab-separated rows; skip empty rows; stop at the cell cap / output-length cap and `logger.warn` on truncation (as #6264 does for PDF pages).
5. Limits next to the OCR ones (proposal): `OM_ATTACHMENT_XLSX_MAX_UNCOMPRESSED_BYTES`, `OM_ATTACHMENT_XLSX_MAX_CELLS`; mirror in `apps/mercato/.env.example` and the create-app template (`yarn template:sync:fix`).
6. Tests in `attachments/lib/__tests__/textExtraction.test.ts`, building workbooks with `jszip` in the test: shared/inline strings, formula with cached value, multiple sheets, empty sheet, corrupt archive, oversized declared size, cell-cap truncation.
7. Docs: add XLSX to the "Pure-JS extraction" section of `apps/docs/docs/api/attachments.mdx` and the format table in the 2026-04-27 spec.

Extraction runs synchronously in the upload request (`attachments/api/route.ts`, `lib/scoped-upload-service.ts`) and in the OCR overflow fallback (`lib/ocrQueue.ts`), so the bounds are what keep upload latency and memory predictable.

</details>

## ⚠️ Open questions

1. **Blocking — dependency sign-off.** Proposal: `jszip` (3.10.1, already a production dependency of `@open-mercato/documents` and in `yarn.lock`) plus `fast-xml-parser` (5.10.1, already in `yarn.lock` transitively via `@google-cloud/storage`) as direct dependencies of `@open-mercato/core` — no new packages in the tree. Rejected: SheetJS `xlsx` from npm (the registry stops at 0.18.5, which carries known high-severity advisories — would fail the audit gate); `exceljs` (large dependency tree for a read-only need). Alternative if a second parser is unwanted: a minimal hand-written reader for the few OOXML elements needed, on `jszip` only.
2. Non-blocking — output format: tab-separated rows (compact for LLM context) vs markdown tables.
3. Non-blocking — default caps (proposal: 50 MB uncompressed, 200k cells).
4. Non-blocking — dates stay as Excel serial numbers (no style-based formatting) in this change.

Builds on #6264 (same file, same limits pattern); the PR will be rebased after #6264 merges.

<details>
<summary>🏷️ label rationale</summary>

- ✨ `feature` — restores a capability (text from spreadsheets) that the platform does not have today.
- 🟡 `priority-medium` — net-new feature, not release-blocking.
- 🟠 `risk-medium` — single-module change shipped with tests, but it parses untrusted uploads in the request path and adds direct production dependencies to `@open-mercato/core`.

</details>

---

## Pierwszy komentarz (zgłoszenie chęci, po utworzeniu issue)

> I'd like to take this. Plan: wait for #6264 to merge, then open a PR on top of it following the implementation notes above. Before writing code I'd appreciate a 👍 / 👎 on the dependency choice (open question 1) from a maintainer — happy to go with the jszip-only variant if a second parser is unwanted.

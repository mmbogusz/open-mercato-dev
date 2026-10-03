# Execution Plan — Attachments: pure-JS, bounded spreadsheet text extraction

Engine: om-auto-create-pr (steps: 8, --loop: no)

## Goal

`extractAttachmentContent` returns `null` for spreadsheets today, so `attachments.content` stays empty for every `.xlsx` upload. Restore spreadsheet text extraction in pure JS, in-process, with explicit resource bounds — the direction #1481 and #6264 set for PDFs.

## Scope

- `packages/core/src/modules/attachments/lib/spreadsheetText.ts` (new): the only file importing the reader library; streams rows sheet by sheet and renders `## <sheet>` + tab-separated rows.
- `packages/core/src/modules/attachments/lib/textExtraction.ts`: detect `.xlsx` / `.xlsm` / `.xltx` / `.xltm`, dispatch to the wrapper.
- `packages/core/src/modules/attachments/lib/ocrLimits.ts`: env-configurable bounds next to the OCR limits.
- Dependency: `hucre@^1.1.0` (MIT, zero dependencies, pure TS/ESM) in `@open-mercato/core`, imported only via `hucre/xlsx`.
- Unit tests with workbooks built in the test; docs and `.env.example` (+ create-app template).

## Non-goals

- Legacy `.xls` (BIFF8) and `.xlsb` — follow-ups (fixtures / upstream cell cap).
- `.ods` — deferred until a fix lands upstream in the library.
- PPTX, MSG, formula evaluation, style-based number formatting, images.
- `.xlsx` support in `sync_excel` / WMS imports, replacing the `staff` XLSX writer, moving the wrapper to `packages/shared`.

## Implementation Plan

### Phase 1: Dependency and limits

- 1.1 Add `hucre@^1.1.0` to `@open-mercato/core`.
- 1.2 Add `resolveSpreadsheetMaxUncompressedBytes`, `resolveSpreadsheetMaxSheets`, `resolveSpreadsheetMaxCells`, `resolveSpreadsheetMaxTextChars` to `ocrLimits.ts` with unit tests.

### Phase 2: Extraction

- 2.1 Add `spreadsheetText.ts`: sheet names via the reader's sheet predicate, rows via `streamXlsxRows` one sheet at a time, sheet/scanned-cell/text caps with `logger.warn` on truncation, failures → `null` + `reportError`.
- 2.2 Dispatch spreadsheets from `extractAttachmentContent`; narrow the unsupported-formats comment.
- 2.3 Unit tests: shared/inline strings, numbers, booleans, dates, multiple sheets, empty sheet, `.xlsm`, password-protected and corrupt files, decompression cap (incl. partial text kept), sheet cap, cell cap, text cap and shared-string amplification.

### Phase 3: Docs and configuration

- 3.1 Document the env vars in `apps/mercato/.env.example` and mirror into the create-app template.
- 3.2 Update `apps/docs/docs/api/attachments.mdx`, the bounds table in `framework/security/rate-limiting.mdx` and the format table in `.ai/specs/2026-04-27-ai-agent-attachment-processing-and-context.md`.

### Phase 4: Validation

- 4.1 Run the validation gate and the attachments test suite.

## Risks

- New production dependency needs maintainer sign-off (AGENTS.md § Ask First) — requested in the tracking issue; the jszip-only fallback stays available.
- `hucre` ships ESM only; Jest must be able to load it.
- Built on top of #6264 (same file); rebase after it merges.
- Shared-strings parsing costs ~40–50× its size in memory and is repeated per sheet by the streaming reader — hence the 10 MiB per-entry and 10-sheet defaults.
- `yarn audit` (`scripts/audit-ci.mjs --severity high`) reports 13 advisories on this base, none in `hucre`; upstream `develop` pins them via `resolutions`, so they clear on rebase.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Dependency and limits

- [x] 1.1 Add hucre dependency — b6a5335da
- [x] 1.2 Spreadsheet limit resolvers — 5ff37f16c

### Phase 2: Extraction

- [x] 2.1 Spreadsheet text wrapper — dbf4d036d, a0d69e79d
- [x] 2.2 Dispatch from extractAttachmentContent — dbf4d036d
- [x] 2.3 Unit tests — dbf4d036d, a0d69e79d

### Phase 3: Docs and configuration

- [x] 3.1 Env example and template sync — 669e7e08a
- [x] 3.2 Docs and spec format table — 669e7e08a, a0d69e79d

### Phase 4: Validation

- [x] 4.1 Validation gate — local runner, Node 24.21: build:packages, generate, build:packages, i18n:check-sync, i18n:check-usage, typecheck (`turbo --concurrency=2` after a container OOM at default fan-out), test (46/46 tasks), build:app all green; template:sync green

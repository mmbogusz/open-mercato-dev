import fs from 'fs/promises'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { getTelemetryRuntime } from '@open-mercato/shared/lib/telemetry/runtime'
import {
  resolveSpreadsheetMaxCells,
  resolveSpreadsheetMaxSheets,
  resolveSpreadsheetMaxTextChars,
  resolveSpreadsheetMaxUncompressedBytes,
} from './ocrLimits'

const logger = createLogger('attachments').child({ component: 'spreadsheet-text' })

export type SpreadsheetTextLimits = {
  maxUncompressedBytes: number
  maxSheets: number
  maxCells: number
  maxTextChars: number
}

type SpreadsheetCap = 'sheets' | 'cells' | 'text'

type SheetRows = AsyncIterable<{ values: readonly unknown[] }>

type ExtractionState = {
  lines: string[]
  textLength: number
  scannedCells: number
}

type RenderedRow = {
  line: string
  filledCells: number
  overflow: boolean
}

export function resolveSpreadsheetTextLimits(): SpreadsheetTextLimits {
  return {
    maxUncompressedBytes: resolveSpreadsheetMaxUncompressedBytes(),
    maxSheets: resolveSpreadsheetMaxSheets(),
    maxCells: resolveSpreadsheetMaxCells(),
    maxTextChars: resolveSpreadsheetMaxTextChars(),
  }
}

function formatDate(value: Date): string {
  if (Number.isNaN(value.getTime())) return ''
  const iso = value.toISOString()
  return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.slice(0, 19).replace('T', ' ')
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (value instanceof Date) return formatDate(value)
  if (typeof value === 'object' && 'error' in value && typeof value.error === 'string') return value.error
  return ''
}

function renderRow(values: readonly unknown[], maxLength: number): RenderedRow {
  const cells: string[] = []
  let length = 0
  let filledCells = 0
  let lastFilledIndex = -1
  for (const value of values) {
    const cell = formatCellValue(value)
    length += cell.length + (cells.length > 0 ? 1 : 0)
    if (cell.length > 0 && length > maxLength) return { line: '', filledCells, overflow: true }
    cells.push(cell)
    if (cell.length > 0) {
      filledCells += 1
      lastFilledIndex = cells.length - 1
    }
  }
  return { line: cells.slice(0, lastFilledIndex + 1).join('\t'), filledCells, overflow: false }
}

async function readSheetNames(data: Uint8Array, maxDecompressedBytes: number): Promise<string[]> {
  const { readXlsx } = await import('hucre/xlsx')
  const names: string[] = []
  await readXlsx(data, {
    maxDecompressedBytes,
    sheets: (info: { name: string }, index: number) => {
      names[index] = info.name
      return false
    },
  })
  return names
}

async function appendSheet(
  rows: SheetRows,
  heading: string,
  state: ExtractionState,
  limits: SpreadsheetTextLimits,
): Promise<SpreadsheetCap | null> {
  let pendingHeading: string | null = heading
  for await (const row of rows) {
    if (state.scannedCells + row.values.length > limits.maxCells) return 'cells'
    state.scannedCells += row.values.length
    const headingLength = pendingHeading === null ? 0 : pendingHeading.length + 1
    const rendered = renderRow(row.values, limits.maxTextChars - state.textLength - headingLength)
    if (rendered.overflow) return 'text'
    if (rendered.filledCells === 0) continue
    if (pendingHeading !== null) {
      state.lines.push(pendingHeading)
      pendingHeading = null
    }
    state.lines.push(rendered.line)
    state.textLength += headingLength + rendered.line.length + 1
  }
  return null
}

export async function extractSpreadsheetText(
  filePath: string,
  limits: SpreadsheetTextLimits = resolveSpreadsheetTextLimits(),
): Promise<string | null> {
  try {
    const { streamXlsxRows } = await import('hucre/xlsx')
    const data = new Uint8Array(await fs.readFile(filePath))
    const sheetNames = await readSheetNames(data, limits.maxUncompressedBytes)
    const state: ExtractionState = { lines: [], textLength: 0, scannedCells: 0 }
    let truncatedBy: SpreadsheetCap | null = sheetNames.length > limits.maxSheets ? 'sheets' : null
    const sheetCount = Math.min(sheetNames.length, limits.maxSheets)
    for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
      const rows = streamXlsxRows(data, { sheet: sheetIndex, maxDecompressedBytes: limits.maxUncompressedBytes })
      const heading = `## ${sheetNames[sheetIndex] ?? `Sheet ${sheetIndex + 1}`}`
      const cap = await appendSheet(rows, heading, state, limits)
      if (cap !== null) {
        truncatedBy = cap
        break
      }
    }
    if (truncatedBy !== null) {
      logger.warn('Spreadsheet exceeds text-extraction cap; truncating', {
        filePath,
        cap: truncatedBy,
        sheetCount: sheetNames.length,
        maxSheets: limits.maxSheets,
        maxCells: limits.maxCells,
        maxTextChars: limits.maxTextChars,
      })
    }
    const text = state.lines.join('\n').trim()
    return text.length > 0 ? text : null
  } catch (error) {
    logger.warn('Spreadsheet text extraction failed', { filePath, err: error })
    getTelemetryRuntime()?.reportError(error, {
      module: 'attachments',
      code: 'attachments.spreadsheet_extraction_failed',
    })
    return null
  }
}

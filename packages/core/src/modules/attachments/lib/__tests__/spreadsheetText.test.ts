/** @jest-environment node */
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { writeXlsx } from 'hucre/xlsx'
import type { WriteOptions } from 'hucre/xlsx'
import type { SpreadsheetTextLimits } from '../spreadsheetText'

const mockReportError = jest.fn()

jest.mock('@open-mercato/shared/lib/telemetry/runtime', () => ({
  getTelemetryRuntime: () => ({ reportError: mockReportError }),
}))

const defaultLimits: SpreadsheetTextLimits = {
  maxUncompressedBytes: 10 * 1024 * 1024,
  maxSheets: 10,
  maxCells: 1_000_000,
  maxTextChars: 1_000_000,
}

async function writeWorkbook(name: string, options: WriteOptions): Promise<string> {
  const filePath = join(tmpdir(), `${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`)
  await fs.writeFile(filePath, await writeXlsx(options))
  return filePath
}

async function extract(filePath: string, limits: Partial<SpreadsheetTextLimits> = {}): Promise<string | null> {
  const { extractSpreadsheetText } = await import('../spreadsheetText')
  return extractSpreadsheetText(filePath, { ...defaultLimits, ...limits })
}

describe('extractSpreadsheetText', () => {
  afterEach(() => {
    mockReportError.mockReset()
  })

  it('renders each sheet as a heading followed by tab-separated rows', async () => {
    const filePath = await writeWorkbook('offer.xlsx', {
      sheets: [
        {
          name: 'Oferta',
          rows: [
            ['Indeks', 'Nazwa', 'Cena', 'Dostępny'],
            ['CEM-42', 'Cement 42,5R', 23.5, true],
            ['PRE-01', 'Pręt Ø12', 4, false],
          ],
        },
        { name: 'Uwagi', rows: [['Ceny netto']] },
      ],
    })

    await expect(extract(filePath)).resolves.toBe(
      [
        '## Oferta',
        'Indeks\tNazwa\tCena\tDostępny',
        'CEM-42\tCement 42,5R\t23.5\tTRUE',
        'PRE-01\tPręt Ø12\t4\tFALSE',
        '## Uwagi',
        'Ceny netto',
      ].join('\n'),
    )
  })

  it('reads inline strings, dates and cached formula results', async () => {
    const filePath = await writeWorkbook('inline.xlsx', {
      stringMode: 'inline',
      sheets: [
        {
          name: 'Dane',
          rows: [
            ['Dostawa', new Date(Date.UTC(2026, 9, 1))],
            ['Odbiór', new Date(Date.UTC(2026, 9, 1, 14, 30))],
            ['Suma', { formula: 'SUM(B1:B2)', formulaResult: 42 }],
          ],
        },
      ],
    })

    await expect(extract(filePath)).resolves.toBe(
      ['## Dane', 'Dostawa\t2026-10-01', 'Odbiór\t2026-10-01 14:30:00', 'Suma\t42'].join('\n'),
    )
  })

  it('keeps inner empty cells, trims trailing ones and skips empty rows and sheets', async () => {
    const filePath = await writeWorkbook('sparse.xlsx', {
      sheets: [
        { name: 'Pusty', rows: [] },
        {
          name: 'Lista',
          rows: [
            ['A', null, 'C', null, null],
            [null, null],
            ['  wiele\tbiałych\nznaków  '],
          ],
        },
      ],
    })

    await expect(extract(filePath)).resolves.toBe(['## Lista', 'A\t\tC', 'wiele białych znaków'].join('\n'))
  })

  it('reads macro-enabled workbooks without touching the VBA project', async () => {
    const filePath = await writeWorkbook('macros.xlsm', {
      vbaProject: new Uint8Array([1, 2, 3, 4]),
      sheets: [{ name: 'Makra', rows: [['wartość', 7]] }],
    })

    await expect(extract(filePath)).resolves.toBe(['## Makra', 'wartość\t7'].join('\n'))
  })

  it('returns null for an empty workbook', async () => {
    const filePath = await writeWorkbook('empty.xlsx', { sheets: [{ name: 'Arkusz1', rows: [] }] })

    await expect(extract(filePath)).resolves.toBeNull()
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('returns null and reports the error for a corrupt file', async () => {
    const filePath = join(tmpdir(), `${Date.now()}-corrupt.xlsx`)
    await fs.writeFile(filePath, 'not a zip archive')

    await expect(extract(filePath)).resolves.toBeNull()
    expect(mockReportError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ module: 'attachments', code: 'attachments.spreadsheet_extraction_failed' }),
    )
  })

  it('returns null for a password-protected workbook', async () => {
    const filePath = await writeWorkbook('protected.xlsx', {
      encryption: { password: 'secret', spinCount: 1_000 },
      sheets: [{ name: 'Tajne', rows: [['x']] }],
    })

    await expect(extract(filePath)).resolves.toBeNull()
  })

  it('returns null when an archive entry decompresses past the cap', async () => {
    const rows = Array.from({ length: 200 }, (_, index) => [`wiersz ${index}`, index])
    const filePath = await writeWorkbook('large.xlsx', { sheets: [{ name: 'Duży', rows }] })

    await expect(extract(filePath, { maxUncompressedBytes: 1_024 })).resolves.toBeNull()
    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it('keeps text already read when a later sheet exceeds the decompression cap', async () => {
    const filePath = await writeWorkbook('partial.xlsx', {
      stringMode: 'inline',
      sheets: [
        { name: 'Mały', rows: [['a']] },
        { name: 'Duży', rows: Array.from({ length: 300 }, (_, index) => [index, index * 2, index * 3]) },
      ],
    })

    await expect(extract(filePath, { maxUncompressedBytes: 4_096 })).resolves.toBe(['## Mały', 'a'].join('\n'))
    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it('stops after the configured number of sheets', async () => {
    const filePath = await writeWorkbook('sheets.xlsx', {
      sheets: [
        { name: 'Pierwszy', rows: [['1']] },
        { name: 'Drugi', rows: [['2']] },
        { name: 'Trzeci', rows: [['3']] },
      ],
    })

    await expect(extract(filePath, { maxSheets: 2 })).resolves.toBe(['## Pierwszy', '1', '## Drugi', '2'].join('\n'))
  })

  it('stops at the scanned-cell cap, counting empty cells', async () => {
    const filePath = await writeWorkbook('cells.xlsx', {
      sheets: [{ name: 'Komórki', rows: [['a', null, 'b'], ['c', null, 'd'], ['e', null, 'f']] }],
    })

    await expect(extract(filePath, { maxCells: 7 })).resolves.toBe(['## Komórki', 'a\t\tb', 'c\t\td'].join('\n'))
  })

  it('stops at the text cap without splitting a row', async () => {
    const filePath = await writeWorkbook('text.xlsx', {
      sheets: [{ name: 'Tekst', rows: [['abcdefghij'], ['klmnopqrst'], ['uvwxyz']] }],
    })

    await expect(extract(filePath, { maxTextChars: 30 })).resolves.toBe(['## Tekst', 'abcdefghij', 'klmnopqrst'].join('\n'))
  })

  it('bounds the text built from one shared string referenced by many cells', async () => {
    const longValue = 'x'.repeat(30_000)
    const rows = Array.from({ length: 200 }, () => [longValue])
    const filePath = await writeWorkbook('amplified.xlsx', { sheets: [{ name: 'Powtórzenia', rows }] })

    const result = await extract(filePath, { maxTextChars: 100_000 })

    expect(result?.split('\n')).toHaveLength(4)
    expect(result!.length).toBeLessThanOrEqual(100_000)
  })
})

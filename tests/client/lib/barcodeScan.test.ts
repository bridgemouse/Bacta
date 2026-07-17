import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('zxing-wasm/reader', () => ({ readBarcodes: vi.fn(), prepareZXingModule: vi.fn() }))

describe('decodeBarcodeFromFile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the decoded barcode text from the first result', async () => {
    const { readBarcodes } = await import('zxing-wasm/reader')
    vi.mocked(readBarcodes).mockResolvedValue([{ text: '0016000275287' }] as any)

    const { decodeBarcodeFromFile } = await import('../../../client/src/lib/barcodeScan')
    const result = await decodeBarcodeFromFile(new File([], 'photo.jpg'))
    expect(result).toBe('0016000275287')
  })

  it('returns null when no barcode is found in the photo, so the caller can fall back to ad-hoc entry', async () => {
    const { readBarcodes } = await import('zxing-wasm/reader')
    vi.mocked(readBarcodes).mockResolvedValue([])

    const { decodeBarcodeFromFile } = await import('../../../client/src/lib/barcodeScan')
    const result = await decodeBarcodeFromFile(new File([], 'photo.jpg'))
    expect(result).toBeNull()
  })

  it('restricts the reader to retail 1D formats actually used by product barcodes, not every symbology', async () => {
    const { readBarcodes } = await import('zxing-wasm/reader')
    vi.mocked(readBarcodes).mockResolvedValue([])

    const { decodeBarcodeFromFile } = await import('../../../client/src/lib/barcodeScan')
    await decodeBarcodeFromFile(new File([], 'photo.jpg'))

    const options = vi.mocked(readBarcodes).mock.calls[0][1]
    expect(options?.formats).toEqual(expect.arrayContaining(['EAN13', 'EAN8', 'UPCA', 'UPCE']))
  })
})

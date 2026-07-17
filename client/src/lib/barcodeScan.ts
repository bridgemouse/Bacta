// Still-image barcode capture (#141) — decodes a photo taken via native camera
// (<input capture>, never a live in-page video feed, which is broken in exactly
// Bacta's standalone-PWA deployment mode per webkit.org #185448). zxing-wasm's
// readBarcodes decodes directly from an image Blob/File — no getUserMedia involved.
// Dynamically imported so the ~1MB WASM binary is never in the app's main bundle.
//
// zxing-wasm defaults to fetching its .wasm binary from the jsDelivr CDN, which Bacta's
// CSP (connect-src 'self') blocks outright — confirmed live: a real browser refuses the
// CDN fetch entirely. The binary is vendored into client/public/ instead (served
// same-origin, matches the self-hosted framing) and locateFile is overridden to point
// there. See also server/index.ts's helmet config, which adds 'wasm-unsafe-eval' to
// script-src for this — WebAssembly instantiation needs it even once the fetch succeeds,
// and that source is deliberately narrower than 'unsafe-eval' (permits WASM compile only,
// not JS eval()).
let modulePrepared = false

export async function decodeBarcodeFromFile(file: File): Promise<string | null> {
  const { readBarcodes, prepareZXingModule } = await import('zxing-wasm/reader')
  if (!modulePrepared) {
    prepareZXingModule({ overrides: { locateFile: () => '/zxing_reader.wasm' } })
    modulePrepared = true
  }
  const results = await readBarcodes(file, {
    tryHarder: true,
    // Retail product barcodes only — the formats this feature actually needs to match
    // against foods.source_id (Open Food Facts barcodes), not every symbology zxing-wasm supports.
    formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'],
    maxNumberOfSymbols: 1,
  })
  return results.length > 0 ? results[0].text : null
}

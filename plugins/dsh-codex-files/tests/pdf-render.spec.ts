/**
 * Real-parse PDF test: a minimal hand-built one-page PDF is fed through
 * pdf.js exactly the way PdfPreview does (getDocument({ data })), proving
 * the render pipeline's first stage works in this environment. The bytes
 * carry no xref table — pdf.js recovers it, which also exercises that
 * robustness path.
 */
import { strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { clampPdfWidth } from '../src/client/PdfPreview.tsx'

/** One-page PDF: catalog → pages → page with a Hello text content stream. */
const MINIMAL_PDF = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 72 100 Td (Hello) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
trailer
<< /Root 1 0 R /Size 6 >>
%%EOF
`

describe('pdf.js parse path (PdfPreview stage 1)', () => {
  it('registers the main-thread WorkerMessageHandler that the bundle relies on', async () => {
    // PdfPreview.tsx imports this module for its side effect: without
    // globalThis.pdfjsWorker set, the browser build has no workerSrc and
    // getDocument throws before parsing. Assert the mechanism the preview
    // depends on, in the same order the bundle executes it.
    await import('pdfjs-dist/build/pdf.worker.min.mjs')
    const handler = (globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } }).pdfjsWorker?.WorkerMessageHandler
    expect(handler).toBeTypeOf('function')
  })

  it('parses the minimal PDF and reports one page', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = pdfjs.getDocument({ data: strToU8(MINIMAL_PDF), isEvalSupported: false })
    try {
      const document = await task.promise
      expect(document.numPages).toBe(1)
      const page = await document.getPage(1)
      const viewport = page.getViewport({ scale: 1 })
      expect(viewport.width).toBe(200)
      expect(viewport.height).toBe(200)
      await document.destroy()
    } catch (error) {
      await task.destroy().catch(() => {})
      throw error
    }
  })
})

describe('clampPdfWidth', () => {
  it('converts a measured wrapper width into the page render width', () => {
    expect(clampPdfWidth(720)).toBe(696)
  })

  it('clamps very narrow and very wide containers', () => {
    expect(clampPdfWidth(200)).toBe(280)
    expect(clampPdfWidth(4000)).toBe(1400)
  })

  it('falls back to the default for a non-positive width', () => {
    expect(clampPdfWidth(0)).toBe(720)
    expect(clampPdfWidth(Number.NaN)).toBe(720)
  })
})

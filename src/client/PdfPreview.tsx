/**
 * PDF preview rendered with pdf.js on the main thread. The worker
 * implementation is imported as a side effect: it registers
 * `globalThis.pdfjsWorker.WorkerMessageHandler`, which pdf.js detects and
 * uses as its main-thread handler (fake worker). Without it, the browser
 * build has no `workerSrc` and `getDocument` throws before parsing.
 * This deliberately avoids the browser's built-in PDF plugin, which the
 * Electron shell does not enable — canvas rendering works everywhere.
 */
// Side effect: must run before any getDocument call (static import order
// guarantees it); keeps the single-file bundle self-contained, with no
// worker file, network fetch, or CSP-dependent Worker construction.
import 'pdfjs-dist/legacy/build/pdf.worker.min.mjs'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { rawUrl } from './preview-logic.ts'

/** Maximum pages rendered (long documents stop here with a notice). */
const MAX_PAGES = 60

/** Debounce for container resize → page re-render (ms). */
const PDF_RESIZE_DEBOUNCE_MS = 140

/** Host route serving pdf.js' binary CMap and standard-font assets. */
const PDF_ASSET_BASE = '/plugins/dsh-codex-file-panel/pdf-assets'

/** Minimum rendered bitmap scale; keeps PDF text crisp even on 1x displays. */
const MIN_PDF_PIXEL_RATIO = 2

/** Cap the rendered bitmap scale. Above this the files are mostly memory, not visible detail. */
const MAX_PDF_PIXEL_RATIO = 2.5

/** One rendered page: its bitmap data URL and original dimensions. */
interface RenderedPage {
  url: string
  width: number
  height: number
}

/** Component props. */
export interface PdfPreviewProps {
  sessionId: string
  path: string
  t: PropsLocale<'codex-files'>['t']
}

/**
 * Render one pdf.js page onto a canvas at a fixed viewport width.
 * @param page - pdf.js page proxy.
 * @param targetWidth - CSS pixel width to render at (devicePixelRatio-scaled).
 * @returns the page bitmap and dimensions.
 */
async function renderPage(
  page: import('pdfjs-dist/legacy/build/pdf.mjs').PDFPageProxy,
  targetWidth: number,
  pixelRatio: number,
): Promise<RenderedPage> {
  const base = page.getViewport({ scale: 1 })
  const cssScale = targetWidth / base.width
  // Render at device-pixel scale so text and line art stay sharp on HiDPI
  // screens; the returned width/height stay CSS pixels so the <img> keeps
  // the same layout footprint as the previous 1x renderer.
  const cssViewport = page.getViewport({ scale: cssScale })
  const viewport = page.getViewport({ scale: cssScale * pixelRatio })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(viewport.width))
  canvas.height = Math.max(1, Math.ceil(viewport.height))
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('canvas 2d context unavailable')
  await page.render({ canvasContext: context, viewport }).promise
  return {
    url: canvas.toDataURL('image/png'),
    width: cssViewport.width,
    height: cssViewport.height,
  }
}

/** Clamp a raw device-pixel ratio into the PDF renderer's sane range. */
export function pdfPixelRatio(raw: number | undefined): number {
  const value = raw === undefined || !Number.isFinite(raw) ? 1 : raw
  return Math.min(MAX_PDF_PIXEL_RATIO, Math.max(MIN_PDF_PIXEL_RATIO, value))
}

/**
 * Clamp a measured container width to a usable PDF page width. The wrapper
 * carries 12px of horizontal padding; subtracting it keeps the page shadow
 * inside the scroll container instead of clipping against its edge.
 * @param clientWidth - the wrapper's `clientWidth`.
 * @returns the render width, clamped to a safe range.
 */
export function clampPdfWidth(clientWidth: number): number {
  if (!Number.isFinite(clientWidth) || clientWidth <= 0) return 720
  return Math.max(280, Math.min(1400, clientWidth - 24))
}

export function PdfPreview({ sessionId, path, t }: PdfPreviewProps): JSX.Element {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; pages: RenderedPage[]; truncated: boolean; reloading?: boolean }
  >({ status: 'loading' })
  // Null means "not measured yet". The render effect waits for a real width
  // so a freshly mounted panel never rasterizes every page at a wrong
  // default and then immediately re-rasterizes at the measured width.
  const [targetWidth, setTargetWidth] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // The wrapper renders for every status, so measurement runs once on mount
  // and re-fits pages when the column width changes (debounced).
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (el === null) return
    let timer: number | null = null
    const measure = (): void => {
      const width = clampPdfWidth(el.clientWidth)
      setTargetWidth(prev => (prev !== null && Math.abs(prev - width) < 4 ? prev : width))
    }
    measure()
    const observer = new ResizeObserver(() => {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(measure, PDF_RESIZE_DEBOUNCE_MS)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (targetWidth === null) return
    const controller = new AbortController()
    let documentTask: pdfjsLib.PDFDocumentLoadingTask | null = null
    setState(prev => prev.status === 'ready' ? { ...prev, reloading: true } : { status: 'loading' })
    void (async () => {
      try {
        const response = await fetch(rawUrl(sessionId, path), { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (controller.signal.aborted) return
        documentTask = pdfjsLib.getDocument({
          data: bytes,
          isEvalSupported: false,
          // The browser build has no filesystem to resolve pdf.js' CMap and
          // standard-font data from. Serve them from the plugin's own host
          // route so CJK/standard-font PDFs render text instead of tofu or
          // garbled glyphs.
          cMapUrl: `${PDF_ASSET_BASE}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${PDF_ASSET_BASE}/standard_fonts/`,
        })
        const document = await documentTask.promise
        if (controller.signal.aborted) return
        const total = document.numPages
        const limit = Math.min(total, MAX_PAGES)
        const pages: RenderedPage[] = []
        const pixelRatio = pdfPixelRatio(window.devicePixelRatio)
        for (let number = 1; number <= limit; number++) {
          if (controller.signal.aborted) return
          const page = await document.getPage(number)
          pages.push(await renderPage(page, targetWidth, pixelRatio))
        }
        // Decode every bitmap before publishing the ready state so the first
        // paint does not show blank <img> tiles that resolve one by one.
        await Promise.all(pages.map(async (page) => {
          const image = new Image()
          image.src = page.url
          if (typeof image.decode === 'function') await image.decode().catch(() => {})
        }))
        await document.destroy()
        if (controller.signal.aborted) return
        setState({ status: 'ready', pages, truncated: total > limit, reloading: false })
      } catch (error) {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      }
    })()
    return () => {
      controller.abort()
      if (documentTask !== null) void documentTask.destroy().catch(() => {})
    }
  }, [path, sessionId, targetWidth])

  return (
    <div ref={wrapRef} className="cfx-pdf-wrap">
      {state.status === 'loading' && (
        <div className="cfx-binary-loading">{t('file.loading')}</div>
      )}
      {state.status === 'error' && (
        <div className="cfx-binary-loading cfx-binary-error">
          {t('file.pdfFailed', { message: state.message })}
        </div>
      )}
      {state.status === 'ready' && (
        <>
          <div className="cfx-pdf-pages">
            {state.pages.map((page, index) => (
              <div key={index} className="cfx-pdf-page">
                <img
                  src={page.url}
                  alt={`${path} · ${index + 1}`}
                  width={page.width}
                  height={page.height}
                />
                <span className="cfx-pdf-page-number">{index + 1}</span>
              </div>
            ))}
          </div>
          {state.truncated && (
            <div className="cfx-pdf-truncated">{t('file.pdfTruncated', { max: String(MAX_PAGES) })}</div>
          )}
          {state.reloading === true && <div className="cfx-pdf-reloading">{t('file.loading')}</div>}
        </>
      )}
    </div>
  )
}

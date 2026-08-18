/**
 * Multi-format file previews for the Files panel. Text files stay on the
 * ReadBlock line-numbered view; PDFs render with pdf.js on canvas (no
 * browser plugin needed); images/audio/video load through the /raw route as
 * Blob URLs and render natively; Markdown renders through MarkdownText;
 * HTML renders in a sandboxed iframe; Office documents (docx/xlsx/pptx) and
 * EPUB books are unzipped with fflate and shown as extracted text; CSV/TSV
 * render as tables. Routing and extraction live in preview-logic.ts so
 * tests need no UI-primitive imports.
 */
import { useEffect, useMemo, useState } from 'react'
import { MarkdownText, ReadBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { langForPath } from './files.ts'
import { PdfPreview } from './PdfPreview.tsx'
import {
  extractEpubText, extractOfficeText, extensionOf, parseCsv, previewKindFor, rawUrl,
} from './preview-logic.ts'

/** MIME types the Blob needs to open the browser's native viewers. */
const RAW_MIMES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
}

/** Full preview props. */
export interface FilePreviewProps {
  sessionId: string
  path: string
  /** Text content (already loaded for text-like files); unused by raw/office. */
  content: string
  t: PropsLocale<'codex-files'>['t']
}

/** The previewer dispatcher. */
export function FilePreview({ sessionId, path, content, t }: FilePreviewProps): JSX.Element {
  const kind = previewKindFor(path)
  if (kind === 'pdf') {
    return <PdfPreview sessionId={sessionId} path={path} t={t} />
  }
  if (kind === 'markdown') {
    return (
      <div className="cfx-md-preview">
        <MarkdownText text={content} />
      </div>
    )
  }
  if (kind === 'html') {
    return (
      <iframe className="cfx-html-preview" title={path} sandbox="" srcDoc={content} />
    )
  }
  if (kind === 'raw') {
    return <BinaryPreview sessionId={sessionId} path={path} extract={null} t={t} />
  }
  if (kind === 'office' || kind === 'epub') {
    return <BinaryPreview sessionId={sessionId} path={path} extract={kind} t={t} />
  }
  if (kind === 'csv') {
    return <CsvPreview content={content} path={path} />
  }
  const lines = useMemo(() => {
    const raw = content.endsWith('\n') ? content.slice(0, -1) : content
    return raw === '' ? [] : raw.split('\n').map((text, index) => ({ number: index + 1, text }))
  }, [content])
  return (
    <ReadBlock
      label={path}
      lines={lines}
      totalLines={lines.length}
      lang={langForPath(path)}
    />
  )
}

/** CSV/TSV table preview. */
function CsvPreview(props: { content: string; path: string }): JSX.Element {
  const { content, path } = props
  const table = useMemo(
    () => parseCsv(content, path.toLowerCase().endsWith('.tsv') ? '\t' : ','),
    [content, path],
  )
  const shown = table.rows.slice(0, 500)
  return (
    <div className="cfx-csv-wrap">
      <table className="cfx-csv-table">
        <tbody>
          {shown.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > shown.length && (
        <div className="cfx-csv-truncated">…</div>
      )}
    </div>
  )
}

/** Native-viewer preview (image/audio/video) plus Office/EPUB text extraction. */
function BinaryPreview(props: {
  sessionId: string
  path: string
  extract: 'office' | 'epub' | null
  t: PropsLocale<'codex-files'>['t']
}): JSX.Element {
  const { sessionId, path, extract, t } = props
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; url: string }
    | { status: 'extracted'; text: string }
    | { status: 'error'; message: string }
  >({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    setState({ status: 'loading' })
    void (async () => {
      try {
        const response = await fetch(rawUrl(sessionId, path), { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const bytes = new Uint8Array(await response.arrayBuffer())
        if (controller.signal.aborted) return
        if (extract !== null) {
          const text = extract === 'office' ? extractOfficeText(bytes, path) : extractEpubText(bytes)
          setState({ status: 'extracted', text: text === '' ? t('file.officeEmpty') : text })
          return
        }
        const ext = extensionOf(path)
        const mime = RAW_MIMES[ext] ?? 'application/octet-stream'
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }))
        setState({ status: 'ready', url: objectUrl })
      } catch (error) {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      }
    })()
    return () => {
      controller.abort()
      if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl)
    }
  }, [extract, path, sessionId, t])

  if (state.status === 'loading') {
    return <div className="cfx-binary-loading">{t('file.loading')}</div>
  }
  if (state.status === 'error') {
    return <div className="cfx-binary-loading cfx-binary-error">{t('file.error', { message: state.message })}</div>
  }
  if (state.status === 'extracted') {
    return (
      <pre className="cfx-office-text">{state.text}</pre>
    )
  }
  const ext = extensionOf(path)
  if (RAW_MIMES[ext]?.startsWith('image/') === true) {
    return (
      <div className="cfx-image-wrap">
        <img className="cfx-image" src={state.url} alt={path} />
      </div>
    )
  }
  if (RAW_MIMES[ext]?.startsWith('video/') === true) {
    return <video className="cfx-binary-frame" src={state.url} controls />
  }
  return <audio className="cfx-audio" src={state.url} controls />
}

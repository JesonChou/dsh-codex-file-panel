/**
 * Previewer routing and Office text extraction, dependency-free so tests
 * and the bundle both import it without pulling the UI primitive graph.
 */
import { strFromU8, unzipSync } from 'fflate'

/** Extensions rendered natively through /raw (browser viewers). */
const RAW_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif',
  'mp4', 'webm', 'mov', 'm4v', 'mp3', 'wav', 'ogg', 'm4a', 'flac',
])

/** The PDF extension (rendered with pdf.js, not the browser plugin). */
const PDF_EXTENSIONS = new Set(['pdf'])

/** Extensions rendered as Markdown. */
const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx'])

/** Extensions rendered as sandboxed HTML. */
const HTML_EXTENSIONS = new Set(['html', 'htm'])

/** Extensions unzipped for Office text extraction. */
const OFFICE_EXTENSIONS = new Set(['docx', 'xlsx', 'pptx'])

/** Extensions unzipped as EPUB ebooks. */
const EPUB_EXTENSIONS = new Set(['epub'])

/** Extensions rendered as CSV tables. */
const CSV_EXTENSIONS = new Set(['csv', 'tsv'])

/** Extension of one path, lowercase, without the dot. */
export function extensionOf(path: string): string {
  const normalized = path.toLowerCase()
  const dot = normalized.lastIndexOf('.')
  return dot === -1 ? '' : normalized.slice(dot + 1)
}

/** Which previewer a path selects. */
export type PreviewKind = 'pdf' | 'raw' | 'markdown' | 'html' | 'office' | 'epub' | 'csv' | 'text'

/** One registered file previewer, in better-sidebar's descriptor shape. */
export interface FileViewerDescriptor {
  id: string
  /** Lowercase extensions without the leading dot. */
  exts: readonly string[]
  /** Higher wins; the catch-all text viewer uses the lowest priority. */
  priority?: number
  kind: PreviewKind
}

/** The previewer registry. Add rows here instead of growing a switch chain. */
export const FILE_VIEWERS: readonly FileViewerDescriptor[] = [
  { id: 'pdf', exts: ['pdf'], priority: 100, kind: 'pdf' },
  {
    id: 'image-media',
    exts: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif', 'mp4', 'webm', 'mov', 'm4v', 'mp3', 'wav', 'ogg', 'm4a', 'flac'],
    priority: 80,
    kind: 'raw',
  },
  { id: 'markdown', exts: ['md', 'markdown', 'mdx'], priority: 70, kind: 'markdown' },
  { id: 'html', exts: ['html', 'htm'], priority: 70, kind: 'html' },
  { id: 'office', exts: ['docx', 'xlsx', 'pptx'], priority: 60, kind: 'office' },
  { id: 'epub', exts: ['epub'], priority: 60, kind: 'epub' },
  { id: 'csv', exts: ['csv', 'tsv'], priority: 60, kind: 'csv' },
  { id: 'text', exts: [], priority: -100, kind: 'text' },
]

/**
 * Kinds whose content the panel opens without the text read route: the
 * previewer fetches the bytes through /raw itself (PDFs, media, Office,
 * EPUB). Every other kind needs the text content loaded up front.
 */
const BINARY_PREVIEW_KINDS = new Set<PreviewKind>(['pdf', 'raw', 'office', 'epub'])

/** True when the preview loads binary content through /raw. */
export function isBinaryPreviewKind(kind: PreviewKind): boolean {
  return BINARY_PREVIEW_KINDS.has(kind)
}

/** Route one path to its previewer kind. */
export function previewKindFor(path: string): PreviewKind {
  const ext = extensionOf(path)
  const viewers = [...FILE_VIEWERS].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  for (const viewer of viewers) {
    if (viewer.exts.length === 0) return viewer.kind
    if (viewer.exts.includes(ext)) return viewer.kind
  }
  return 'text'
}

/** The /raw URL for one session file. */
export function rawUrl(sessionId: string, path: string): string {
  const query = new URLSearchParams({ sessionId, path })
  return `/plugins/dsh-codex-files/raw?${query.toString()}`
}

/**
 * Decode XML text content with the standard five entities (Office files
 * only use these plus numeric references, which numeric spans ignore).
 */
function decodeEntities(text: string): string {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}

/** Extract every <tag>text</tag> body for one tag name. */
function tagTexts(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'g')
  const out: string[] = []
  for (const match of xml.matchAll(pattern)) {
    const text = decodeEntities(match[1] ?? '')
    if (text !== '') out.push(text)
  }
  return out
}

/** Paragraph-split tag extraction: one output line per paragraph. */
function paragraphTexts(xml: string, inlineTag: string): string[] {
  const paragraphs = xml.split(/<\/w:p>/)
  return paragraphs.flatMap(paragraph => {
    const texts = tagTexts(paragraph, inlineTag)
    return texts.length === 0 ? [] : [texts.join('')]
  })
}

/** Text extraction for one Office zip, keyed by extension. */
export function extractOfficeText(data: Uint8Array, path: string): string {
  const files = unzipSync(data)
  const ext = extensionOf(path)
  if (ext === 'docx') {
    const document = files['word/document.xml']
    if (document === undefined) return ''
    return paragraphTexts(strFromU8(document), 'w:t').join('\n')
  }
  if (ext === 'xlsx') {
    // Shared strings are the cell text pool; the sheet grids reference them.
    // The preview lists the strings in order — the readable approximation of
    // the workbook's text without parsing sheet layout.
    const shared = files['xl/sharedStrings.xml']
    if (shared !== undefined) {
      const cells = strFromU8(shared)
        .split(/<\/si>/)
        .flatMap(si => {
          const texts = tagTexts(si, 't')
          return texts.length === 0 ? [] : [texts.join(' ')]
        })
      if (cells.length > 0) return cells.join('\n')
    }
    return ''
  }
  if (ext === 'pptx') {
    const slides: string[] = []
    for (const [name, content] of Object.entries(files)) {
      if (name.startsWith('ppt/slides/slide') && name.endsWith('.xml')) {
        const texts = tagTexts(strFromU8(content), 'a:t')
        if (texts.length > 0) slides.push(texts.join(' · '))
      }
    }
    return slides.join('\n\n')
  }
  return ''
}

/** One CSV table. */
export interface CsvTable {
  /** Cell rows; ragged rows are padded with empty strings. */
  rows: string[][]
}

/**
 * Parse CSV/TSV text into a cell table. Quote-aware (RFC 4180 double
 * quotes, embedded commas, escaped quotes, CRLF), tab-delimited for .tsv.
 */
export function parseCsv(text: string, delimiter: ',' | '\t'): CsvTable {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const pushCell = (): void => { row.push(cell); cell = '' }
  const pushRow = (): void => {
    pushCell()
    rows.push(row)
    row = []
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"' && cell === '') {
      quoted = true
      continue
    }
    if (ch === delimiter) {
      pushCell()
      continue
    }
    if (ch === '\n') {
      pushRow()
      continue
    }
    if (ch === '\r') continue
    cell += ch
  }
  if (cell !== '' || row.length > 0) pushRow()
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0)
  return {
    rows: rows.map(r => {
      const padded = [...r]
      while (padded.length < width) padded.push('')
      return padded
    }),
  }
}

/**
 * Text extraction for one EPUB zip: the spine order from content.opf plus
 * each chapter's text from its XHTML. Falls back to chapter order when the
 * spine is unreadable.
 */
export function extractEpubText(data: Uint8Array): string {
  const files = unzipSync(data)
  const spine: string[] = []
  const opf = Object.keys(files).find(name => name.endsWith('.opf'))
  if (opf !== undefined) {
    const opfText = strFromU8(files[opf]!)
    const opfDir = opf.includes('/') ? opf.slice(0, opf.lastIndexOf('/') + 1) : ''
    for (const match of opfText.matchAll(/<itemref[^>]*idref="([^"]+)"[^>]*\/?>/g)) {
      const id = match[1]!
      const item = opfText.match(new RegExp(`<item[^>]*id="${id}"[^>]*href="([^"]+)"`))
      if (item !== null) spine.push(opfDir + item[1]!)
    }
  }
  const chapters = spine.length > 0
    ? spine
    : Object.keys(files).filter(name => name.endsWith('.xhtml') || name.endsWith('.html'))
  const out: string[] = []
  for (const chapter of chapters) {
    const content = files[chapter]
    if (content === undefined) continue
    const xhtml = strFromU8(content)
    const paragraphs = xhtml.split(/<\/p>|<br\s*\/?>/i)
      .flatMap(p => {
        const text = decodeEntities(p.replace(/<[^>]+>/g, '')).trim()
        return text === '' ? [] : [text]
      })
    if (paragraphs.length > 0) out.push(...paragraphs, '')
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

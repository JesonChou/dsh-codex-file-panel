/**
 * Binary-preview vocabulary shared by the host /raw route and its tests:
 * which extensions the route serves and the content type each maps to.
 * Zero dependencies so both the node half and vitest import it directly.
 */

/** Extensions the /raw route serves, mapped to their content types. */
export const RAW_CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
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
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  epub: 'application/epub+zip',
}

/** Content type for one path's extension; undefined for non-previewable files. */
export function contentTypeFor(path: string): string | undefined {
  const normalized = path.toLowerCase()
  const dot = normalized.lastIndexOf('.')
  if (dot === -1) return undefined
  return RAW_CONTENT_TYPES[normalized.slice(dot + 1)]
}

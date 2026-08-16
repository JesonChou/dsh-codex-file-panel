/**
 * Multi-format preview tests: previewer routing by extension, Office text
 * extraction from synthetic zips (built with fflate's zipSync), and the
 * host content-type map.
 */
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { contentTypeFor, RAW_CONTENT_TYPES } from '../src/content-types.ts'
import {
  extensionOf, extractEpubText, extractOfficeText, isBinaryPreviewKind, parseCsv,
  previewKindFor, rawUrl,
} from '../src/client/preview-logic.ts'

describe('contentTypeFor', () => {
  it('maps every registered extension', () => {
    for (const [ext, mime] of Object.entries(RAW_CONTENT_TYPES)) {
      expect(contentTypeFor(`file.${ext}`)).toBe(mime)
      expect(contentTypeFor(`FILE.${ext.toUpperCase()}`)).toBe(mime)
    }
  })

  it('rejects unregistered extensions and extensionless paths', () => {
    expect(contentTypeFor('a.txt')).toBeUndefined()
    expect(contentTypeFor('README')).toBeUndefined()
  })
})

describe('previewKindFor', () => {
  it('routes pdf to the pdf.js renderer, images/audio/video to the native viewer', () => {
    expect(previewKindFor('a.pdf')).toBe('pdf')
    expect(previewKindFor('a.PNG')).toBe('raw')
    expect(previewKindFor('a.ico')).toBe('raw')
    expect(previewKindFor('a.avif')).toBe('raw')
    expect(previewKindFor('a.mp4')).toBe('raw')
    expect(previewKindFor('a.mp3')).toBe('raw')
  })

  it('routes markdown, html, office, epub, and csv documents', () => {
    expect(previewKindFor('README.md')).toBe('markdown')
    expect(previewKindFor('page.html')).toBe('html')
    expect(previewKindFor('spec.docx')).toBe('office')
    expect(previewKindFor('book.xlsx')).toBe('office')
    expect(previewKindFor('deck.pptx')).toBe('office')
    expect(previewKindFor('book.epub')).toBe('epub')
    expect(previewKindFor('data.csv')).toBe('csv')
    expect(previewKindFor('data.tsv')).toBe('csv')
  })

  it('falls back to the text previewer', () => {
    expect(previewKindFor('src/index.ts')).toBe('text')
    expect(previewKindFor('data.json')).toBe('text')
  })
})

describe('isBinaryPreviewKind', () => {
  it('marks every kind that loads through /raw instead of the text route', () => {
    expect(isBinaryPreviewKind('pdf')).toBe(true)
    expect(isBinaryPreviewKind('raw')).toBe(true)
    expect(isBinaryPreviewKind('office')).toBe(true)
    expect(isBinaryPreviewKind('epub')).toBe(true)
    expect(isBinaryPreviewKind('markdown')).toBe(false)
    expect(isBinaryPreviewKind('html')).toBe(false)
    expect(isBinaryPreviewKind('csv')).toBe(false)
    expect(isBinaryPreviewKind('text')).toBe(false)
  })
})

describe('rawUrl', () => {
  it('encodes the session and path into the query', () => {
    const url = rawUrl('s/1', 'a b.pdf')
    expect(url).toContain('sessionId=s%2F1')
    // URLSearchParams encodes spaces as '+', which is equivalent on the wire.
    expect(url).toContain('path=a+b.pdf')
  })
})

describe('extractOfficeText', () => {
  it('extracts docx paragraphs in order', () => {
    const document = [
      '<?xml version="1.0"?>',
      '<w:document><w:body>',
      '<w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:t xml:space="preserve"> world</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Amp &amp; amp</w:t></w:r></w:p>',
      '</w:body></w:document>',
    ].join('')
    const zip = zipSync({ 'word/document.xml': strToU8(document) })
    expect(extractOfficeText(zip, 'x.docx')).toBe('Hello world\nAmp & amp')
  })

  it('extracts xlsx shared strings, one cell per line', () => {
    const shared = [
      '<sst><si><t>Name</t></si>',
      '<si><r><t>Rich</t></r><r><t>Text</t></r></si>',
      '<si><t>42</t></si></sst>',
    ].join('')
    const zip = zipSync({ 'xl/sharedStrings.xml': strToU8(shared) })
    expect(extractOfficeText(zip, 'x.xlsx')).toBe('Name\nRich Text\n42')
  })

  it('extracts pptx slide text with slides separated', () => {
    const slide1 = '<p:sld><p:sp><a:t>Title</a:t><a:t> Sub</a:t></p:sp></p:sld>'
    const slide2 = '<p:sld><p:sp><a:t>Second</a:t></p:sp></p:sld>'
    const zip = zipSync({
      'ppt/slides/slide1.xml': strToU8(slide1),
      'ppt/slides/slide2.xml': strToU8(slide2),
    })
    expect(extractOfficeText(zip, 'x.pptx')).toBe('Title ·  Sub\n\nSecond')
  })

  it('returns an empty string when the zip lacks the document part', () => {
    expect(extractOfficeText(zipSync({ 'other/file.bin': strToU8('x') }), 'x.docx')).toBe('')
  })
})

describe('extensionOf', () => {
  it('lowercases and strips the dot', () => {
    expect(extensionOf('a/b/c.TSX')).toBe('tsx')
    expect(extensionOf('noext')).toBe('')
  })
})

describe('parseCsv', () => {
  it('parses comma-delimited rows', () => {
    expect(parseCsv('a,b\nc,d', ',')).toEqual({ rows: [['a', 'b'], ['c', 'd']] })
  })

  it('handles quoted cells with embedded delimiters and escaped quotes', () => {
    expect(parseCsv('"x,y","say ""hi"""\nz', ',')).toEqual({
      rows: [['x,y', 'say "hi"'], ['z', '']],
    })
  })

  it('parses tab-delimited text', () => {
    expect(parseCsv('a\tb', '\t')).toEqual({ rows: [['a', 'b']] })
  })

  it('pads ragged rows to the widest row', () => {
    expect(parseCsv('a,b,c\nd', ',')).toEqual({
      rows: [['a', 'b', 'c'], ['d', '', '']],
    })
  })
})

describe('extractEpubText', () => {
  it('extracts chapter text in spine order', () => {
    const opf = [
      '<package><spine>',
      '<itemref idref="c1"/>',
      '<itemref idref="c2"/>',
      '</spine><manifest>',
      '<item id="c1" href="ch1.xhtml"/>',
      '<item id="c2" href="text/ch2.xhtml"/>',
      '</manifest></package>',
    ].join('')
    const zip = zipSync({
      'content.opf': strToU8(opf),
      'ch1.xhtml': strToU8('<html><body><p>First &amp; only</p></body></html>'),
      'text/ch2.xhtml': strToU8('<html><body><p>Second</p><br/><p>Third</p></body></html>'),
    })
    expect(extractEpubText(zip)).toBe('First & only\n\nSecond\nThird')
  })

  it('falls back to all chapters when the spine is unreadable', () => {
    const zip = zipSync({
      'ch1.xhtml': strToU8('<p>Alpha</p>'),
      'ch2.xhtml': strToU8('<p>Beta</p>'),
    })
    const text = extractEpubText(zip)
    expect(text).toContain('Alpha')
    expect(text).toContain('Beta')
  })
})

/**
 * Pure-function tests for the session-file extraction: line change totals
 * (LCS over occurrence-paired lines) and snapshot traversal.
 */
import { describe, expect, it } from 'vitest'
import { countLineChanges, sessionFilesEqual, splitDisplayPath } from '../src/client/files.ts'

describe('countLineChanges', () => {
  it('counts one added and one removed line', () => {
    const change = countLineChanges('a\nb', 'a\nc')
    expect(change).toEqual({ added: 1, removed: 1 })
  })

  it('counts a whole-file create against a null old text', () => {
    const change = countLineChanges(null, 'x\ny\nz')
    expect(change).toEqual({ added: 3, removed: 0 })
  })

  it('pairs repeated identical lines by occurrence, not text alone', () => {
    // LCS keeps the three matched braces; the fourth is new and 'a' becomes 'b'.
    const change = countLineChanges('}\n}\n}\na', '}\n}\n}\n}\nb')
    expect(change).toEqual({ added: 2, removed: 1 })
  })

  it('returns null beyond the size bound', () => {
    const big = Array.from({ length: 2100 }, () => 'x').join('\n')
    expect(countLineChanges(big, big)).toBeNull()
  })
})

describe('sessionFilesEqual', () => {
  const base = { path: 'a.ts', ops: ['edit'] as const, lastTime: 1, diffs: [], added: 1, removed: 0 }

  it('accepts equal file lists', () => {
    expect(sessionFilesEqual([base], [{ ...base }])).toBe(true)
  })

  it('rejects differing change totals', () => {
    expect(sessionFilesEqual([base], [{ ...base, added: 2 }])).toBe(false)
  })

  it('rejects differing diff payloads', () => {
    expect(sessionFilesEqual(
      [base],
      [{ ...base, diffs: [{ path: 'a.ts', oldText: 'x', newText: 'y' }] }],
    )).toBe(false)
  })
})

describe('splitDisplayPath', () => {
  it('splits a nested path into name and directory', () => {
    expect(splitDisplayPath('src/client/index.tsx')).toEqual({ name: 'index.tsx', dir: 'src/client' })
  })

  it('normalizes backslashes', () => {
    expect(splitDisplayPath('src\\a.ts')).toEqual({ name: 'a.ts', dir: 'src' })
  })

  it('handles a bare filename', () => {
    expect(splitDisplayPath('a.ts')).toEqual({ name: 'a.ts', dir: '' })
  })
})

import { describe, expect, it } from 'vitest'
import { classifyDropInputs, dropInputsFromAbsolutePaths, guessDropSourceKind } from './dropInput'

describe('classifyDropInputs', () => {
  it('identifies two file inputs', () => {
    expect(
      classifyDropInputs([
        { path: 'C:/work/left.txt', kind: 'file' },
        { path: 'C:/work/right.txt', kind: 'file' },
      ]),
    ).toMatchObject({
      kind: 'files',
      left: { displayName: 'left.txt' },
      right: { displayName: 'right.txt' },
    })
  })

  it('identifies two folder inputs', () => {
    expect(
      classifyDropInputs([
        { path: 'C:/work/left', kind: 'directory' },
        { path: 'C:/work/right', kind: 'directory' },
      ]),
    ).toMatchObject({
      kind: 'folders',
      left: { displayName: 'left' },
      right: { displayName: 'right' },
    })
  })

  it('identifies mixed file and folder inputs', () => {
    expect(
      classifyDropInputs([
        { path: 'C:/work/left.txt', kind: 'file' },
        { path: 'C:/work/right', kind: 'directory' },
      ]),
    ).toMatchObject({
      kind: 'mixed',
      left: { sourceKind: 'file' },
      right: { sourceKind: 'directory' },
    })
  })

  it('rejects drops that do not contain exactly two inputs', () => {
    expect(classifyDropInputs([{ path: 'left.txt', kind: 'file' }])).toEqual({
      kind: 'invalid',
      reason: 'Drop exactly two files or folders.',
    })
  })

  it('accepts a single patch file as a patch drop', () => {
    expect(classifyDropInputs([{ path: 'C:/work/change.patch', kind: 'file' }])).toMatchObject({
      kind: 'patch',
      left: { displayName: 'change.patch' },
      right: { displayName: 'change.patch' },
    })
  })
})

describe('guessDropSourceKind', () => {
  it('treats extension-bearing paths as files', () => {
    expect(guessDropSourceKind('C:/work/left.txt')).toBe('file')
    expect(guessDropSourceKind('/tmp/notes.md')).toBe('file')
  })

  it('treats extensionless and trailing-slash paths as directories', () => {
    expect(guessDropSourceKind('C:/work/left')).toBe('directory')
    expect(guessDropSourceKind('/tmp/project/')).toBe('directory')
  })
})

describe('dropInputsFromAbsolutePaths', () => {
  it('preserves absolute paths while classifying kinds', () => {
    expect(dropInputsFromAbsolutePaths(['/abs/left.txt', '/abs/right/', '  '])).toEqual([
      { path: '/abs/left.txt', kind: 'file' },
      { path: '/abs/right/', kind: 'directory' },
    ])
  })
})

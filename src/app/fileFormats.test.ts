import { afterEach, describe, expect, it } from 'vitest'
import {
  fileFormatsStorageKey,
  loadFileFormats,
  matchFileFormat,
  saveFileFormats,
  sessionTypeForPath,
} from './fileFormats'

describe('fileFormats', () => {
  afterEach(() => {
    localStorage.removeItem(fileFormatsStorageKey)
  })

  it('routes csv, registry, image, and patch paths from persisted formats', () => {
    expect(sessionTypeForPath('report.csv')).toBe('table-compare')
    expect(sessionTypeForPath('export.reg')).toBe('registry-compare')
    expect(sessionTypeForPath('photo.webp')).toBe('picture-compare')
    expect(sessionTypeForPath('change.patch')).toBe('text-patch')
    expect(sessionTypeForPath('release.zip')).toBe('archive-compare')
    expect(sessionTypeForPath('bundle.tar.gz')).toBe('archive-compare')
  })

  it('lets saved file formats influence open routing', () => {
    const formats = loadFileFormats()
    const rust = formats.find((format) => format.id === 'source-code')

    expect(rust).toBeDefined()
    if (rust) {
      rust.matcher.extensions.push('bin')
      rust.defaultView = 'text'
    }
    saveFileFormats(formats)

    expect(matchFileFormat('payload.bin')?.defaultView).toBe('text')
    expect(sessionTypeForPath('payload.bin')).toBe('text-compare')
  })
})

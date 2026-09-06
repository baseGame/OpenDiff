import { describe, expect, it } from 'vitest'
import {
  buildFolderCompareToolbar,
  buildTextCompareToolbar,
  folderCompareToolbarOrder,
  pathPairTitle,
  textCompareToolbarOrder,
} from './sessionToolbars'

describe('sessionToolbars', () => {
  it('keeps Folder Compare toolbar in expected order', () => {
    const toolbar = buildFolderCompareToolbar({
      home: true,
      all: true,
      same: true,
      expand: true,
      collapse: true,
      refresh: true,
      swap: true,
      stop: true,
      copy: false,
      minor: false,
      rules: false,
      select: false,
      files: false,
      filters: false,
      peek: false,
    })

    expect(toolbar.map((item) => item.id)).toEqual([...folderCompareToolbarOrder])
    expect(toolbar.find((item) => item.id === 'peek')?.enabled).toBe(false)
    expect(toolbar.find((item) => item.id === 'home')?.enabled).toBe(true)
  })

  it('keeps Text Compare toolbar in expected order', () => {
    const toolbar = buildTextCompareToolbar({
      home: true,
      all: true,
      diffs: true,
      copy: true,
      'next-section': true,
      'prev-section': true,
      swap: true,
      reload: true,
    })

    expect(toolbar.map((item) => item.id)).toEqual([...textCompareToolbarOrder])
    expect(toolbar.find((item) => item.id === 'minor')?.enabled).toBe(false)
  })

  it('formats path pair titles', () => {
    expect(pathPairTitle('D:/work/left.txt', 'D:/work/right.txt')).toBe('left.txt <--> right.txt')
  })
})

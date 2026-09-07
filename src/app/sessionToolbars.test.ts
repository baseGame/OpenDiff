import { describe, expect, it } from 'vitest'
import {
  buildClipboardCompareToolbar,
  buildFolderCompareToolbar,
  buildFolderMergeToolbar,
  buildFolderSyncToolbar,
  buildHexCompareToolbar,
  buildMediaCompareToolbar,
  buildPictureCompareToolbar,
  buildRegistryCompareToolbar,
  buildTableCompareToolbar,
  buildTextCompareToolbar,
  buildTextPatchToolbar,
  buildVersionCompareToolbar,
  clipboardCompareToolbarOrder,
  folderCompareToolbarOrder,
  folderMergeToolbarOrder,
  folderSyncToolbarOrder,
  hexCompareToolbarOrder,
  mergeSessionTitle,
  pathPairTitle,
  pictureCompareToolbarOrder,
  singlePathTitle,
  syncPathPairTitle,
  tableCompareToolbarOrder,
  textCompareToolbarOrder,
  textPatchToolbarOrder,
  versionCompareToolbarOrder,
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

  it('keeps Hex Compare toolbar in expected order', () => {
    const toolbar = buildHexCompareToolbar({
      home: true,
      all: true,
      diffs: true,
      'next-diff': true,
      'prev-diff': true,
      swap: true,
      reload: true,
    })

    expect(toolbar.map((item) => item.id)).toEqual([...hexCompareToolbarOrder])
    expect(toolbar.find((item) => item.id === 'same')?.enabled).toBe(false)
    expect(toolbar.find((item) => item.id === 'rules')?.enabled).toBe(false)
  })

  it('keeps Table Compare toolbar in expected order', () => {
    const toolbar = buildTableCompareToolbar({
      home: true,
      'next-diff': true,
      'prev-diff': true,
      swap: true,
      reload: true,
    })

    expect(toolbar.map((item) => item.id)).toEqual([...tableCompareToolbarOrder])
    expect(toolbar.find((item) => item.id === 'minor')?.enabled).toBe(false)
  })

  it('can enable Picture Tol and Range without fake labels', () => {
    const toolbar = buildPictureCompareToolbar({
      home: true,
      tol: true,
      range: true,
      swap: true,
      reload: true,
    })

    expect(toolbar.map((item) => item.id)).toEqual([...pictureCompareToolbarOrder])
    expect(toolbar.find((item) => item.id === 'tol')?.enabled).toBe(true)
    expect(toolbar.find((item) => item.id === 'range')?.enabled).toBe(true)
    expect(toolbar.find((item) => item.id === 'blend')?.enabled).toBe(false)
    expect(toolbar.find((item) => item.id === 'meta')?.enabled).toBe(false)
    expect(toolbar.every((item) => !item.labelKey.includes('unimplemented'))).toBe(true)
  })

  it('keeps Registry Media and Version toolbars ordered', () => {
    expect(buildRegistryCompareToolbar({ home: true }).map((item) => item.id)).toContain('expand')
    expect(
      buildMediaCompareToolbar({ home: true, swap: true }).find((i) => i.id === 'swap')?.enabled,
    ).toBe(true)
    expect(buildVersionCompareToolbar({ home: true }).map((item) => item.id)).toEqual([
      ...versionCompareToolbarOrder,
    ])
  })

  it('formats path pair titles', () => {
    expect(pathPairTitle('D:/work/left.txt', 'D:/work/right.txt')).toBe('left.txt <--> right.txt')
    expect(syncPathPairTitle('D:/left', 'D:/right')).toBe('Update: left <--> right')
    expect(singlePathTitle('D:/work/out.txt')).toBe('out.txt')
  })

  it('formats merge session titles with output', () => {
    expect(mergeSessionTitle('D:/left', 'D:/right', 'D:/out/merged')).toBe(
      'left <--> right → merged',
    )
    expect(mergeSessionTitle('', '', 'D:/out/merged')).toBe('merged')
    expect(mergeSessionTitle('D:/left', 'D:/right')).toBe('left <--> right')
  })

  it('keeps Clipboard Compare toolbar ordered', () => {
    const toolbar = buildClipboardCompareToolbar({
      home: true,
      capture: true,
      compare: false,
      swap: true,
      reload: true,
    })

    expect(toolbar.map((item) => item.id)).toEqual([...clipboardCompareToolbarOrder])
    expect(toolbar.find((item) => item.id === 'compare')?.enabled).toBe(false)
  })

  it('keeps Text Patch toolbar in Home / Next / Prev section order', () => {
    const toolbar = buildTextPatchToolbar({
      home: true,
      'next-section': true,
      'prev-section': false,
    })

    expect(toolbar.map((item) => item.id)).toEqual([...textPatchToolbarOrder])
    expect(toolbar.find((item) => item.id === 'prev-section')?.enabled).toBe(false)
  })

  it('keeps Folder Sync toolbar chrome for expand/collapse/select/filters/home', () => {
    const toolbar = buildFolderSyncToolbar({
      home: true,
      expand: true,
      collapse: true,
      select: true,
      filters: true,
      refresh: true,
      swap: true,
      stop: false,
    })

    expect(toolbar.map((item) => item.id)).toEqual([...folderSyncToolbarOrder])
    expect(toolbar.find((item) => item.id === 'home')?.enabled).toBe(true)
    expect(toolbar.find((item) => item.id === 'select')?.enabled).toBe(true)
    expect(toolbar.find((item) => item.id === 'stop')?.enabled).toBe(false)
  })

  it('keeps Folder Merge toolbar chrome for expand/collapse/select', () => {
    const toolbar = buildFolderMergeToolbar({
      home: true,
      expand: true,
      collapse: true,
      select: true,
      same: true,
      filters: true,
      refresh: true,
      peek: true,
    })

    expect(toolbar.map((item) => item.id)).toEqual([...folderMergeToolbarOrder])
    expect(toolbar.find((item) => item.id === 'expand')?.enabled).toBe(true)
    expect(toolbar.find((item) => item.id === 'peek')?.enabled).toBe(true)
  })
})

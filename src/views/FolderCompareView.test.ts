import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FolderCompareView from './FolderCompareView.vue'
import {
  changeFolderEntryAttributes,
  compareFolderPaths,
  copyFolderCompareEntry,
  deleteFolderEntry,
  exportFolderCompareReport,
  moveFolderEntry,
  renameFolderEntry,
  touchFolderEntry,
} from '@/api/diff'
import { previewFolderSync } from '@/api/sync'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/api/sync', () => ({
  previewFolderSync: vi.fn().mockResolvedValue({
    name: 'preview',
    leftRoot: 'D:/left',
    rightRoot: 'D:/right',
    strategy: 'updateRight',
    rows: [
      {
        id: 'copy-notes',
        relativePath: 'notes.md',
        action: 'Copy',
        sourcePath: 'D:/left/notes.md',
        targetPath: 'D:/right/notes.md',
        detail: 'Copy left to right',
      },
    ],
    summary: { total: 1, copy: 1, delete: 0, leave: 0, conflict: 0 },
  }),
}))

vi.mock('@/api/diff', () => ({
  changeFolderEntryAttributes: vi.fn().mockResolvedValue({
    path: 'D:/left/README.md',
    metadata: { readonly: true },
  }),
  compareFolderPaths: vi.fn().mockResolvedValue({
    leftRoot: 'D:/left',
    rightRoot: 'D:/right',
    rows: [
      {
        relativePath: 'src',
        depth: 0,
        status: 'Same',
        left: { name: 'src', kind: 'directory', size: 0, path: 'D:/left/src' },
        right: { name: 'src', kind: 'directory', size: 0, path: 'D:/right/src' },
      },
      {
        relativePath: 'src/main.ts',
        depth: 1,
        status: 'Different',
        left: { name: 'main.ts', kind: 'file', size: 12, path: 'D:/left/src/main.ts' },
        right: { name: 'main.ts', kind: 'file', size: 14, path: 'D:/right/src/main.ts' },
      },
      {
        relativePath: 'README.md',
        depth: 0,
        status: 'Same',
        left: { name: 'README.md', kind: 'file', size: 10, path: 'D:/left/README.md' },
        right: { name: 'README.md', kind: 'file', size: 10, path: 'D:/right/README.md' },
      },
      {
        relativePath: 'notes.md',
        depth: 0,
        status: 'Left only',
        left: { name: 'notes.md', kind: 'file', size: 4, path: 'D:/left/notes.md' },
      },
    ],
    summary: { total: 4, same: 2, different: 1, leftOnly: 1, rightOnly: 0 },
  }),
  copyFolderCompareEntry: vi.fn().mockResolvedValue({
    direction: 'toRight',
    sourcePath: 'D:/left/src/main.ts',
    targetPath: 'D:/right/src/main.ts',
    refreshedStatus: 'same',
  }),
  deleteFolderEntry: vi.fn().mockResolvedValue({
    operation: 'delete',
    status: 'deleted',
    sourcePath: 'D:/left/notes.md',
    targetPath: null,
  }),
  exportFolderCompareReport: vi.fn().mockResolvedValue({
    format: 'html',
    content: '<html></html>',
    outputPath: 'D:/left/folder-compare.html',
    bytesWritten: 13,
  }),
  moveFolderEntry: vi.fn().mockResolvedValue({
    operation: 'move',
    status: 'moved',
    sourcePath: 'D:/left/notes.md',
    targetPath: 'D:/left/archive/notes.md',
  }),
  renameFolderEntry: vi.fn().mockResolvedValue({
    operation: 'rename',
    status: 'renamed',
    sourcePath: 'D:/left/notes.md',
    targetPath: 'D:/left/notes-final.md',
  }),
  touchFolderEntry: vi.fn().mockResolvedValue({
    path: 'D:/left/README.md',
    metadata: { readonly: false },
  }),
}))

function mountFolderCompareView(): VueWrapper {
  return mount(FolderCompareView, {
    global: {
      stubs: {
        NButton: {
          props: ['disabled', 'loading'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  })
}

async function runCompare(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('[data-testid="folder-left-root"]').setValue('D:/left')
  await wrapper.find('[data-testid="folder-right-root"]').setValue('D:/right')
  await wrapper.find('[data-testid="run-folder-compare"]').trigger('click')
  await flushPromises()
}

describe('FolderCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockClear()
    vi.clearAllMocks()
  })

  it('does not render a demo folder tree before a real compare', () => {
    const wrapper = mountFolderCompareView()

    expect(wrapper.text()).not.toContain('generated-120.log')
    expect(wrapper.text()).not.toContain('D:/workspace/left')
    expect(wrapper.findAll('[data-testid="folder-row"]')).toHaveLength(0)
  })

  it('runs a real folder comparison request and renders returned rows', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)

    expect(compareFolderPaths).toHaveBeenCalledWith({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      criteria: {
        compareSize: true,
        compareModifiedTime: false,
        compareContents: true,
        compareCrc: false,
      },
    })
    expect(wrapper.text()).toContain('main.ts')
    expect(wrapper.text()).toContain('Different')
  })

  it('opens a child text compare session for a selected file pair', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-row-id="src-main-ts"]').trigger('click')
    await wrapper.find('[data-testid="compare-to-selected-file"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/text')
    expect(useSessionLaunchStore().pendingLaunch).toMatchObject({
      route: '/compare/text',
      autoRun: true,
      locations: {
        left: { uri: 'D:/left/src/main.ts' },
        right: { uri: 'D:/right/src/main.ts' },
      },
    })
  })

  it('moves the selected file through the Tauri command', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-row-id="notes-md"]').trigger('click')
    await wrapper.find('[data-testid="move-selected-file"]').trigger('click')
    await flushPromises()

    expect(moveFolderEntry).toHaveBeenCalledWith({
      sourcePath: 'D:/left/notes.md',
      targetPath: 'D:/left/archive/notes.md',
    })
    expect(wrapper.text()).toContain('Move -> D:/left/archive/notes.md')
  })

  it('copies, renames, deletes, and touches selected files', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)

    await wrapper.find('[data-row-id="src-main-ts"]').trigger('click')
    await wrapper.find('[data-testid="copy-selected-to-right"]').trigger('click')
    await wrapper.find('[data-testid="confirm-folder-copy"]').trigger('click')
    await flushPromises()
    expect(copyFolderCompareEntry).toHaveBeenCalled()

    await wrapper.find('[data-row-id="notes-md"]').trigger('click')
    await wrapper.find('[data-testid="rename-selected-file"]').trigger('click')
    await wrapper.find('[data-testid="rename-target-name"]').setValue('notes-final.md')
    await wrapper.find('[data-testid="confirm-rename-file"]').trigger('click')
    await flushPromises()
    expect(renameFolderEntry).toHaveBeenCalled()

    await wrapper.find('[data-row-id="notes-md"]').trigger('click')
    await wrapper.find('[data-testid="delete-selected-file"]').trigger('click')
    await wrapper.find('[data-testid="confirm-dangerous-file-operation"]').trigger('click')
    await flushPromises()
    expect(deleteFolderEntry).toHaveBeenCalled()

    await wrapper.find('[data-row-id="readme-md"]').trigger('click')
    await wrapper.find('[data-testid="touch-selected-file"]').trigger('click')
    await flushPromises()
    expect(touchFolderEntry).toHaveBeenCalled()
    expect(changeFolderEntryAttributes).not.toHaveBeenCalled()
  })

  it('exports a folder compare HTML report', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-testid="export-folder-html-report"]').trigger('click')
    await flushPromises()

    expect(exportFolderCompareReport).toHaveBeenCalledWith(
      expect.objectContaining({
        leftRoot: 'D:/left',
        rightRoot: 'D:/right',
        format: 'html',
      }),
    )
  })

  it('loads a real sync preview instead of demo rows', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-testid="preview-sync-plan"]').trigger('click')
    await flushPromises()

    expect(previewFolderSync).toHaveBeenCalledWith({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      strategy: 'updateRight',
    })
    expect(wrapper.find('[data-testid="sync-preview-panel"]').text()).toContain('D:/left/notes.md')
    expect(wrapper.text()).not.toContain('D:/workspace/right/archive/legacy.tmp')
  })
})

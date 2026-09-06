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
import { executeFolderSync, previewFolderSync } from '@/api/sync'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { openPathExternal } from '@/api/integration'
import { useTabsStore } from '@/stores/tabs'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/api/integration', () => ({
  openPathExternal: vi.fn().mockResolvedValue({
    path: 'D:/left/src/main.ts',
    executable: null,
    launched: true,
  }),
}))

vi.mock('@/api/sync', () => ({
  executeFolderSync: vi.fn().mockResolvedValue({
    name: 'Update Right',
    leftRoot: 'D:/left',
    rightRoot: 'D:/right',
    strategy: 'updateRight',
    total: 1,
    succeeded: 1,
    failed: 0,
    cancelled: 0,
    logs: [],
  }),
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
    localStorage.clear()
    setActivePinia(createPinia())
    push.mockClear()
    vi.clearAllMocks()
  })

  it('renders the Folder Compare session toolbar order', () => {
    const wrapper = mountFolderCompareView()
    const ids = [
      'home',
      'all',
      'same',
      'minor',
      'rules',
      'copy',
      'expand',
      'collapse',
      'select',
      'files',
      'refresh',
      'swap',
      'stop',
      'filters',
      'peek',
    ]

    expect(wrapper.find('[data-testid="folder-session-toolbar-bar"]').exists()).toBe(true)
    expect(
      wrapper
        .findAll('[data-testid^="folder-session-toolbar-"]')
        .filter((node) => node.attributes('data-testid') !== 'folder-session-toolbar-bar')
        .map((node) => node.attributes('data-testid')?.replace('folder-session-toolbar-', '')),
    ).toEqual(ids)
    expect(
      wrapper.find('[data-testid="folder-session-toolbar-minor"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="folder-session-toolbar-peek"]').attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.html()).not.toContain('未实现')
  })

  it('does not render a demo folder tree before a real compare', () => {
    const wrapper = mountFolderCompareView()

    expect(wrapper.text()).not.toContain('generated-120.log')
    expect(wrapper.text()).not.toContain('D:/workspace/left')
    expect(wrapper.findAll('[data-testid="folder-row"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="folder-empty-state"]').exists()).toBe(true)
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
    expect(useTabsStore().tabs.some((tab) => tab.route === '/compare/text')).toBe(true)
  })

  it('launches open-with and associated apps for the selected file', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-row-id="src-main-ts"]').trigger('click')

    const openWith = wrapper.find('[data-testid="open-with-selected-file"]')
    const associated = wrapper.find('[data-testid="open-associated-file"]')
    const vscode = wrapper.find('[data-testid="open-with-custom-vscode"]')

    expect(openWith.attributes('disabled')).toBeUndefined()
    expect(associated.attributes('disabled')).toBeUndefined()
    expect(vscode.attributes('disabled')).toBeUndefined()
    expect(openWith.text()).not.toContain('unimplemented')

    await associated.trigger('click')
    await flushPromises()
    expect(openPathExternal).toHaveBeenCalledWith('D:/left/src/main.ts')

    vi.mocked(openPathExternal).mockClear()
    await vscode.trigger('click')
    await flushPromises()
    expect(openPathExternal).toHaveBeenCalledWith('D:/left/src/main.ts', 'code')
    expect(wrapper.text()).toContain('Open With Visual Studio Code')
  })

  it('keeps unfinished align-with actions disabled without unimplemented labels', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-row-id="src-main-ts"]').trigger('click')

    const alignWith = wrapper.find('[data-testid="align-with-selected-file"]')
    const breakAlignment = wrapper.find('[data-testid="break-selected-alignment"]')

    expect(alignWith.attributes('disabled')).toBeDefined()
    expect(breakAlignment.attributes('disabled')).toBeDefined()
    expect(alignWith.text()).toBe('Align With')
    expect(breakAlignment.text()).toBe('Break Alignment')
    expect(alignWith.text()).not.toContain('unimplemented')
    expect(wrapper.find('[data-testid="folder-alignment-action-status"]').exists()).toBe(false)
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

    await wrapper.find('[data-testid="run-sync-preview"]').trigger('click')
    await flushPromises()

    expect(executeFolderSync).toHaveBeenCalledWith({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      strategy: 'updateRight',
      overrides: [
        {
          relativePath: 'notes.md',
          action: 'copyLeftToRight',
        },
      ],
    })
    expect(wrapper.text()).toMatch(/Sync finished|同步完成/)
  })
  it('filters rows by Same/Different/Orphans and persists the selection', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)

    const sameToggle = wrapper.find('[data-testid="toggle-status-same"]')

    await sameToggle.setValue(false)
    await sameToggle.trigger('change')
    await flushPromises()

    const statuses = wrapper
      .findAll('[data-testid="folder-row"]')
      .map((row) => row.classes().find((name) => name.startsWith('status-')))

    expect(statuses.length).toBeGreaterThan(0)
    expect(statuses.every((status) => status !== 'status-same')).toBe(true)

    const stored = JSON.parse(localStorage.getItem('open-diff-folder-display-filters') ?? '{}') as {
      statuses: string[]
      showSuppressed: boolean
    }

    expect(stored.statuses).not.toContain('Same')
    expect(stored.statuses).toContain('Different')
  })

  it('shows a readable compare error instead of undefined', async () => {
    vi.mocked(compareFolderPaths).mockRejectedValueOnce(undefined)
    const wrapper = mountFolderCompareView()

    await wrapper.find('[data-testid="folder-left-root"]').setValue('D:/left')
    await wrapper.find('[data-testid="folder-right-root"]').setValue('D:/right')
    await wrapper.find('[data-testid="run-folder-compare"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-compare-error"]').text()).toContain(
      'Comparison failed',
    )
  })

  it('applies a pending folder drop launch while already mounted', async () => {
    mountFolderCompareView()
    const launchStore = useSessionLaunchStore()

    launchStore.setPendingLaunch({
      id: 'drop-folder-1',
      source: 'drop',
      sessionType: 'folder-compare',
      title: 'folder-a vs folder-b',
      route: '/compare/folder',
      autoRun: true,
      locations: {
        left: { uri: 'D:/drops/folder-a', kind: 'directory', readOnly: false },
        right: { uri: 'D:/drops/folder-b', kind: 'directory', readOnly: false },
      },
    })
    await flushPromises()

    expect(compareFolderPaths).toHaveBeenCalledWith(
      expect.objectContaining({
        leftRoot: 'D:/drops/folder-a',
        rightRoot: 'D:/drops/folder-b',
      }),
    )
    expect(launchStore.pendingLaunch).toBeUndefined()
  })

  it('disables export and sync preview until both roots are set', () => {
    const wrapper = mountFolderCompareView()

    expect(
      wrapper.find('[data-testid="export-folder-html-report"]').attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.find('[data-testid="preview-sync-plan"]').attributes('disabled')).toBeDefined()
  })

  it('surfaces copy failures instead of leaving a hanging confirmation', async () => {
    vi.mocked(copyFolderCompareEntry).mockRejectedValueOnce(new Error('disk full'))
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-row-id="src-main-ts"]').trigger('click')
    await wrapper.find('[data-testid="copy-selected-to-right"]').trigger('click')
    await wrapper.find('[data-testid="confirm-folder-copy"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-compare-error"]').text()).toContain('disk full')
    expect(wrapper.find('[data-testid="folder-copy-confirmation"]').exists()).toBe(true)
  })

  it('refreshes the tree after touch and enables directory rename/delete/move', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    vi.mocked(compareFolderPaths).mockClear()

    await wrapper.find('[data-row-id="readme-md"]').trigger('click')
    await wrapper.find('[data-testid="touch-selected-file"]').trigger('click')
    await flushPromises()

    expect(touchFolderEntry).toHaveBeenCalled()
    expect(compareFolderPaths).toHaveBeenCalled()

    await wrapper.find('[data-row-id="src"]').trigger('click')
    expect(
      wrapper.find('[data-testid="rename-selected-file"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="delete-selected-file"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="move-selected-file"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="copy-selected-to-right"]').attributes('disabled'),
    ).toBeDefined()

    await wrapper.find('[data-testid="move-selected-file"]').trigger('click')
    await flushPromises()
    expect(moveFolderEntry).toHaveBeenCalledWith({
      sourcePath: 'D:/left/src',
      targetPath: 'D:/left/archive/src',
    })
  })

  it('exposes full path tooltips on path inputs', async () => {
    const wrapper = mountFolderCompareView()
    const longPath = 'D:/very/long/path/to/project/left-root-directory'

    await wrapper.find('[data-testid="folder-left-root"]').setValue(longPath)

    expect(wrapper.find('[data-testid="folder-left-root"]').attributes('title')).toBe(longPath)
  })
})

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FolderSyncView from './FolderSyncView.vue'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))
import { executeFolderSync, previewFolderSync } from '@/api/sync'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

vi.mock('@/api/sync', () => ({
  executeFolderSync: vi.fn().mockResolvedValue({
    name: 'Mirror to Right',
    leftRoot: 'D:/deploy/package',
    rightRoot: 'D:/deploy/prod',
    strategy: 'mirrorRight',
    total: 2,
    succeeded: 2,
    failed: 0,
    cancelled: 0,
    logs: [
      {
        relativePath: 'package/app.exe',
        action: 'copyLeftToRight',
        sourcePath: 'D:/deploy/package/package/app.exe',
        targetPath: 'D:/deploy/prod/package/app.exe',
        status: 'succeeded',
      },
      {
        relativePath: 'prod/old.dll',
        action: 'delete',
        targetPath: 'D:/deploy/prod/prod/old.dll',
        status: 'succeeded',
      },
    ],
  }),
  previewFolderSync: vi.fn().mockResolvedValue({
    name: 'Mirror to Right',
    leftRoot: 'D:/deploy/package',
    rightRoot: 'D:/deploy/prod',
    strategy: 'mirrorRight',
    rows: [
      {
        id: 'copy-app',
        relativePath: 'package/app.exe',
        action: 'Copy',
        sourcePath: 'D:/deploy/package/package/app.exe',
        targetPath: 'D:/deploy/prod/package/app.exe',
        detail: 'Left item only exists',
      },
      {
        id: 'delete-old',
        relativePath: 'prod/old.dll',
        action: 'Delete',
        targetPath: 'D:/deploy/prod/prod/old.dll',
        detail: 'Right item does not exist on left',
      },
    ],
    summary: {
      total: 2,
      copy: 1,
      delete: 1,
      leave: 0,
      conflict: 0,
    },
  }),
}))

describe('FolderSyncView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('configures folder paths, strategy, preview, and run status', async () => {
    const wrapper = mount(FolderSyncView, {
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

    expect(wrapper.text()).toContain('Folder Sync')
    expect(
      (wrapper.find('[data-testid="folder-sync-left-path"]').element as HTMLInputElement).value,
    ).toBe('')
    expect(
      (wrapper.find('[data-testid="folder-sync-right-path"]').element as HTMLInputElement).value,
    ).toBe('')

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-strategy"]').setValue('mirrorRight')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    expect(previewFolderSync).toHaveBeenCalledWith({
      leftRoot: 'D:/deploy/package',
      rightRoot: 'D:/deploy/prod',
      strategy: 'mirrorRight',
    })
    expect(wrapper.find('[data-testid="folder-sync-preview-panel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Mirror to Right')
    expect(wrapper.text()).toContain('D:/deploy/package')
    expect(wrapper.text()).toContain('D:/deploy/prod')
    expect(wrapper.text()).toContain('Copy L→R')
    expect(wrapper.text()).toContain('Delete')

    expect(wrapper.find('[data-testid="folder-sync-title"]').text()).toContain('Update:')
    expect(wrapper.find('[data-testid="folder-sync-run"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="folder-sync-accept"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-chrome-status"]').text()).toContain('accepted')
    expect(wrapper.find('[data-testid="folder-sync-run"]').attributes('disabled')).toBeUndefined()

    await wrapper.find('[data-testid="sync-override-copy-app"]').setValue('leave')
    expect(wrapper.find('[data-testid="folder-sync-run"]').attributes('disabled')).toBeDefined()
    await wrapper.find('[data-testid="folder-sync-accept"]').trigger('click')
    await wrapper.find('[data-testid="folder-sync-run"]').trigger('click')
    await flushPromises()

    expect(executeFolderSync).toHaveBeenCalledWith({
      leftRoot: 'D:/deploy/package',
      rightRoot: 'D:/deploy/prod',
      strategy: 'mirrorRight',
      overrides: [
        { relativePath: 'package/app.exe', action: 'copyLeftToRight' },
        { relativePath: 'prod/old.dll', action: 'delete' },
      ],
    })
    expect(wrapper.text()).toContain('Completed 2 / 2')
    expect(wrapper.text()).toContain('Copied package/app.exe')
    expect(wrapper.text()).toContain('Deleted prod/old.dll')
  })

  it('cancels overrides to leave and resets a single row', async () => {
    const wrapper = mount(FolderSyncView, {
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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-strategy"]').setValue('mirrorRight')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="folder-sync-cancel"]').trigger('click')
    expect(
      (wrapper.find('[data-testid="sync-override-copy-app"]').element as HTMLSelectElement).value,
    ).toBe('leave')
    expect(
      (wrapper.find('[data-testid="sync-override-delete-old"]').element as HTMLSelectElement).value,
    ).toBe('leave')

    await wrapper.find('[data-testid="sync-reset-copy-app"]').trigger('click')
    expect(
      (wrapper.find('[data-testid="sync-override-copy-app"]').element as HTMLSelectElement).value,
    ).toBe('copyLeftToRight')
  })

  it('consumes a saved-session launch and auto-previews', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'sync-launch',
      source: 'saved-session',
      sessionType: 'folder-sync',
      title: 'Deploy sync',
      route: '/sync/folder',
      autoRun: true,
      locations: {
        left: { uri: 'D:/deploy/package', kind: 'directory', readOnly: false },
        right: { uri: 'D:/deploy/prod', kind: 'directory', readOnly: false },
      },
    })

    mount(FolderSyncView, {
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
    await flushPromises()

    expect(previewFolderSync).toHaveBeenCalledWith({
      leftRoot: 'D:/deploy/package',
      rightRoot: 'D:/deploy/prod',
      strategy: 'updateBoth',
    })
  })

  it('exposes Expand/Collapse/Select/Filters/Home session toolbar chrome', async () => {
    const wrapper = mount(FolderSyncView, {
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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-sync-session-toolbar-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-sync-session-toolbar-home"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="folder-sync-session-toolbar-expand"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="folder-sync-session-toolbar-collapse"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="folder-sync-session-toolbar-filters"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-filters-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="folder-sync-session-toolbar-select"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-select-panel"]').exists()).toBe(true)
    await wrapper.find('[data-testid="folder-sync-select-all"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-selection-status"]').text()).toContain('2')

    await wrapper.find('[data-testid="folder-sync-session-toolbar-collapse"]').trigger('click')
    expect(wrapper.find('[data-testid="sync-row-copy-app"]').exists()).toBe(false)
    await wrapper.find('[data-testid="folder-sync-session-toolbar-expand"]').trigger('click')
    expect(wrapper.find('[data-testid="sync-row-copy-app"]').exists()).toBe(true)
  })
})

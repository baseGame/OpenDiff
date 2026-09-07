import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RegistryCompareView from './RegistryCompareView.vue'
import { compareRegistryExports, readTextFile, saveTextFile } from '@/api/diff'
import { queryLiveWindowsRegistry } from '@/api/policy'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useTabsStore } from '@/stores/tabs'

const clipboardWriteText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/policy', () => ({
  queryLiveWindowsRegistry: vi
    .fn()
    .mockRejectedValue(new Error('Live registry query is available on Windows only')),
}))

vi.mock('@/api/diff', () => ({
  saveTextFile: vi.fn().mockResolvedValue({
    path: 'C:/drop/registry-compare.txt',
    bytesWritten: 64,
  }),
  compareRegistryExports: vi.fn().mockResolvedValue({
    leftName: 'fixture-left.reg',
    rightName: 'fixture-right.reg',
    tree: [
      {
        path: 'HKCU/Software/OpenDiff',
        label: 'OpenDiff',
        status: 'modified',
        values: [
          {
            keyPath: 'HKCU/Software/OpenDiff',
            name: 'Theme',
            status: 'modified',
            left: { kind: 'REG_SZ', data: 'dark' },
            right: { kind: 'REG_SZ', data: 'light' },
          },
        ],
        children: [],
      },
    ],
    summary: {
      added: 0,
      removed: 0,
      modified: 1,
      unchanged: 0,
    },
  }),
  readTextFile: vi.fn().mockImplementation((path: string) =>
    Promise.resolve({
      path,
      text: path.includes('left') ? 'left export from file' : 'right export from file',
      encoding: 'UTF-8',
      lineEnding: 'CRLF',
      fileStamp: { size: 24, modifiedAtMs: 1 },
    }),
  ),
}))

describe('RegistryCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(compareRegistryExports).mockClear()
    vi.mocked(readTextFile).mockClear()
    vi.mocked(saveTextFile).mockClear()
    clipboardWriteText.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    })
  })

  it('runs a registry export comparison and renders returned values', async () => {
    const wrapper = mount(RegistryCompareView)

    await wrapper.find('[data-testid="registry-left-export"]').setValue('left export')
    await wrapper.find('[data-testid="registry-right-export"]').setValue('right export')
    await wrapper.find('[data-testid="run-registry-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(compareRegistryExports).toHaveBeenCalledWith({
      left: 'left export',
      right: 'right export',
      leftName: 'left.reg',
      rightName: 'right.reg',
    })
    expect(wrapper.text()).toContain('fixture-left.reg')
    expect(wrapper.text()).toContain('fixture-right.reg')
    expect(wrapper.find('[data-testid="registry-summary-modified"]').text()).toContain('1')
    expect(
      wrapper.find('[data-testid="registry-value-HKCU/Software/OpenDiff::Theme"]').text(),
    ).toContain('light')
  })

  it('reads dropped registry export launch paths and runs the comparison', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-registry',
      source: 'drop',
      sessionType: 'registry-compare',
      title: 'left.reg vs right.reg',
      route: '/compare/registry',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.reg', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.reg', kind: 'file', readOnly: false },
      },
    })

    mount(RegistryCompareView)
    await Promise.resolve()
    await Promise.resolve()

    expect(readTextFile).toHaveBeenCalledWith('C:/drop/left.reg')
    expect(readTextFile).toHaveBeenCalledWith('C:/drop/right.reg')
    expect(compareRegistryExports).toHaveBeenCalledWith({
      left: 'left export from file',
      right: 'right export from file',
      leftName: 'left.reg',
      rightName: 'right.reg',
    })
  })

  it('starts empty without a demo registry tree', () => {
    const wrapper = mount(RegistryCompareView)

    expect(wrapper.text()).toContain('Registry Compare')
    expect(wrapper.find('[data-testid="registry-summary-modified"]').text()).toContain('0')
    expect(wrapper.find('[data-testid="registry-key-HKCU/Software/OpenDiff"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="registry-maturity-note"]').exists()).toBe(true)
  })

  it('filters diffs, applies right value in the workspace, and probes live query honesty', async () => {
    const wrapper = mount(RegistryCompareView)

    await wrapper.find('[data-testid="registry-left-export"]').setValue('left export')
    await wrapper.find('[data-testid="registry-right-export"]').setValue('right export')
    await wrapper.find('[data-testid="run-registry-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper
      .find('[data-testid="registry-value-HKCU/Software/OpenDiff::Theme"]')
      .trigger('click')
    await wrapper.find('[data-testid="registry-apply-right"]').trigger('click')

    expect(wrapper.find('[data-testid="registry-apply-status"]').text().length).toBeGreaterThan(0)
    expect(
      wrapper.find('[data-testid="registry-value-HKCU/Software/OpenDiff::Theme"]').text(),
    ).toContain('light')
    expect(wrapper.find('[data-testid="registry-summary-unchanged"]').text()).toContain('1')

    await wrapper.find('[data-testid="registry-session-toolbar-diffs"]').trigger('click')
    expect(
      wrapper.find('[data-testid="registry-value-HKCU/Software/OpenDiff::Theme"]').exists(),
    ).toBe(false)

    await wrapper.find('[data-testid="registry-live-key"]').setValue('HKCU\\Software\\OpenDiff')
    await wrapper.find('[data-testid="registry-live-query"]').trigger('click')
    await wrapper.vm.$nextTick()
    await Promise.resolve()

    expect(queryLiveWindowsRegistry).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="registry-live-error"]').exists()).toBe(true)
  })

  it('sets path-pair tab titles for registry sessions', async () => {
    const tabs = useTabsStore()

    tabs.openTab({
      title: 'Registry Compare',
      titleKey: 'ui.registryCompare',
      route: '/compare/registry',
      dirty: false,
    })
    mount(RegistryCompareView)
    await Promise.resolve()

    expect(tabs.activeTab.title).toBe('left.reg <--> right.reg')
  })

  it('exports the registry report to clipboard and a sibling text file', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-registry-report',
      source: 'drop',
      sessionType: 'registry-compare',
      title: 'left.reg vs right.reg',
      route: '/compare/registry',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.reg', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.reg', kind: 'file', readOnly: false },
      },
    })

    const wrapper = mount(RegistryCompareView)

    await flushPromises()

    expect(wrapper.find('[data-testid="registry-report-panel"]').exists()).toBe(true)
    await wrapper.find('[data-testid="export-registry-report"]').trigger('click')
    await flushPromises()

    expect(clipboardWriteText).toHaveBeenCalled()
    const payload = clipboardWriteText.mock.calls[0]?.[0] ?? ''

    expect(payload).toContain('REGISTRY-REPORT')
    expect(payload).toContain('left: C:/drop/left.reg')
    expect(payload).toContain('Theme')
    expect(saveTextFile).toHaveBeenCalledWith({
      path: 'C:/drop/registry-compare.txt',
      text: payload,
      createBackup: false,
    })
    expect(wrapper.find('[data-testid="registry-report-status"]').text()).toBe(
      'C:/drop/registry-compare.txt',
    )
  })
})

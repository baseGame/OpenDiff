import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RegistryCompareView from './RegistryCompareView.vue'
import { compareRegistryExports, readTextFile } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/diff', () => ({
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
  })
})

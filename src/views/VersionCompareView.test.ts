import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VersionCompareView from './VersionCompareView.vue'
import { compareVersionFiles } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/diff', () => ({
  compareVersionFiles: vi.fn().mockResolvedValue({
    left: {
      name: 'fixture-left.exe',
      fileType: 'Application',
      targetOs: 'Windows 32-bit',
      fileVersion: '1.0.0.0',
      productVersion: '1.0.0.0',
    },
    right: {
      name: 'fixture-right.exe',
      fileType: 'Application',
      targetOs: 'Windows 32-bit',
      fileVersion: '1.1.0.0',
      productVersion: '1.0.0.0',
    },
    fields: [
      {
        field: 'FileVersion',
        group: 'Fixed Info',
        left: '1.0.0.0',
        right: '1.1.0.0',
        status: 'modified',
      },
      {
        field: 'CompanyName',
        group: 'String Info',
        left: 'Open Diff',
        right: 'Open Diff',
        status: 'unchanged',
      },
      {
        field: 'Comments',
        group: 'String Info',
        left: 'alpha',
        right: 'beta',
        status: 'modified',
      },
    ],
    summary: {
      added: 0,
      removed: 0,
      modified: 2,
      unchanged: 1,
    },
  }),
}))

describe('VersionCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.mocked(compareVersionFiles).mockClear()
  })

  it('runs a real version comparison request and renders returned fields', async () => {
    const wrapper = mount(VersionCompareView)

    await wrapper.find('[data-testid="version-left-path"]').setValue('C:/apps/fixture-left.exe')
    await wrapper.find('[data-testid="version-right-path"]').setValue('C:/apps/fixture-right.exe')
    await wrapper.find('[data-testid="run-version-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(compareVersionFiles).toHaveBeenCalledWith({
      leftPath: 'C:/apps/fixture-left.exe',
      rightPath: 'C:/apps/fixture-right.exe',
    })
    expect(wrapper.text()).toContain('fixture-left.exe')
    expect(wrapper.text()).toContain('fixture-right.exe')
    expect(wrapper.find('[data-testid="version-summary-modified"]').text()).toContain('2')
    expect(wrapper.find('[data-testid="version-field-FileVersion"]').text()).toContain('1.1.0.0')
  })

  it('runs automatically from dropped version launch paths', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-version',
      source: 'drop',
      sessionType: 'version-compare',
      title: 'left.exe vs right.exe',
      route: '/compare/version',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.exe', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.exe', kind: 'file', readOnly: false },
      },
    })

    mount(VersionCompareView)
    await Promise.resolve()

    expect(compareVersionFiles).toHaveBeenCalledWith({
      leftPath: 'C:/drop/left.exe',
      rightPath: 'C:/drop/right.exe',
    })
  })

  it('starts empty without demo version resources', () => {
    const wrapper = mount(VersionCompareView)

    expect(wrapper.text()).toContain('Version Compare')
    expect(wrapper.text()).not.toContain('left-app.exe')
    expect(wrapper.find('[data-testid="version-summary-modified"]').text()).toContain('0')
    expect(wrapper.find('[data-testid="version-toolbar-home"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="version-toolbar-minor"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="version-toolbar-rules"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('filters minor differences and toggles importance rules', async () => {
    const wrapper = mount(VersionCompareView)

    await wrapper.find('[data-testid="version-left-path"]').setValue('C:/apps/fixture-left.exe')
    await wrapper.find('[data-testid="version-right-path"]').setValue('C:/apps/fixture-right.exe')
    await wrapper.find('[data-testid="run-version-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="version-toolbar-minor"]').trigger('click')
    expect(wrapper.find('[data-testid="version-field-Comments"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="version-field-FileVersion"]').exists()).toBe(false)

    await wrapper.find('[data-testid="version-toolbar-rules"]').trigger('click')
    expect(wrapper.find('[data-testid="version-rules-panel"]').exists()).toBe(true)
    await wrapper.find('[data-testid="version-rule-Comments"] input').setValue(true)
    await wrapper.find('[data-testid="version-toolbar-diffs"]').trigger('click')
    expect(wrapper.find('[data-testid="version-field-Comments"]').exists()).toBe(true)
  })

  it('filters diffs and swaps paths from the toolbar', async () => {
    const wrapper = mount(VersionCompareView)

    await wrapper.find('[data-testid="version-left-path"]').setValue('C:/apps/fixture-left.exe')
    await wrapper.find('[data-testid="version-right-path"]').setValue('C:/apps/fixture-right.exe')
    await wrapper.find('[data-testid="run-version-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="version-field-FileVersion"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="version-field-CompanyName"]').exists()).toBe(true)

    await wrapper.find('[data-testid="version-toolbar-diffs"]').trigger('click')

    expect(wrapper.find('[data-testid="version-field-FileVersion"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="version-field-Comments"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="version-field-CompanyName"]').exists()).toBe(false)

    await wrapper.find('[data-testid="version-toolbar-swap"]').trigger('click')

    expect(
      (wrapper.find('[data-testid="version-left-path"]').element as HTMLInputElement).value,
    ).toBe('C:/apps/fixture-right.exe')
  })
})

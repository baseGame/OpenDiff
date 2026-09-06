import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextMergeView from './TextMergeView.vue'
import { mergeTextFiles, saveTextFile } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

vi.mock('@/api/diff', () => ({
  saveTextFile: vi.fn().mockResolvedValue({
    path: 'out.txt',
    bytesWritten: 32,
    backupPath: 'out.txt.bak',
  }),
  mergeTextFiles: vi.fn().mockResolvedValue({
    leftPath: 'left.txt',
    rightPath: 'right.txt',
    centerPath: 'base.txt',
    outputPath: 'out.txt',
    leftText: 'export const mode = "fast"\ntimeout = 45\nretry = true',
    rightText: 'export const mode = "fast"\ntimeout = 60\nretry = true',
    centerText: 'export const mode = "fast"\ntimeout = 30\nretry = true',
    outputText: 'export const mode = "fast"\ntimeout = 30\nretry = true',
    conflicts: [
      {
        lineIndex: 1,
        title: 'Line 2',
        base: 'timeout = 30',
        left: 'timeout = 45',
        right: 'timeout = 60',
      },
    ],
  }),
}))

describe('TextMergeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(saveTextFile).mockClear()
    vi.mocked(mergeTextFiles).mockClear()
  })

  it('starts without hardcoded merge conflicts', () => {
    const wrapper = mount(TextMergeView)

    expect(wrapper.find('[data-testid="merge-pane-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
    expect(outputEditorValue(wrapper)).not.toContain('timeout = 45')
  })

  it('loads a real three-way merge from launch paths', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'merge-launch',
      source: 'command',
      sessionType: 'text-merge',
      title: 'Merge',
      route: '/merge/text',
      autoRun: true,
      locations: {
        left: { uri: 'left.txt', kind: 'file', readOnly: false },
        right: { uri: 'right.txt', kind: 'file', readOnly: false },
        center: { uri: 'base.txt', kind: 'file', readOnly: false },
        output: { uri: 'out.txt', kind: 'file', readOnly: false },
      },
    })

    const wrapper = mount(TextMergeView)

    await flushPromises()

    expect(mergeTextFiles).toHaveBeenCalledWith({
      leftPath: 'left.txt',
      rightPath: 'right.txt',
      centerPath: 'base.txt',
      outputPath: 'out.txt',
    })
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('1 conflict')
    expect(wrapper.find('[data-testid="merge-conflict-list"]').text()).toContain('Line 2')
    expect(wrapper.find('[data-testid="merge-conflict-markers-chip"]').exists()).toBe(false)
  })

  it('accepts the left side for the current conflict', async () => {
    const wrapper = await mountLoadedMerge()

    await wrapper.find('[data-testid="accept-left-conflict"]').trigger('click')

    expect(outputEditorValue(wrapper)).toContain('timeout = 45')
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
  })

  it('accepts the right side for the current conflict', async () => {
    const wrapper = await mountLoadedMerge()

    await wrapper.find('[data-testid="accept-right-conflict"]').trigger('click')

    expect(outputEditorValue(wrapper)).toContain('timeout = 60')
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
  })

  it('accepts the base side for the current conflict', async () => {
    const wrapper = await mountLoadedMerge()

    await wrapper.find('[data-testid="accept-base-conflict"]').trigger('click')

    expect(outputEditorValue(wrapper)).toContain('timeout = 30')
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
  })

  it('edits the output text and saves it to the configured output path', async () => {
    const wrapper = await mountLoadedMerge()

    await wrapper.find('[data-testid="merge-output-editor"]').setValue('merged output\nsaved')
    await wrapper.find('[data-testid="save-merge-output"]').trigger('click')

    expect(saveTextFile).toHaveBeenCalledWith({
      path: 'out.txt',
      text: 'merged output\nsaved',
    })
    expect(wrapper.find('[data-testid="merge-save-status"]').text()).toContain('Saved 32 bytes')
  })
})

async function mountLoadedMerge(): Promise<VueWrapper> {
  const wrapper = mount(TextMergeView)

  await wrapper.find('[data-testid="merge-left-path"]').setValue('left.txt')
  await wrapper.find('[data-testid="merge-right-path"]').setValue('right.txt')
  await wrapper.find('[data-testid="merge-center-path"]').setValue('base.txt')
  await wrapper.find('[data-testid="merge-output-path"]').setValue('out.txt')
  await wrapper.find('[data-testid="load-text-merge"]').trigger('click')
  await flushPromises()

  return wrapper
}

function outputEditorValue(wrapper: ReturnType<typeof mount>): string {
  return (wrapper.find('[data-testid="merge-output-editor"]').element as HTMLTextAreaElement).value
}

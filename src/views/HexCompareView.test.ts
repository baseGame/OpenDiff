import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HexCompareView from './HexCompareView.vue'
import { compareHexFiles, findHexInFile, saveHexEdits } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

vi.mock('@/api/diff', () => ({
  compareHexFiles: vi.fn().mockResolvedValue({
    left: {
      path: 'C:/bin/left.bin',
      totalLen: 4,
      cells: [
        { offset: 0, byte: 65, hex: '41', ascii: 'A', different: false },
        { offset: 1, byte: 66, hex: '42', ascii: 'B', different: true },
        { offset: 2, byte: 67, hex: '43', ascii: 'C', different: false },
        { offset: 3, byte: 68, hex: '44', ascii: 'D', different: false },
      ],
    },
    right: {
      path: 'C:/bin/right.bin',
      totalLen: 4,
      cells: [
        { offset: 0, byte: 65, hex: '41', ascii: 'A', different: false },
        { offset: 1, byte: 88, hex: '58', ascii: 'X', different: true },
        { offset: 2, byte: 67, hex: '43', ascii: 'C', different: false },
        { offset: 3, byte: 68, hex: '44', ascii: 'D', different: false },
      ],
    },
    diffRanges: [{ offset: 1, leftBytes: [66], rightBytes: [88] }],
    summary: {
      leftBytes: 4,
      rightBytes: 4,
      differentRanges: 1,
    },
  }),
  findHexInFile: vi.fn().mockResolvedValue([{ offset: 256, length: 2 }]),
  saveHexEdits: vi.fn().mockResolvedValue({ bytesWritten: 1 }),
}))

async function runCompare(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.find('[data-testid="hex-left-path"]').setValue('C:/bin/left.bin')
  await wrapper.find('[data-testid="hex-right-path"]').setValue('C:/bin/right.bin')
  await wrapper.find('[data-testid="run-hex-compare"]').trigger('click')
  await wrapper.vm.$nextTick()
}

describe('HexCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(compareHexFiles).mockClear()
    vi.mocked(findHexInFile).mockClear()
    vi.mocked(saveHexEdits).mockClear()
  })

  it('starts empty without a demo hex dump', () => {
    const wrapper = mount(HexCompareView)

    expect(wrapper.findAll('[data-testid="hex-row"]')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('ABCD')
    expect((wrapper.find('[data-testid="hex-left-path"]').element as HTMLInputElement).value).toBe(
      '',
    )
  })

  it('runs a hex comparison request and renders returned byte windows', async () => {
    const wrapper = mount(HexCompareView)
    await runCompare(wrapper)

    expect(compareHexFiles).toHaveBeenCalledWith({
      leftPath: 'C:/bin/left.bin',
      rightPath: 'C:/bin/right.bin',
      offset: 0,
      length: 256,
    })
    expect(wrapper.find('[data-testid="left-hex-byte-diff-00000001"]').text()).toBe('42')
    expect(wrapper.find('[data-testid="right-hex-byte-diff-00000001"]').text()).toBe('58')
  })

  it('pages and jumps through chunked offsets', async () => {
    const wrapper = mount(HexCompareView)
    await runCompare(wrapper)
    await wrapper.find('[data-testid="hex-next-page"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(compareHexFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 256, length: 256 }),
    )

    await wrapper.find('[data-testid="hex-jump-offset"]').setValue(512)
    await wrapper.find('[data-testid="hex-jump"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(compareHexFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 512, length: 256 }),
    )
  })

  it('finds bytes and saves queued edits', async () => {
    const wrapper = mount(HexCompareView)
    await runCompare(wrapper)
    await wrapper.find('[data-testid="hex-find-query"]').setValue('4142')
    await wrapper.find('[data-testid="hex-find"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(findHexInFile).toHaveBeenCalledWith({
      path: 'C:/bin/left.bin',
      queryKind: 'hex',
      query: '4142',
    })
    expect(wrapper.find('[data-testid="hex-find-status"]').text()).toContain('1')

    await wrapper.find('[data-testid="hex-edit-offset"]').setValue(1)
    await wrapper.find('[data-testid="hex-edit-value"]').setValue('58')
    await wrapper.find('[data-testid="hex-add-edit"]').trigger('click')
    await wrapper.find('[data-testid="hex-save"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(saveHexEdits).toHaveBeenCalledWith({
      path: 'C:/bin/left.bin',
      edits: [{ offset: 1, value: 88 }],
    })
  })

  it('runs automatically from dropped hex file launch paths', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-hex',
      source: 'drop',
      sessionType: 'hex-compare',
      title: 'left.bin vs right.bin',
      route: '/compare/hex',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.bin', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.bin', kind: 'file', readOnly: false },
      },
    })

    mount(HexCompareView)
    await Promise.resolve()

    expect(compareHexFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        leftPath: 'C:/drop/left.bin',
        rightPath: 'C:/drop/right.bin',
      }),
    )
  })

  it('renders offset, hex and ascii panes after a real compare', async () => {
    const wrapper = mount(HexCompareView)
    await runCompare(wrapper)

    expect(wrapper.find('[data-testid="hex-offset-pane"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="hex-byte-pane"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="hex-ascii-pane"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="hex-row"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="hex-byte-pane"]').text()).toContain('41424344')
  })

  it('keeps left and right hex viewports synchronized', async () => {
    const wrapper = mount(HexCompareView, {
      attachTo: document.body,
    })
    await runCompare(wrapper)
    const leftViewport = wrapper.find<HTMLElement>('[data-testid="left-hex-viewport"]')
    const rightViewport = wrapper.find<HTMLElement>('[data-testid="right-hex-viewport"]')

    leftViewport.element.scrollTop = 48
    await leftViewport.trigger('scroll')

    expect(rightViewport.element.scrollTop).toBe(48)

    wrapper.unmount()
  })

  it('shows only rows containing byte differences when diff-only mode is enabled', async () => {
    const wrapper = mount(HexCompareView)
    await runCompare(wrapper)

    await wrapper.find('[data-testid="hex-diff-only-toggle"]').setValue(true)

    expect(wrapper.findAll('[data-testid="hex-row"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="left-hex-byte-diff-00000001"]').text()).toBe('42')
  })
})

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaCompareView from './MediaCompareView.vue'
import { compareMediaFiles } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useTabsStore } from '@/stores/tabs'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/diff', () => ({
  compareMediaFiles: vi.fn().mockResolvedValue({
    left: {
      name: 'fixture-left.mp3',
      container: 'MP3',
      duration: '00:00.000',
      stream: {
        codec: 'MP3',
        sampleRate: 'Unknown',
        channels: 'Unknown',
        bitrate: 'Unknown',
      },
    },
    right: {
      name: 'fixture-right.mp3',
      container: 'MP3',
      duration: '00:00.000',
      stream: {
        codec: 'MP3',
        sampleRate: 'Unknown',
        channels: 'Unknown',
        bitrate: 'Unknown',
      },
    },
    fields: [
      {
        field: 'Title',
        left: 'Left Song',
        right: 'Right Song',
        status: 'modified',
      },
      {
        field: 'Artist',
        left: 'Aster',
        right: 'Aster',
        status: 'unchanged',
      },
    ],
    summary: {
      added: 0,
      removed: 0,
      modified: 1,
      unchanged: 1,
    },
  }),
}))

describe('MediaCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(compareMediaFiles).mockClear()
  })

  it('runs a real media comparison request and renders returned metadata', async () => {
    const wrapper = mount(MediaCompareView)

    await wrapper.find('[data-testid="media-left-path"]').setValue('C:/music/fixture-left.mp3')
    await wrapper.find('[data-testid="media-right-path"]').setValue('C:/music/fixture-right.mp3')
    await wrapper.find('[data-testid="run-media-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(compareMediaFiles).toHaveBeenCalledWith({
      leftPath: 'C:/music/fixture-left.mp3',
      rightPath: 'C:/music/fixture-right.mp3',
    })
    expect(wrapper.text()).toContain('fixture-left.mp3')
    expect(wrapper.text()).toContain('fixture-right.mp3')
    expect(wrapper.find('[data-testid="media-summary-modified"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="media-field-Title"]').text()).toContain('Left Song')
    expect(wrapper.find('[data-testid="media-field-Title"]').text()).toContain('Right Song')
  })

  it('runs automatically from dropped media launch paths', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-media',
      source: 'drop',
      sessionType: 'media-compare',
      title: 'left.mp3 vs right.mp3',
      route: '/compare/media',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.mp3', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.mp3', kind: 'file', readOnly: false },
      },
    })

    mount(MediaCompareView)
    await Promise.resolve()

    expect(compareMediaFiles).toHaveBeenCalledWith({
      leftPath: 'C:/drop/left.mp3',
      rightPath: 'C:/drop/right.mp3',
    })
  })

  it('starts empty without demo media tags', () => {
    const wrapper = mount(MediaCompareView)

    expect(wrapper.text()).toContain('Media Compare')
    expect(wrapper.text()).not.toContain('left-track.flac')
    expect(wrapper.text()).not.toContain('Northern Lights')
    expect(wrapper.find('[data-testid="media-summary-modified"]').text()).toContain('0')
  })

  it('renders dual HTML5 media elements for local paths', async () => {
    const wrapper = mount(MediaCompareView)

    await wrapper.find('[data-testid="media-left-path"]').setValue('C:/music/fixture-left.mp3')
    await wrapper.find('[data-testid="media-right-path"]').setValue('C:/music/fixture-right.mp3')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="media-playback-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-left-audio"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-right-audio"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-scrub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-play-toggle"]').exists()).toBe(true)
  })

  it('sets path-pair tab titles for media sessions', async () => {
    const wrapper = mount(MediaCompareView)
    const tabs = useTabsStore()

    tabs.openTab({
      title: 'Media Compare',
      titleKey: 'ui.mediaCompare',
      route: '/compare/media',
      dirty: false,
    })

    await wrapper.find('[data-testid="media-left-path"]').setValue('C:/music/fixture-left.mp3')
    await wrapper.find('[data-testid="media-right-path"]').setValue('C:/music/fixture-right.mp3')
    await wrapper.vm.$nextTick()

    expect(tabs.activeTab.title).toBe('fixture-left.mp3 <--> fixture-right.mp3')
  })
})

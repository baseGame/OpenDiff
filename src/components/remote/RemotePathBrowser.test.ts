import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RemotePathBrowser from './RemotePathBrowser.vue'
import type * as remoteApi from '@/api/remote'
import { listRemotePath } from '@/api/remote'

vi.mock('@/api/remote', async (importOriginal) => {
  const actual = await importOriginal<typeof remoteApi>()

  return {
    ...actual,
    listRemotePath: vi.fn(),
  }
})

describe('RemotePathBrowser', () => {
  beforeEach(() => {
    vi.mocked(listRemotePath).mockReset()
    vi.mocked(listRemotePath).mockResolvedValue([
      { path: '/apps', kind: 'directory', size: 0 },
      { path: '/readme.txt', kind: 'file', size: 12 },
    ])
  })

  it('lists remote entries and emits the current folder path', async () => {
    const wrapper = mount(RemotePathBrowser, {
      props: {
        profileId: 'stage-sftp',
        profileLabel: 'Stage SFTP',
        initialPath: '/',
      },
    })

    await flushPromises()

    expect(listRemotePath).toHaveBeenCalledWith('stage-sftp', '/')
    expect(wrapper.find('[data-testid="remote-browse-entry-list"]').text()).toContain('apps')
    expect(wrapper.find('[data-testid="remote-browse-entry-list"]').text()).toContain('readme.txt')

    await wrapper.find('[data-testid="remote-browse-entry-directory"]').trigger('click')
    await flushPromises()

    expect(listRemotePath).toHaveBeenCalledWith('stage-sftp', '/apps')

    await wrapper.find('[data-testid="remote-browse-use-path"]').trigger('click')

    expect(wrapper.emitted('select')?.at(-1)).toEqual(['/apps'])
  })

  it('surfaces list failures without exposing secrets', async () => {
    vi.mocked(listRemotePath).mockRejectedValue(new Error('Backend("permission denied")'))

    const wrapper = mount(RemotePathBrowser, {
      props: {
        profileId: 'stage-sftp',
        initialPath: '/secret',
      },
    })

    await flushPromises()

    expect(wrapper.find('[data-testid="remote-browse-status"]').text()).toContain(
      'permission denied',
    )
    expect(wrapper.text()).not.toContain('password')
    expect(
      wrapper.find('[data-testid="remote-browse-use-path"]').attributes('disabled'),
    ).toBeDefined()
  })
})

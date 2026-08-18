import { beforeEach, describe, expect, it, vi } from 'vitest'
import { writeGitIntegration, writeSvnIntegration } from './integration'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('wrote config'),
}))

describe('integration api', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear()
  })

  it('writes git and svn integration snippets through Tauri commands', async () => {
    await writeGitIntegration('mergetool', '/usr/bin/open-diff', 'global')
    await writeSvnIntegration('/usr/bin/open-diff', '/tmp/open-diff-svn.sh')

    expect(invoke).toHaveBeenCalledWith('write_git_integration', {
      kind: 'mergetool',
      executablePath: '/usr/bin/open-diff',
      scope: 'global',
    })
    expect(invoke).toHaveBeenCalledWith('write_svn_integration', {
      executablePath: '/usr/bin/open-diff',
      wrapperPath: '/tmp/open-diff-svn.sh',
    })
  })
})

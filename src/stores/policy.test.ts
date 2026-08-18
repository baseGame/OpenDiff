import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePolicyStore } from './policy'

describe('usePolicyStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('defaults to allowing remotes and passwords before policy loads', () => {
    const store = usePolicyStore()

    expect(store.savePasswords).toBe(true)
    expect(store.remoteProfiles).toBe(true)
    expect(store.updateChecks).toBe(true)
    expect(store.isWindows).toBe(false)
  })

  it('applies administrator policy flags', () => {
    const store = usePolicyStore()

    store.apply({
      savePasswords: false,
      remoteProfiles: false,
      updateChecks: true,
    })

    expect(store.savePasswords).toBe(false)
    expect(store.remoteProfiles).toBe(false)
    expect(store.updateChecks).toBe(true)
    expect(store.loaded).toBe(true)
  })
})

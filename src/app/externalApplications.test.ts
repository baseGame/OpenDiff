import { describe, expect, it } from 'vitest'
import {
  defaultExternalApplications,
  externalApplicationsStorageKey,
  loadExternalApplications,
  saveExternalApplications,
} from './externalApplications'

describe('externalApplications', () => {
  it('loads defaults and persists enabled applications', () => {
    const storage = {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null
      },
      setItem(key: string, value: string) {
        this.store[key] = value
      },
    }

    expect(loadExternalApplications(storage)).toEqual(defaultExternalApplications())

    const next = [
      {
        id: 'notepad',
        name: 'Notepad',
        executable: 'notepad',
        enabled: false,
      },
    ]

    saveExternalApplications(next, storage)
    expect(storage.store[externalApplicationsStorageKey]).toContain('notepad')
    expect(loadExternalApplications(storage)).toEqual(next)
  })
})

import type { ExternalApplicationConfig } from '@/app/fileOpenActions'

export const externalApplicationsStorageKey = 'open-diff-external-applications'

export function defaultExternalApplications(): ExternalApplicationConfig[] {
  return [
    {
      id: 'vscode',
      name: 'Visual Studio Code',
      executable: 'code',
      enabled: true,
    },
    {
      id: 'text-patch',
      name: 'Text Patch',
      executable: 'open-diff-text-patch',
      enabled: true,
    },
  ]
}

export function loadExternalApplications(
  storage: Pick<Storage, 'getItem'> = localStorage,
): ExternalApplicationConfig[] {
  try {
    const raw = storage.getItem(externalApplicationsStorageKey)

    if (!raw) {
      return defaultExternalApplications()
    }

    const parsed = JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) {
      return defaultExternalApplications()
    }

    const applications = parsed
      .map((item) => normalizeApplication(item))
      .filter((item): item is ExternalApplicationConfig => item !== null)

    return applications.length > 0 ? applications : defaultExternalApplications()
  } catch {
    return defaultExternalApplications()
  }
}

export function saveExternalApplications(
  applications: ExternalApplicationConfig[],
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    externalApplicationsStorageKey,
    JSON.stringify(applications.map((item) => normalizeApplication(item)).filter(Boolean)),
  )
}

function normalizeApplication(value: unknown): ExternalApplicationConfig | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Partial<ExternalApplicationConfig>
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  const executable = typeof record.executable === 'string' ? record.executable.trim() : ''

  if (!id || !name || !executable) {
    return null
  }

  return {
    id,
    name,
    executable,
    enabled: record.enabled !== false,
  }
}

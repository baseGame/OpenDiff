export const versionCompareOptionsStorageKey = 'open-diff-version-compare-options'

/** Default fields treated as unimportant (minor) when comparing version resources. */
export const defaultUnimportantVersionFields = [
  'Comments',
  'LegalCopyright',
  'LegalTrademarks',
  'PrivateBuild',
  'SpecialBuild',
  'InternalName',
] as const

export interface VersionCompareOptionsState {
  unimportantFields: string[]
}

export function defaultVersionCompareOptions(): VersionCompareOptionsState {
  return {
    unimportantFields: [...defaultUnimportantVersionFields],
  }
}

function normalizeFieldList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...defaultUnimportantVersionFields]
  }

  const fields = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return [...new Set(fields)]
}

export function loadVersionCompareOptions(
  storage: Pick<Storage, 'getItem'> = localStorage,
): VersionCompareOptionsState {
  try {
    const raw = storage.getItem(versionCompareOptionsStorageKey)

    if (!raw) {
      return defaultVersionCompareOptions()
    }

    const parsed = JSON.parse(raw) as Partial<VersionCompareOptionsState>

    return {
      unimportantFields: normalizeFieldList(parsed.unimportantFields),
    }
  } catch {
    return defaultVersionCompareOptions()
  }
}

export function saveVersionCompareOptions(
  state: VersionCompareOptionsState,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    versionCompareOptionsStorageKey,
    JSON.stringify({
      unimportantFields: normalizeFieldList(state.unimportantFields),
    }),
  )
}

export function isVersionFieldImportant(
  field: string,
  options: Pick<VersionCompareOptionsState, 'unimportantFields'>,
): boolean {
  const normalized = field.trim().toLowerCase()

  return !options.unimportantFields.some((entry) => entry.trim().toLowerCase() === normalized)
}

export function toggleVersionFieldImportance(
  field: string,
  options: VersionCompareOptionsState,
): VersionCompareOptionsState {
  const important = isVersionFieldImportant(field, options)

  if (important) {
    return {
      unimportantFields: [...options.unimportantFields, field],
    }
  }

  return {
    unimportantFields: options.unimportantFields.filter(
      (entry) => entry.trim().toLowerCase() !== field.trim().toLowerCase(),
    ),
  }
}

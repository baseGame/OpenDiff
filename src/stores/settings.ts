import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  commandRegistry,
  type AppCommand,
  type CommandId,
  type CommandShortcut,
  type ShortcutScope,
} from '@/app/commandRegistry'
import { fallbackLocale, isSupportedLocale, type SupportedLocale } from '@/i18n/core'

export type ThemeMode = 'light' | 'dark' | 'system'

const sharedSessionPathsStorageKey = 'open-diff-shared-session-paths'
const localeStorageKey = 'open-diff-locale'
const shortcutOverridesStorageKey = 'open-diff-shortcut-overrides'
const autoSaveLimitStorageKey = 'open-diff-auto-save-limit'
const shortcutScopes = new Set<ShortcutScope>(['global', 'text-compare'])
const commandIds = new Set<string>(commandRegistry.map((command) => command.id))

type ShortcutOverrides = Partial<Record<CommandId, CommandShortcut>>

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>(loadTheme())
  const systemPrefersDark = ref(prefersDarkTheme())
  const resolvedTheme = computed(() => {
    if (theme.value === 'system') {
      return systemPrefersDark.value ? 'dark' : 'light'
    }

    return theme.value
  })
  const locale = ref<SupportedLocale>(loadLocale())
  const sharedSessionPaths = ref<string[]>(loadSharedSessionPaths())
  const shortcutOverrides = ref<ShortcutOverrides>(loadShortcutOverrides())
  const autoSaveLimit = ref(loadAutoSaveLimit())

  bindSystemThemeListener((prefersDark) => {
    systemPrefersDark.value = prefersDark
  })

  watch(
    [theme, resolvedTheme],
    ([nextTheme, nextResolved]) => {
      localStorage.setItem('open-diff-theme', nextTheme)
      document.documentElement.dataset.theme = nextResolved
    },
    { immediate: true },
  )

  watch(
    sharedSessionPaths,
    (value) => {
      localStorage.setItem(sharedSessionPathsStorageKey, JSON.stringify(value))
    },
    { deep: true, flush: 'sync' },
  )

  watch(
    locale,
    (value) => {
      localStorage.setItem(localeStorageKey, value)
      document.documentElement.lang = value
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    shortcutOverrides,
    (value) => {
      localStorage.setItem(shortcutOverridesStorageKey, JSON.stringify(value))
    },
    { deep: true, immediate: true, flush: 'sync' },
  )

  watch(
    autoSaveLimit,
    (value) => {
      localStorage.setItem(autoSaveLimitStorageKey, String(value))
    },
    { immediate: true, flush: 'sync' },
  )

  function toggleTheme(): void {
    theme.value = resolvedTheme.value === 'dark' ? 'light' : 'dark'
  }

  function setTheme(nextTheme: ThemeMode): void {
    theme.value = nextTheme
  }

  function addSharedSessionPath(path: string): boolean {
    const normalized = path.trim()

    if (!normalized || sharedSessionPaths.value.includes(normalized)) {
      return false
    }

    sharedSessionPaths.value = [...sharedSessionPaths.value, normalized]

    return true
  }

  function removeSharedSessionPath(path: string): boolean {
    if (!sharedSessionPaths.value.includes(path)) {
      return false
    }

    sharedSessionPaths.value = sharedSessionPaths.value.filter((item) => item !== path)

    return true
  }

  function setLocale(nextLocale: string): boolean {
    if (!isSupportedLocale(nextLocale)) {
      return false
    }

    locale.value = nextLocale

    return true
  }

  function setShortcutOverride(
    commandId: string,
    shortcut: { keys: string[]; scope: string },
  ): boolean {
    if (!isCommandId(commandId) || !isShortcutScope(shortcut.scope)) {
      return false
    }

    const normalizedKeys = shortcut.keys.map((key) => key.trim())

    if (normalizedKeys.length === 0 || normalizedKeys.some((key) => key === '')) {
      return false
    }

    shortcutOverrides.value = {
      ...shortcutOverrides.value,
      [commandId]: {
        keys: normalizedKeys,
        scope: shortcut.scope,
      },
    }

    return true
  }

  function resetShortcutOverride(commandId: string): boolean {
    if (!isCommandId(commandId) || shortcutOverrides.value[commandId] === undefined) {
      return false
    }

    const { [commandId]: _removed, ...remainingOverrides } = shortcutOverrides.value

    shortcutOverrides.value = remainingOverrides

    return true
  }

  function getEffectiveShortcut(command: AppCommand): CommandShortcut {
    return shortcutOverrides.value[command.id] ?? command.defaultShortcut
  }

  function setAutoSaveLimit(value: number): void {
    autoSaveLimit.value = Math.max(0, Math.min(50, Math.floor(value)))
  }

  return {
    theme,
    resolvedTheme,
    locale,
    sharedSessionPaths,
    shortcutOverrides,
    autoSaveLimit,
    toggleTheme,
    setTheme,
    setLocale,
    addSharedSessionPath,
    removeSharedSessionPath,
    setShortcutOverride,
    resetShortcutOverride,
    getEffectiveShortcut,
    setAutoSaveLimit,
  }
})

function loadTheme(): ThemeMode {
  const stored = localStorage.getItem('open-diff-theme')

  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }

  return 'light'
}

function prefersDarkTheme(): boolean {
  if (typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function bindSystemThemeListener(onChange: (prefersDark: boolean) => void): void {
  if (typeof window.matchMedia !== 'function') {
    return
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = (event: MediaQueryListEvent): void => {
    onChange(event.matches)
  }

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', listener)
  }
}

function loadLocale(): SupportedLocale {
  const storedLocale = localStorage.getItem(localeStorageKey)

  if (!storedLocale || !isSupportedLocale(storedLocale)) {
    return fallbackLocale
  }

  return storedLocale
}

function loadSharedSessionPaths(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(sharedSessionPathsStorageKey) ?? '[]') as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  } catch {
    return []
  }
}

function loadShortcutOverrides(): ShortcutOverrides {
  try {
    const parsed = JSON.parse(localStorage.getItem(shortcutOverridesStorageKey) ?? '{}') as unknown

    if (!isPlainRecord(parsed)) {
      return {}
    }

    return Object.entries(parsed).reduce<ShortcutOverrides>((overrides, [commandId, shortcut]) => {
      if (!isCommandId(commandId) || !isShortcutLike(shortcut)) {
        return overrides
      }

      overrides[commandId] = shortcut

      return overrides
    }, {})
  } catch {
    return {}
  }
}

function loadAutoSaveLimit(): number {
  const rawValue = localStorage.getItem(autoSaveLimitStorageKey)

  if (rawValue === null) {
    return 10
  }

  const stored = Number(rawValue)

  if (!Number.isFinite(stored)) {
    return 10
  }

  return Math.max(0, Math.min(50, Math.floor(stored)))
}

function isCommandId(value: string): value is CommandId {
  return commandIds.has(value)
}

function isShortcutScope(value: string): value is ShortcutScope {
  return shortcutScopes.has(value as ShortcutScope)
}

function isShortcutLike(value: unknown): value is CommandShortcut {
  if (
    !isPlainRecord(value) ||
    !Array.isArray(value.keys) ||
    !isShortcutScope(String(value.scope))
  ) {
    return false
  }

  const keys = value.keys

  return keys.length > 0 && keys.every((key) => typeof key === 'string' && key.trim() !== '')
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

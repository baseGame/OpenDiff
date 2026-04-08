import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings, ThemeMode } from '@/types'
import { getSettings, saveSettings } from '@/api'
import { setLocale, type LocaleCode } from '@/i18n'

const DEFAULT: AppSettings = {
  theme: 'auto',
  font_family: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
  font_size: 13,
  diff_algorithm: 'histogram',
  show_line_numbers: true,
  show_whitespace: false,
  word_wrap: false,
  auto_save_sessions: true,
  language: 'en',
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT })
  const loaded = ref(false)

  async function load() {
    try {
      const loadedSettings = await getSettings()
      // Merge with defaults to fill missing fields (e.g. language)
      settings.value = { ...DEFAULT, ...(loadedSettings ?? {}) }
    } catch {
      settings.value = { ...DEFAULT }
    }
    loaded.value = true
    applyAll(settings.value)
  }

  async function save() {
    await saveSettings(settings.value)
    applyAll(settings.value)
  }

  function applyAll(s: AppSettings) {
    applyTheme(s.theme)
    setLocale(s.language as LocaleCode)
    document.documentElement.style.setProperty('--font-mono', s.font_family)
    document.documentElement.style.setProperty('--editor-font-size', `${s.font_size}px`)
  }

  function applyTheme(theme: ThemeMode) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = theme === 'dark' || (theme === 'auto' && prefersDark)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }

  function resetDefaults() {
    settings.value = { ...DEFAULT }
  }

  return { settings, loaded, load, save, resetDefaults }
})

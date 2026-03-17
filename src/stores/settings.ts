import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { AppSettings, ThemeMode } from '@/types'
import { getSettings, saveSettings } from '@/api'

const DEFAULT: AppSettings = {
  theme: 'auto',
  font_family: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
  font_size: 13,
  diff_algorithm: 'histogram',
  show_line_numbers: true,
  show_whitespace: false,
  word_wrap: false,
  auto_save_sessions: true,
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT })
  const loaded = ref(false)

  async function load() {
    try {
      settings.value = await getSettings()
    } catch {
      settings.value = { ...DEFAULT }
    }
    loaded.value = true
    applyTheme(settings.value.theme)
  }

  async function save() {
    await saveSettings(settings.value)
    applyTheme(settings.value.theme)
  }

  function applyTheme(theme: ThemeMode) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = theme === 'dark' || (theme === 'auto' && prefersDark)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    document.documentElement.style.setProperty('--font-mono', settings.value.font_family)
    document.documentElement.style.setProperty('--editor-font-size', `${settings.value.font_size}px`)
  }

  return { settings, loaded, load, save }
})

/**
 * i18n — OpenDiff internationalization
 *
 * Architecture:
 *   All user-facing text lives in locale files (en.ts, zh.ts, ...).
 *   Components use the `useI18n()` composable to get translated text.
 *   Locale preference is stored in localStorage and loaded at startup.
 *
 * Adding a new language:
 *   1. Create src/i18n/{lang}.ts with the full translation map
 *   2. Add it to LOCALES in this file
 *   3. Use the language code in Settings (no code change needed elsewhere)
 */
import { createI18n } from 'vue-i18n'
import en from './en'
import zh from './zh'

export const LOCALES = [
  { code: 'en', label: 'English', labelNative: 'English' },
  { code: 'zh', label: 'Chinese', labelNative: '中文' },
  // Future locales — add here:
  // { code: 'ja', label: 'Japanese', labelNative: '日本語' },
  // { code: 'ko', label: 'Korean', labelNative: '한국어' },
  // { code: 'de', label: 'German', labelNative: 'Deutsch' },
  // { code: 'fr', label: 'French', labelNative: 'Français' },
  // { code: 'es', label: 'Spanish', labelNative: 'Español' },
  // { code: 'ru', label: 'Russian', labelNative: 'Русский' },
  // { code: 'pt', label: 'Portuguese', labelNative: 'Português' },
] as const

export type LocaleCode = typeof LOCALES[number]['code']

const STORAGE_KEY = 'opendiff_locale'

function detectLocale(): LocaleCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LOCALES.some(l => l.code === saved)) return saved as LocaleCode
  } catch {}
  const browser = navigator.language.split('-')[0]
  if (LOCALES.some(l => l.code === browser)) return browser as LocaleCode
  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { en, zh },
})

export function setLocale(code: LocaleCode) {
  i18n.global.locale.value = code
  try { localStorage.setItem(STORAGE_KEY, code) } catch {}
  // Apply theme direction for RTL languages in future
}

export const currentLocale = i18n.global.locale

// Re-export for convenience
export const { t, locale } = i18n.global

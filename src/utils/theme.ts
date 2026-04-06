/**
 * Theme utilities — smooth transitions + system preference listener
 */
import { ref } from 'vue'

export type ThemeMode = 'auto' | 'dark' | 'light'

export function useTheme() {
  const current = ref(document.documentElement.getAttribute('data-theme') || 'dark')

  // Listen for system preference changes
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', (e) => {
    // Only auto-update if user is in 'auto' mode
    const stored = localStorage.getItem('opendiff_theme')
    if (stored === 'auto' || !stored) {
      applyTheme('auto')
    }
  })

  export function applyTheme(mode: ThemeMode) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = mode === 'dark' || (mode === 'auto' && prefersDark)
    const theme = isDark ? 'dark' : 'light'

    // Smooth transition: add class first, then update CSS var
    document.documentElement.classList.add('theme-transitioning')
    requestAnimationFrame(() => {
      document.documentElement.setAttribute('data-theme', theme)
      current.value = theme
      localStorage.setItem('opendiff_theme', mode)
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning')
      }, 200)
    })
  }

  return { current, applyTheme }
}

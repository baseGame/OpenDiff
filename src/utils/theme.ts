/**
 * Theme utilities — smooth transitions + system preference listener
 */
export type ThemeMode = 'auto' | 'dark' | 'light'

export function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = mode === 'dark' || (mode === 'auto' && prefersDark)
  const theme = isDark ? 'dark' : 'light'

  // Smooth transition: add class first, then update attribute
  document.documentElement.classList.add('theme-transitioning')
  requestAnimationFrame(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('opendiff_theme', mode)
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning')
    }, 220)
  })
}

export function getStoredTheme(): ThemeMode {
  return (localStorage.getItem('opendiff_theme') as ThemeMode) || 'auto'
}

// Listen for system preference changes — auto-update when in 'auto' mode
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getStoredTheme() === 'auto') {
    applyTheme('auto')
  }
})

// Thème clair / sombre. Sombre par défaut, persisté dans localStorage.
export type Theme = 'light' | 'dark'
const KEY = 'patrimoine-theme'

export function getTheme(): Theme {
  const saved = localStorage.getItem(KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark' // défaut : mode sombre
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(KEY, theme)
  applyTheme(theme)
}

export function initTheme(): void {
  applyTheme(getTheme())
}

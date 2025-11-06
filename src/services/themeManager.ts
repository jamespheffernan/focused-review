export interface Theme {
  name: string
  key: string
  description: string
}

export const THEMES: Record<string, Theme> = {
  light: {
    name: 'Light',
    key: 'light',
    description: 'Clean, bright interface for daytime use'
  },
  dark: {
    name: 'Dark',
    key: 'dark',
    description: 'Easy on the eyes for nighttime use'
  },
  auto: {
    name: 'Auto',
    key: 'auto',
    description: 'Follows your system preferences'
  }
}

const STORAGE_KEY = 'theme-preference'

export class ThemeManager {
  getCurrentTheme(): string {
    return localStorage.getItem(STORAGE_KEY) || 'auto'
  }

  setTheme(themeKey: string) {
    localStorage.setItem(STORAGE_KEY, themeKey)
    this.applyTheme(themeKey)
  }

  private applyTheme(themeKey: string) {
    if (themeKey === 'auto') {
      // Match system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
    } else {
      document.documentElement.setAttribute('data-theme', themeKey)
    }
  }

  initializeTheme() {
    const savedTheme = this.getCurrentTheme()
    this.applyTheme(savedTheme)

    // Listen for system theme changes when in auto mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (this.getCurrentTheme() === 'auto') {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
      }
    })
  }
}

export const themeManager = new ThemeManager()

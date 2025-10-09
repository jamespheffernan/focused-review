export interface Theme {
  name: string
  gradient: string
  accent: string
}

export const THEMES: Record<string, Theme> = {
  ocean: {
    name: 'Ocean',
    gradient: 'linear-gradient(135deg, #00ff88 0%, #00d4aa 50%, #0099cc 100%)',
    accent: '#00d4aa'
  },
  sunset: {
    name: 'Sunset',
    gradient: 'linear-gradient(135deg, #ff6b9d 0%, #ff8a65 50%, #ffd54f 100%)',
    accent: '#ff6b9d'
  },
  forest: {
    name: 'Forest',
    gradient: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 50%, #cddc39 100%)',
    accent: '#4caf50'
  },
  twilight: {
    name: 'Twilight',
    gradient: 'linear-gradient(135deg, #9c27b0 0%, #673ab7 50%, #3f51b5 100%)',
    accent: '#9c27b0'
  },
  ember: {
    name: 'Ember',
    gradient: 'linear-gradient(135deg, #ff5722 0%, #ff9800 50%, #ffc107 100%)',
    accent: '#ff5722'
  }
}

const STORAGE_KEY = 'blinders-theme'
const DEFAULT_THEME = 'ocean'

export class ThemeManager {
  getCurrentTheme(): string {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME
  }

  setTheme(themeKey: string) {
    if (!THEMES[themeKey]) {
      console.warn(`Theme "${themeKey}" not found, using default`)
      themeKey = DEFAULT_THEME
    }

    const theme = THEMES[themeKey]
    localStorage.setItem(STORAGE_KEY, themeKey)
    
    // Apply to CSS custom properties
    document.documentElement.style.setProperty('--gradient', theme.gradient)
    document.documentElement.style.setProperty('--accent', theme.accent)
  }

  initializeTheme() {
    const currentTheme = this.getCurrentTheme()
    this.setTheme(currentTheme)
  }
}

export const themeManager = new ThemeManager()

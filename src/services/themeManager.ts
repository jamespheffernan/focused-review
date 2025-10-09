export interface Theme {
  name: string
  gradient: string
  accent: string
  primary: string
  primaryHover: string
  secondary: string
  secondaryHover: string
  success: string
  successHover: string
  warning: string
  warningHover: string
  danger: string
  dangerHover: string
}

export const THEMES: Record<string, Theme> = {
  ocean: {
    name: 'Ocean',
    gradient: 'linear-gradient(135deg, #00ff88 0%, #00d4aa 50%, #0099cc 100%)',
    accent: '#00d4aa',
    primary: '#00d4aa',
    primaryHover: '#00e6bb',
    secondary: '#0099cc',
    secondaryHover: '#00aae6',
    success: '#00ff88',
    successHover: '#33ff9f',
    warning: '#ffc107',
    warningHover: '#ffcd38',
    danger: '#ff6b6b',
    dangerHover: '#ff8787'
  },
  sunset: {
    name: 'Sunset',
    gradient: 'linear-gradient(135deg, #ff6b9d 0%, #ff8a65 50%, #ffd54f 100%)',
    accent: '#ff6b9d',
    primary: '#ff6b9d',
    primaryHover: '#ff5a8a',
    secondary: '#ff8a65',
    secondaryHover: '#ff9f7f',
    success: '#ffd54f',
    successHover: '#ffdd70',
    warning: '#ff9800',
    warningHover: '#ffad33',
    danger: '#f44336',
    dangerHover: '#f6685e'
  },
  forest: {
    name: 'Forest',
    gradient: 'linear-gradient(135deg, #4caf50 0%, #8bc34a 50%, #cddc39 100%)',
    accent: '#4caf50',
    primary: '#4caf50',
    primaryHover: '#66bb6a',
    secondary: '#8bc34a',
    secondaryHover: '#a0cf67',
    success: '#66bb6a',
    successHover: '#81c784',
    warning: '#cddc39',
    warningHover: '#d7e360',
    danger: '#ff5722',
    dangerHover: '#ff7043'
  },
  twilight: {
    name: 'Twilight',
    gradient: 'linear-gradient(135deg, #9c27b0 0%, #673ab7 50%, #3f51b5 100%)',
    accent: '#9c27b0',
    primary: '#9c27b0',
    primaryHover: '#ab47bc',
    secondary: '#673ab7',
    secondaryHover: '#7e57c2',
    success: '#3f51b5',
    successHover: '#5c6bc0',
    warning: '#ff9800',
    warningHover: '#ffad33',
    danger: '#f44336',
    dangerHover: '#f6685e'
  },
  ember: {
    name: 'Ember',
    gradient: 'linear-gradient(135deg, #ff5722 0%, #ff9800 50%, #ffc107 100%)',
    accent: '#ff5722',
    primary: '#ff5722',
    primaryHover: '#ff7043',
    secondary: '#ff9800',
    secondaryHover: '#ffad33',
    success: '#ffc107',
    successHover: '#ffcd38',
    warning: '#ff6f00',
    warningHover: '#ff8f00',
    danger: '#d84315',
    dangerHover: '#e64a19'
  },
  dos: {
    name: 'DOS',
    gradient: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0d1f0d 100%)',
    accent: '#00ff00',
    primary: '#00ff00',
    primaryHover: '#33ff33',
    secondary: '#00cc00',
    secondaryHover: '#00e600',
    success: '#00ff00',
    successHover: '#33ff33',
    warning: '#ffff00',
    warningHover: '#ffff33',
    danger: '#ff0000',
    dangerHover: '#ff3333'
  },
  solarized: {
    name: 'Solarized Dark',
    gradient: 'linear-gradient(135deg, #002b36 0%, #073642 50%, #0f4a5a 100%)',
    accent: '#268bd2',
    primary: '#268bd2',
    primaryHover: '#3ca0e8',
    secondary: '#2aa198',
    secondaryHover: '#35c9be',
    success: '#859900',
    successHover: '#a6bf26',
    warning: '#b58900',
    warningHover: '#cb9b00',
    danger: '#dc322f',
    dangerHover: '#e35755'
  },
  monochrome: {
    name: 'Monochrome',
    gradient: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #333333 100%)',
    accent: '#ffffff',
    primary: '#ffffff',
    primaryHover: '#e6e6e6',
    secondary: '#cccccc',
    secondaryHover: '#b3b3b3',
    success: '#ffffff',
    successHover: '#e6e6e6',
    warning: '#999999',
    warningHover: '#b3b3b3',
    danger: '#666666',
    dangerHover: '#808080'
  },
  nord: {
    name: 'Nord',
    gradient: 'linear-gradient(135deg, #2e3440 0%, #3b4252 50%, #434c5e 100%)',
    accent: '#88c0d0',
    primary: '#88c0d0',
    primaryHover: '#9fcdda',
    secondary: '#81a1c1',
    secondaryHover: '#96b5d1',
    success: '#a3be8c',
    successHover: '#b5caa0',
    warning: '#ebcb8b',
    warningHover: '#f0d6a0',
    danger: '#bf616a',
    dangerHover: '#cc7c84'
  },
  dracula: {
    name: 'Dracula',
    gradient: 'linear-gradient(135deg, #282a36 0%, #44475a 50%, #6272a4 100%)',
    accent: '#bd93f9',
    primary: '#bd93f9',
    primaryHover: '#caa6fc',
    secondary: '#ff79c6',
    secondaryHover: '#ff92d1',
    success: '#50fa7b',
    successHover: '#6ffb92',
    warning: '#f1fa8c',
    warningHover: '#f4fba3',
    danger: '#ff5555',
    dangerHover: '#ff6e6e'
  },
  cyberpunk: {
    name: 'Cyberpunk',
    gradient: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #2a1a4a 100%)',
    accent: '#00ffff',
    primary: '#00ffff',
    primaryHover: '#33ffff',
    secondary: '#ff00ff',
    secondaryHover: '#ff33ff',
    success: '#00ff00',
    successHover: '#33ff33',
    warning: '#ffff00',
    warningHover: '#ffff33',
    danger: '#ff0080',
    dangerHover: '#ff3399'
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
    
    // Apply all theme properties to CSS custom properties
    document.documentElement.style.setProperty('--gradient', theme.gradient)
    document.documentElement.style.setProperty('--accent', theme.accent)
    document.documentElement.style.setProperty('--primary', theme.primary)
    document.documentElement.style.setProperty('--primary-hover', theme.primaryHover)
    document.documentElement.style.setProperty('--secondary', theme.secondary)
    document.documentElement.style.setProperty('--secondary-hover', theme.secondaryHover)
    document.documentElement.style.setProperty('--success', theme.success)
    document.documentElement.style.setProperty('--success-hover', theme.successHover)
    document.documentElement.style.setProperty('--warning', theme.warning)
    document.documentElement.style.setProperty('--warning-hover', theme.warningHover)
    document.documentElement.style.setProperty('--danger', theme.danger)
    document.documentElement.style.setProperty('--danger-hover', theme.dangerHover)
  }

  initializeTheme() {
    const currentTheme = this.getCurrentTheme()
    this.setTheme(currentTheme)
  }
}

export const themeManager = new ThemeManager()

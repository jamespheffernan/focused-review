import { useState } from 'react'
import { THEMES, themeManager } from '../services/themeManager'
import { Palette, Check, Sun, Moon, Sparkles } from 'lucide-react'

export default function ThemeSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentTheme, setCurrentTheme] = useState(themeManager.getCurrentTheme())

  const handleThemeChange = (themeKey: string) => {
    themeManager.setTheme(themeKey)
    setCurrentTheme(themeKey)
    setIsOpen(false)
  }

  const getThemeIcon = (key: string) => {
    switch(key) {
      case 'light': return <Sun size={24} />
      case 'dark': return <Moon size={24} />
      case 'auto': return <Sparkles size={24} />
      default: return <Palette size={24} />
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(255, 255, 255, var(--glass-opacity-medium))',
          color: 'var(--color-text-inverse)',
          border: '1px solid rgba(255, 255, 255, var(--glass-border-medium))',
          borderRadius: 'var(--radius-small)',
          padding: 'var(--space-2) var(--space-4)',
          cursor: 'pointer',
          fontSize: 'var(--font-size-caption)',
          fontFamily: 'var(--font-body)',
          fontWeight: 'var(--font-weight-medium)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          transition: 'var(--transition-default)',
          minHeight: 'var(--button-height-small)'
        }}
        title="Change theme"
        aria-label="Change theme"
      >
        <Palette size={16} />
        Theme
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 'var(--z-dropdown)'
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Theme Dropdown - Clean and simple */}
          <div style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-2))',
            right: 0,
            background: 'var(--color-surface-overlay)',
            backdropFilter: 'var(--glass-blur-overlay)',
            WebkitBackdropFilter: 'var(--glass-blur-overlay)',
            border: '1px solid rgba(255, 255, 255, var(--glass-border-medium))',
            borderRadius: 'var(--radius-medium)',
            padding: 'var(--space-2)',
            minWidth: '200px',
            boxShadow: 'var(--shadow-medium)',
            zIndex: 'var(--z-overlay)',
            animation: 'fadeIn var(--transition-fast) ease-out'
          }}>
            {Object.entries(THEMES).map(([key, theme]) => (
              <button
                key={key}
                onClick={() => handleThemeChange(key)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: currentTheme === key
                    ? 'rgba(255, 255, 255, var(--glass-opacity-medium))'
                    : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-small)',
                  cursor: 'pointer',
                  transition: 'var(--transition-default)',
                  color: 'var(--color-text-inverse)',
                  fontSize: 'var(--font-size-body)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: currentTheme === key ? 'var(--font-weight-semibold)' : 'var(--font-weight-regular)',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  if (currentTheme !== key) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, var(--glass-opacity-subtle))'
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentTheme !== key) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    opacity: currentTheme === key ? 1 : 0.7
                  }}>
                    {getThemeIcon(key)}
                  </div>
                  <div>
                    <div>{theme.name}</div>
                    <div style={{
                      fontSize: 'var(--font-size-micro)',
                      opacity: 0.7,
                      fontWeight: 'var(--font-weight-regular)'
                    }}>
                      {theme.description}
                    </div>
                  </div>
                </div>
                {currentTheme === key && (
                  <Check size={20} color="var(--color-action)" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

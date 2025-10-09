import { useState } from 'react'
import { THEMES, themeManager } from '../services/themeManager'
import { Palette } from 'lucide-react'

export default function ThemeSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentTheme, setCurrentTheme] = useState(themeManager.getCurrentTheme())

  const handleThemeChange = (themeKey: string) => {
    themeManager.setTheme(themeKey)
    setCurrentTheme(themeKey)
    setIsOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '8px',
          padding: '8px 16px',
          cursor: 'pointer',
          fontSize: '0.9em',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}
        title="Change theme"
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
              zIndex: 999
            }}
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: 'rgba(30, 30, 40, 0.98)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '12px',
            padding: '12px',
            minWidth: '240px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              fontSize: '0.8em',
              opacity: 0.7,
              marginBottom: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Choose Theme
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(THEMES).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => handleThemeChange(key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: currentTheme === key ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                    border: currentTheme === key ? '2px solid rgba(255, 255, 255, 0.4)' : '2px solid transparent',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'left',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => {
                    if (currentTheme !== key) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentTheme !== key) {
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    background: theme.gradient,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    flexShrink: 0
                  }} />
                  <span style={{ fontWeight: 500 }}>{theme.name}</span>
                  {currentTheme === key && (
                    <span style={{ marginLeft: 'auto', fontSize: '1.2em' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

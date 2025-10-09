import { useState } from 'react'
import { THEMES, themeManager } from '../services/themeManager'
import { Palette, Check } from 'lucide-react'

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
          
          {/* Theme Grid Dropdown */}
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: 'rgba(30, 30, 40, 0.98)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            paddingBottom: '24px',
            width: '420px',
            maxWidth: '90vw',
            maxHeight: 'calc(100vh - 180px)',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              fontSize: '0.8em',
              opacity: 0.7,
              marginBottom: '16px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              textAlign: 'center'
            }}>
              Choose Theme
            </div>
            
            {/* Grid layout - 3 columns */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '12px' 
            }}>
              {Object.entries(THEMES).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => handleThemeChange(key)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 8px',
                    background: currentTheme === key ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                    border: currentTheme === key ? '2px solid rgba(255, 255, 255, 0.5)' : '2px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    color: 'white',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (currentTheme !== key) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentTheme !== key) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }
                  }}
                >
                  {/* Gradient preview - larger and more prominent */}
                  <div style={{
                    width: '100%',
                    height: '50px',
                    borderRadius: '6px',
                    background: theme.gradient,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    position: 'relative'
                  }}>
                    {/* Checkmark overlay for selected theme */}
                    {currentTheme === key && (
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Check size={20} color="white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  
                  {/* Theme name */}
                  <span style={{ 
                    fontWeight: currentTheme === key ? 600 : 500,
                    fontSize: '0.85em',
                    textAlign: 'center',
                    lineHeight: 1.2
                  }}>
                    {theme.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

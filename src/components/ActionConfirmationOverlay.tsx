import type { CSSProperties } from 'react'

type OverlayVariant = 'review' | 'dropped' | 'someday'

interface ActionConfirmationOverlayProps {
  visible: boolean
  message: string
  variant?: OverlayVariant
}

export default function ActionConfirmationOverlay({ visible, message, variant = 'review' }: ActionConfirmationOverlayProps) {
  if (!visible) return null

  const accentStyles: Record<OverlayVariant, CSSProperties> = {
    review: {
      background: 'rgba(255, 255, 255, 0.15)',
      border: '2px solid rgba(255, 255, 255, 0.3)'
    },
    dropped: {
      background: 'rgba(255, 87, 34, 0.15)', // deep orange accent
      border: '2px solid rgba(255, 87, 34, 0.35)'
    },
    someday: {
      background: 'rgba(158, 158, 158, 0.15)', // grey accent
      border: '2px solid rgba(158, 158, 158, 0.35)'
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        ...accentStyles[variant],
        backdropFilter: 'blur(30px)',
        borderRadius: '24px',
        padding: '48px 64px',
        textAlign: 'center',
        fontSize: '2em',
        fontWeight: 700,
        color: 'white',
        boxShadow: '0 16px 64px rgba(0, 0, 0, 0.3)',
        animation: 'scaleIn 0.3s ease-out'
      }}>
        {message}
      </div>
    </div>
  )
}



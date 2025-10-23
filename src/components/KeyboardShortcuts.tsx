import { useState } from 'react'

export default function KeyboardShortcuts() {
  const [isVisible, setIsVisible] = useState(false)

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          background: 'rgba(255, 255, 255, 0.1)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          padding: '8px 12px',
          cursor: 'pointer',
          fontSize: '0.8em',
          opacity: 0.7,
          transition: 'opacity 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
      >
        ⌨️ Shortcuts
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        borderRadius: '12px',
        padding: '20px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(10px)',
        maxWidth: '300px',
        zIndex: 1000
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '1.1em' }}>Keyboard Shortcuts</h3>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1.2em',
            padding: '4px'
          }}
        >
          ×
        </button>
      </div>
      
      <div style={{ fontSize: '0.9em', lineHeight: '1.6' }}>
        <div style={{ marginBottom: '8px' }}>
          <strong>← →</strong> Navigate between questions
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>Enter</strong> Go to next question
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>Y / N</strong> Answer yes/no questions
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>1 / 2 / 3</strong> Engagement rating
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>Space</strong> Mark reviewed & next
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>Esc</strong> Skip project
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>Cmd/Ctrl + S</strong> Save answer
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>Cmd/Ctrl + N</strong> Open Notion link
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>Cmd/Ctrl + O</strong> Open in OmniFocus
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>Cmd/Ctrl + [</strong> Previous project
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>Cmd/Ctrl + ]</strong> Next project
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>🎤</strong> Voice input (when available)
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  value: string | null
  onChange: (context: string | null) => void
  disabled?: boolean
}

const CONTEXTS = [
  '@Computer',
  '@Phone',
  '@Errands',
  '@Home',
  '@Office',
  '@Waiting',
  '@Someday',
  '@Agenda'
]

export default function ContextSelector({ value, onChange, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '4px',
          color: value ? 'white' : 'rgba(255, 255, 255, 0.5)',
          padding: '4px 8px',
          fontSize: '12px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          minWidth: '100px',
          opacity: disabled ? 0.5 : 1
        }}
      >
        <span>{value || 'No context'}</span>
        <ChevronDown size={12} />
      </button>
      
      {isOpen && !disabled && (
        <>
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
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: 'rgba(30, 30, 40, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            padding: '4px',
            zIndex: 1000,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            minWidth: '150px'
          }}>
            <button
              onClick={() => {
                onChange(null)
                setIsOpen(false)
              }}
              style={{
                width: '100%',
                padding: '6px 10px',
                background: value === null ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              No context
            </button>
            {CONTEXTS.map(context => (
              <button
                key={context}
                onClick={() => {
                  onChange(context)
                  setIsOpen(false)
                }}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  background: value === context ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                {context}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}


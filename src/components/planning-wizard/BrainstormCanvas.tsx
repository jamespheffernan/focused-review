import { useRef, useEffect, useState } from 'react'
import type { PlanningBrainstormItem } from '../../types'
import BrainstormNode from './BrainstormNode'

interface Props {
  items: PlanningBrainstormItem[]
  isCurrentStage: boolean
  onPositionChange: (itemId: string, position: { x: number; y: number }) => void
  onDelete: (itemId: string) => void
}

export default function BrainstormCanvas({ 
  items, 
  isCurrentStage, 
  onPositionChange, 
  onDelete 
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: Math.max(400, Math.min(600, rect.height)) })
      }
    }
    
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])
  
  return (
    <div
      ref={canvasRef}
      style={{
        width: '100%',
        minHeight: '400px',
        maxHeight: '600px',
        background: '#1a1a1a',
        borderRadius: '8px',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}
    >
      {items.map(item => (
        <BrainstormNode
          key={item.id}
          item={item}
          isCurrentStage={isCurrentStage}
          onPositionChange={onPositionChange}
          onDelete={onDelete}
          canvasWidth={dimensions.width || 800}
          canvasHeight={dimensions.height || 500}
        />
      ))}
      
      {items.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          Start adding ideas below...
        </div>
      )}
    </div>
  )
}


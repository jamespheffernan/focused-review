import { useState, useEffect, useCallback } from 'react'
import type { PlanningBrainstormItem } from '../../types'
import { X } from 'lucide-react'

interface Props {
  item: PlanningBrainstormItem
  isCurrentStage: boolean
  onPositionChange: (itemId: string, position: { x: number; y: number }) => void
  onDelete: (itemId: string) => void
  canvasWidth: number
  canvasHeight: number
}

export default function BrainstormNode({ 
  item, 
  isCurrentStage, 
  onPositionChange, 
  onDelete,
  canvasWidth,
  canvasHeight 
}: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [nodeStart, setNodeStart] = useState<{ x: number; y: number } | null>(null)
  
  const left = item.position.x * canvasWidth
  const top = item.position.y * canvasHeight
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isCurrentStage) return
    
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setNodeStart({ x: left, y: top })
  }
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStart || !nodeStart) return
    
    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y
    
    const newLeft = Math.max(0, Math.min(canvasWidth - 80, nodeStart.x + deltaX))
    const newTop = Math.max(0, Math.min(canvasHeight - 40, nodeStart.y + deltaY))
    
    const newPosition = {
      x: newLeft / canvasWidth,
      y: newTop / canvasHeight
    }
    
    onPositionChange(item.id, newPosition)
  }, [isDragging, dragStart, nodeStart, canvasWidth, canvasHeight, item.id, onPositionChange])
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragStart(null)
    setNodeStart(null)
  }, [])
  
  // Attach global mouse handlers when dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])
  
  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        minWidth: '80px',
        maxWidth: '180px',
        padding: '8px 12px',
        background: 'rgba(34, 197, 94, 0.15)',
        border: isHovered || isDragging 
          ? '2px solid #22c55e' 
          : '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '6px',
        color: 'white',
        fontSize: '13px',
        cursor: isCurrentStage ? (isDragging ? 'grabbing' : 'grab') : 'default',
        opacity: isDragging ? 0.9 : 1,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        boxShadow: isDragging 
          ? '0 8px 24px rgba(34, 197, 94, 0.4)' 
          : isHovered 
            ? '0 4px 12px rgba(34, 197, 94, 0.2)' 
            : 'none',
        transition: isDragging ? 'none' : 'all 0.2s ease',
        zIndex: isDragging ? 1000 : 1,
        wordWrap: 'break-word',
        userSelect: 'none'
      }}
    >
      {item.text}
      {isCurrentStage && isHovered && !isDragging && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(item.id)
          }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#ef4444',
            border: '2px solid #1a1a1a',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            padding: 0,
            lineHeight: 1
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

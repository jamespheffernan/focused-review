interface Props {
  stageNumber: number
  stageName: string
  description: string
  color: string
}

export default function StageHeader({ stageNumber, stageName, description, color }: Props) {
  return (
    <div>
      <div style={{ 
        fontSize: '11px', 
        fontWeight: '600',
        letterSpacing: '1px',
        color: 'rgba(255, 255, 255, 0.5)',
        marginBottom: '8px'
      }}>
        STAGE {stageNumber} OF 5
      </div>
      <h2 style={{ 
        fontSize: '20px', 
        fontWeight: '500',
        color: '#fff',
        margin: '0 0 8px 0'
      }}>
        {stageName}
      </h2>
      <p style={{ 
        fontSize: '14px', 
        color: 'rgba(255, 255, 255, 0.6)',
        margin: 0,
        lineHeight: 1.5
      }}>
        {description}
      </p>
    </div>
  )
}

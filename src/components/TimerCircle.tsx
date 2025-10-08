interface TimerCircleProps {
  remaining: number
  total: number
}

export default function TimerCircle({ remaining, total }: TimerCircleProps) {
  const elapsed = total - remaining
  const progress = Math.max(0, (elapsed / total) * 360)
  
  
  const formatTime = (seconds: number) => {
    const sign = seconds < 0 ? '-' : ''
    const abs = Math.abs(seconds)
    const m = Math.floor(abs / 60)
    const s = String(abs % 60).padStart(2, '0')
    return `${sign}${m}:${s}`
  }

  return (
    <div 
      className="timer-circle"
      style={{ 
        background: `conic-gradient(from 0deg, #ff4444 0deg, #ff4444 ${progress}deg, rgba(255, 255, 255, 0.3) ${progress}deg)`
      }}
    >
      <div className={`timer-text ${remaining < 0 ? 'negative' : ''}`}>
        {formatTime(remaining)}
      </div>
    </div>
  )
}

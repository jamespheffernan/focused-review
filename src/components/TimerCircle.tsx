interface TimerCircleProps {
  remaining: number
  total: number
}

export default function TimerCircle({ remaining, total }: TimerCircleProps) {
  const formatTime = (seconds: number) => {
    const sign = seconds < 0 ? '-' : ''
    const abs = Math.abs(seconds)
    const m = Math.floor(abs / 60)
    const s = String(abs % 60).padStart(2, '0')
    return `${sign}${m}:${s}`
  }

  // Calculate fill angle for the circle
  // Start: 180° filled (left half)
  // 0-30s: drain from 180° to 0° (emptying left half)
  // 30s+: fill from 0° to 360° (filling clockwise, showing negative time)
  let fillDegrees: number
  if (remaining >= 0) {
    // Draining phase: start at 180°, drain to 0°
    fillDegrees = (remaining / total) * 180
  } else {
    // Filling phase: start at 0°, fill up to 360°
    const overtime = Math.abs(remaining)
    fillDegrees = Math.min(360, (overtime / total) * 180)
  }

  return (
    <div className="timer-wrapper">
      <div 
        className="timer-circle"
        style={{ 
          background: `conic-gradient(from 0deg, #ff4444 0deg, #ff4444 ${fillDegrees}deg, rgba(255, 255, 255, 0.3) ${fillDegrees}deg)`
        }}
      />
      <div className={`timer-text ${remaining < 0 ? 'negative' : ''}`}>
        {formatTime(remaining)}
      </div>
    </div>
  )
}

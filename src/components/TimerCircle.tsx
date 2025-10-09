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

  // Calculate angles for the circle
  // Countdown: green arc ticks clockwise from 6 o'clock (180deg) to 12 o'clock (360deg)
  // Overtime: red arc ticks clockwise from 12 o'clock (0deg) onwards
  let startAngle: number
  let endAngle: number
  let arcColor: string
  
  if (remaining >= 0) {
    // Normal countdown: green arc shrinks from 6 o'clock toward 12 o'clock
    // When full: 180deg to 360deg (half circle, right side)
    // When empty: 360deg to 360deg (no arc, at 12 o'clock)
    const progress = remaining / total // 1.0 when full, 0.0 when empty
    startAngle = 180 + (1 - progress) * 180 // advances from 180 to 360
    endAngle = 360
    arcColor = '#22c55e' // green for countdown
  } else {
    // Overtime: red arc grows clockwise from 12 o'clock (0deg)
    // Can grow all the way around (up to 360 degrees for full circle)
    const overtime = Math.abs(remaining)
    const overtimeProgress = overtime / total
    startAngle = 0
    endAngle = Math.min(360, overtimeProgress * 360) // grows from 0 to 360 (full circle)
    arcColor = '#ff4444' // red for overtime
  }

  return (
    <div className="timer-wrapper">
      <div 
        className="timer-circle"
        style={{ 
          background: `conic-gradient(
            rgba(255, 255, 255, 0.3) 0deg,
            rgba(255, 255, 255, 0.3) ${startAngle}deg,
            ${arcColor} ${startAngle}deg,
            ${arcColor} ${endAngle}deg,
            rgba(255, 255, 255, 0.3) ${endAngle}deg
          )`
        }}
      />
      <div className={`timer-text ${remaining < 0 ? 'negative' : ''}`}>
        {formatTime(remaining)}
      </div>
    </div>
  )
}

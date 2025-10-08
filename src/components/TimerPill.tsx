export default function TimerPill({ questionIndex, remaining, onPause, onResume, onAddMinute }:{
  questionIndex:number; remaining:number; onPause:()=>void; onResume:()=>void; onAddMinute:()=>void
}) {
  const sign = remaining < 0 ? '-' : ''; const abs = Math.abs(remaining); const m = Math.floor(abs/60), s = String(abs%60).padStart(2,'0')
  return (
    <div style={{ maxWidth:720, padding:10, borderRadius:999, background:'rgba(0,0,0,.05)' }}>
      <strong>Q{questionIndex}</strong> <span style={{ color: remaining<0 ? 'crimson':'inherit' }}>{sign}{m}:{s}</span>
      <span style={{ float:'right' }}>
        <button onClick={onPause}>Pause</button>
        <button onClick={onResume}>Resume</button>
        <button onClick={onAddMinute}>+1 min</button>
      </span>
    </div>
  )
}

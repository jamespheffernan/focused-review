import { useEffect, useState } from 'react'
export default function LastWeekBlock({ valuePromise }: { valuePromise: Promise<string> }) {
  const [val, setVal] = useState<string>(''); useEffect(()=>{ valuePromise.then(setVal) }, [valuePromise])
  if (!val) return null
  return (
    <div style={{ maxWidth:720 }}>
      <div style={{ fontSize:12, opacity:.7 }}>LAST WEEK</div>
      <div style={{ opacity:.7 }}>{val}</div>
    </div>
  )
}

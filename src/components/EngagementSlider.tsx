export default function EngagementSlider({ onChange }: { onChange: (score?: number)=>void }) {
  return (
    <div style={{ width: 420 }}>
      <div style={{ fontSize:12, opacity:.7 }}>Engagement</div>
      <input type="range" min={1} max={3} step={1} defaultValue={2}
        onChange={e => onChange(Number(e.target.value))} />
      <span style={{ marginLeft:8 }}>{/* show value via CSS/JS if you like */}</span>
    </div>
  )
}

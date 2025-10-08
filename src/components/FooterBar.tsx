export default function FooterBar({ projectName, onMarkReviewed, onSkip }:{
  projectName:string; onMarkReviewed:()=>void; onSkip:()=>void
}) {
  return (
    <div style={{ maxWidth:720, display:'flex', gap:12, alignItems:'center' }}>
      <strong>{projectName}</strong>
      <div style={{ flex:1 }} />
      <button onClick={onSkip}>Skip</button>
      <button onClick={onMarkReviewed}><b>Mark Reviewed</b></button>
    </div>
  )
}

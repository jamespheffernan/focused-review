import { useState, useEffect } from 'react'
export default function AnswerField({ onChange }: { onChange: (text: string)=>void }) {
  const [text, setText] = useState('')
  useEffect(() => { const id = setTimeout(() => onChange(text), 500); return () => clearTimeout(id) }, [text])
  return <textarea value={text} onChange={e=>setText(e.target.value)} style={{ width:'100%', minHeight:180 }} />
}

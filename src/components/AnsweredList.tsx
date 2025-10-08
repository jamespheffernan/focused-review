export default function AnsweredList({ items, activeQuestionID, onSelect }:{
  items: {questionID:string; questionLabel:string; previewText:string; status:'CarriedForward'|'Updated'|'New'}[]
  activeQuestionID: string
  onSelect: (qid:string)=>void
}) {
  return (
    <div style={{ width:280, padding:16 }}>
      <div style={{ fontSize:12, opacity:.7 }}>Answered in this project</div>
      <ul>
        {items.map(it =>
          <li key={it.questionID}>
            <button style={{ background: it.questionID===activeQuestionID ? '#f2f2f2' : 'transparent' }}
                    onClick={() => onSelect(it.questionID)}>
              <b>{it.questionLabel}</b> · <span style={{ opacity:.7 }}>{it.previewText}</span>
            </button>
          </li>)}
      </ul>
    </div>
  )
}

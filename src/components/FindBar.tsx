import { useEffect, useRef } from 'react'
import { X, ChevronUp, ChevronDown } from 'lucide-react'
import { useStore } from '../store'

export function FindBar() {
  const find = useStore((s) => s.find)
  const runFind = useStore((s) => s.runFind)
  const closeFind = useStore((s) => s.closeFind)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="findbar glass">
      <input
        ref={inputRef}
        value={find.text}
        onChange={(e) => runFind(e.target.value, true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') runFind(find.text, !e.shiftKey)
          if (e.key === 'Escape') closeFind()
        }}
        placeholder="Find in page"
        aria-label="Find in page"
      />
      <span className="find-count">
        {find.text ? `${find.active}/${find.matches}` : ''}
      </span>
      <button className="icon-btn" onClick={() => runFind(find.text, false)} title="Previous"><ChevronUp size={15} /></button>
      <button className="icon-btn" onClick={() => runFind(find.text, true)} title="Next"><ChevronDown size={15} /></button>
      <button className="icon-btn" onClick={closeFind} title="Close"><X size={15} /></button>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import './Modal.css'

type Props = { title: string; items: string[]; onClose: () => void }

/* A pop-up list (guidelines or policy). It uses the browser's own dialog, so Esc closes it and focus stays inside. */
export default function Modal({ title, items, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    return () => {
      if (d?.open) d.close()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="modal-body">
        <h2 id="modal-title">{title}</h2>
        <ul className="small">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <div className="modal-row">
          <button type="button" className="btn ghost" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
      </div>
    </dialog>
  )
}

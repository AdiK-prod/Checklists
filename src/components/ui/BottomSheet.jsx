import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Reusable bottom sheet modal.
 * Slides up from the bottom; backdrop click or X button closes it.
 *
 * @param {boolean}  open
 * @param {() => void} onClose
 * @param {string}   [title]
 * @param {React.ReactNode} children
 */
export default function BottomSheet({ open, onClose, title, children }) {
  const sheetRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.40)' }}
      onPointerDown={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={sheetRef}
        className="bg-white rounded-t-[20px] max-h-[92dvh] flex flex-col"
        style={{ boxShadow: '0 -2px 24px rgba(0,0,0,0.14)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}
        >
          <h2 className="text-16 font-medium text-content-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full text-content-hint bg-transparent border-0 cursor-pointer"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {children}
        </div>
      </div>
    </div>
  )
}

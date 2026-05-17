import { useState, useEffect, useRef } from 'react'
import { MoreVertical } from 'lucide-react'
import { useDirection } from '../../contexts/DirectionContext'

/**
 * Tap-activated action menu.
 * Renders the dropdown via a fixed-position overlay so it escapes any
 * overflow-hidden ancestor (e.g. rounded card wrappers).
 * Aligns to the correct edge in both LTR and RTL.
 *
 * @param {{ label: string, onClick: () => void, danger?: boolean }[]} items
 * @param {number}   [buttonSize=28]     – px, used for width & height of default trigger
 * @param {number}   [iconSize=16]       – px, MoreVertical icon size
 * @param {object}   [buttonStyle={}]    – extra inline styles on trigger button
 * @param {function} [renderTrigger]     – optional render prop: (ref, handleOpen) => ReactNode
 */
export default function ActionMenu({ items, buttonSize = 28, iconSize = 16, buttonStyle = {}, renderTrigger }) {
  const { dir }         = useDirection()
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({})
  const btnRef          = useRef(null)
  const menuRef         = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [open])

  const handleOpen = e => {
    e.stopPropagation()
    if (open) { setOpen(false); return }

    const rect = btnRef.current.getBoundingClientRect()

    if (dir === 'rtl') {
      // Button is on the left in RTL — anchor menu's left edge to the button's left edge
      setPos({ top: rect.bottom + 4, left: rect.left })
    } else {
      // Button is on the right in LTR — anchor menu's right edge to the button's right edge
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen(true)
  }

  return (
    <>
      {renderTrigger ? (
        <div ref={btnRef} onClick={handleOpen} style={{ display: 'inline-flex', cursor: 'pointer' }}>
          {renderTrigger()}
        </div>
      ) : (
        <button
          ref={btnRef}
          type="button"
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={handleOpen}
          style={{ width: buttonSize, height: buttonSize, borderRadius: 6, flexShrink: 0, ...buttonStyle }}
          className="flex items-center justify-center bg-transparent border-0 cursor-pointer"
        >
          <MoreVertical size={iconSize} />
        </button>
      )}

      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: 'fixed',
            top: pos.top,
            ...(dir === 'rtl'
              ? { left: pos.left }
              : { right: pos.right }),
            zIndex: 9999,
            backgroundColor: '#fff',
            borderRadius: 10,
            border: '0.5px solid rgba(0,0,0,0.12)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
            minWidth: 168,
            overflow: 'hidden',
          }}
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={e => {
                e.stopPropagation()
                setOpen(false)
                item.onClick()
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'start',
                padding: '11px 16px',
                fontSize: 14,
                lineHeight: 1.4,
                color: item.danger ? '#c03434' : '#1a1a1a',
                background: 'transparent',
                border: 'none',
                borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

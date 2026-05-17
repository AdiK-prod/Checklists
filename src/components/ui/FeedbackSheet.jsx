import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import BottomSheet from './BottomSheet'

const CATEGORIES = [
  { id: 'bug',     emoji: '🐛', label: 'Bug' },
  { id: 'feature', emoji: '💡', label: 'Feature' },
  { id: 'general', emoji: '👍', label: 'General' },
]

export default function FeedbackSheet({ open, onClose, userId, householdId, onSuccess }) {
  const [category, setCategory] = useState(null)
  const [message, setMessage]   = useState('')
  const [errors, setErrors]     = useState({})
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setCategory(null)
    setMessage('')
    setErrors({})
    setSubmitting(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit() {
    const errs = {}
    if (!category) errs.category = 'Please select a category.'
    if (message.trim().length < 10) errs.message = 'Please write at least 10 characters.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    const { error } = await supabase.from('user_feedback').insert({
      user_id:     userId ?? null,
      household_id: householdId ?? null,
      category,
      message:     message.trim(),
      app_version: import.meta.env.VITE_APP_VERSION || 'unknown',
    })
    setSubmitting(false)

    if (error) {
      onSuccess?.("Couldn't send — try again", 'error')
      return
    }

    reset()
    onClose()
    onSuccess?.('Thanks for your feedback!', 'success')
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Give feedback">
      <div className="space-y-4">
        {/* Category pills */}
        <div>
          <p className="text-12 text-content-secondary mb-2">Category</p>
          <div className="flex gap-2">
            {CATEGORIES.map(cat => {
              const selected = category === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { setCategory(cat.id); setErrors(e => ({ ...e, category: undefined })) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-13 font-medium border-0 cursor-pointer"
                  style={{
                    backgroundColor: selected ? '#3d6494' : '#f1efe8',
                    color: selected ? '#ffffff' : '#1a1a1a',
                  }}
                >
                  {cat.emoji} {cat.label}
                </button>
              )
            })}
          </div>
          {errors.category && (
            <p className="text-11 mt-1" style={{ color: '#c03434' }}>{errors.category}</p>
          )}
        </div>

        {/* Message textarea */}
        <div>
          <textarea
            value={message}
            onChange={e => { setMessage(e.target.value); setErrors(er => ({ ...er, message: undefined })) }}
            placeholder="Your feedback…"
            rows={4}
            className="w-full text-13 rounded-input border border-[#e0ddd8] px-3 py-2 resize-none focus:outline-none focus:border-navy"
            style={errors.message ? { borderColor: '#c03434' } : {}}
          />
          {errors.message && (
            <p className="text-11 mt-1" style={{ color: '#c03434' }}>{errors.message}</p>
          )}
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="w-full text-btn font-medium text-white bg-navy rounded-button py-[13px] disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send feedback'}
        </button>
      </div>
    </BottomSheet>
  )
}

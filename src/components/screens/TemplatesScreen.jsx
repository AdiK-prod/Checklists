import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2, Plane, Car, Moon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const ICON_MAP = { Plane, Car, Moon }
const CATEGORIES = ['Documents', 'Clothing', 'Essentials', 'Toiletries', 'Entertainment', 'Medications', 'Other']

export default function TemplatesScreen() {
  const { household } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [newLabel, setNewLabel] = useState('')
  const [newCategory, setNewCategory] = useState('Documents')
  const [editingNameId, setEditingNameId] = useState(null)
  const [editNameValue, setEditNameValue] = useState('')

  const load = useCallback(async () => {
    if (!household?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('templates')
      .select('id, name, icon, template_items(id, label, category, sort_order)')
      .eq('household_id', household.id)
      .order('created_at')

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    const sorted = (data || []).map((t) => ({
      ...t,
      template_items: [...(t.template_items || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    }))
    setRows(sorted)
    setLoading(false)
  }, [household?.id])

  useEffect(() => {
    load()
  }, [load])

  async function saveTemplateName(id) {
    const name = editNameValue.trim()
    if (!name) return
    const { error } = await supabase.from('templates').update({ name }).eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setEditingNameId(null)
    await load()
  }

  async function removeItem(templateId, itemId) {
    if (!window.confirm('Remove this item from the template?')) return
    const { error } = await supabase.from('template_items').delete().eq('id', itemId)
    if (error) {
      alert(error.message)
      return
    }
    await load()
  }

  async function addItem(templateId) {
    const label = newLabel.trim()
    if (!label) return
    const tpl = rows.find((r) => r.id === templateId)
    const maxOrder = (tpl?.template_items || []).reduce((m, i) => Math.max(m, i.sort_order ?? 0), 0)
    const { error } = await supabase.from('template_items').insert({
      template_id: templateId,
      label,
      category: newCategory,
      sort_order: maxOrder + 1,
    })
    if (error) {
      alert(error.message)
      return
    }
    setNewLabel('')
    setNewCategory('Documents')
    await load()
  }

  return (
    <div className="bg-page h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden">

      <div className="flex-none flex items-center gap-2 px-4 pt-4 pb-3 border-b border-[rgba(0,0,0,0.06)]">
        <button
          type="button"
          onClick={() => navigate('/settings', { state: { direction: 'back' } })}
          className="flex items-center gap-1 text-13"
          style={{ color: '#2d6fb5' }}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-18 font-medium text-content-primary">Pack templates</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-8">
        <p className="text-12 text-content-secondary mb-4">
          These lists seed each traveller&apos;s checklist when you start a new trip. You can also add items from a trip back into a template.
        </p>

        {loading ? (
          <p className="text-13 text-content-hint animate-pulse">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-13 text-content-hint">No templates yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((tpl) => {
              const Icon = ICON_MAP[tpl.icon] || Plane
              const expanded = openId === tpl.id
              return (
                <div
                  key={tpl.id}
                  className="bg-white rounded-card overflow-hidden"
                  style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(expanded ? null : tpl.id)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left"
                  >
                    <div
                      className="rounded-input flex items-center justify-center flex-shrink-0"
                      style={{ width: 40, height: 40, backgroundColor: '#f1efe8', color: '#6b6b6b' }}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-14 font-medium text-content-primary truncate">{tpl.name}</p>
                      <p className="text-11 text-content-secondary">
                        {(tpl.template_items || []).length} items
                      </p>
                    </div>
                    {expanded ? <ChevronUp size={18} className="text-content-hint" /> : <ChevronDown size={18} className="text-content-hint" />}
                  </button>

                  {expanded && (
                    <div className="px-3 pb-3 border-t border-[rgba(0,0,0,0.06)] pt-3 space-y-3">
                      {editingNameId === tpl.id ? (
                        <div className="flex gap-2">
                          <input
                            value={editNameValue}
                            onChange={e => setEditNameValue(e.target.value)}
                            className="flex-1 rounded-input border border-[#e0ddd8] px-2 py-1.5 text-13"
                          />
                          <button type="button" onClick={() => saveTemplateName(tpl.id)} className="text-12 bg-navy text-white rounded-input px-3">
                            Save
                          </button>
                          <button type="button" onClick={() => setEditingNameId(null)} className="text-12 text-content-secondary px-2">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEditingNameId(tpl.id); setEditNameValue(tpl.name) }}
                          className="text-12"
                          style={{ color: '#2d6fb5' }}
                        >
                          Rename template
                        </button>
                      )}

                      <ul className="space-y-1.5">
                        {(tpl.template_items || []).map((it) => (
                          <li
                            key={it.id}
                            className="flex items-start gap-2 text-13 py-1.5 border-b border-[rgba(0,0,0,0.04)] last:border-0"
                          >
                            <span className="flex-1 min-w-0">
                              <span className="text-content-primary">{it.label}</span>
                              <span className="text-11 text-content-hint ml-2">{it.category}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeItem(tpl.id, it.id)}
                              className="text-content-hint p-1 flex-shrink-0"
                              aria-label="Remove item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </li>
                        ))}
                      </ul>

                      <div className="rounded-input bg-page p-2 space-y-2" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
                        <input
                          value={newLabel}
                          onChange={e => setNewLabel(e.target.value)}
                          placeholder="New item label"
                          className="w-full rounded-input border border-[#e0ddd8] px-2 py-1.5 text-13 bg-white"
                        />
                        <select
                          value={newCategory}
                          onChange={e => setNewCategory(e.target.value)}
                          className="w-full rounded-input border border-[#e0ddd8] px-2 py-1.5 text-13 bg-white"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => addItem(tpl.id)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-button border border-[#e0ddd8] text-13 font-medium text-navy bg-white"
                        >
                          <Plus size={16} />
                          Add to template
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

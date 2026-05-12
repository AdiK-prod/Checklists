import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2, Plane, Car, Moon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  ensureTemplateHasMinimalTree,
  ensureTemplateMiscSectionDefaultSubcategory,
  TEMPLATE_MISC_SECTION_NAME,
} from '../../lib/templateLayout'
import { asArray } from '../../lib/transforms'

const ICON_MAP = { Plane, Car, Moon }

function normalizeTemplateRow(t) {
  const secs = [...asArray(t.template_sections)]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(sec => ({
      ...sec,
      template_subcategories: [...asArray(sec.template_subcategories)]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(sub => ({
          ...sub,
          template_items: [...asArray(sub.template_items)].sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
          ),
        })),
    }))
  return { ...t, template_sections: secs }
}

function countTemplateItems(tpl) {
  let n = 0
  for (const sec of tpl.template_sections || []) {
    n += countTemplateSectionItems(sec)
  }
  return n
}

function countTemplateSectionItems(sec) {
  let n = 0
  for (const sub of sec.template_subcategories || []) {
    n += asArray(sub.template_items).length
  }
  return n
}

export default function TemplatesScreen() {
  const { household } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [newLabel, setNewLabel] = useState('')
  const [addSubId, setAddSubId] = useState('')
  const [editingNameId, setEditingNameId] = useState(null)
  const [editNameValue, setEditNameValue] = useState('')
  const [subAddOpen, setSubAddOpen] = useState(null)
  const [subAddName, setSubAddName] = useState('')
  const [members, setMembers] = useState([])
  const [editingTplSectionId, setEditingTplSectionId] = useState(null)
  const [tplSectionEditName, setTplSectionEditName] = useState('')
  const [newSharedCatName, setNewSharedCatName] = useState('')
  const [newPersonMemberId, setNewPersonMemberId] = useState('')
  const [newPersonCatName, setNewPersonCatName] = useState('')
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)

  const load = useCallback(async () => {
    if (!household?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('templates')
      .select(
        `
        id, name, icon,
        template_sections(
          id, section_type, name, member_id, sort_order,
          template_subcategories(
            id, name, sort_order,
            template_items(id, label, sort_order)
          )
        )
      `,
      )
      .eq('household_id', household.id)
      .order('created_at')

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    const raw = Array.isArray(data) ? data : []
    const sorted = raw.map(normalizeTemplateRow)
    setRows(sorted)
    setLoading(false)
  }, [household?.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!household?.id) {
      setMembers([])
      return
    }
    let cancelled = false
    supabase
      .from('household_members')
      .select('id, name, role')
      .eq('household_id', household.id)
      .order('name')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error(error)
          return
        }
        setMembers(Array.isArray(data) ? data : [])
      })
    return () => {
      cancelled = true
    }
  }, [household?.id])

  useEffect(() => {
    setAddSubId('')
    setNewSharedCatName('')
    setNewPersonMemberId('')
    setNewPersonCatName('')
    setEditingTplSectionId(null)
    setTplSectionEditName('')
    setAddCategoryOpen(false)
  }, [openId])

  useEffect(() => {
    if (!openId || !household?.id) return
    const tpl = rows.find(r => r.id === openId)
    if (!tpl) return
    const hasNoSections = !(tpl.template_sections || []).length
    if (!hasNoSections) return

    let cancelled = false
    ;(async () => {
      try {
        const created = await ensureTemplateHasMinimalTree(supabase, openId)
        if (!cancelled && created) await load()
      } catch (e) {
        if (!cancelled) alert(e?.message || 'Could not prepare template.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [openId, rows, household?.id, load])

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

  async function removeItem(subcategoryId, itemId) {
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

    let subId = addSubId.trim() ? addSubId : null
    try {
      if (!subId) subId = await ensureTemplateMiscSectionDefaultSubcategory(supabase, templateId)
    } catch (e) {
      alert(e?.message || 'Could not resolve subcategory.')
      return
    }

    const tpl = rows.find(r => r.id === templateId)
    let maxOrder = 0
    outer: for (const sec of tpl?.template_sections || []) {
      for (const sub of sec.template_subcategories || []) {
        if (sub.id !== subId) continue
        for (const it of sub.template_items || []) {
          maxOrder = Math.max(maxOrder, it.sort_order ?? 0)
        }
        break outer
      }
    }
    const { error } = await supabase.from('template_items').insert({
      subcategory_id: subId,
      label,
      sort_order: maxOrder + 1,
    })
    if (error) {
      alert(error.message)
      return
    }
    setNewLabel('')
    await load()
  }

  async function addTemplateSubcategory(sectionId) {
    const name = subAddName.trim()
    if (!name) return
    const sec = rows.flatMap(t => t.template_sections || []).find(s => s.id === sectionId)
    const subs = asArray(sec?.template_subcategories)
    const maxSo = subs.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)
    const { error } = await supabase.from('template_subcategories').insert({
      section_id: sectionId,
      name,
      sort_order: maxSo + 1,
    })
    if (error) {
      alert(error.message)
      return
    }
    setSubAddName('')
    setSubAddOpen(null)
    await load()
  }

  async function addTemplateSharedCategory(templateId) {
    const name = newSharedCatName.trim()
    if (!name) return
    const tpl = rows.find(r => r.id === templateId)
    const secs = tpl?.template_sections || []
    const maxSo = secs.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)
    const { error } = await supabase.from('template_sections').insert({
      template_id: templateId,
      section_type: 'shared',
      name,
      member_id: null,
      sort_order: maxSo + 1,
    })
    if (error) {
      alert(error.message)
      return
    }
    setNewSharedCatName('')
    await load()
  }

  async function addTemplatePersonCategory(templateId) {
    const memberId = newPersonMemberId
    if (!memberId) {
      alert('Select a household member.')
      return
    }
    const tpl = rows.find(r => r.id === templateId)
    const name =
      newPersonCatName.trim() || members.find(m => m.id === memberId)?.name || ''
    if (!name) return
    if (tpl?.template_sections?.some(s => s.section_type === 'person' && s.member_id === memberId)) {
      alert('This person already has a category in this template.')
      return
    }
    const secs = tpl?.template_sections || []
    const maxSo = secs.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0)
    const { error } = await supabase.from('template_sections').insert({
      template_id: templateId,
      section_type: 'person',
      name,
      member_id: memberId,
      sort_order: maxSo + 1,
    })
    if (error) {
      alert(error.message)
      return
    }
    setNewPersonCatName('')
    setNewPersonMemberId('')
    await load()
  }

  async function saveTplSectionName(sectionId) {
    const name = tplSectionEditName.trim()
    if (!name) return
    const { error } = await supabase.from('template_sections').update({ name }).eq('id', sectionId)
    if (error) {
      alert(error.message)
      return
    }
    setEditingTplSectionId(null)
    await load()
  }

  async function removeTemplateSection(sec) {
    const n = countTemplateSectionItems(sec)
    if (!window.confirm(`Remove category "${sec.name}" and all ${n} items inside?`)) return
    const { error } = await supabase.from('template_sections').delete().eq('id', sec.id)
    if (error) {
      alert(error.message)
      return
    }
    await load()
  }

  function subcategoryOptions(tpl) {
    const opts = []
    for (const sec of tpl.template_sections || []) {
      for (const sub of sec.template_subcategories || []) {
        opts.push({
          id: sub.id,
          label: `${sec.name} · ${sub.name}`,
        })
      }
    }
    return opts
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
          Categories are the top level of each template (shared groups and one block per traveller). Inside each
          category you can add subcategories and items. Trips copy this structure when you create them.
        </p>

        {loading ? (
          <p className="text-13 text-content-hint animate-pulse">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-13 text-content-hint">No templates yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(tpl => {
              const Icon = ICON_MAP[tpl.icon] || Plane
              const expanded = openId === tpl.id
              const itemTotal = countTemplateItems(tpl)
              const subOpts = subcategoryOptions(tpl)

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
                      <p className="text-11 text-content-secondary">{itemTotal} items</p>
                    </div>
                    {expanded ? (
                      <ChevronUp size={18} className="text-content-hint" />
                    ) : (
                      <ChevronDown size={18} className="text-content-hint" />
                    )}
                  </button>

                  {expanded && (
                    <div className="px-3 pb-3 border-t border-[rgba(0,0,0,0.06)] pt-3 space-y-4">
                      {editingNameId === tpl.id ? (
                        <div className="flex gap-2">
                          <input
                            value={editNameValue}
                            onChange={e => setEditNameValue(e.target.value)}
                            className="flex-1 rounded-input border border-[#e0ddd8] px-2 py-1.5 text-13"
                          />
                          <button
                            type="button"
                            onClick={() => saveTemplateName(tpl.id)}
                            className="text-12 bg-navy text-white rounded-input px-3"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNameId(null)}
                            className="text-12 text-content-secondary px-2"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNameId(tpl.id)
                            setEditNameValue(tpl.name)
                          }}
                          className="text-12"
                          style={{ color: '#2d6fb5' }}
                        >
                          Rename template
                        </button>
                      )}

                      {(tpl.template_sections || []).map(sec => (
                        <div
                          key={sec.id}
                          className="space-y-2 rounded-input p-2"
                          style={{ border: '0.5px solid rgba(0,0,0,0.06)' }}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            {editingTplSectionId === sec.id ? (
                              <div className="flex flex-1 flex-wrap gap-2 items-center min-w-0">
                                <input
                                  value={tplSectionEditName}
                                  onChange={e => setTplSectionEditName(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && saveTplSectionName(sec.id)}
                                  className="flex-1 min-w-[8rem] text-13 rounded-input px-2 py-1.5 border border-[#e0ddd8] bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => saveTplSectionName(sec.id)}
                                  className="text-12 font-medium text-white bg-navy rounded-input px-3 py-1.5"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTplSectionId(null)}
                                  className="text-12 text-content-secondary px-2"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="min-w-0">
                                  <p className="text-12 font-medium text-content-primary">{sec.name}</p>
                                  <p className="text-10 text-content-hint">
                                    {sec.section_type === 'shared'
                                      ? 'Shared category'
                                      : `Traveller · ${
                                          members.find(m => m.id === sec.member_id)?.name || 'Member'
                                        }`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTplSectionId(sec.id)
                                      setTplSectionEditName(sec.name)
                                    }}
                                    className="text-11 bg-transparent border-0 cursor-pointer p-0"
                                    style={{ color: '#2d6fb5' }}
                                  >
                                    Rename
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeTemplateSection(sec)}
                                    className="text-11 text-content-hint bg-transparent border-0 cursor-pointer p-0"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                          {(sec.template_subcategories || []).map(sub => (
                            <div key={sub.id} className="pl-2 border-l-2 border-[#e8e4dc]">
                              <p className="text-12 font-medium text-content-primary mb-1">{sub.name}</p>
                              <ul className="space-y-1">
                                {(sub.template_items || []).map(it => (
                                  <li
                                    key={it.id}
                                    className="flex items-start gap-2 text-13 py-1 border-b border-[rgba(0,0,0,0.04)] last:border-0"
                                  >
                                    <span className="flex-1 min-w-0 text-content-primary">{it.label}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeItem(sub.id, it.id)}
                                      className="text-content-hint p-1 flex-shrink-0"
                                      aria-label="Remove item"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}

                          <div className="pl-2">
                            {subAddOpen !== sec.id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSubAddOpen(sec.id)
                                  setSubAddName('')
                                }}
                                className="text-12 bg-transparent border-0 p-0 cursor-pointer"
                                style={{ color: '#6b6b6b' }}
                              >
                                + Add subcategory
                              </button>
                            ) : (
                              <div className="flex gap-2 items-center mt-1">
                                <input
                                  value={subAddName}
                                  onChange={e => setSubAddName(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && addTemplateSubcategory(sec.id)}
                                  placeholder="Subcategory name"
                                  className="flex-1 text-13 rounded-input px-2 py-1.5 border border-[#e0ddd8] bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => addTemplateSubcategory(sec.id)}
                                  className="text-12 font-medium text-white bg-navy rounded-input px-3 py-1.5"
                                >
                                  Add
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      <div
                        className="rounded-input bg-page overflow-hidden"
                        style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
                      >
                        <button
                          type="button"
                          onClick={() => setAddCategoryOpen(o => !o)}
                          aria-expanded={addCategoryOpen}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-page"
                        >
                          <span className="flex-1 text-11 font-medium uppercase tracking-[0.08em] text-content-secondary">
                            Add category
                          </span>
                          <ChevronDown
                            size={18}
                            className="text-content-hint flex-shrink-0"
                            style={{
                              transition: 'transform 200ms ease',
                              transform: addCategoryOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}
                          />
                        </button>
                        <div
                          style={{
                            display: 'grid',
                            transition: 'grid-template-rows 250ms ease',
                            gridTemplateRows: addCategoryOpen ? '1fr' : '0fr',
                          }}
                        >
                          <div style={{ overflow: 'hidden' }}>
                            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-[rgba(0,0,0,0.06)]">
                              <div className="space-y-2">
                                <p className="text-12 text-content-primary">Shared (everyone)</p>
                                <div className="flex gap-2">
                                  <input
                                    value={newSharedCatName}
                                    onChange={e => setNewSharedCatName(e.target.value)}
                                    onKeyDown={e =>
                                      e.key === 'Enter' && addTemplateSharedCategory(tpl.id)
                                    }
                                    placeholder="Category name"
                                    className="flex-1 text-13 rounded-input px-2 py-1.5 border border-[#e0ddd8] bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addTemplateSharedCategory(tpl.id)}
                                    className="text-12 font-medium text-white bg-navy rounded-input px-3 py-1.5 flex-shrink-0"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <p className="text-12 text-content-primary">Traveller (personal)</p>
                                <select
                                  value={newPersonMemberId}
                                  onChange={e => {
                                    const id = e.target.value
                                    setNewPersonMemberId(id)
                                    const m = members.find(x => x.id === id)
                                    if (m) setNewPersonCatName(m.name)
                                  }}
                                  className="w-full text-13 rounded-input px-2 py-1.5 border border-[#e0ddd8] bg-white"
                                >
                                  <option value="">Select household member…</option>
                                  {members.map(m => (
                                    <option key={m.id} value={m.id}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                                <div className="flex gap-2">
                                  <input
                                    value={newPersonCatName}
                                    onChange={e => setNewPersonCatName(e.target.value)}
                                    onKeyDown={e =>
                                      e.key === 'Enter' && addTemplatePersonCategory(tpl.id)
                                    }
                                    placeholder="Category title (optional)"
                                    className="flex-1 text-13 rounded-input px-2 py-1.5 border border-[#e0ddd8] bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addTemplatePersonCategory(tpl.id)}
                                    className="text-12 font-medium text-white bg-navy rounded-input px-3 py-1.5 flex-shrink-0"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        className="rounded-input bg-page p-2 space-y-2"
                        style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
                      >
                        <input
                          value={newLabel}
                          onChange={e => setNewLabel(e.target.value)}
                          placeholder="New item label"
                          className="w-full rounded-input border border-[#e0ddd8] px-2 py-1.5 text-13 bg-white"
                        />
                        <label className="block text-11 text-content-secondary">Subcategory (optional)</label>
                        <select
                          value={addSubId}
                          onChange={e => setAddSubId(e.target.value)}
                          className="w-full rounded-input border border-[#e0ddd8] px-2 py-1.5 text-13 bg-white"
                        >
                          <option value="">
                            {TEMPLATE_MISC_SECTION_NAME} category — default
                          </option>
                          {subOpts.map(o => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => addItem(tpl.id)}
                          disabled={!newLabel.trim()}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-button border border-[#e0ddd8] text-13 font-medium text-navy bg-white disabled:opacity-50"
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

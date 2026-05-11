import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { normalizeMember } from '../../lib/transforms'
import { buildHouseholdMemberInsert } from '../../lib/memberInsert'
import Avatar from '../ui/Avatar'

export default function Settings() {
  const { user, household, signOut, refreshHousehold } = useAuth()
  const navigate = useNavigate()

  const [hName, setHName]         = useState('')
  const [editingHouse, setEditingHouse] = useState(false)
  const [members, setMembers]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [banner, setBanner]       = useState('')

  const [editingId, setEditingId] = useState(null)
  const [formName, setFormName]   = useState('')
  const [formRole, setFormRole]   = useState('parent')
  const [formAge, setFormAge]     = useState('')

  const [adding, setAdding]       = useState(false)
  const [addName, setAddName]     = useState('')
  const [addRole, setAddRole]     = useState('parent')
  const [addAge, setAddAge]       = useState('')

  const [inviteBusy, setInviteBusy] = useState(false)

  useEffect(() => {
    if (household?.name) setHName(household.name)
  }, [household])

  useEffect(() => {
    if (!household?.id) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_id', household.id)
        .order('sort_order')
      if (!cancelled) {
        if (!error && data) setMembers(data.map(normalizeMember))
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [household?.id])

  async function saveHouseholdName() {
    if (!household?.id) return
    const { error } = await supabase
      .from('households')
      .update({ name: hName.trim() || 'My household' })
      .eq('id', household.id)
    if (error) {
      alert(error.message)
      return
    }
    await refreshHousehold(user.id)
    setEditingHouse(false)
    setBanner('Household name saved')
    setTimeout(() => setBanner(''), 2500)
  }

  function startEdit(m) {
    setEditingId(m.id)
    setFormName(m.name)
    setFormRole(m.role)
    setFormAge(m.age != null ? String(m.age) : '')
    setAdding(false)
  }

  async function saveMember() {
    if (!editingId) return
    const parts = formName.trim().split(/\s+/)
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : formName.trim().slice(0, 2).toUpperCase()
    const { error } = await supabase
      .from('household_members')
      .update({
        name:     formName.trim(),
        role:     formRole,
        age:      formRole === 'kid' && formAge !== '' ? Number(formAge) : null,
        initials: initials || '?',
      })
      .eq('id', editingId)
    if (error) {
      alert(error.message)
      return
    }
    const { data } = await supabase.from('household_members').select('*').eq('id', editingId).single()
    if (data) {
      setMembers(prev => prev.map(x => x.id === editingId ? normalizeMember(data) : x))
    }
    setEditingId(null)
    setBanner('Member updated')
    setTimeout(() => setBanner(''), 2500)
  }

  async function removeMember(m) {
    if (!window.confirm(`Remove ${m.name}? Their checklist items will remain on existing trips.`)) return
    const { error } = await supabase.from('household_members').delete().eq('id', m.id)
    if (error) {
      alert(error.message.includes('restrict') || error.code === '23503'
        ? 'Cannot remove this person while they still have items on trips.'
        : error.message)
      return
    }
    setMembers(prev => prev.filter(x => x.id !== m.id))
  }

  async function addMember() {
    if (!household?.id) return
    const n = addName.trim()
    if (!n) return
    const row = buildHouseholdMemberInsert(household.id, {
      name: n,
      role: addRole,
      age:  addRole === 'kid' ? addAge : null,
      sortOrder: members.length,
    })
    const { data, error } = await supabase.from('household_members').insert(row).select('*').single()
    if (error) {
      alert(error.message)
      return
    }
    setMembers(prev => [...prev, normalizeMember(data)])
    setAddName('')
    setAddRole('parent')
    setAddAge('')
    setAdding(false)
    setBanner('Member added')
    setTimeout(() => setBanner(''), 2500)
  }

  async function copyInviteLink() {
    if (!household?.id) return
    setInviteBusy(true)
    const { data, error } = await supabase
      .from('household_invites')
      .insert({ household_id: household.id })
      .select('token')
      .single()
    setInviteBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    const url = `${window.location.origin}/join?token=${encodeURIComponent(data.token)}`
    try {
      await navigator.clipboard.writeText(url)
      setBanner('Invite link copied')
      setTimeout(() => setBanner(''), 2500)
    } catch {
      prompt('Copy this link:', url)
    }
  }

  return (
    <div className="bg-page min-h-screen pb-10">

      <div className="sticky top-0 bg-page z-10 px-4 pt-4 pb-3 flex items-center gap-2 border-b border-[rgba(0,0,0,0.06)]">
        <button
          type="button"
          onClick={() => navigate('/', { state: { direction: 'back' } })}
          className="flex items-center gap-1 text-13"
          /* style for blue link per TripPage */
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-18 font-medium text-content-primary">Settings</h1>
      </div>

      {banner && (
        <div className="mx-4 mt-3 text-12 text-center rounded-input py-2 bg-success/10 text-[#0F6E56]">
          {banner}
        </div>
      )}

      <div className="px-4 pt-5 space-y-6">

        {/* Household */}
        <section>
          <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-2">Household</p>
          {editingHouse ? (
            <div className="flex gap-2">
              <input
                value={hName}
                onChange={e => setHName(e.target.value)}
                className="flex-1 rounded-input border border-[#e0ddd8] px-3 py-2 text-14"
              />
              <button type="button" onClick={() => { saveHouseholdName() }} className="text-13 text-white bg-navy rounded-input px-3">Save</button>
              <button type="button" onClick={() => { setHName(household?.name || ''); setEditingHouse(false) }} className="text-12 text-content-secondary px-2">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-white rounded-card px-4 py-3" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
              <span className="text-14 font-medium text-content-primary">{household?.name || '—'}</span>
              <button type="button" onClick={() => setEditingHouse(true)} className="text-13" style={{ color: '#2d6fb5' }}>Edit</button>
            </div>
          )}
        </section>

        {/* Members */}
        <section>
          <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-2">Family members</p>
          {loading ? (
            <p className="text-13 text-content-hint">Loading…</p>
          ) : (
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id}>
                  {editingId === m.id ? (
                    <div className="bg-white rounded-card p-3 space-y-2" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
                      <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full rounded-input border px-3 py-2 text-13" />
                      <div className="flex gap-2">
                        {['parent', 'kid'].map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setFormRole(r)}
                            className={['flex-1 py-1 rounded-input text-12', formRole === r ? 'bg-navy text-white' : 'bg-surface'].join(' ')}
                          >
                            {r === 'parent' ? 'Parent' : 'Kid'}
                          </button>
                        ))}
                      </div>
                      {formRole === 'kid' && (
                        <input value={formAge} onChange={e => setFormAge(e.target.value)} placeholder="Age" type="number" className="w-full rounded-input border px-3 py-2 text-13" />
                      )}
                      <div className="flex gap-2">
                        <button type="button" onClick={saveMember} className="flex-1 bg-navy text-white rounded-button py-2 text-13">Save</button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-12 text-content-secondary px-2">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-2 bg-white rounded-card px-3 py-2.5"
                      style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
                    >
                      <Avatar member={m} size={32} />
                      <div className="flex-1 min-w-0">
                        <p className="text-13 font-medium truncate">{m.name}</p>
                        <p className="text-11 text-content-secondary">
                          {m.role === 'parent' ? 'Parent' : m.age != null ? `Age ${m.age}` : 'Kid'}
                        </p>
                      </div>
                      <button type="button" onClick={() => startEdit(m)} className="text-12" style={{ color: '#2d6fb5' }}>Edit</button>
                      <button type="button" onClick={() => removeMember(m)} className="text-content-hint p-1" aria-label="Remove"><X size={18} /></button>
                    </div>
                  )}
                </div>
              ))}

              {adding ? (
                <div className="bg-white rounded-card p-3 space-y-2" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
                  <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Name" className="w-full rounded-input border px-3 py-2 text-13" />
                  <div className="flex gap-2">
                    {['parent', 'kid'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setAddRole(r)}
                        className={['flex-1 py-1 rounded-input text-12', addRole === r ? 'bg-navy text-white' : 'bg-surface'].join(' ')}
                      >
                        {r === 'parent' ? 'Parent' : 'Kid'}
                      </button>
                    ))}
                  </div>
                  {addRole === 'kid' && (
                    <input value={addAge} onChange={e => setAddAge(e.target.value)} placeholder="Age" type="number" className="w-full rounded-input border px-3 py-2 text-13" />
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={addMember} className="flex-1 bg-navy text-white rounded-button py-2 text-13">Add</button>
                    <button type="button" onClick={() => setAdding(false)} className="text-12 text-content-secondary px-2">Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAdding(true); setEditingId(null) }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-button border border-[#e0ddd8] text-13 text-navy bg-page"
                >
                  <Plus size={16} />
                  Add family member
                </button>
              )}
            </div>
          )}
        </section>

        {/* Invite */}
        <section>
          <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-2">Invite partner</p>
          <p className="text-12 text-content-secondary mb-3">
            Anyone with this link can join your household after signing in. Links expire after about 7 days unless you create a new one.
          </p>
          <button
            type="button"
            disabled={inviteBusy}
            onClick={copyInviteLink}
            className="w-full bg-navy text-white rounded-button py-2.5 text-14 font-medium disabled:opacity-60"
          >
            {inviteBusy ? 'Creating link…' : 'Copy invite link'}
          </button>
        </section>

        {/* Account */}
        <section>
          <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-2">Account</p>
          <p className="text-13 text-content-primary mb-3 break-all">{user?.email}</p>
          <button
            type="button"
            onClick={async () => { await signOut(); navigate('/login', { replace: true }) }}
            className="w-full py-2.5 rounded-button text-14 font-medium border border-[#e05454] text-[#c03434] bg-transparent"
          >
            Sign out
          </button>
        </section>
      </div>
    </div>
  )
}

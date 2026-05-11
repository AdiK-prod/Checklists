import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Plane, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { buildHouseholdMemberInsert } from '../../lib/memberInsert'
import Avatar from '../ui/Avatar'
import { normalizeMember } from '../../lib/transforms'

const DEFAULT_NAME = 'My household'

export default function Onboarding() {
  const { user, household, refreshHousehold } = useAuth()
  const navigate = useNavigate()

  const [step, setStep]           = useState(1)
  const [householdName, setHouseholdName] = useState('')
  const [householdId, setHouseholdId]     = useState(null)
  const [members, setMembers]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const [newName, setNewName]     = useState('')
  const [newRole, setNewRole]     = useState('parent')
  const [newAge, setNewAge]       = useState('')

  if (!user) return <Navigate to="/login" replace />
  if (household) return <Navigate to="/" replace />

  async function createHouseholdRecord(name) {
    const { data: { session }, error: sessErr } = await supabase.auth.getSession()
    if (sessErr) throw sessErr
    const ownerId = session?.user?.id
    if (!ownerId) {
      throw new Error('Your session expired — please sign in again, then continue setup.')
    }

    const { data, error } = await supabase
      .from('households')
      .insert({ name: name.trim() || DEFAULT_NAME, owner_id: ownerId })
      .select('id')
      .single()
    if (error) throw error
    const hid = data.id
    const { error: huErr } = await supabase.from('household_users').insert({
      household_id: hid,
      user_id:      ownerId,
      role:         'owner',
    })
    if (huErr) throw huErr
    return hid
  }

  async function seedIfNeeded(hid) {
    const { error } = await supabase.rpc('seed_default_templates', { p_household_id: hid })
    if (error) throw error
  }

  async function finishAndGoHome(hid) {
    await seedIfNeeded(hid)
    await refreshHousehold(user.id)
    navigate('/', { replace: true })
  }

  async function skipStep1() {
    setError('')
    setLoading(true)
    try {
      const hid = await createHouseholdRecord(DEFAULT_NAME)
      await finishAndGoHome(hid)
    } catch (e) {
      setError(e.message || 'Something went wrong')
    }
    setLoading(false)
  }

  function goStep2() {
    setError('')
    setStep(2)
  }

  async function submitStep2(skip) {
    setError('')
    setLoading(true)
    try {
      const name = skip ? DEFAULT_NAME : (householdName.trim() || DEFAULT_NAME)
      const hid = await createHouseholdRecord(name)
      setHouseholdId(hid)
      setStep(3)
    } catch (e) {
      setError(e.message || 'Something went wrong')
    }
    setLoading(false)
  }

  async function addMember() {
    if (!householdId) return
    const n = newName.trim()
    if (!n) return
    setError('')
    const row = buildHouseholdMemberInsert(householdId, {
      name: n,
      role: newRole,
      age:  newRole === 'kid' ? newAge : null,
      sortOrder: members.length,
    })
    const { data, error } = await supabase.from('household_members').insert(row).select('*').single()
    if (error) {
      setError(error.message)
      return
    }
    setMembers(m => [...m, normalizeMember(data)])
    setNewName('')
    setNewRole('parent')
    setNewAge('')
  }

  async function removeMember(id) {
    const { error } = await supabase.from('household_members').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setMembers(m => m.filter(x => x.id !== id))
  }

  async function allDone() {
    if (!householdId) return
    setError('')
    setLoading(true)
    try {
      await finishAndGoHome(householdId)
    } catch (e) {
      setError(e.message || 'Something went wrong')
    }
    setLoading(false)
  }

  async function skipStep3() {
    if (!householdId) return
    await allDone()
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-page flex flex-col overflow-hidden px-4 pt-5">
      {step === 1 && (
        <>
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center max-w-[340px] mx-auto w-full pb-2">
            <div
              className="w-14 h-14 rounded-[16px] flex items-center justify-center mb-4"
              style={{ backgroundColor: '#3d6494' }}
            >
              <Plane size={28} color="white" />
            </div>
            <h1 className="text-[21px] font-medium text-content-primary mb-2">
              Welcome to PackSmart
            </h1>
            <p className="text-15 text-content-secondary">
              Let&apos;s set up your household so you never forget a thing.
            </p>
          </div>
          <div
            className="flex-none space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
            style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}
          >
            {error && (
              <p className="text-12 text-center" style={{ color: '#c03434' }}>{error}</p>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={goStep2}
              className="w-full bg-navy hover:bg-navy-hover text-white rounded-button py-[13px] text-15 font-medium disabled:opacity-60"
            >
              Get started
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={skipStep1}
              className="w-full text-12 py-1"
              style={{ color: '#6b6b6b' }}
            >
              Skip for now
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-2">
              Your household
            </p>
            <input
              type="text"
              value={householdName}
              onChange={e => setHouseholdName(e.target.value)}
              placeholder="e.g. The Levi Family"
              className="w-full text-14 rounded-input px-3 py-2.5 border border-[#e0ddd8] bg-white focus:outline-none focus:border-navy"
            />
            <p className="text-12 text-content-secondary mt-2 mb-4">
              This helps identify your household if you invite a partner.
            </p>
            {error && (
              <p className="text-12 mb-3" style={{ color: '#c03434' }}>{error}</p>
            )}
          </div>
          <div
            className="flex-none space-y-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
            style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}
          >
            <button
              type="button"
              disabled={loading}
              onClick={() => submitStep2(false)}
              className="w-full bg-navy hover:bg-navy-hover text-white rounded-button py-[13px] text-15 font-medium disabled:opacity-60"
            >
              Next
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => submitStep2(true)}
              className="w-full text-12 text-content-secondary py-1"
            >
              I&apos;ll do this later
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto max-w-[360px] mx-auto w-full">
            <p className="text-11 font-medium uppercase text-content-secondary tracking-[0.08em] mb-2">
              Who&apos;s in your family?
            </p>

            <div className="space-y-2 mb-3">
              {members.map(m => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 bg-white rounded-card px-3 py-2.5"
                  style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
                >
                  <Avatar member={m} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-13 font-medium text-content-primary truncate">{m.name}</p>
                    <p className="text-11 text-content-secondary">
                      {m.role === 'parent' ? 'Parent' : m.age != null ? `Age ${m.age}` : 'Kid'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMember(m.id)}
                    className="text-content-hint p-1"
                    aria-label="Remove"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-card p-3 mb-3" style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Name"
                className="w-full text-13 rounded-input px-3 py-2 border border-[#e0ddd8] mb-2"
              />
              <div className="flex gap-2 mb-2">
                {['parent', 'kid'].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewRole(r)}
                    className={[
                      'flex-1 py-1.5 rounded-input text-12 font-medium',
                      newRole === r ? 'bg-navy text-white' : 'bg-surface text-content-secondary',
                    ].join(' ')}
                  >
                    {r === 'parent' ? 'Parent' : 'Kid'}
                  </button>
                ))}
              </div>
              {newRole === 'kid' && (
                <input
                  type="number"
                  inputMode="numeric"
                  value={newAge}
                  onChange={e => setNewAge(e.target.value)}
                  placeholder="Age"
                  className="w-full text-13 rounded-input px-3 py-2 border border-[#e0ddd8] mb-2"
                />
              )}
              <button
                type="button"
                onClick={addMember}
                className="w-full py-2 text-13 font-medium text-navy border border-[#e0ddd8] rounded-button bg-page"
              >
                Add member
              </button>
            </div>

            {error && (
              <p className="text-12 mb-2" style={{ color: '#c03434' }}>{error}</p>
            )}
          </div>

          <div
            className="flex-none max-w-[360px] mx-auto w-full space-y-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
            style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}
          >
            <button
              type="button"
              disabled={loading}
              onClick={allDone}
              className="w-full bg-navy hover:bg-navy-hover text-white rounded-button py-[13px] text-15 font-medium disabled:opacity-60"
            >
              All done — let&apos;s go
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={skipStep3}
              className="w-full text-12 text-content-secondary py-1"
            >
              I&apos;ll add people later
            </button>
          </div>
        </>
      )}
    </div>
  )
}

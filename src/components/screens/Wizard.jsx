import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowLeft, Sparkles } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useHousehold } from '../../hooks/useHousehold'
import { useTemplates } from '../../hooks/useTemplates'
import { supabase } from '../../lib/supabase'
import { createTripFromWizard } from '../../lib/tripService'
import StepIndicator from '../wizard/StepIndicator'
import Step1Template from '../wizard/Step1Template'
import Step2Travellers from '../wizard/Step2Travellers'
import Step3Details from '../wizard/Step3Details'
import Step4Suggestions from '../wizard/Step4Suggestions'

function mapAiToWizardSuggestions(apiList, travellerMembers) {
  const ids = travellerMembers.map(m => m.id)
  return apiList.map((s, i) => {
    let assigned = []
    if (s.assignToAll) {
      assigned = [...ids]
    } else {
      for (const n of s.memberNames || []) {
        const m = travellerMembers.find(
          t => t.name.trim().toLowerCase() === String(n).trim().toLowerCase()
        )
        if (m) assigned.push(m.id)
      }
      if (assigned.length === 0) assigned = [...ids]
    }
    return {
      id:                 `ai-${i}-${Date.now()}`,
      label:              s.label,
      reason:             s.reason,
      category:           s.category || 'Other',
      memberIds:          ids,
      hasAllChip:         true,
      assignedTo:         assigned,
      checked:            true,
      personSpecificNote: s.personSpecificNote,
    }
  })
}

export default function Wizard() {
  const { household, user }     = useAuth()
  const navigate                = useNavigate()
  const { members, loading: membersLoading }     = useHousehold(household?.id)
  const { templates, loading: templatesLoading } = useTemplates(household?.id)

  const [step, setStep]                         = useState(1)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [selectedTravellers, setSelectedTravellers] = useState(new Set())
  const [suggestions, setSuggestions]           = useState([])
  const [aiLoading, setAiLoading]             = useState(false)
  const [aiError, setAiError]                 = useState(false)
  const [generating, setGenerating]           = useState(false)
  const [tripFields, setTripFields]           = useState({
    destination: '',
    datesFrom:   '',
    datesTo:     '',
    weather:     '',
    tripType:    '',
  })
  const [fieldErrors, setFieldErrors]         = useState({})
  const aiMetaRef = useRef({ promptSent: '', responseRaw: '', total: 0 })
  const fetchStartedStepRef = useRef(0)
  const [step4Ready, setStep4Ready] = useState(false)

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id)
    }
  }, [templates, selectedTemplateId])

  useEffect(() => {
    if (members.length > 0 && selectedTravellers.size === 0) {
      setSelectedTravellers(new Set(members.map(m => m.id)))
    }
  }, [members, selectedTravellers.size])

  const travellerMembers = members.filter(m => selectedTravellers.has(m.id))

  const loadStep4Ai = useCallback(async () => {
    if (!selectedTemplateId || travellerMembers.length === 0) return
    setStep4Ready(false)
    setAiLoading(true)
    setAiError(false)
    setSuggestions([])

    const { data: baseRows, error: bErr } = await supabase
      .from('template_items')
      .select('label, category')
      .eq('template_id', selectedTemplateId)

    if (bErr) {
      setAiLoading(false)
      setAiError(true)
      setStep4Ready(true)
      return
    }

    const tripContext = {
      destination: tripFields.destination.trim(),
      datesFrom:   tripFields.datesFrom,
      datesTo:     tripFields.datesTo,
      weather:     tripFields.weather.trim(),
      tripType:    tripFields.tripType.trim(),
      travellers:  travellerMembers.map(m => ({
        name: m.name,
        role: m.role,
        age:  m.age,
      })),
    }

    let json
    try {
      const res = await fetch('/api/suggest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          tripContext,
          baseItems: baseRows || [],
        }),
      })
      json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Request failed')
    } catch {
      setAiLoading(false)
      setAiError(true)
      aiMetaRef.current = { promptSent: '', responseRaw: '', total: 0 }
      setStep4Ready(true)
      return
    }

    aiMetaRef.current = {
      promptSent:  json.promptSent || '',
      responseRaw: json.responseRaw || '',
      total:       (json.suggestions || []).length,
    }

    const mapped = mapAiToWizardSuggestions(json.suggestions || [], travellerMembers)
    setSuggestions(mapped)
    setAiLoading(false)
    setStep4Ready(true)
  }, [selectedTemplateId, travellerMembers, tripFields])

  useEffect(() => {
    if (step !== 4) {
      if (step < 4) fetchStartedStepRef.current = 0
      return
    }
    if (fetchStartedStepRef.current === 4) return
    fetchStartedStepRef.current = 4
    loadStep4Ai()
  }, [step, loadStep4Ai])

  function goNext() {
    if (step === 3) {
      const e = {}
      if (!tripFields.destination.trim()) e.destination = 'Required'
      if (!tripFields.datesFrom) e.dates = 'Start date required'
      if (!tripFields.datesTo) e.dates = e.dates || 'End date required'
      if (tripFields.datesFrom && tripFields.datesTo && tripFields.datesTo < tripFields.datesFrom) {
        e.dates = 'End date must be on or after start'
      }
      if (!tripFields.weather.trim()) e.weather = 'Required'
      if (!tripFields.tripType.trim()) e.tripType = 'Required'
      setFieldErrors(e)
      if (Object.keys(e).length) return
    }
    if (step === 2 && selectedTravellers.size === 0) return
    setStep(s => Math.min(s + 1, 4))
  }

  function goBack() {
    if (step === 1) navigate('/', { state: { direction: 'back' } })
    else {
      if (step === 4) fetchStartedStepRef.current = 0
      setStep(s => s - 1)
    }
  }

  const toggleTraveller = (id) => {
    setSelectedTravellers(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSuggestion = (id) =>
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s))

  const toggleAssign = (suggId, memberId) =>
    setSuggestions(prev => prev.map(s => {
      if (s.id !== suggId) return s
      const next = s.assignedTo.includes(memberId)
        ? s.assignedTo.filter(x => x !== memberId)
        : [...s.assignedTo, memberId]
      return { ...s, assignedTo: next }
    }))

  const toggleAll = (suggId) =>
    setSuggestions(prev => prev.map(s => {
      if (s.id !== suggId) return s
      const allSelected = s.memberIds.every(id => s.assignedTo.includes(id))
      return { ...s, assignedTo: allSelected ? [] : [...s.memberIds] }
    }))

  const changeTripField = (key, value) => {
    setTripFields(f => ({ ...f, [key]: value }))
    setFieldErrors(e => {
      const n = { ...e }
      delete n[key]
      if (key.startsWith('dates')) delete n.dates
      return n
    })
  }

  async function generateTrip(suggestionsOverride = null) {
    if (!household?.id || !user?.id || !selectedTemplateId) return
    if (selectedTravellers.size === 0) return

    setGenerating(true)
    const sugg = suggestionsOverride ?? suggestions
    const accepted = sugg.filter(s => s.checked).length
    const total    = sugg.length

    try {
      const { tripId } = await createTripFromWizard({
        householdId:   household.id,
        userId:        user.id,
        templateId:    selectedTemplateId,
        memberIds:     [...selectedTravellers],
        destination:   tripFields.destination.trim(),
        datesFrom:     tripFields.datesFrom,
        datesTo:       tripFields.datesTo,
        weather:       tripFields.weather.trim(),
        tripType:      tripFields.tripType.trim(),
        suggestions:   sugg,
        aiLog: {
          promptSent:          aiMetaRef.current.promptSent || '(skipped or failed)',
          responseRaw:         aiMetaRef.current.responseRaw || '',
          suggestionsAccepted: accepted,
          suggestionsTotal:    total,
        },
      })
      navigate(`/trips/${tripId}`, { state: { direction: 'forward' } })
    } catch (err) {
      console.error(err)
      alert(err.message || 'Could not create trip')
    }
    setGenerating(false)
  }

  const skipAiAndGenerate = async () => {
    setSuggestions([])
    setAiError(false)
    await generateTrip([])
  }

  const kidCount = [...selectedTravellers].filter(id =>
    members.find(m => m.id === id)?.role === 'kid'
  ).length

  const suggestionSubtitle = `Based on ${tripFields.destination.trim() || 'your trip'}${kidCount > 0 ? ` with ${kidCount} kid${kidCount !== 1 ? 's' : ''}` : ''}.`

  const isAmberCTA = step === 4
  const ctaLabel   = step === 1 ? "Next — Who's coming"
    : step === 2 ? 'Next — Trip details'
    : step === 3 ? 'Next — Review suggestions'
    : 'Generate all checklists'

  const dataLoading = membersLoading || templatesLoading

  return (
    <div className="flex flex-col h-screen bg-page">

      <div className="flex-none flex items-center justify-between px-4 pt-4 pb-2">
        {step === 1 ? (
          <>
            <button type="button" onClick={goBack} className="text-13 text-content-secondary">Cancel</button>
            <button
              type="button"
              onClick={() => navigate('/', { state: { direction: 'back' } })}
              className="text-content-secondary"
            >
              <X size={20} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-13"
            style={{ color: '#2d6fb5' }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}
      </div>

      <StepIndicator currentStep={step} totalSteps={4} />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div key={step} className="step-fade-in">
          {step === 1 && (
            dataLoading ? (
              <LoadingPlaceholder label="Loading templates…" />
            ) : (
              <Step1Template
                templates={templates}
                selectedId={selectedTemplateId}
                onSelect={setSelectedTemplateId}
              />
            )
          )}
          {step === 2 && (
            dataLoading ? (
              <LoadingPlaceholder label="Loading members…" />
            ) : (
              <Step2Travellers
                members={members}
                selected={selectedTravellers}
                onToggle={toggleTraveller}
              />
            )
          )}
          {step === 3 && (
            <Step3Details
              destination={tripFields.destination}
              datesFrom={tripFields.datesFrom}
              datesTo={tripFields.datesTo}
              weather={tripFields.weather}
              tripType={tripFields.tripType}
              onChange={changeTripField}
              errors={fieldErrors}
            />
          )}
          {step === 4 && (
            <>
              {aiLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Sparkles size={28} style={{ color: '#c47d1a' }} className="animate-pulse" />
                  <p className="text-14 text-content-secondary">Generating suggestions…</p>
                </div>
              )}
              {aiError && !aiLoading && (
                <div className="pt-4">
                  <p className="text-14 text-content-primary mb-2">Couldn&apos;t generate suggestions</p>
                  <p className="text-12 text-content-secondary mb-4">
                    You can skip and create checklists from your template only.
                  </p>
                  <button
                    type="button"
                    onClick={skipAiAndGenerate}
                    disabled={generating}
                    className="w-full py-2.5 rounded-button bg-navy text-white text-14 font-medium disabled:opacity-60"
                  >
                    Skip suggestions
                  </button>
                </div>
              )}
              {!aiLoading && !aiError && suggestions.length > 0 && (
                <Step4Suggestions
                  suggestions={suggestions}
                  members={members}
                  subtitle={suggestionSubtitle}
                  onToggle={toggleSuggestion}
                  onToggleAssign={toggleAssign}
                  onToggleAll={toggleAll}
                />
              )}
              {step4Ready && !aiLoading && !aiError && suggestions.length === 0 && (
                <p className="text-13 text-content-secondary pt-4">No extra suggestions — continue to generate.</p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-none px-4 py-3" style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
        <button
          type="button"
          disabled={
            generating ||
            (step === 2 && selectedTravellers.size === 0) ||
            (step === 4 && aiLoading)
          }
          onClick={step === 4 ? generateTrip : goNext}
          className={[
            'w-full flex items-center justify-center gap-2 rounded-button py-[13px] text-15 font-medium text-white transition-colors disabled:opacity-60',
            isAmberCTA ? 'cta-pulse' : '',
            isAmberCTA ? 'bg-amber hover:bg-amber/90' : 'bg-navy hover:bg-navy-hover',
          ].join(' ')}
          style={isAmberCTA ? { boxShadow: '0 2px 8px rgba(196,125,26,0.30)' } : {}}
        >
          {isAmberCTA && <Sparkles size={16} />}
          {generating ? 'Creating…' : ctaLabel}
        </button>
      </div>
    </div>
  )
}

function LoadingPlaceholder({ label }) {
  return (
    <div className="pt-6 flex justify-center">
      <p className="text-13 text-content-hint animate-pulse">{label}</p>
    </div>
  )
}

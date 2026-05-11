import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowLeft, Sparkles } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useHousehold } from '../../hooks/useHousehold'
import { useTemplates } from '../../hooks/useTemplates'
import StepIndicator from '../wizard/StepIndicator'
import Step1Template from '../wizard/Step1Template'
import Step2Travellers from '../wizard/Step2Travellers'
import Step3Details from '../wizard/Step3Details'
import Step4Suggestions from '../wizard/Step4Suggestions'
import { DEMO_SUGGESTIONS } from '../../data/demo'

// DEMO SCAFFOLDING — DEMO_SUGGESTIONS replaced in Module 9 when /api/suggest is wired up.
// Deletion checklist for Module 9:
//   [ ] Remove DEMO_SUGGESTIONS import and initSuggestions()
//   [ ] Step 4 POSTs to /api/suggest and renders live response

function initSuggestions() {
  return DEMO_SUGGESTIONS.map(s => ({
    ...s,
    checked:    s.defaultChecked,
    assignedTo: [...s.defaultAssignedTo],
  }))
}

export default function Wizard() {
  const { household }  = useAuth()
  const navigate       = useNavigate()
  const { members, loading: membersLoading }     = useHousehold(household?.id)
  const { templates, loading: templatesLoading } = useTemplates(household?.id)

  const [step, setStep]                         = useState(1)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [selectedTravellers, setSelectedTravellers] = useState(new Set())
  const [suggestions, setSuggestions]           = useState(initSuggestions)

  // Set defaults once data loads
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

  // ── Navigation ──────────────────────────────────────────────
  function goNext() { setStep(s => Math.min(s + 1, 4)) }
  function goBack() {
    if (step === 1) navigate('/', { state: { direction: 'back' } })
    else setStep(s => s - 1)
  }

  // ── Traveller toggle ─────────────────────────────────────────
  const toggleTraveller = (id) => {
    setSelectedTravellers(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Suggestion handlers ──────────────────────────────────────
  const toggleSuggestion = (id) =>
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s))

  const toggleAssign = (suggId, memberId) =>
    setSuggestions(prev => prev.map(s => {
      if (s.id !== suggId) return s
      const next = s.assignedTo.includes(memberId)
        ? s.assignedTo.filter(id => id !== memberId)
        : [...s.assignedTo, memberId]
      return { ...s, assignedTo: next }
    }))

  const toggleAll = (suggId) =>
    setSuggestions(prev => prev.map(s => {
      if (s.id !== suggId) return s
      const allSelected = s.memberIds.every(id => s.assignedTo.includes(id))
      return { ...s, assignedTo: allSelected ? [] : [...s.memberIds] }
    }))

  // ── Derived ─────────────────────────────────────────────────
  const kidCount = [...selectedTravellers].filter(id => {
    return members.find(m => m.id === id)?.role === 'kid'
  }).length

  const suggestionSubtitle = `Based on your trip${kidCount > 0 ? ` with ${kidCount} kid${kidCount !== 1 ? 's' : ''}` : ''}.`

  const isAmberCTA = step === 4
  const ctaLabel   = step === 1 ? "Next — Who's coming"
    : step === 2 ? 'Next — Trip details'
    : step === 3 ? 'Next — Review suggestions'
    : 'Generate all checklists'

  const dataLoading = membersLoading || templatesLoading

  return (
    <div className="flex flex-col h-screen bg-page">

      {/* ── Top bar ──────────────────────────────────────── */}
      <div className="flex-none flex items-center justify-between px-4 pt-4 pb-2">
        {step === 1 ? (
          <>
            <button onClick={goBack} className="text-13 text-content-secondary">Cancel</button>
            <button
              onClick={() => navigate('/', { state: { direction: 'back' } })}
              className="text-content-secondary"
            >
              <X size={20} />
            </button>
          </>
        ) : (
          <button
            onClick={goBack}
            className="flex items-center gap-1 text-13"
            style={{ color: '#2d6fb5' }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}
      </div>

      {/* ── Step indicator ───────────────────────────────── */}
      <StepIndicator currentStep={step} totalSteps={4} />

      {/* ── Scrollable content ───────────────────────────── */}
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
          {step === 3 && <Step3Details />}
          {step === 4 && (
            <Step4Suggestions
              suggestions={suggestions}
              members={members}
              subtitle={suggestionSubtitle}
              onToggle={toggleSuggestion}
              onToggleAssign={toggleAssign}
              onToggleAll={toggleAll}
            />
          )}
        </div>
      </div>

      {/* ── Sticky bottom CTA ────────────────────────────── */}
      <div className="flex-none px-4 py-3" style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
        <button
          onClick={step === 4 ? () => navigate('/', { state: { direction: 'back' } }) : goNext}
          className={[
            'w-full flex items-center justify-center gap-2 rounded-button py-[13px] text-15 font-medium text-white transition-colors',
            isAmberCTA ? 'cta-pulse' : '',
            isAmberCTA ? 'bg-amber hover:bg-amber/90' : 'bg-navy hover:bg-navy-hover',
          ].join(' ')}
          style={isAmberCTA ? { boxShadow: '0 2px 8px rgba(196,125,26,0.30)' } : {}}
        >
          {isAmberCTA && <Sparkles size={16} />}
          {ctaLabel}
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

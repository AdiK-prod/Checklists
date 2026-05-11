import { useState } from 'react'
import { X, ArrowLeft, Sparkles } from 'lucide-react'
import StepIndicator from '../wizard/StepIndicator'
import Step1Template from '../wizard/Step1Template'
import Step2Travellers from '../wizard/Step2Travellers'
import Step3Details from '../wizard/Step3Details'
import Step4Suggestions from '../wizard/Step4Suggestions'
import { TEMPLATES } from '../../data/templates'
import { HOUSEHOLD } from '../../data/household'
import { DEMO_SUGGESTIONS } from '../../data/demo'

// DEMO SCAFFOLDING — HOUSEHOLD/TEMPLATES/DEMO_SUGGESTIONS replaced in Module 7–9

function initSuggestions() {
  return DEMO_SUGGESTIONS.map(s => ({
    ...s,
    checked: s.defaultChecked,
    assignedTo: [...s.defaultAssignedTo],
  }))
}

export default function Wizard({ navigate, onGenerate }) {
  const [step, setStep] = useState(1)
  const [selectedTemplateId, setSelectedTemplateId] = useState('template-flight')
  const [selectedTravellers, setSelectedTravellers] = useState(
    new Set(HOUSEHOLD.members.map(m => m.id))
  )
  const [suggestions, setSuggestions] = useState(initSuggestions)

  // ── Navigation ──────────────────────────────────────────────
  function goNext() { setStep(s => Math.min(s + 1, 4)) }
  function goBack() {
    if (step === 1) navigate.toDashboard()
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
    const m = HOUSEHOLD.members.find(m => m.id === id)
    return m?.role === 'kid'
  }).length

  const suggestionSubtitle = `Based on Barcelona in July with ${kidCount} kid${kidCount !== 1 ? 's' : ''}.`

  const isAmberCTA = step === 4
  const ctaLabel = step === 1 ? "Next — Who's coming"
    : step === 2 ? 'Next — Trip details'
    : step === 3 ? 'Next — Review suggestions'
    : 'Generate all checklists'

  return (
    <div className="flex flex-col h-screen bg-page">

      {/* ── Top bar ──────────────────────────────────────── */}
      <div className="flex-none flex items-center justify-between px-4 pt-4 pb-2">
        {step === 1 ? (
          <>
            <button onClick={goBack} className="text-13 text-content-secondary">
              Cancel
            </button>
            <button onClick={navigate.toDashboard} className="text-content-secondary">
              <X size={20} />
            </button>
          </>
        ) : (
          <button onClick={goBack} className="flex items-center gap-1 text-13" style={{ color: '#2d6fb5' }}>
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
            <Step1Template
              templates={TEMPLATES}
              selectedId={selectedTemplateId}
              onSelect={setSelectedTemplateId}
            />
          )}
          {step === 2 && (
            <Step2Travellers
              members={HOUSEHOLD.members}
              selected={selectedTravellers}
              onToggle={toggleTraveller}
            />
          )}
          {step === 3 && <Step3Details />}
          {step === 4 && (
            <Step4Suggestions
              suggestions={suggestions}
              members={HOUSEHOLD.members}
              subtitle={suggestionSubtitle}
              onToggle={toggleSuggestion}
              onToggleAssign={toggleAssign}
              onToggleAll={toggleAll}
            />
          )}
        </div>
      </div>

      {/* ── Sticky bottom action ─────────────────────────── */}
      <div className="flex-none px-4 py-3" style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
        <button
          onClick={step === 4 ? onGenerate : goNext}
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

import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useHousehold } from '../../hooks/useHousehold'
import { useTemplates } from '../../hooks/useTemplates'
import { useEnsureTemplatesSeeded } from '../../hooks/useEnsureTemplatesSeeded'
import { createTripFromWizard } from '../../lib/tripService'
import { fetchWeather } from '../../lib/weatherService'
import { asArray } from '../../lib/transforms'
import StepIndicator from '../wizard/StepIndicator'
import Step1Template from '../wizard/Step1Template'
import Step2Travellers from '../wizard/Step2Travellers'
import Step3Details from '../wizard/Step3Details'

// TODO: Re-enable AI suggestions — see /api/suggest.js
// import { supabase } from '../../lib/supabase'
// import { fetchTemplateTree, templateTreeToBaseItems } from '../../lib/tripService'
// import { weatherSummaryForTrip } from '../../lib/tripWeatherSummary'
// import Step4Suggestions from '../wizard/Step4Suggestions'
// function mapAiToWizardSuggestions(apiList, travellerMembers) { ... }

export default function Wizard() {
  const { household, user }     = useAuth()
  const navigate                = useNavigate()
  const { members, loading: membersLoading }    = useHousehold(household?.id)
  const { templates, loading: templatesLoading, refetch: refetchTemplates } = useTemplates(household?.id)
  useEnsureTemplatesSeeded(
    household?.id,
    members,
    membersLoading,
    templates,
    templatesLoading,
    refetchTemplates,
  )

  const [step, setStep]                         = useState(1)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [selectedTravellers, setSelectedTravellers] = useState(new Set())
  const [generating, setGenerating]           = useState(false)
  const [tripFields, setTripFields]           = useState({
    destination: '',
    datesFrom:   '',
    datesTo:     '',
    tripType:    '',
  })
  const [weatherForecast, setWeatherForecast] = useState(null)
  const [fieldErrors, setFieldErrors]         = useState({})
  const generateInFlightRef                   = useRef(false)
  const weatherDebounceRef                    = useRef(null)

  // TODO: Re-enable AI suggestions — see /api/suggest.js
  // const [suggestions, setSuggestions] = useState([])
  // const [aiLoading, setAiLoading] = useState(false)
  // const [aiError, setAiError] = useState(false)
  // const derivedWeather = useMemo(() => weatherSummaryForTrip(tripFields.datesFrom, tripFields.datesTo), [...])
  // const aiMetaRef = useRef({ promptSent: '', responseRaw: '', total: 0 })
  // const fetchStartedStepRef = useRef(0)
  // const [step4Ready, setStep4Ready] = useState(false)
  // const loadStep4Ai = useCallback(async () => { ... }, [...])
  // useEffect(() => { if (step !== 4) { ... } loadStep4Ai() }, [step, loadStep4Ai])

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

  function goNext() {
    if (step === 3) {
      const e = {}
      if (!tripFields.destination.trim()) e.destination = 'Required'
      if (!tripFields.datesFrom) e.dates = 'Start date required'
      if (!tripFields.datesTo) e.dates = e.dates || 'End date required'
      if (tripFields.datesFrom && tripFields.datesTo && tripFields.datesTo < tripFields.datesFrom) {
        e.dates = 'End date must be on or after start'
      }
      setFieldErrors(e)
      if (Object.keys(e).length) return
    }
    if (step === 2 && selectedTravellers.size === 0) return
    setStep(s => Math.min(s + 1, 3))
  }

  function goBack() {
    if (step === 1) navigate('/', { state: { direction: 'back' } })
    else setStep(s => s - 1)
  }

  const toggleTraveller = (id) => {
    setSelectedTravellers(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const triggerWeatherFetch = (destination, datesFrom, datesTo) => {
    if (weatherDebounceRef.current) clearTimeout(weatherDebounceRef.current)
    if (!destination.trim()) return
    weatherDebounceRef.current = setTimeout(async () => {
      try {
        const { forecast } = await fetchWeather({
          destination: destination.trim(),
          dateFrom: datesFrom,
          dateTo:   datesTo,
        })
        setWeatherForecast(forecast?.length ? forecast : null)
      } catch {
        // Silent — weather is non-blocking
      }
    }, 500)
  }

  const changeTripField = (key, value) => {
    setTripFields(f => {
      const next = { ...f, [key]: value }
      if (key === 'destination' || key === 'datesFrom' || key === 'datesTo') {
        triggerWeatherFetch(
          key === 'destination' ? value : next.destination,
          key === 'datesFrom'   ? value : next.datesFrom,
          key === 'datesTo'     ? value : next.datesTo,
        )
      }
      return next
    })
    setFieldErrors(e => {
      const n = { ...e }
      delete n[key]
      if (key.startsWith('dates')) delete n.dates
      return n
    })
  }

  async function generateTrip() {
    if (!household?.id || !user?.id || !selectedTemplateId) return
    if (selectedTravellers.size === 0) return
    if (generateInFlightRef.current) return

    // Validate Step 3 before generating
    const e = {}
    if (!tripFields.destination.trim()) e.destination = 'Required'
    if (!tripFields.datesFrom) e.dates = 'Start date required'
    if (!tripFields.datesTo) e.dates = e.dates || 'End date required'
    if (tripFields.datesFrom && tripFields.datesTo && tripFields.datesTo < tripFields.datesFrom) {
      e.dates = 'End date must be on or after start'
    }
    setFieldErrors(e)
    if (Object.keys(e).length) return

    generateInFlightRef.current = true
    setGenerating(true)

    try {
      const { tripId } = await createTripFromWizard({
        householdId:   household.id,
        userId:        user.id,
        templateId:    selectedTemplateId,
        memberIds:     [...selectedTravellers],
        destination:   tripFields.destination.trim(),
        datesFrom:     tripFields.datesFrom,
        datesTo:       tripFields.datesTo,
        weather:       weatherForecast ? { forecast: weatherForecast } : null,
        tripType:      tripFields.tripType.trim(),
        // TODO: Re-enable AI suggestions — see /api/suggest.js
        // suggestions: [],
        // aiLog: { promptSent: '', responseRaw: '', suggestionsAccepted: 0, suggestionsTotal: 0 },
      })
      navigate(`/trips/${tripId}`, { state: { direction: 'forward' } })
    } catch (err) {
      console.error(err)
      const msg =
        err?.message ||
        err?.error_description ||
        (typeof err?.details === 'string' && err.details) ||
        (typeof err?.hint === 'string' && err.hint) ||
        'Could not create trip'
      alert(msg)
    } finally {
      generateInFlightRef.current = false
      setGenerating(false)
    }
  }

  const dataLoading = membersLoading || templatesLoading
  const contentScroll = step === 2 || step === 3
  const isGenerateStep = step === 3

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden bg-page">

      <div className="flex-none flex items-center justify-between px-4 pt-3 pb-1.5">
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

      <StepIndicator currentStep={step} totalSteps={3} />

      <div
        className={[
          'flex-1 min-h-0 px-4',
          contentScroll ? 'overflow-y-auto' : 'overflow-hidden flex flex-col',
        ].join(' ')}
      >
        <div key={step} className={['step-fade-in', contentScroll ? '' : 'flex-1 min-h-0 flex flex-col overflow-hidden'].filter(Boolean).join(' ')}>
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
              tripType={tripFields.tripType}
              onChange={changeTripField}
              errors={fieldErrors}
            />
          )}
        </div>
      </div>

      <div className="flex-none px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
        <button
          type="button"
          disabled={
            generating ||
            (step === 2 && selectedTravellers.size === 0)
          }
          onClick={isGenerateStep ? generateTrip : goNext}
          className="w-full flex items-center justify-center gap-2 rounded-button py-[13px] text-btn font-medium text-white bg-navy hover:bg-navy-hover transition-colors disabled:opacity-60"
        >
          {generating
            ? 'Creating…'
            : isGenerateStep
              ? 'Generate all checklists'
              : step === 1
                ? "Next — Who's coming"
                : 'Next — Trip details'
          }
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

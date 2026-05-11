import { Fragment } from 'react'
import { Check } from 'lucide-react'

export default function StepIndicator({ currentStep, totalSteps = 4 }) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1)

  return (
    <div className="flex items-center px-8 py-3">
      {steps.map((step, idx) => (
        <Fragment key={step}>
          {idx > 0 && (
            // Line: green when step to the left (= idx, 1-based) is done
            <div
              className="flex-1 h-px mx-1"
              style={{ backgroundColor: currentStep > idx ? '#2a9d6e' : '#e0ddd8' }}
            />
          )}
          <StepDot step={step} currentStep={currentStep} />
        </Fragment>
      ))}
    </div>
  )
}

function StepDot({ step, currentStep }) {
  const isDone   = currentStep > step
  const isActive = currentStep === step

  if (isDone) {
    return (
      <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 bg-success">
        <Check size={12} color="white" strokeWidth={3} />
      </div>
    )
  }
  if (isActive) {
    return (
      <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 bg-navy">
        <span className="text-11 font-medium text-white leading-none">{step}</span>
      </div>
    )
  }
  return (
    <div
      className="w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0"
      style={{ border: '1.5px solid #e0ddd8' }}
    >
      <span className="text-11 font-medium text-content-hint leading-none">{step}</span>
    </div>
  )
}

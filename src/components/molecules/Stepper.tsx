/**
 * @fileoverview Stepper molecule - multi-step wizard indicator
 *
 * @description Horizontal stepper showing step labels and current progress.
 *              Optional click on completed steps to go back (e.g. wizard flow).
 *
 * @purpose Reusable step indicator for wizards; follows MRE design tokens.
 *
 * @relatedFiles
 * - docs/architecture/atomic-design-system.md
 */

"use client"

export interface StepperStep {
  id?: string
  label: string
}

export interface StepperProps {
  steps: StepperStep[]
  currentStep: number
  onStepClick?: (index: number) => void
  "aria-label"?: string
}

export default function Stepper({
  steps,
  currentStep,
  onStepClick,
  "aria-label": ariaLabel = "Progress",
}: StepperProps) {
  return (
    <nav
      className="flex items-center justify-center gap-0 sm:gap-2"
      aria-label={ariaLabel}
      role="navigation"
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        const isClickable = onStepClick && isCompleted
        const stepNumber = index + 1

        return (
          <div key={step.id ?? index} className="flex items-center">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`${step.label}${isCurrent ? ", current step" : isCompleted ? ", completed" : ""}`}
              className={`
                flex items-center gap-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]
                ${isClickable ? "cursor-pointer hover:opacity-90" : "cursor-default"}
                ${isCurrent ? "text-[var(--token-accent)]" : ""}
                ${isCompleted && !isClickable ? "text-[var(--token-text-secondary)]" : ""}
                ${index > currentStep ? "text-[var(--token-text-muted)]" : ""}
              `}
            >
              <span
                className={`
                  flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium
                  ${isCurrent ? "border-[var(--token-accent)] bg-[var(--token-accent)]/10 text-[var(--token-accent)]" : ""}
                  ${isCompleted && !isCurrent ? "border-[var(--token-accent)] bg-[var(--token-accent)]/20 text-[var(--token-text-primary)]" : ""}
                  ${index > currentStep ? "border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-muted)]" : ""}
                `}
                aria-hidden
              >
                {isCompleted && !isCurrent ? "✓" : stepNumber}
              </span>
              <span className="hidden text-sm font-medium sm:inline">{step.label}</span>
            </button>
            {index < steps.length - 1 && (
              <div
                className="mx-1 h-0.5 w-4 sm:mx-2 sm:w-6"
                aria-hidden
              >
                <div
                  className={`
                    h-full rounded-full
                    ${index < currentStep ? "bg-[var(--token-accent)]/50" : "bg-[var(--token-border-default)]"}
                  `}
                />
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

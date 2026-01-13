/**
 * Placeholder Comparisons tab content.
 */

export interface ComparisonsTabProps {
  selectedClass: string | null
}

export default function ComparisonsTab({ selectedClass }: ComparisonsTabProps) {
  return (
    <div className="text-center py-12" role="tabpanel" id="tabpanel-comparisons" aria-labelledby="tab-comparisons">
      <p className="text-sm text-[var(--token-text-secondary)]">
        Driver comparisons will appear here soon. Select drivers on the Drivers tab to prepare your comparisons.
      </p>
      {selectedClass && (
        <p className="text-xs text-[var(--token-text-secondary)] mt-2">
          Filtered by class: {selectedClass}
        </p>
      )}
    </div>
  )
}

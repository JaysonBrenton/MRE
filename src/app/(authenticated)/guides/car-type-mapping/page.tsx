/**
 * @fileoverview Car type mapping guide page
 *
 * @created 2026-04-11
 * @creator Jayson Brenton
 * @lastModified 2026-04-11
 *
 * @description User guide for mapping event class text to canonical vehicle classes
 *
 * @purpose Explains why car type mapping exists, how account-wide rules work, and how
 *          to use the Event Analysis modal (suggestions, manual mapping, applied rules).
 */

import Breadcrumbs from "@/components/atoms/Breadcrumbs"

export default async function CarTypeMappingGuidePage() {
  return (
    <section className="content-wrapper w-full min-w-0">
      <Breadcrumbs
        items={[
          { label: "My Event Analysis", href: "/eventAnalysis" },
          { label: "Guides", href: "/guides" },
          { label: "Car type mapping" },
        ]}
      />
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-[var(--token-text-primary)]">
          Car type mapping guide
        </h1>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Map raw event class names from schedules and results to MRE&apos;s vehicle classes so your
          analysis stays consistent everywhere.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Why this feature exists
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Schedules and timing systems rarely use one standard phrase for the same class. One
            event might list &quot;1/8 Nitro Buggy,&quot; another &quot;1/8th Nitro Buggy,&quot; or
            a shortened label. If MRE treated every spelling as a different class, you would keep
            re-interpreting the same real-world category, and your drivers and charts would not line
            up across events.
          </p>
          <p className="text-[var(--token-text-secondary)]">
            <strong className="text-[var(--token-text-primary)]">Car type mapping</strong> records
            your decision: this piece of event text means this canonical vehicle class in MRE. Those
            choices are stored as{" "}
            <strong className="text-[var(--token-text-primary)]">account-wide</strong> rules, so
            when similar text appears in another event, you are not starting from zero.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            What you are mapping
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>
              <strong className="text-[var(--token-text-primary)]">Event class</strong> is the class
              string attached to races in the imported analysis (what appeared on the schedule or in
              results).
            </li>
            <li>
              <strong className="text-[var(--token-text-primary)]">Vehicle class</strong> is a leaf
              in MRE&apos;s car taxonomy (for example a specific nitro buggy or touring class). That
              is the label MRE uses for filtering, comparisons, and consistency across events.
            </li>
            <li>
              A <strong className="text-[var(--token-text-primary)]">mapping</strong> (rule) ties
              one event class string to one vehicle class. Rules apply by matching that text when it
              appears again.
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Opening the Car type mapping modal
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            From Event Analysis, open the event actions menu (three dots) for the selected event and
            choose <strong className="text-[var(--token-text-primary)]">Map car types</strong>. The
            modal works on the event you have loaded: it lists classes found in that event&apos;s
            analysis and helps you confirm or add mappings.
          </p>
          <p className="text-[var(--token-text-secondary)]">
            The layout is: a short intro (with a link to this guide), then manual mapping, then
            applied mappings for this event, then suggested mappings.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Map an unmapped event class (manual)
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            When there is no suggestion, or you need a different vehicle class than the suggestion,
            use{" "}
            <strong className="text-[var(--token-text-primary)]">
              Map an unmapped event class
            </strong>
            . Pick an event class from the dropdown (only classes that still need a mapping are
            listed), choose the correct vehicle class, then click{" "}
            <strong className="text-[var(--token-text-primary)]">Save mapping</strong>.
          </p>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Manual saves are the same account-wide rules as suggestions: they apply whenever that
            exact event class text appears in future analyses.
          </p>
          <p className="text-[var(--token-text-secondary)]">
            Saved mappings apply account-wide whenever the same event class text appears in other
            events.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Applied mappings in this event
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            This section follows manual mapping. It lists rules from your account that actually
            match this event&apos;s races (for example class name rules that apply to classes
            present here). It is a recap of what is in effect for this analysis, not every rule you
            have ever saved for other wording.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Suggested mappings
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            For event classes that are not mapped yet, MRE may suggest a vehicle class based on
            keywords in the class name and related fields (for example race labels or session type).
            Each row shows the suggested vehicle class, the event class text, and a short match note
            explaining why that suggestion was made.
          </p>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Use <strong className="text-[var(--token-text-primary)]">Use suggestion</strong> when
            the suggestion is correct. That creates or updates your account rule for that event
            class string. If a class already has a mapping, it no longer appears in this suggestions
            list.
          </p>
          <p className="text-[var(--token-text-secondary)]">
            You can collapse or expand the suggestions section. If there are no suggestions left for
            unmapped classes, use manual mapping above.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Account-wide rules
          </h2>
          <p className="mb-4 text-[var(--token-text-secondary)]">
            Mappings are stored per user account. Changing a mapping for a given event class string
            affects how that string is interpreted in other events when the same text appears, not
            only the event you are looking at now. That is what makes the workflow scalable: you
            decide once per distinct label, not once per event import.
          </p>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">Tips</h2>
          <ul className="list-disc space-y-2 pl-6 text-[var(--token-text-secondary)]">
            <li>
              Work through manual mapping and applied mappings first; then use suggested mappings
              when they look right (they are faster than manual entry for common patterns).
            </li>
            <li>
              If two events use slightly different strings for the same real class, you may need a
              separate mapping per string until they are normalized the same way upstream.
            </li>
            <li>
              After saving, refresh event data if you need the analysis to pick up taxonomy changes
              immediately (depending on how your data is loaded).
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--token-text-primary)]">
            Related guides
          </h2>
          <p className="text-[var(--token-text-secondary)]">
            For charts, sessions, and exports, see the{" "}
            <a href="/guides/event-analysis" className="text-[var(--token-accent)] hover:underline">
              Event Analysis guide
            </a>
            . For finding and importing events, see the{" "}
            <a href="/guides/event-search" className="text-[var(--token-accent)] hover:underline">
              Event Search guide
            </a>
            .
          </p>
        </section>
      </div>
    </section>
  )
}

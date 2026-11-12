import type { ReviewedSnapshotBundle } from '@/lib/platform/journey'

const count = (value: number) => value.toLocaleString('en-US')
const decimal = (value: number | null) => value === null ? 'Unknown' : value.toFixed(2)
const percent = (value: number) => `${(value * 100).toFixed(2)}%`
const signed = (value: number) => `${value > 0 ? '+' : ''}${decimal(value)}`
const reasons: Record<string, string> = { MISSING_DATES: 'Some daily dates are missing', MISSING_TOTALS: 'Property totals are missing', BOUNDED_SOURCE: 'A source reached the row limit', TOTALS_MISMATCH: 'Daily data and property totals disagree', CONFLICTING_ACTIVITY: 'Observed activity conflicts with property totals' }

export function SearchReportView({ review }: { review: ReviewedSnapshotBundle }) {
  const complete = (review.status === 'ready' || review.status === 'empty') && review.coverage.current.status === 'complete' && review.coverage.prior.status === 'complete' && !!review.totals.current.metrics && !!review.totals.prior.metrics
  const comparison = complete ? review.comparison : null
  const pages = [...review.snapshots.current.page.rows].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions || a.keys[0].localeCompare(b.keys[0])).slice(0, 10)
  return <div className="space-y-8">
    <section className="portal-card p-6 space-y-3" aria-labelledby="report-source">
      <p className="portal-eyebrow">PRIVATE GOOGLE SEARCH REPORT · V1</p>
      <h2 id="report-source" className="break-all text-2xl font-semibold">{review.selection.propertyId}</h2>
      <p>Source: Google Search Console · Web Search · final data only · no filters.</p>
      <p>Report review: <strong>{review.status}</strong>. All reporting dates use Pacific time (America/Los_Angeles).</p>
      <p className="portal-muted">{review.disclaimer}</p>
      {review.status === 'empty' && <p>Both complete periods report zero impressions. There are no page observations or review actions.</p>}
    </section>
    <section aria-labelledby="property-totals" className="space-y-4">
      <h2 id="property-totals" className="text-xl font-semibold">Property totals</h2>
      <p className="portal-muted">Fetched separately at property level. These are not sums of the page rows below.</p>
      <div className="grid gap-4 md:grid-cols-2">{(['current', 'prior'] as const).map(period => {
        const total = review.totals[period], coverage = review.coverage[period], metrics = total.metrics
        return <article key={period} className="portal-card p-6 space-y-4">
          <h3 className="font-semibold capitalize">{period} period</h3>
          <p>{review.windows[period].start} to {review.windows[period].end} · Pacific</p>
          <dl className="grid grid-cols-2 gap-4">{[
            ['Clicks', metrics ? count(metrics.clicks) : 'Unknown'], ['Impressions', metrics ? count(metrics.impressions) : 'Unknown'],
            ['CTR', metrics ? percent(metrics.ctr) : 'Unknown'], ['Average position', metrics ? decimal(metrics.position) : 'Unknown'],
          ].map(([label, value]) => <div key={label}><dt className="portal-muted text-sm">{label}</dt><dd className="text-2xl font-semibold">{value}</dd></div>)}</dl>
          <p>Totals: {total.status}. Source completeness: <strong>{coverage.status}</strong>.</p>
          {coverage.reasons.length > 0 && <ul className="list-disc pl-5">{coverage.reasons.map(reason => <li key={reason}>{reasons[reason] ?? reason}</li>)}</ul>}
          {coverage.missingDates.length > 0 && <details><summary>{coverage.missingDates.length} missing daily dates: unknown, not zero</summary><p className="mt-2 break-words">{coverage.missingDates.join(', ')}</p></details>}
          <details><summary>Source retrieval and scope</summary><ul className="mt-2 space-y-2">{(['aggregate', 'daily', 'page'] as const).map(grain => {
            const source = review.snapshots[period][grain]
            return <li key={grain}><strong>{grain === 'aggregate' ? 'Property totals' : grain === 'daily' ? 'Daily observations' : 'Available page rows'}:</strong> {source.rows.length} rows, {source.coverage}. Retrieved {new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(source.retrievedAt))} Pacific.
              {source.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</li>
          })}</ul></details>
        </article>
      })}</div>
    </section>
    <section className="portal-card p-6 space-y-3" aria-labelledby="report-comparison">
      <h2 id="report-comparison" className="text-xl font-semibold">Current versus prior</h2>
      {comparison ? <ul className="grid gap-3 sm:grid-cols-2"><li>Clicks: {signed(comparison.clicks.absolute)} ({comparison.clicks.relative === null ? 'relative change unavailable: zero baseline' : `${signed(comparison.clicks.relative * 100)}%`})</li><li>Impressions: {signed(comparison.impressions.absolute)} ({comparison.impressions.relative === null ? 'relative change unavailable: zero baseline' : `${signed(comparison.impressions.relative * 100)}%`})</li><li>CTR: {signed(comparison.ctrPercentagePoints)} percentage points</li><li>Average position: {comparison.positionChange === null ? 'Unknown' : signed(comparison.positionChange)} (lower is better)</li></ul> : <p>Comparison withheld. Both periods must have complete, consistent source data and available property totals. A row limit, missing dates or inconsistent observations prevents a reliable comparison.</p>}
    </section>
    <section className="space-y-4" aria-labelledby="report-pages">
      <h2 id="report-pages" className="text-xl font-semibold">Top available pages · current period</h2>
      <p className="portal-muted">Up to 10 retained page rows, ranked by clicks then impressions. Available rows are not exhaustive and do not establish total property coverage.</p>
      {pages.length ? <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><caption className="sr-only">Current-period available page observations</caption><thead><tr>{['Page', 'Clicks', 'Impressions', 'CTR', 'Average position'].map(label => <th scope="col" className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{pages.map(row => <tr key={row.keys[0]} className="border-t"><th scope="row" className="max-w-sm break-all p-3 font-normal">{row.keys[0]}</th><td className="p-3">{count(row.clicks)}</td><td className="p-3">{count(row.impressions)}</td><td className="p-3">{percent(row.ctr)}</td><td className="p-3">{decimal(row.position)}</td></tr>)}</tbody></table></div> : <p>No page observations returned. Missing rows do not establish zero activity.</p>}
    </section>
    <section className="space-y-4" aria-labelledby="report-actions"><h2 id="report-actions" className="text-xl font-semibold">Prioritized review actions</h2>
      <p className="portal-muted">Up to three evidence-based reviews, prioritized by observed impressions. These are not diagnoses or proof of leads, revenue, AI visibility or improvement.</p>
      {!complete ? <p>Actions withheld until both periods are complete and consistent.</p> : review.actions.length ? <ol className="space-y-4">{review.actions.slice(0, 3).map((action, index) => <li key={action.id} className="portal-card p-6 space-y-2"><h3 className="font-semibold">{index + 1}. {action.title}</h3><p className="break-all">{action.page}</p><p>{action.reason}</p><p className="portal-muted text-sm">Status: review needed · Rule version {action.ruleVersion}</p></li>)}</ol> : <p>No review actions met the rules for this report.</p>}
    </section>
  </div>
}

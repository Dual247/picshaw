# Showcase evidence audit

Reviewed on 2026-10-07 against `main` commit
`0f688e60e367c3c4135fb766c9de86e8c6760a2a`.

All tracked repository text and the three `public/images/project-*.png`
assets were checked. Project names and outcomes appeared only in
`components/WorkShowcase.tsx`; there were no supporting analytics,
case-study documents, client approvals, or explicit project destinations.
The preview images did not establish client identities, hosts, or results.

| Example | Unsupported claims removed | Current treatment |
| --- | --- | --- |
| Pacific Plumbing Co. | 47% more quote requests; quote requests nearly doubled within 60 days; retrospective client/rebuild story | Plumbing website concept; no destination or measured result |
| Glow Aesthetics LA | 3x consultation bookings; consultations tripled in the first month; retrospective client/rebuild story | Med spa website concept; no destination or measured result |
| Ember Kitchen | First-page Google ranking; #1 for “Silver Lake brunch”; retrospective client/rebuild story | Restaurant website concept; no destination or measured result |

The related `components/Hero.tsx` assertions “50+ LA businesses trust Picshaw”
and “Averaging 3x more leads after launch” also had no supporting records and
were replaced with service descriptions.

## Adding verified work

`lib/work-showcase.ts` is the project data source. A missing destination or
result is explicitly `null`; titles must never be transformed into domains.

- Add `destination` only after confirming the business identity, Picshaw's
  involvement, and approval to link the actual website. Supply the exact HTTPS
  `url`, approved display `host`, and evidence label, publicly reachable proof URL
  (or a local path served by the site), and review
  date. Check that the host matches the destination. A similarly named business
  or a responding domain does not establish a project relationship.
- Add `result` only when the cited material supports the precise claim. Record
  the baseline, comparison period, metric definition, and any relevant search
  query/location/date in that supporting material. Repeated marketing copy is
  not independent substantiation.
- Review section copy and image alt text when verified client work replaces
  concepts. Do not label a concept as a real case study.

The component shows a neutral, non-clickable preview label without a
destination, and renders measured results with their evidence links only when
the corresponding structured data exists.

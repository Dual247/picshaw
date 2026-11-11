# Measurement contract for the client portal

The portal must answer three practical questions: where the business appears, what changed on a comparable basis, and what work has been completed or is next. The source and its limits must remain visible.

## Keep three measurement sources separate

1. **Google Search performance**: the current Search Console adapter requests final Web-search data. It can report clicks, impressions, CTR and position for the selected property/window. It is not a dedicated generative-AI feed and cannot attribute leads or revenue by itself.
2. **Google AI impressions**: Google now documents a dedicated Search Console Generative AI performance report for AI Overviews and AI Mode. As reviewed on 2026-11-10, the public Search Analytics API documentation and discovery metadata do not expose a dedicated Generative AI type or endpoint. Do not invent a searchAppearance value or present the current Web API adapter as importing that report. Show unavailable/not connected until a supported import is implemented. Absence of public documentation is not proof that no private capability exists.
3. **Sampled answer visibility**: controlled prompt/location/engine/method observations. State the exact count and denominator, such as mentioned in 18 of 60 successful checks, and distinguish unsuccessful checks from genuine absence. Label synthetic examples as fictional. API model answers are not evidence of the consumer ChatGPT interface unless that interface was actually observed using a permitted method.

## Comparisons and evidence

- Compare only matching cohorts of prompt, location, engine/surface and collection method across the reported windows. Show coverage changes rather than attributing them to visibility gains.
- Separate branded accuracy checks from unbranded discovery prompts. A business named in the question is not an independent discovery result.
- Each observed answer needs prompt, business/location context, engine/surface/method, capture time, exact answer, citations and outcome. Missing evidence is missing evidence, not a zero score.
- Keep work completion separate from measurement changes. A completed action records a deliverable and owner; it does not establish causation or guarantee ranking, traffic or revenue improvement.
- Work ledger entries need status, owner, deliverable/evidence and a recheck date. In a sample workspace, these are examples, not claims that Picshaw performed real work.

## Import cautions

The Google AI report's help describes UI export. Displayed tables are limited, property chart totals can differ from page tables, and export can map suppressed/unknown display values to zero. A future importer must preserve those distinctions and not silently treat incomplete/suppressed cells as measured zero. No manual import or automated dedicated AI report sync exists in the current code.

## Sources reviewed

- Google AI report: https://support.google.com/webmasters/answer/16984139?hl=en
- Search Analytics API: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- Public discovery metadata (reviewed revision 20261108): https://www.googleapis.com/discovery/v1/apis/searchconsole/v1/rest

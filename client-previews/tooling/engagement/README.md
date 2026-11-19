# Required Picshaw outbound engagement tooling

Canonical `engagement.js` and `transport.js` originate from the tested Andy pilot, with a strict explicit canonical-path extension. No third-party browser SDK, dependency install, deployment, network send or lifecycle mutation occurs when building/installing. The adapter uses Vercel's inspectable collector protocol, not a documented stable browser API: reverify ingestion rather than assuming compatibility.

## Build and install

Run from repository root, Node 24:

```sh
node --test client-previews/tooling/engagement/*.test.js
node client-previews/tooling/engagement/install.mjs client-previews/<slug>
node client-previews/tooling/engagement/install.mjs client-previews/<slug> --check
(cd client-previews/<slug> && npm ci --ignore-scripts && npm test)
```

The installer reads the exact canonical URL from the immutable lifecycle. It accepts `/previews/<slug>/` or `/previews/<category>/<slug>/` only, with lowercase alphanumeric/hyphen segments and the final segment exactly matching the declared slug. No prefix matching, redirects, query strings, encoded segments, alternate hosts or inferred category paths. The installer supports the guarded buildless template only and refuses an unexpected CSP or route mapping. It is deterministic/idempotent. It preserves existing UI scripts, server gate, lifecycle and unrelated headers; review its three-file diff (`public/picshaw-engagement.js`, `public/index.html`, `vercel.json`). The public bundle must be committed alongside the preview, as projects have an empty build command. Never copy pilot-generated `append-production.js`, which contains Andy-specific constants. Never hand-edit generated output. Existing app-bundled tracking must be reconciled manually before installation, not stacked with this script.

The exact permitted CSP is exported as `CSP` in `install.mjs`. `connect-src` is only `https://www.picshaw.com/_vercel/insights/event`, not `*`, the full origin, `'self'`, a wildcard domain or additional collector. Forms retain `form-action 'none'`; scripts remain local only. Do not remove no-store or noindex headers. Do not modify the separate expired-response CSP.

## Publication and QA gate

1. Inspect the source diff and confirm immutable expiry/server gate unchanged. Run installer check, tracker tests and preview expiry tests. Inspect generated slug, canonical path and expiry; no placeholder or Andy identifier may remain.
2. Confirm deploy isolation before any operations ref movement. Publish only the approved preview source; do not merge into main or inadvertently redeploy other projects. Installation itself does not authorize publication.
3. Inspect desktop and mobile branded page. Disclosure/opt-out must be visible and usable; UI, keyboard tabs, local-only forms and no-overflow behavior must still work. Include new script in live asset/expiry verification.
4. Open the canonical route with `?picshaw_qa=1`. Verify zero request on load. Perform a harmless internal navigation/service-tab interaction or local-only demo submission; never trigger phone calls, SMS, emails or a real enquiry. Expect one `picshaw_preview_qa` per action category, with only `company`, `path`, `action` custom fields. Repeated category must not add events in that document. No production event is permitted in QA.
5. Inspect the collector request and response, then verify the corresponding QA event actually appears in the appropriate Vercel analytics project with the expected slug/path/action. Record observed evidence and latency, not just request status. If access or ingestion is blocked, report it; do not fabricate success or widen CSP.
6. Verify no requests on `?picshaw_no_track=1`, GPC/DNT, noncanonical origin, hidden/prerendered state, and automated production sessions. Use deterministic tests for the immutable cutoff, never a public override. Tests must still pass after the calendar moves beyond the pilot's expiry.
7. Keep QA separate from production reports. A production event requires a real trusted interaction in a normal browser without privacy opt-out, automation flags or QA query. Do not label test traffic as prospect interest. Never infer identity, unique visitor count or buying intent from these category events.

Save QA evidence in the preview's `docs/verification.json` or another non-public operational record, including bundle/source SHA, deployment, date, immutable expiry, privacy checks and ingestion outcome. No contact/sending/scheduling or new automation is part of this tooling.

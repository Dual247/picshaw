# Picshaw daily preview workflow

## Purpose and boundaries

Prepare **at least five new, qualified Los Angeles or Orange County prospect packages per Los Angeles calendar day**. Each completed package contains verified research, a tailored website concept on a Picshaw URL, a short saved Gmail draft using the approved **$250/month** offer, and a complete registry record.

This workflow is independent of the existing 20-per-day outreach task. Do not replace or change that task, count its work toward this target, or approach a business already covered by it. The Expo example is a bootstrap seed and never counts as a new daily prospect.

**No email sending or scheduling is authorized.** Save drafts only. Do not send follow-ups, publish comments, merge into main, or change a prospect's real website. Use the approved offer and scope; do not invent setup fees, contract terms, bundled services, rankings, traffic guarantees, or guaranteed AI recommendations.

Operational files live on `Dual247/picshaw`, branch `preview/picshaw-outbound`:

- `client-previews/registry.json`: authoritative prospect, deduplication and daily-run records.
- `client-previews/OUTBOUND_WORKFLOW.md`: this procedure.
- `client-previews/<unique-slug>/`: each durable preview and its lifecycle manifest.

The registry and this runbook are private operational source. Keep them, research notes, lifecycle files, tests and package metadata outside every `public/` directory. Deploy only each project's `public/` output, with its server middleware bundled separately. Never expose the repository root as a static site.

## 1. Claim the day's run and inspect cleanup

1. Read the current branch head, registry, and previous run records. Derive the date in `America/Los_Angeles`, not UTC. Use `picshaw-preview-five:YYYY-MM-DD` as the run ID.
2. If that date is completed, report the existing result and do not create another batch. If it is partial or in progress, resume its reserved prospects and completed IDs. Do not double-count completed work. If another invocation is active, do not race it.
3. Reserve or update the daily-run record using a branch update with an expected-head lease. Re-read and reconcile after any concurrent-update rejection; never force-overwrite another run. Record start time, target, reserved IDs, completed IDs, blockers and status. `dailyRunRecordExample` documents the shape; it is not a real run.
4. Before building, inspect only registry entries whose immutable `expiresAt` has passed. Cleanup is secondary to server expiration. The preview must already return HTTP 410 regardless of cleanup timing.
5. For each expired entry, read the current active route version, staged route state and full diff. Match its exact recorded route IDs, project, path and origin. Remove only that entry's known preview route pair. If the current routing differs from the registry, or unrelated staged changes cannot be preserved, leave routes in place and report the conflict.
6. Apply route changes with optimistic version/head checks where supported; otherwise re-read immediately before mutation and stop on concurrent change. Inspect the resulting diff before promotion. Promote only the intended expired-preview removal while preserving every unrelated route and staged change. Never overwrite or promote someone else's unrelated draft unintentionally.
7. Record removal time and result in the registry. Keep source code, the Vercel project, lifecycle history and draft references. Do not delete domains, projects, deployments or source as routine cleanup. An absent route is already clean. Do not touch main Picshaw, the portal, Keith's preview or unregistered paths.

## 2. Qualify and deduplicate prospects

Select real LA/Orange County businesses with a verifiable operating website, an appropriate public business contact, and a concrete opportunity that a better site could address. Verify location, services, contact details and the opportunity from current public sources. Prefer first-party evidence. Record source URLs, observation dates and concise facts. Do not infer an owner's name, certifications, reviews, project photos, hours or service promises.

Before reserving a business, search **Gmail sent messages, all relevant drafts, opt-outs and the entire registry**. Deduplicate the business itself, not only an email address. Check normalized domain and known alternate domains, business/trading names, telephone, physical address, contacts and prior conversation threads. Account for the existing 20-per-day task and saved drafts from earlier dates. A different employee or email alias does not make a business new. Honor opt-outs and suppression records. Record the search date and the reason a prospect qualified; do not retain unnecessary mailbox content.

Reserve the canonical business identity and a unique slug before spending substantial work on it. A blocked or incomplete package retains its reservation and status so a retry can resume it. If evidence is weak, select a different prospect. Never weaken verification to meet the target.

## 3. Create a tailored preview from the tested template

Copy the Expo runtime structure from `client-previews/expo-collision/` into a new `client-previews/<slug>/` directory on the operations branch. The tested seed source is commit `e0ed3cb821fd59286efc1242cf997065cbbab53b`. Retain the expiration architecture, accessibility and local-only demo behavior; replace the business content and visual design for the prospect.

- Use the prospect's actual branding and verified service details. Design a polished, responsive concept around how its customers choose and enquire.
- Use authentic assets only when their provenance is known. Label generated or illustrative imagery as concept imagery; never imply it shows real projects, staff, premises or customers.
- Keep assets and links compatible with a subpath: relative `./assets/...` URLs, no hosting-platform branding, no absolute origin references.
- Keep `noindex`, `nofollow`, `noarchive` and appropriate security headers. Do not submit the preview to search engines or add live-business structured data that presents it as the real site.
- Forms are clearly marked demos. They must not submit, email, persist, upload or collect customer data. Local image previews are acceptable when cleared after the demonstration.
- Test responsive layout and keyboard interactions. Inspect at least the mobile hero, navigation, primary call to action, service content and demo form. Confirm no overflow, broken imagery, invented claims or dead essential controls. Do not make test phone calls or send test enquiries.
- Write a brief source/provenance note outside `public/`. Record measurable website observations accurately: for example, do not claim the business lacks photo estimates if its existing site already has them.

## 4. Fix the lifetime before first publication

For a new prospect, set its immutable `firstPublishedAt` and matching epoch timestamp **before the first production deployment**. Set `expiresAt` and matching epoch to no later than 168 hours after that timestamp. Keep `maximumLifetimeHours` at 168. A conservative cutoff that starts before the deployment becomes ready is acceptable.

Replace all copied Expo identifiers and the test's initial timestamp constants for this new business once, before publication. Update its lifecycle manifest with the correct slug, source branch, project, contact, URLs and exact route IDs. After first publication, these initial timestamp values and test fixtures are fixed. Record actual deployment READY time separately if useful. **Never extend or recompute an existing deadline on redeploy, retry, daily-run rollover, branch copy, rollback or cleanup.** An explicit future renewal decision must be handled separately; this workflow does not authorize it.

Every preview requires the tested server gate:

- `proxy.js` checks server time before cache and has no route matcher exclusions.
- It guards every URL and every image, font, script, stylesheet and asset path, including origin and aliases.
- At or after the cutoff it returns neutral HTTP 410, without the original design. Invalid or overlong lifecycle data fails closed.
- Active and expired responses use `Cache-Control: private, no-store, no-cache, max-age=0, must-revalidate`, `CDN-Cache-Control: no-store` and `Vercel-CDN-Cache-Control: no-store`.
- The Picshaw reverse-proxy route also uses no-store so an outer cache cannot serve the design after expiry.
- Preserve protection on old immutable deployment URLs. Do not expose or roll back to an earlier deployment that lacks the server gate.
- No client-side clock, URL parameter, cookie, request header or environment override may extend access. A browser countdown or deletion job is not an expiration control.

Run **`npm ci --ignore-scripts`** and **`npm test`** with Node 24. Keep `@vercel/functions` pinned with its lockfile. Tests must cover the exact inclusive cutoff, every actual public file, aliases, HEAD/method behavior, traversal attempts, no-store headers and deployed middleware logic. Do not skip a failed gate. Preserve the fixed constants for all later tests and redeploys.

## 4a. Required engagement instrumentation for every future preview

Ash approved production engagement tracking and its inclusion in **all future Picshaw outbound previews**, regardless of industry or batch. This adds measurement only; it does not authorize contact, sending, scheduling, automatic follow-ups, changes to campaign wording, or renewal of previews.

After fixing the immutable lifecycle and completing the local-only demo UI, use the versioned tooling in `client-previews/tooling/engagement/`:

```sh
node --test client-previews/tooling/engagement/*.test.js
node client-previews/tooling/engagement/install.mjs client-previews/<slug>
node client-previews/tooling/engagement/install.mjs client-previews/<slug> --check
(cd client-previews/<slug> && npm ci --ignore-scripts && npm test)
```

The installer validates but never edits lifecycle or server-gate files; it generates a separate local script, a brief visible disclosure and opt-out link, and allows only `https://www.picshaw.com/_vercel/insights/event` in CSP `connect-src`. It refuses unknown CSPs, existing in-app trackers and mismatched canonical route/slug mappings. Resolve those explicitly rather than weakening the guard. Preserve the original publication and expiry bytes on every reinstall. The script is covered by the existing all-path server expiry gate.

Only trusted intentional `cta`, `navigation`, `service_tab` and `demo_submit` interactions are measured, once per category per document. No page-load, hover, prefetch or scroll events. Events contain only the company slug, fixed canonical path and category, plus the collector's minimal protocol fields. Do not add names, email addresses, form contents, hrefs, DOM text, identifiers, full URLs/query strings, cookies, local/session storage, SDK identity or session replay. The transport omits credentials and referrer, but network infrastructure still receives ordinary request metadata; do not claim it is impossible to identify a visitor. Engagement is not proof of the prospect's identity or buying intent.

Honor GPC, DNT and `?picshaw_no_track=1`. Suppress production tracking on hidden/prerendered documents, automated browsers, direct origins, unrelated paths, expired previews and any `picshaw_qa` query. Keep the visible opt-out available on mobile and desktop; the URL opt-out applies to the current page, not a persistent preference. QA uses `?picshaw_qa=1` and emits only `picshaw_preview_qa`, never `picshaw_preview_engaged`; it still honors privacy signals. Do not bypass those signals to obtain test data.

Before marking the package verified, perform the README's browser QA and collector checks using the canonical branded URL. A successful build or HTTP 200 from the collector alone is not proof of analytics ingestion. Record exact source/bundle/deployment, canonical route, unchanged deadline, browser checks, QA event name/category and observed ingestion evidence outside `public/`. Exclude QA from engagement reporting. If ingestion cannot be verified, record the blocker and do not silently claim tracking is working.

Keep tooling, tests and operational evidence outside `public/`. Do not publish or promote the operations branch as the main marketing site. Before moving its remote ref, verify linked projects' Git auto-deploy settings: an operations-branch push must not unexpectedly deploy other previews or main-site changes. If that cannot be established, retain a patch/unreferenced commit and coordinate the controlled publication; do not change unrelated project settings to bypass this check.

## 5. Deploy and verify the complete package

Use a separate Vercel project for each prospect, with root directory `client-previews/<slug>`, Node 24, install command `npm ci --ignore-scripts`, empty build command for this buildless template, and output directory `public`. Commit to the operations branch with an expected-head lease, then deploy the recorded exact commit. Do not merge or edit main.

Create only a scoped route pair on the existing Picshaw project: the trailing-slash redirect and proxy for `https://www.picshaw.com/previews/<route-slug>/`. Use unique route IDs, the new project's origin, and origin-plus-proxy no-store headers. Preserve all existing routes and staged changes using the same inspection, diff and optimistic-update discipline as cleanup. Record real IDs immediately; do not guess them.

After the deployment is READY, verify anonymously:

1. The branded page, stylesheet and representative images/fonts load correctly.
2. The branded page, direct origin and all public stable aliases return the dynamic `X-Picshaw-Preview-Expires` header with the exact recorded cutoff and no-store behavior.
3. A harmless POST to the demo preview receives HTTP 405, demonstrating live middleware execution. It must not submit data.
4. Old unguarded immutable deployment URLs remain protected and cannot serve the design publicly.
5. Existing Picshaw homepage, portal and unrelated preview routes still work.

Use the deterministic local tests for the real future boundary; never add a public test-clock bypass. Confirm the deployment's source commit, middleware settings and protection state. Do not mark a preview verified merely because deployment reports READY.

## 6. Save the draft and record the result

Prepare a short, human email that mentions one or two verified observations, links to the working branded concept, and offers the approved $250/month plan. State that Ash owns Picshaw and will personally work on the site and its visibility to people asking Google or AI for recommendations when that fits the approved offer. Explain the practical work without promising placements or traffic. Finish with an easy question. Do not add lengthy audits, generic praise or invented common ground.

Recheck the verified recipient and Gmail/registry deduplication immediately before saving. Save the draft only, then retrieve or otherwise verify the saved draft. Record Gmail draft ID, message ID, recipient and `draft_saved` status. Preserve Ash's approved signature and any established opt-out handling. Do not send or schedule it.

Update the prospect record with:

- Canonical business identity, location, contact and verified source facts.
- Daily-run ID and whether it counts toward that day's target.
- Repository path, exact source commit and branch.
- Immutable lifecycle dates, Vercel team/project/deployment IDs, source root, origin and branded URL.
- Exact route IDs/version, deployment and guard-verification evidence.
- Gmail draft/message IDs and send authorization set to false.
- Current status, any blockers and cleanup state.

Only count a new package as complete after its tailored preview, live checks, saved draft and registry record all pass. Update the daily run using unique prospect IDs, not a manually inflated counter. A retry must reuse that day's existing work. Aim for at least five verified new packages; report actual completed count, remaining shortfall and precise blockers if fewer are possible. Never silently mark a partial batch complete.

The daily report should give the actual companies, preview links, expiry dates and draft status concisely. Keep implementation details in operational records. Do not state that anything was emailed.

## Seed state

Expo's original publication was `2026-11-18T20:54:47.759Z`; its immutable expiry is `2026-11-25T20:54:47.759Z`. Its preview route is `/previews/expo/`, while the source slug is `expo-collision`; do not assume those are always identical. The registry records its verified guarded deployment and actual route IDs. Ash independently sent the Expo email; Gmail confirmed the SENT message. Retain the original draft reference as history only and never recreate it. This seed does not authorize the daily workflow to send or schedule email.

The separate daily preview automation was created for approximately 9 a.m. Los Angeles time, starting November 19, 2026. Its private task ID is recorded in the registry. Do not create a second automation while resuming this workflow.

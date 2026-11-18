# Second City Plumbing website concept

Prepared by Picshaw for Ash's second user-selected prospect on 18 November 2026. This is an unofficial design preview, not a replacement for scplumbing.com. The offer is $250/month for website build, hosting and small updates; outreach also explains practical service/location content to support local reach and AI-search visibility without promising rankings or leads.

## Hosting and lifecycle

- Source: Dual247/picshaw, branch preview/picshaw-outbound, directory client-previews/second-city-plumbing.
- Vercel project: picshaw-second-city-preview (prj_Xkcd55dgABreLiDRMBZdUpco377e).
- Intended branded route: https://www.picshaw.com/previews/second-city-plumbing/ .
- Node 24, npm ci --ignore-scripts, no build command, public/ output. proxy.js guards every route and asset before cache.
- preview-lifecycle.json records the fixed initial publication window. Never reset either timestamp after first publication. At the inclusive cutoff all requests return HTTP 410; the origin and branded proxy use no-store.
- Public output excludes research, contact research, lifecycle metadata, package files and tests. No real form delivery, database, analytics or storage.

## Sources and business facts

Reviewed 18 November 2026:

- https://scplumbing.com/ : Second City Plumbing, (310) 738-7094, support@scplumbing.com, serving West LA and South Bay. The business describes residential, commercial, HOA and realtor work; hydrojetting, sewer camera inspection, drain/water repiping, tankless water-heater replacement, gas lines/leaks and drain cleaning. It advertises 24/7 emergency service and more than 35 years of team experience. Do not infer a founding date from experience.
- The existing homepage already supports non-emergency quote requests and image attachments. The preview preserves that distinction and uses a clearly labelled local-only demo.
- https://scplumbing.com/service/international-shipping/ and https://scplumbing.com/service/customer-support/ : linked hydrojetting and gas-line pages currently contain navigation/footer content without service-specific descriptions. This supports a content-improvement opportunity, not a claim about measured rankings or lost leads.
- https://contractorfinder.noritz.com/contractors/second-city-plumbing-38663-el-segundo-ca : identifies Mike Erland as Owner and matches the business telephone.
- https://www.elsegundochamber.org/autowebsite/cw_msss.htm : publicly lists Mike Erland and rland345@gmail.com for Second City Plumbing. Search-indexed evidence is corroborated by the February 2026 city business register at https://www.elsegundo.gov/home/showpublisheddocument/12507/639077867762670000 . Direct chamber/city fetches were unavailable during research; the email is publicly published for business use, not deliverability-tested.

## Imagery and content boundaries

Original asset sources are recorded in docs/provenance.json. The branded truck is a company-published image. Other company-published service/coast images are illustrative, with no unverified claim that they depict a completed job or a particular location. No generated people, fabricated testimonials, star ratings, review counts or license numbers are added. No ranking, traffic, conversion or AI recommendation metrics have been tested or claimed.

The prototype is prepared for the prospect's review. Final business copy, service promises and photography should be confirmed before a commissioned launch. The email remains a draft until Ash sends or separately authorizes sending.

## Immutable preview window

First publication window fixed before deployment: **2026-11-18T21:39:03.000Z**.
Expires: **2026-11-25T21:39:03.000Z** (25 November 2026, 1:39:03 p.m. America/Los_Angeles).
The server gate returns HTTP 410 at the inclusive cutoff for every route and asset. Redeployment must preserve these exact source values and their test constants.

DM Sans font files are copied from the existing preview font bundle; their SIL Open Font License is preserved in docs/dmsans-OFL.txt.

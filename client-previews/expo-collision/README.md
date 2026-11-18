# EXPO Collision Center website concept

Prepared by Picshaw for a draft outbound offer at $250/month. This is an unofficial prospect preview, not a replacement for expocc.com.

## Preview and hosting

- Static HTML/CSS/JavaScript; public/ contains the deployable website.
- Separate Vercel project: picshaw-expo-preview, project ID prj_PdAD4CmZGjeRSbFYS3wZbklalgIR.
- Intended branded path: https://www.picshaw.com/previews/expo/ . Project-level rules are limited to this path on www.picshaw.com.
- No email, database, analytics or form delivery. Photo selections remain in browser memory; the demo clears sample input.
- Search indexing discouraged using noindex/nofollow metadata, response headers and robots.txt.

## Verified public business facts

Source: https://www.expocc.com/ (reviewed 2026-11-18).
EXPO Collision Center, 137 Oregon St, El Segundo CA 90245. Phone (310) 615-0155; public email info@expocc.com. The site states over 30 years of experience, collision/dent repair, frame and unibody repair, paint matching, towing, free estimates and insurance-company communication.
Source: https://www.expocc.com/submit-photos.html . The existing website already accepts damage photos. No form was submitted during research.

## Imagery

Existing EXPO logo and circular illustrative images come from expocc.com. They are not verified photographs of completed Expo projects. The original Gallery section is commented out and contains unrelated template imagery, which is not used.
The automotive hero is an AI-generated concept photograph, explicitly labelled illustrative. It does not depict Expo's actual premises or completed work. No invented testimonials, ratings, certifications or repair times are included.

## Commercial boundary

The draft offer covers website build, hosting and small updates at $250/month. No setup-fee claim, contract minimum, unlimited work or guaranteed search/lead results has been offered. Ongoing SEO/AEO campaigns are not promised as part of this narrow website offer. The prospect must approve final business content and supply approved project photographs before a real launch.

## Ownership and review

Source retained on a separate unmerged branch of Dual247/picshaw. The email remains a draft until Ash authorises sending.

## Server-enforced expiration

This preview was first published at `2026-11-18T20:54:47.759Z` and expires at
`2026-11-25T20:54:47.759Z` (12:54:47 p.m. Los Angeles time on November 25).
The immutable window is recorded in `preview-lifecycle.json`. Redeploying does
not refresh that window.

`vercel.json` points `proxy.entrypoint` at `proxy.js` and deliberately specifies
no matcher. Vercel Routing Middleware therefore runs on every request, including
all static assets, before CDN cache. The middleware uses the server clock and
returns a neutral HTTP 410 response at or after expiry. Missing, inconsistent or
overlong lifecycle data fails closed. GET and HEAD are the only permitted
methods while active. No URL parameter, cookie or request header can extend the
deadline. The original static files remain unchanged and durable in source.

All responses carry private/no-store browser and CDN headers. The branded
reverse-proxy route on the Picshaw project must also send no-store and respect
the origin's Cache-Control; otherwise its outer cache could mask the cutoff.
Historical unguarded deployment URLs must remain protected or be removed; all
public stable aliases must point at the guarded deployment. Never roll back to
an unguarded deployment. Copies previously downloaded by a visitor cannot be
revoked by a server-side cutoff.

Local verification: `npm ci --ignore-scripts && npm test`. The suite checks the
last active millisecond, exact expiry, every current public file over multiple
alias hosts, HEAD/method handling, malformed/traversal-style paths, client clock
spoofing, invalid lifecycle data and actual middleware cache headers. This does
not substitute for checking the deployed project's aliases and routing setup.

## Reuse for future daily previews

1. Create a unique preview slug, source branch and isolated project. Preserve
   this server-side expiry gate and pinned dependency/lockfile. Tailor the
   design and factual content to the new prospect; do not clone Expo's facts or
   photographs into a different business's site.
2. Establish the seven-day-or-shorter deadline before its first public launch.
   Record the actual first-publication timestamp once known, retaining any
   earlier deadline already set. `expiresAt - firstPublishedAt` must never exceed
   168 hours. Persist both timestamps as ISO UTC and matching epoch milliseconds.
   Never derive expiration from `Date.now()` during redeployment.
3. Record the actual team/project IDs, repository branch, branded URL, origin URL,
   business domain/contact and branded route IDs in `preview-lifecycle.json`.
   Never copy Expo's IDs or reset a previously recorded window.
4. Deploy with `npm ci --ignore-scripts`, output directory `public`, and this
   catch-all middleware enabled. Check origin and branded paths anonymously;
   confirm no-store headers and the correct expiry metadata in source.
5. Keep immutable deployment URLs protected and disable nonessential preview
   domains. Any cleanup automation is a second layer, not the expiration gate.
   On expiry the same address serves a neutral 410 response. Retain source for
   later approved work; renewing a preview requires a new explicit decision.

Official implementation references:
- https://vercel.com/docs/routing-middleware
- https://vercel.com/docs/routing-middleware/js-reference
- https://vercel.com/docs/project-configuration/vercel-json#proxy

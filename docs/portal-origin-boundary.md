# Portal origin boundary

The reviewed portal origin is `https://app.picshaw.com`, defined in
`lib/portal-origin.ts`. Marketing remains on `picshaw.com` and `www.picshaw.com`.
Changing it is a code-reviewed deployment change, not a forwarded-header setting.

The all-path Next 16 proxy accepts only exact Host values. It never trusts
X-Forwarded-Host. On the portal host it permits `/platform`, `/api/platform`,
their segment descendants, Next static assets, and the two required icons.
Everything else is a plain-text 404 before any marketing layout or missing-page
HTML can render. Root redirects to the fixed `/platform` URL with no query.
Marketing rejects every portal API and callback; only four legacy entry pages
redirect to the same fixed portal root, dropping all query data.

Localhost and explicit Vercel previews can display sample pages. They cannot
reach portal auth APIs or callbacks. Other aliases fail closed.
Marketing links remain relative in explicitly declared Vercel preview builds,
using public navigation metadata derived only from server `VERCEL_ENV=preview`.
This permits gated review before portal DNS exists. Production links remain
canonical even on a Vercel-looking hostname; this metadata never enables auth.
Auth handlers also require exact canonical origin and Host, and `VERCEL_ENV=production`.
Provider/session flags and distributed admission remain separate activation
requirements. The public `/api/portal-access` boolean reads no session, sets no
cookies, and supports no CORS; marketing requests it with credentials omitted.

Session, PKCE verifier, concurrent-flow and chunk cookies use the SDK storage
key `__Host-picshaw-auth` with Secure, HttpOnly, Path=/, SameSite=Lax and no Domain.
There were no production sessions to migrate. Do not add a browser Supabase
client or parent-domain cookie. SDK chunk rotation/deletion must remain intact.

Portal responses deny framing via CSP and X-Frame-Options. CSP also limits base,
form and object embedding without blocking Next's inline RSC hydration. This
is not a full script nonce CSP or a substitute for authorization and sanitizing.

## Deployment checks before activation

- Attach the approved portal hostname and TLS in Vercel. Verify the actual
  ingress Host and HTTPS request URL; do not loosen validation to accommodate
  arbitrary forwarded headers.
- Configure exact Supabase site/callback allowlists for this portal, not marketing
  or wildcard preview aliases, and only then the server origin setting.
- Keep every auth flag false until provider, email delivery, admission, session,
  cookie and rollback tests pass on the final deployment.
- Run `node scripts/check-portal-host-boundary.mjs`, existing auth/platform suites,
  typecheck, lint and production build. Test HTTP with alternate Host headers,
  encoded/dotted/normalized paths and forwarded-host spoofing. Check browser
  hydration and local sample navigation. CDN/deployment behavior needs a separate
  live verification; local tests cannot prove Vercel routing or provider setup.

No DNS, Vercel settings, provider settings or remote deployment is changed by
this source-only implementation.

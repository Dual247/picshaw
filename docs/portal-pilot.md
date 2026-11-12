# Restricted production verification pilot

This gate keeps public customer access closed while the two expressly approved
test accounts exercise the canonical production portal. It does not create accounts,
send email, change hosted settings, provision credentials or activate a deployment.

## Independent server-only mode

- `PIC_SHAW_PORTAL_ACCESS_MODE=closed` is the default. Missing, misspelled and
  unsupported values are also closed, even with provider flags enabled.
- `pilot` permits email initiation only for the exact reviewed addresses
  `hello+portal-test-a@picshaw.com` and `hello+portal-test-b@picshaw.com`. No wildcard,
  domain match, extra alias, case folding or user metadata can enlarge this list.
  Google/Apple sign-in remain disabled even if their flags are mistakenly true.
- `public` is a separate, deliberate future launch decision. Do not set it until
  live acceptance and launch approval are complete. Provider flags still apply.

Canonical host, production deployment, CSRF, body bounds, distributed admission,
tenant membership, connection ownership and database/session checks remain in
force. No localhost, preview or forwarded-host bypass was added. The marketing
site stays public and `/api/portal-access` reports `ready:false` throughout pilot.

## Pin the real accounts before authenticated access

After approved signup and independent verification of the Auth records, an operator
pins each exact account's UUID in production server-only configuration:

- `PIC_SHAW_PILOT_USER_A_ID` corresponds only to the `-a` address above.
- `PIC_SHAW_PILOT_USER_B_ID` corresponds only to the `-b` address above.

Both must be valid, distinct UUIDs. Do not derive them from client input, an unsigned
cookie, user metadata or a possibly obfuscated duplicate-signup response. Never
automatically enroll the first account to claim an address. No real IDs are tracked.

The exact approved addresses can request signup confirmation or recovery before
pins exist, but authenticated portal access fails closed until both IDs are pinned.
Every admission uses fresh `getUser()` data and requires the exact pinned ID **and**
matching confirmed email. Sign-in, auto-confirmed signup and callback re-verify
before reporting success. Ineligible results discard outgoing and existing local
Picshaw auth-cookie chunks; they do not revoke an unrelated upstream account.

Session inspection and password update use the same gate. Workspace, GSC and report
handlers use it before any workspace/store/provider access, in addition to verified
JWT claims. Changing an account's email away from its approved address denies it.
Logout remains usable for an existing browser session, including while closed;
revocation never grants access. Global logout still verifies that account first.

## Upstream boundary is separate

This is an application boundary, **not** a Supabase Auth signup hook or Data API
policy. A public project key can still reach Supabase directly according to that
project's own settings. Before pilot activation, separately review upstream signup,
email/provider restrictions and existing Auth users/memberships. If those permit
unapproved account creation/email or existing nonpilot Data API access, this code
does not prevent those direct service operations. Keep the pilot closed until the
operator has an approved upstream restriction strategy. Do not claim an app flag
restricts Supabase itself, and do not silently create a hook or change privileges.

No live accounts, email, tokens or hosted configuration are used by
`scripts/check-portal-pilot.mjs`. Its synthetic checks cover exact-address rejection
before SDK calls, pinned identity/confirmed-email matching, cookie discard, provider
denial, closed defaults, recovery/callback/session behavior, retained logout, unchanged
origin/admission guards and all three data-handler boundaries. Existing public-mode
tests now opt into public explicitly rather than assuming missing configuration is
open. Actual approved-account browser tests remain required.

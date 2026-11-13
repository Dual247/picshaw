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
  Google/Apple sign-in remain disabled with provider flags alone. The separately
  approved Google identity flow below is the only pilot OAuth exception.
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

## Separately approved Google pilot identity

An explicitly configured `PIC_SHAW_PILOT_GOOGLE_EMAIL` and enabled Google provider
allow Google initiation in pilot mode only when both existing test UUID pins are
valid. This is an exact lowercase mailbox, not a domain rule. The existing owner
email/UUID and two test identities remain unchanged. Apple remains disabled.
No setting here changes public marketing readiness or upstream Supabase policies.

The first Google authentication can create the upstream Auth identity. Both pending
and admitted Google-slot checks require a server-returned Google identity with the
same Auth user ID, exact configured email and a true email-verified claim. Until an
operator independently verifies and pins `PIC_SHAW_PILOT_GOOGLE_ID`, the exact
confirmed account is signed out locally, exchanged cookies are discarded, and the
callback shows access-pending. A sign-out failure fails closed. No automatic
first-user enrollment or workspace grant occurs. The operator must obtain required
approval before the persistent-access grant. Pin only the verified exact email's
Auth UUID, not a client-provided ID or OAuth response alone. Other mailboxes, aliases,
domain matches, unconfirmed email and conflicting UUIDs never grant pilot access.

This does not restrict upstream Google account creation to that mailbox; the
application callback and all workspace/data handlers enforce the admission boundary.

Deployment-specific reviewed hook SQL is retained privately, outside the public repository.
Apply through the approved hosted migration workflow, then separately enable the
before-user-created hook and read back its configured URI. Creating the function
alone does not activate it. Existing users/sessions/linking are not changed by this
hook. The exact Google/test/owner pairs are fixed; reject every other new signup.
Pure PostgreSQL 17 checks cover 47 allowed/denied/malformed cases and restricted
EXECUTE privileges; hosted invocation and activation still require verification.

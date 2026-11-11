# Supabase setup for the Picshaw pilot

Supabase is the selected database/auth provider. Vercel remains the selected app host. The dedicated hosted pilot now exists. The local app remains setup-locked: Google and Apple are not configured, local authentication is disabled, and no customer access or Vercel deployment has been activated.

## Confirmed project and intended configuration

- Dedicated project: `picshaw-pilot`, project reference `emlrtdffbfhainvvlvnl`, in Dual247's Org (`paqgbbkgbrrzlttylvup`). Verified `ACTIVE_HEALTHY` on 2026-11-10; do not reuse another product's database.
- Verified PostgreSQL 17.11 on the stable/GA release. Micro compute with no paid add-ons or replicas is the approved configuration; the project-details API does not expose compute or billing configuration, so those settings require separate dashboard/provider evidence.
- Verified primary region: West US (North California), `us-west-1`. Co-locate the Vercel server runtime where supported after its exact project and hostname are confirmed.
- Keep the existing spend-cap setting unchanged. It does not cap compute, so it is not a hard monthly budget.
- No automatic preview database branches. Local development uses synthetic fixtures; production data does not belong in preview deployments or tests.

## Cost and ownership approval

The user selected the existing Dual247's Org and approved a dedicated Picshaw Micro project up to US$15/month including mandatory fees and applicable tax. The account quote returned US$10/month but did not specify tax. Provider confirmation subsequently succeeded and project creation was independently verified. Do not create a duplicate. The confirmation receipt and actual billing settings remain the authority for compute, tax and spend-cap details. This approval does not cover unknown usage overages, paid add-ons or changes to unrelated projects.

Supabase's published baseline as checked on 2026-11-10:

- A Pro organization is listed at US$25/month, with US$10 of monthly organization-level compute credits.
- Each additional Micro project is US$0.01344/hour, approximately US$10/month before usage and applicable tax. Credits are shared across the organization; each new project does not bring another credit.
- Free and paid projects cannot be mixed in one organization. A separate Free organization may be possible, subject to the two-active-free-project allowance across owners/admins. Do not promise an available free slot without checking eligibility.
- Usage limits are mostly shared by projects within an organization. Confirm the current organization's actual usage, billing terms and quote before provisioning. Public list prices are not a verified invoice.

Sources: [billing FAQ](https://supabase.com/docs/guides/platform/billing-faq), [compute billing](https://supabase.com/docs/guides/platform/manage-your-usage/compute), [organization billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [regions](https://supabase.com/docs/guides/platform/regions).

## App authentication and client separation

- Supabase Auth identifies a signed-in person. It does not determine which client organization that person can access.
- Database memberships are the authority for tenant roles. Do not authorize from user-editable `user_metadata`, a browser-supplied organization ID, or a selected domain alone.
- Keep pilot access invitation-only. Selecting an account provider does not authorize inviting clients or sending authentication emails.
- Validate identity server-side, then check current membership on every sensitive request. Use the caller's session and row-level security for normal reads/writes. Never expose a service-role/secret key to a browser or a `NEXT_PUBLIC_` variable.
- Enable RLS on every exposed table. Deny anonymous access, constrain reads and writes by tenant, and use both `USING` and `WITH CHECK` for updates. Test cross-tenant references, not just individual row ownership.
- Treat membership management and invitation redemption as privileged operations with explicit authorization. Do not let users create their own memberships or select a more powerful role.
- Google, Apple and email login/signup UI and disabled server flows are now prepared. Logout/recovery/session handlers and the tenant/RLS migration are also prepared; see `docs/tenant-database.md` for the current hosted application and verification status. Real provider activation, abuse-backend wiring, authenticated persistence and live Auth/RLS integration tests remain launch gates. The workspace is still setup-locked and its sample data is fictional. See `lib/supabase/README.md` for exact secure setup requirements.

## Identity provider status verified on 2026-11-10

A read-only public Auth settings check found Google and Apple disabled, email enabled, signup allowed, and email confirmation required. This is provider readiness, not a successful login or delivery test. The local app still disables every provider and session feature. The public endpoint does not prove production SMTP, redirect allowlists, abuse controls or secure password-change configuration.

The verified default Supabase provider callback is `https://emlrtdffbfhainvvlvnl.supabase.co/auth/v1/callback`. Google and Apple must use that provider callback. The application callback will instead be `https://FINAL_HOST/platform/auth/callback`; it cannot be finalized until the pilot host is confirmed. The project URL and modern publishable key can be read from the connected Supabase account, so the user does not need to paste them into chat. Provider secrets must be entered through approved secure configuration.

## Separate Google authorization

Picshaw login and permission to read Search Console are distinct. A Google identity used to log in is not proof of Search Console access.

- Use a user-owned Google Cloud OAuth app with a fixed callback URL and only the Search Console read-only scope needed for this feature.
- Validate OAuth state and use PKCE. Keep the actor/organization/connection binding server-side throughout the redirect flow.
- Store refresh tokens encrypted server-side after consent; never in browser storage, snapshots, logs or report data. Keep encryption keys separate from stored ciphertext.
- Request retained read-only access and data storage approval for the named pilot account/property before connecting it.
- Include disconnect/revocation, failed refresh, revoked property access and account switching in the integration tests.

## Delivery and data requirements before launch

- Configure a production email provider if using email sign-in or invitations. Supabase's default SMTP sends only to organization-team addresses and is not for customer delivery. Keep email confirmation enabled and use exact redirect allowlists.
- Confirm the pilot hostname, Supabase Site URL/callback allowlist and Vercel environment mapping. Do not give arbitrary preview deployments production credentials.
- Agree retention/deletion and backup-recovery behavior before storing client search data. Avoid collecting query-level data until it is needed.
- Persist tenant-bound immutable snapshots with source/property/window/provenance. Query daily completeness separately; do not interpret a conservative date lag as proof of complete data.
- Build and execute cross-tenant denial tests, OAuth/session failure tests and authenticated report-access tests on the configured pilot. Mocked helper tests do not substitute for these.
- Run Supabase advisors and database tests before enabling client access. Review database software/security updates for the newly created project without changing unrelated existing projects.

Additional references: [server-side auth](https://supabase.com/docs/guides/auth/server-side), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [production checklist](https://supabase.com/docs/guides/platform/going-into-prod).

## Latest dashboard verification (2026-11-11 UTC)

Read-only dashboard verification: Micro compute in us-west-1; organization Spend Cap enabled (does not cap compute). Built-in test email service only, no custom SMTP. Site URL is http://localhost:3000 with no redirect URLs. Google/Apple are disabled; email confirmation is enabled. Secure password change, require current password and leaked-password protection are off. The minimum password length was not readable and is not inferred. No settings were changed; all app auth/session flags remain false. Dashboard: https://supabase.com/dashboard/project/emlrtdffbfhainvvlvnl .

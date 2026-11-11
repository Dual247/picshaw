# Supabase setup for the Picshaw pilot

Supabase is the selected database/auth provider and Vercel the app host. This is a portable setup checklist, not an inventory of a live account. The application template keeps authentication disabled; sample data is fictional and no customer launch is established here.

## Project and cost planning

- Use a dedicated Supabase project; never reuse another product's database.
- Check the target migration history before applying migrations. Never blindly reapply a migration or assume this repository describes the target's current schema.
- Select supported database software and a suitable region. Co-locate the Vercel server runtime where supported.
- Confirm compute, usage, organization-level charges, mandatory fees, taxes and backup requirements before provisioning. Spend caps do not necessarily cap compute or every billable product; public prices are not an invoice or a guaranteed total.
- Avoid automatic preview database branches unless explicitly provisioned for that purpose. Local tests use synthetic fixtures; production data does not belong in preview deployments or tests.
- Keep account identifiers, quotes, approvals and dashboard findings outside the public repository.

Sources: [billing FAQ](https://supabase.com/docs/guides/platform/billing-faq), [compute billing](https://supabase.com/docs/guides/platform/manage-your-usage/compute), [organization billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [regions](https://supabase.com/docs/guides/platform/regions).

## App authentication and client separation

- Supabase Auth identifies a signed-in person. It does not determine which client organization that person can access.
- Database memberships are the authority for tenant roles. Do not authorize from user-editable `user_metadata`, a browser-supplied organization ID, or a selected domain alone.
- Keep pilot access invitation-only. Selecting an account provider does not authorize inviting clients or sending authentication emails.
- Validate identity server-side, then check current membership on every sensitive request. Use the caller's session and row-level security for normal reads/writes. Never expose a service-role/secret key to a browser or a `NEXT_PUBLIC_` variable.
- Enable RLS on every exposed table. Deny anonymous access, constrain reads and writes by tenant, and use both `USING` and `WITH CHECK` for updates. Test cross-tenant references, not just individual row ownership.
- Treat membership management and invitation redemption as privileged operations with explicit authorization. Do not let users create their own memberships or select a more powerful role.
- Google, Apple and email login/signup UI and disabled server flows are now prepared. Logout/recovery/session handlers and the tenant/RLS migration are also prepared; see `docs/tenant-database.md` for the current hosted application and verification status. Real provider activation, abuse-backend wiring, authenticated persistence and live Auth/RLS integration tests remain launch gates. The workspace is still setup-locked and its sample data is fictional. See `lib/supabase/README.md` for exact secure setup requirements.

## Identity provider readiness

Check provider enablement, confirmation requirements, signup policy, production SMTP, redirect allowlists, abuse controls and secure password-change settings on the intended environment. A public Auth settings response does not establish successful login, email delivery or a complete configuration audit.

Google and Apple use the Supabase provider callback `https://PROJECT-REF.supabase.co/auth/v1/callback` (or the verified custom Auth domain). The application callback is distinct: `https://PORTAL-HOST/platform/auth/callback`. Use exact approved HTTPS origins, not wildcards. Configure keys and provider secrets through approved secure configuration; never commit them or paste them into documentation.

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

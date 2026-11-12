# Supabase database TLS trust preparation

Status: **prepared but not activated**. No production runtime imports `lib/supabase/database-tls.ts`. Adding this helper does not change any connection, deployment, environment variable, operating-system trust store, or process-wide trust setting. Runtime wiring requires a separately reviewed and authorized change.

## Supported configuration

Supabase documents full certificate-chain and hostname verification for its shared pooler with the database CA downloaded from Dashboard → Database Settings → SSL Configuration:

- https://supabase.com/docs/guides/platform/ssl-enforcement
- https://supabase.com/docs/guides/database/psql

The equivalent `postgres` 4.1.0 Node configuration is a driver-local SSL options object containing the official CA, `rejectUnauthorized: true`, the exact configured pooler hostname as `servername`, and Node's normal `checkServerIdentity`. Never use a permissive SSL string, disable hostname checks, or modify global/OS trust. Do not derive trust from the certificate presented by a failing connection.

The helper embeds only the public CA. It checks the expected SHA-256 certificate fingerprint, CA status, self-signature, and validity dates before returning frozen connection-local options. It permits configured Supabase shared pooler DNS names only, not IP addresses, connection URLs, or request-supplied hostnames. It neither fetches nor rotates trust automatically.

## Verified provenance and metadata

On 2026-11-12 the authenticated project Database Settings page's Download certificate link was verified as:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

The public file was downloaded over normally verified HTTPS from that exact URL, independently of the failing database peer.

- Subject/issuer: Supabase Root 2021 CA, Supabase Inc.
- CA: true. Self-signature: valid.
- Valid from: 2021-04-28 10:56:53 UTC.
- Valid until: 2031-04-26 10:56:53 UTC.
- SHA-256 certificate fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
- Original downloaded file SHA-256: `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7` (file formatting differs from the embedded normalized PEM; the certificate fingerprint is the trust identity).

## Evidence and limits

A parent-authorized SSLRequest-only probe to the verified `aws-1-us-west-1.pooler.supabase.com:6543` endpoint using this scoped CA passed with `authorized=true`, normal hostname verification, and TLS 1.3. The peer SAN covered `*.pooler.supabase.com` and `*.pooler.supabase.co`. The socket was closed after the TLS handshake. No Postgres startup message, username, password, query, or application traffic was sent.

This proves the local client-to-pooler chain and hostname only. It does not prove Vercel's observed failure category, database credentials, role grants, admission debits, or the pooler's upstream verification. Confirm the deployed fixed-enum diagnostic before attributing its failure to CA trust.

Offline regression: `node scripts/check-database-tls.mjs`. It tests CA identity/validity and rejection, pooler-host restrictions, immutable strict TLS options, the installed driver's object-mode TLS context handling, and Node's normal hostname verifier. It performs no network operation.

## Activation and rotation gates

1. Confirm the deployed failure category and obtain the exact trust-configuration authorization.
2. Independently review the helper and chosen call sites. Retain all ingress checks, host checks, request deadlines, per-role grants, and fail-closed outcomes.
3. Wire only the authorized Supabase database drivers. This change must not alter HTTPS API trust or other services.
4. Test actual deployment connectivity and failure handling without exposing credentials, certificates, raw headers, IPs, or database error messages in application logs.
5. Before expiry or provider CA rotation, reverify the Dashboard's download source, validate the replacement's fingerprint/metadata through the approved release process, and repeat strict positive and negative verification. Never accept a new peer certificate automatically.

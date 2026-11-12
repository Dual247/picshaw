import 'server-only'
import { isIP } from 'node:net'
import { ipAddress } from '@vercel/functions'
import postgres from 'postgres'
import { createSupabasePoolerTls } from './database-tls'
import { createDistributedAuthAdmission } from './auth-admission-backend'
import { AdmissionIngressError } from './auth-admission-diagnostics'
import type { AuthAdmission } from './auth-admission'

type Environment = Record<string, string | undefined>

/** Configuration is not proof of connectivity, deployment safety, or admission.
 * No request field, forwarded deployment ID, or manual "verified" switch can
 * select the backend. Credentials belong only in Vercel's production secrets.
 */
export function readAdmissionConfig(env: Environment = process.env) {
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production' ||
      env.PIC_SHAW_AUTH_ORIGIN !== 'https://app.picshaw.com') return null
  const project = /^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(env.NEXT_PUBLIC_SUPABASE_URL ?? '')?.[1]
  const host = env.PIC_SHAW_ADMISSION_DB_HOST ?? ''
  const password = env.PIC_SHAW_ADMISSION_DB_PASSWORD ?? ''
  const key = env.PIC_SHAW_ADMISSION_HMAC_KEY ?? ''
  if (!project || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.pooler\.supabase\.com$/.test(host) ||
      password.length < 32 || password.length > 256 || !/^[0-9a-f]{64}$/.test(key)) return null
  return { host, user: `picshaw_admission.${project}`, password, key }
}

/** Group IPv6 /64 networks to avoid trivial per-address rotation. Vercel
 * overwrites forwarding identity at its ingress; this helper alone is NOT a
 * trusted identity outside Vercel. Never use a fallback client-supplied header.
 * https://vercel.com/docs/headers/request-headers
 */
export function canonicalNetworkIdentity(ip: string | undefined): string | null {
  if (!ip || ip.includes('%')) return null
  const version = isIP(ip)
  if (version === 4) return `v4:${ip}`
  if (version !== 6) return null
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1)
  const halves = canonical.split('::')
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const words = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left
  const numbers = words.map(word => parseInt(word, 16))
  if (numbers.slice(0, 5).every(word => word === 0) && numbers[5] === 65535) {
    return `v4:${numbers[6] >> 8}.${numbers[6] & 255}.${numbers[7] >> 8}.${numbers[7] & 255}`
  }
  return `v6:${numbers.slice(0, 4).map(word => word.toString(16)).join(':')}::/64`
}

export function createRuntimeAdmission(env: Environment = process.env): AuthAdmission | null {
  const config = readAdmissionConfig(env)
  if (!config) return null
  // Explicit destination/credentials: no URI parsing, prepared statements,
  // startup parameter injection, notices/debug logs, or insecure TLS fallback.
  const sql = postgres({
    host: config.host, port: 6543, database: 'postgres', username: config.user,
    password: config.password, ssl: createSupabasePoolerTls(config.host),
    prepare: false, max: 1, max_pipeline: 1,
    connect_timeout: 1, queue_timeout: 1, query_timeout: 1, cancel_timeout: 1,
    idle_timeout: 10, max_lifetime: 60, fetch_types: false,
    onnotice: () => {}, debug: false,
  })
  return createDistributedAuthAdmission({
    hmacKey: Buffer.from(config.key, 'hex'),
    resolvePrincipal: request => {
      if (request.nextUrl.origin !== 'https://app.picshaw.com' || request.headers.get('host') !== 'app.picshaw.com') throw new AdmissionIngressError('ingress_origin_rejected')
      const principal = canonicalNetworkIdentity(ipAddress(request))
      // Reject inconsistent identity headers instead of trusting either one.
      const forwarded = canonicalNetworkIdentity(request.headers.get('x-vercel-forwarded-for') ?? undefined)
      if (!principal || !forwarded) throw new AdmissionIngressError('ingress_principal_unavailable')
      if (principal !== forwarded) throw new AdmissionIngressError('ingress_identity_mismatch')
      return principal
    },
    consume: async (action, principalDigest, signal) => {
      // Never retry an ambiguous result: a committed debit followed by a lost
      // response must fail closed, not issue duplicate auth requests.
      const rows = await sql`select picshaw_admission_private.consume(${action}, ${principalDigest}) as allowed`.signal(signal)
      return rows.length === 1 ? rows[0].allowed : undefined
    },
  })
}

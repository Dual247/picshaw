import 'server-only'
import { readSupabaseConfig, type SupabaseEnvironment } from './config'
import { authAdmissionConfigured } from './auth-admission'

export type PortalEnvironment = SupabaseEnvironment & {
  PIC_SHAW_AUTH_ORIGIN?: string
  PIC_SHAW_AUTH_GOOGLE_ENABLED?: string
  PIC_SHAW_AUTH_APPLE_ENABLED?: string
  PIC_SHAW_AUTH_EMAIL_ENABLED?: string
  PIC_SHAW_AUTH_SESSION_ENABLED?: string
}
export type AuthAvailability = { google: boolean; apple: boolean; email: boolean }

export function readPortalConfig(env: PortalEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PIC_SHAW_AUTH_ORIGIN: process.env.PIC_SHAW_AUTH_ORIGIN,
  PIC_SHAW_AUTH_GOOGLE_ENABLED: process.env.PIC_SHAW_AUTH_GOOGLE_ENABLED,
  PIC_SHAW_AUTH_APPLE_ENABLED: process.env.PIC_SHAW_AUTH_APPLE_ENABLED,
  PIC_SHAW_AUTH_EMAIL_ENABLED: process.env.PIC_SHAW_AUTH_EMAIL_ENABLED,
  PIC_SHAW_AUTH_SESSION_ENABLED: process.env.PIC_SHAW_AUTH_SESSION_ENABLED,
}) {
  const supabase = readSupabaseConfig(env)
  const origin = new URL(env.PIC_SHAW_AUTH_ORIGIN || '')
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port ||
      origin.pathname !== '/' || origin.search || origin.hash || origin.hostname === 'localhost' ||
      !/^[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(origin.hostname)) {
    throw new Error('Authentication setup is incomplete.')
  }
  return {
    ...supabase,
    origin: origin.origin,
    callback: `${origin.origin}/platform/auth/callback`,
    sessionEnabled: env.PIC_SHAW_AUTH_SESSION_ENABLED === 'true',
    enabled: {
      google: env.PIC_SHAW_AUTH_GOOGLE_ENABLED === 'true',
      apple: env.PIC_SHAW_AUTH_APPLE_ENABLED === 'true',
      email: env.PIC_SHAW_AUTH_EMAIL_ENABLED === 'true',
    },
  }
}

export function lifecycleAvailability(env?: PortalEnvironment) {
  try {
    const config = readPortalConfig(env)
    return { email: config.enabled.email && authAdmissionConfigured, session: config.sessionEnabled }
  } catch { return { email: false, session: false } }
}

export function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && value === value.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function validNewPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128
}

export function authAvailability(env?: PortalEnvironment): AuthAvailability {
  try {
    const { enabled } = readPortalConfig(env)
    return { google: enabled.google && authAdmissionConfigured, apple: enabled.apple && authAdmissionConfigured, email: enabled.email && authAdmissionConfigured }
  } catch { return { google: false, apple: false, email: false } }
}

export function validEmailCredentials(value: unknown, signup: boolean): value is { email: string; password: string } {
  if (!value || typeof value !== 'object') return false
  const { email, password } = value as Record<string, unknown>
  return typeof email === 'string' && email.length <= 254 && email === email.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && typeof password === 'string' &&
    password.length >= (signup ? 12 : 1) && password.length <= 128
}

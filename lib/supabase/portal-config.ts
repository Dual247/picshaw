import 'server-only'
import { readSupabaseConfig, type SupabaseEnvironment } from './config'
import { authAdmissionConfigured } from './auth-admission'
import { PORTAL_ORIGIN } from '../portal-origin'
import { readPortalAccess, type PortalAccessEnvironment } from './auth'

export type PortalEnvironment = SupabaseEnvironment & PortalAccessEnvironment & {
  VERCEL_ENV?: string
  PIC_SHAW_AUTH_ORIGIN?: string
  PIC_SHAW_AUTH_GOOGLE_ENABLED?: string
  PIC_SHAW_AUTH_APPLE_ENABLED?: string
  PIC_SHAW_AUTH_EMAIL_ENABLED?: string
  PIC_SHAW_AUTH_SESSION_ENABLED?: string
}
export type AuthAvailability = { google: boolean; apple: boolean; email: boolean; pilot?: boolean }

export function readPortalConfig(env: PortalEnvironment = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PIC_SHAW_AUTH_ORIGIN: process.env.PIC_SHAW_AUTH_ORIGIN,
  PIC_SHAW_AUTH_GOOGLE_ENABLED: process.env.PIC_SHAW_AUTH_GOOGLE_ENABLED,
  PIC_SHAW_AUTH_APPLE_ENABLED: process.env.PIC_SHAW_AUTH_APPLE_ENABLED,
  PIC_SHAW_AUTH_EMAIL_ENABLED: process.env.PIC_SHAW_AUTH_EMAIL_ENABLED,
  PIC_SHAW_AUTH_SESSION_ENABLED: process.env.PIC_SHAW_AUTH_SESSION_ENABLED,
  PIC_SHAW_PORTAL_ACCESS_MODE: process.env.PIC_SHAW_PORTAL_ACCESS_MODE,
  PIC_SHAW_PILOT_USER_A_ID: process.env.PIC_SHAW_PILOT_USER_A_ID,
  PIC_SHAW_PILOT_USER_B_ID: process.env.PIC_SHAW_PILOT_USER_B_ID,
  PIC_SHAW_PILOT_OWNER_EMAIL: process.env.PIC_SHAW_PILOT_OWNER_EMAIL,
  PIC_SHAW_PILOT_OWNER_ID: process.env.PIC_SHAW_PILOT_OWNER_ID,
}) {
  if (env.VERCEL_ENV !== 'production' || env.PIC_SHAW_AUTH_ORIGIN !== PORTAL_ORIGIN) {
    throw new Error('Authentication is disabled on this deployment.')
  }
  const supabase = readSupabaseConfig(env)
  const { mode } = readPortalAccess(env)
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
    accessMode: mode,
    sessionEnabled: env.PIC_SHAW_AUTH_SESSION_ENABLED === 'true',
    enabled: {
      google: mode === 'public' && env.PIC_SHAW_AUTH_GOOGLE_ENABLED === 'true',
      apple: mode === 'public' && env.PIC_SHAW_AUTH_APPLE_ENABLED === 'true',
      email: mode !== 'closed' && env.PIC_SHAW_AUTH_EMAIL_ENABLED === 'true',
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
    const { enabled, accessMode } = readPortalConfig(env)
    return { google: enabled.google && authAdmissionConfigured, apple: enabled.apple && authAdmissionConfigured, email: enabled.email && authAdmissionConfigured, pilot: accessMode === 'pilot' }
  } catch { return { google: false, apple: false, email: false } }
}

/** Pilot access must never advertise public customer readiness on marketing. */
export function publicPortalReady(env?: PortalEnvironment) {
  try {
    const config = readPortalConfig(env)
    return config.accessMode === 'public' && config.sessionEnabled && authAdmissionConfigured && Object.values(config.enabled).some(Boolean)
  } catch { return false }
}

export function validEmailCredentials(value: unknown, signup: boolean): value is { email: string; password: string } {
  if (!value || typeof value !== 'object') return false
  const { email, password } = value as Record<string, unknown>
  return typeof email === 'string' && email.length <= 254 && email === email.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && typeof password === 'string' &&
    password.length >= (signup ? 12 : 1) && password.length <= 128
}

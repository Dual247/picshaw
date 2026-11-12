import 'server-only'
import type { NextRequest } from 'next/server'
import { createRuntimeAdmission, readAdmissionConfig } from './auth-admission-runtime'
import { reportAdmissionDiagnostic } from './auth-admission-diagnostics'

export type AuthAdmissionAction = 'google' | 'apple' | 'sign-in' | 'sign-up' | 'recover' | 'reset-password' | 'callback' | 'workspace-bootstrap' | 'workspace-read'
export type AuthAdmissionResult = { status: 'allow' } | { status: 'limited' } | { status: 'unavailable' }
export type AuthAdmission = (context: { action: AuthAdmissionAction; request: NextRequest }) => Promise<AuthAdmissionResult>

// UI configuration readiness only; not a connectivity check or admission grant.
export const authAdmissionConfigured = readAdmissionConfig() !== null

/**
 * Production-only Vercel ingress and shared Postgres admission. Missing setup,
 * ambiguous database results and outages all fail closed. No request body,
 * cookie, password, or auth token is passed to the admission database.
 * Tests inject a guard through server-only function dependencies; HTTP callers
 * cannot supply or override it. Logout and session inspection are not gated here.
 */
let admission: AuthAdmission | null | undefined
export const checkDeploymentAuthAdmission: AuthAdmission = async context => {
  try {
    admission ??= createRuntimeAdmission()
    if (!admission) { reportAdmissionDiagnostic('configuration_unavailable'); return { status: 'unavailable' } }
    return await admission(context)
  } catch { reportAdmissionDiagnostic('runtime_unavailable'); return { status: 'unavailable' } }
}

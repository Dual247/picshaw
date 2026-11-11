import 'server-only'
import type { NextRequest } from 'next/server'

export type AuthAdmissionAction = 'google' | 'apple' | 'sign-in' | 'sign-up' | 'recover' | 'reset-password'
export type AuthAdmissionResult = { status: 'allow' } | { status: 'limited' } | { status: 'unavailable' }
export type AuthAdmission = (context: { action: AuthAdmissionAction; request: NextRequest }) => Promise<AuthAdmissionResult>

// UI readiness only; never an authorization bypass. Set true only alongside a
// tested adapter implementation. Its per-request decision still controls access.
export const authAdmissionConfigured = false

/**
 * Deployment adapter boundary, deliberately fail-closed until a distributed
 * limiter/edge enforcement is integrated and verified. Do not replace with an
 * in-memory counter, an environment "verified" switch, or a client header.
 * A real adapter must derive trusted client identity at the deployment ingress,
 * use atomic shared limits, and fail closed on outages. Never forward raw body,
 * cookies, passwords or tokens to a third-party rate-limit service.
 * Tests inject a guard through server-only function dependencies; HTTP callers
 * cannot supply or override it. Logout and session inspection are not gated here.
 */
export const checkDeploymentAuthAdmission: AuthAdmission = async () => ({ status: 'unavailable' })

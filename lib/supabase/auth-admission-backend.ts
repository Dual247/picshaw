import 'server-only'
import { createHmac } from 'node:crypto'
import type { AuthAdmission, AuthAdmissionAction } from './auth-admission'

const actions: readonly AuthAdmissionAction[] = ['google', 'apple', 'sign-in', 'sign-up', 'recover', 'reset-password', 'callback', 'workspace-bootstrap', 'workspace-read']

/** Server-only integration boundary. Neither dependency may come from request data.
 * resolvePrincipal must return an ingress-verified canonical network identity,
 * never an arbitrary forwarded header. The production resolver lives in
 * auth-admission-runtime; tests supply only server-side dependencies.
 */
export function createDistributedAuthAdmission(options: {
  hmacKey: Uint8Array
  resolvePrincipal: (request: Parameters<AuthAdmission>[0]['request']) => string | null
  consume: (action: AuthAdmissionAction, principalDigest: string, signal: AbortSignal) => Promise<unknown>
}): AuthAdmission {
  if (options.hmacKey.byteLength < 32) throw new Error('Admission key is insufficient.')
  const key = new Uint8Array(options.hmacKey)
  return async ({ action, request }) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()
    try {
      if (!actions.includes(action)) return { status: 'unavailable' }
      const principal = options.resolvePrincipal(request)
      if (!principal || principal.length > 256) return { status: 'unavailable' }
      const digest = createHmac('sha256', key).update('picshaw-auth-admission:v1\0').update(principal).digest('hex')
      const result = await Promise.race([
        options.consume(action, digest, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('Admission timeout.')) }, 1500)
        }),
      ])
      // No coercion, permissive truthiness, or diagnostic payload reflection.
      if (result === true) return { status: 'allow' }
      if (result === false) return { status: 'limited' }
      return { status: 'unavailable' }
    } catch { return { status: 'unavailable' } }
    finally { if (timer) clearTimeout(timer) }
  }
}

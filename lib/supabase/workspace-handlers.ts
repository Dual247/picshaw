import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'
import { AUTH_RESPONSE_HEADERS, createRequestSupabaseClient } from './server'
import { readPortalConfig, type PortalEnvironment } from './portal-config'
import { checkDeploymentAuthAdmission, type AuthAdmission } from './auth-admission'
import { requireWorkspaceActor, deploymentWorkspaceStore, type WorkspaceStore } from './workspace-runtime'
import { parseWorkspaceInput } from './workspace-input'

type Dependencies = { env?: PortalEnvironment; createClient?: typeof createRequestSupabaseClient; admit?: AuthAdmission; store?: WorkspaceStore | null }
export async function handleWorkspacePost(request: NextRequest, create: boolean, dependencies: Dependencies = {}) {
  const writes = new Map<string, { name: string; value: string; options: CookieOptions }>()
  const current = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]))
  const headers = new Headers({ ...AUTH_RESPONSE_HEADERS, 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' })
  const finish = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, { status, headers })
    for (const { name, value, options } of writes.values()) response.cookies.set(name, value, options)
    return response
  }
  let config: ReturnType<typeof readPortalConfig>
  try { config = readPortalConfig(dependencies.env) } catch { return finish({ error: 'Workspace setup is not available yet.' }, 503) }
  if (request.method !== 'POST' || request.headers.get('host') !== 'app.picshaw.com' ||
      new URL(request.url).origin !== config.origin || request.headers.get('origin') !== config.origin ||
      (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')) return finish({ error: 'Please open your portal to continue.' }, 403)
  const store = dependencies.store === undefined ? deploymentWorkspaceStore() : dependencies.store
  if (!config.sessionEnabled || !store) return finish({ error: 'Workspace setup is not available yet.' }, 503)
  let input = null
  try {
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw Error()
    const reader = request.body?.getReader()
    if (!reader) throw Error()
    let text = ''; let size = 0
    const decoder = new TextDecoder('utf-8', { fatal: true })
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 2048) { await reader.cancel(); throw Error() }
        text += decoder.decode(value, { stream: true })
      }
      text += decoder.decode()
    } finally { reader.releaseLock() }
    const body = JSON.parse(text)
    if (create) { input = parseWorkspaceInput(body); if (!input) throw Error() }
    else if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).length) throw Error()
  } catch { return finish({ error: 'Enter a workspace name and a website hostname, such as example.com.' }, 400) }
  try {
    const admission = await (dependencies.admit ?? checkDeploymentAuthAdmission)({ request, action: create ? 'workspace-bootstrap' : 'workspace-read' })
    if (admission.status !== 'allow') return finish({ error: admission.status === 'limited' ? 'Too many requests. Please wait before trying again.' : 'Workspace requests are temporarily unavailable.' }, admission.status === 'limited' ? 429 : 503)
    const client = (dependencies.createClient ?? createRequestSupabaseClient)({
      getAll: () => Array.from(current, ([name, value]) => ({ name, value })),
      setAll: (cookies, extra) => {
        for (const cookie of cookies) { writes.set(cookie.name, cookie); if (!cookie.value || cookie.options.maxAge === 0) current.delete(cookie.name); else current.set(cookie.name, cookie.value) }
        Object.entries(extra).forEach(([key, value]) => headers.set(key, value))
      },
    }, dependencies.env)
    let actor
    try { actor = await requireWorkspaceActor(client, config.url) } catch { return finish({ error: 'Sign in again to open your workspace.' }, 401) }
    const workspace = await store(actor, input)
    return finish({ workspace })
  } catch {
    // Includes revoked sessions/membership, backend outages and ambiguous commit.
    // No SQL diagnostics or identity data are reflected. Identical create retries
    // recover the durable result; changed inputs never silently create a duplicate.
    return finish({ error: 'We could not confirm workspace access. Try again with the same details, or sign in again.' }, 503)
  }
}

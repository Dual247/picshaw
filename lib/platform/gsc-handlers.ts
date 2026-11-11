import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'
import { AUTH_RESPONSE_HEADERS, createRequestSupabaseClient } from '../supabase/server'
import { readPortalConfig, type PortalEnvironment } from '../supabase/portal-config'
import { requireWorkspaceActor, deploymentWorkspaceStore } from '../supabase/workspace-runtime'
import { deploymentGsc } from './gsc-runtime'
import { checkDeploymentAuthAdmission, type AuthAdmission } from '../supabase/auth-admission'

const COOKIE = '__Host-picshaw-gsc-state'
type Operation = 'connect' | 'callback' | 'status' | 'properties' | 'select' | 'disconnect'
type Dependencies = { env?: PortalEnvironment; createClient?: typeof createRequestSupabaseClient; workspace?: ReturnType<typeof deploymentWorkspaceStore>; lifecycle?: ReturnType<typeof deploymentGsc>; admit?: AuthAdmission }
async function smallBody(request: NextRequest): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw Error('Invalid request')
  const reader = request.body?.getReader()
  if (!reader) throw Error('Invalid request')
  let bytes = 0, text = ''; const decoder = new TextDecoder('utf-8', { fatal: true })
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break
      bytes += part.value.byteLength
      if (bytes > 4096) { await reader.cancel(); throw Error('Invalid request') }
      text += decoder.decode(part.value, { stream: true })
    }
    text += decoder.decode()
  } finally { reader.releaseLock() }
  const value = JSON.parse(text)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid request')
  return value
}
export async function handleGsc(request: NextRequest, operation: Operation, deps: Dependencies = {}) {
  const writes = new Map<string, { name: string; value: string; options: CookieOptions }>()
  const current = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]))
  const headers = new Headers({ ...AUTH_RESPONSE_HEADERS, 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' })
  const finish = (body: unknown, status = 200, location?: string) => {
    const result = location ? new NextResponse(null, { status: 303, headers: new Headers([...headers, ['Location', location]]) }) : NextResponse.json(body, { status, headers })
    for (const cookie of writes.values()) result.cookies.set(cookie.name, cookie.value, cookie.options)
    return result
  }
  const clear = () => writes.set(COOKIE, { name: COOKIE, value: '', options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 } })
  let config
  try { config = readPortalConfig(deps.env) } catch { return finish({ enabled: false, error: 'Search Console connection is not configured yet.' }, 503) }
  const callback = operation === 'callback'
  if (request.headers.get('host') !== 'app.picshaw.com' || new URL(request.url).origin !== config.origin ||
      request.method !== (callback ? 'GET' : 'POST') || (!callback && (request.headers.get('origin') !== config.origin ||
      (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')))) return finish({ error: 'Open the portal to continue.' }, 403)
  const lifecycle = deps.lifecycle === undefined ? deploymentGsc() : deps.lifecycle
  const workspace = deps.workspace === undefined ? deploymentWorkspaceStore() : deps.workspace
  if (!config.sessionEnabled || !lifecycle || !workspace) return finish({ enabled: false, error: 'Search Console connection is not configured yet. No Google data has been imported.' }, 503)
  let body: Record<string, unknown> = {}
  if (!callback) {
    try {
      body = await smallBody(request)
      const keys = operation === 'connect' ? ['consent'] : operation === 'select' ? ['connectionId','propertyId'] : ['properties','disconnect'].includes(operation) ? ['connectionId'] : []
      if (Object.keys(body).some(key => !keys.includes(key)) || (operation === 'connect' && body.consent !== true)) throw Error()
    } catch { return finish({ error: 'Invalid connection request.' }, 400) }
  }
  try {
    // Every operation resolves the current workspace. Share its distributed
    // admission budget; the SQL start throttle and refresh lease add per-tenant limits.
    const admission = await (deps.admit ?? checkDeploymentAuthAdmission)({ request, action: 'workspace-read' })
    if (admission.status !== 'allow') return finish({ error: 'Connection requests are temporarily unavailable. Try again later.' }, admission.status === 'limited' ? 429 : 503)
    const client = (deps.createClient ?? createRequestSupabaseClient)({ getAll: () => Array.from(current, ([name,value]) => ({ name,value })),
      setAll: (cookies, extra) => { for (const cookie of cookies) { writes.set(cookie.name,cookie); current.set(cookie.name,cookie.value) }; Object.entries(extra).forEach(([key,value]) => headers.set(key,value)) },
    }, deps.env)
    let actor
    try { actor = await requireWorkspaceActor(client, config.url) } catch { return finish({ error: 'Sign in again to connect Search Console.' }, 401) }
    const selected = await workspace(actor, null)
    if (!selected) return finish({ error: 'Create your workspace first.' }, 409)
    const identity = { actor, organizationId: selected.id }
    if (callback) {
      clear()
      const params = request.nextUrl.searchParams
      if (['state','code','error'].some(key => params.getAll(key).length > 1) || (params.has('error') && params.has('code'))) throw Error()
      await lifecycle.callback(identity, params.get('state') ?? '', request.cookies.get(COOKIE)?.value ?? '', params.get('code'), params.has('error'))
      return finish(null, 303, `${config.origin}/platform/connect?result=${params.has('error') ? 'cancelled' : 'connected'}`)
    }
    if (operation === 'status') return finish({ enabled: true, ...(await lifecycle.status(identity)) })
    if (operation === 'connect') {
      const result = await lifecycle.start(identity)
      writes.set(COOKIE, { name: COOKIE, value: result.browser, options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 } })
      return finish({ authorizationUrl: result.url })
    }
    if (typeof body.connectionId !== 'string') return finish({ error: 'Select a connection.' }, 400)
    if (operation === 'disconnect') return finish(await lifecycle.disconnect(identity, body.connectionId))
    if (operation === 'select' && typeof body.propertyId !== 'string') return finish({ error: 'Select a property.' }, 400)
    const properties = await lifecycle.properties(identity, body.connectionId, operation === 'select' ? body.propertyId as string : undefined)
    return finish({ properties, ...(operation === 'select' ? { selectedProperty: body.propertyId } : {}) })
  } catch {
    // Never echo provider errors, request URLs, authorization codes, SQL or tokens.
    if (callback) { clear(); return finish(null, 303, `${config.origin}/platform/connect?result=unconfirmed`) }
    return finish({ error: 'The connection operation could not be confirmed. Check status before retrying; you may need to disconnect and reconnect.' }, 503)
  }
}

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'
import { AUTH_RESPONSE_HEADERS, createRequestSupabaseClient } from '../supabase/server'
import { readPortalConfig, type PortalEnvironment } from '../supabase/portal-config'
import { requireWorkspaceActor, deploymentWorkspaceStore } from '../supabase/workspace-runtime'
import { checkDeploymentAuthAdmission, type AuthAdmission } from '../supabase/auth-admission'
import { deploymentReports } from './report-runtime'

type Operation = 'sync' | 'read' | 'status'
type Dependencies = { env?: PortalEnvironment; createClient?: typeof createRequestSupabaseClient; workspace?: ReturnType<typeof deploymentWorkspaceStore>; reports?: ReturnType<typeof deploymentReports>; admit?: AuthAdmission }
async function smallBody(request: NextRequest): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw Error()
  const reader = request.body?.getReader()
  if (!reader) throw Error()
  let bytes = 0, text = ''; const decoder = new TextDecoder('utf-8', { fatal: true })
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break
      bytes += part.value.byteLength
      if (bytes > 512) { await reader.cancel(); throw Error() }
      text += decoder.decode(part.value, { stream: true })
    }
    text += decoder.decode()
  } finally { reader.releaseLock() }
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error()
  return value as Record<string, unknown>
}
export async function handleReports(request: NextRequest, operation: Operation, deps: Dependencies = {}) {
  const writes = new Map<string, { name: string; value: string; options: CookieOptions }>()
  const current = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]))
  const headers = new Headers({ ...AUTH_RESPONSE_HEADERS, 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' })
  const finish = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, { status, headers })
    for (const cookie of writes.values()) response.cookies.set(cookie.name, cookie.value, cookie.options)
    return response
  }
  let config
  try { config = readPortalConfig(deps.env) } catch { return finish({ enabled: false, error: 'Private search reports are not configured yet.' }, 503) }
  if (request.headers.get('host') !== 'app.picshaw.com' || new URL(request.url).origin !== config.origin || request.method !== 'POST' || request.headers.get('origin') !== config.origin || (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin') || request.nextUrl.search) return finish({ error: 'Open the portal to continue.' }, 403)
  const reports = deps.reports === undefined ? deploymentReports() : deps.reports
  const workspace = deps.workspace === undefined ? deploymentWorkspaceStore() : deps.workspace
  if (!config.sessionEnabled || !reports || !workspace) return finish({ enabled: false, error: 'Private search reports are not configured yet. No data has been imported.' }, 503)
  let body
  try {
    body = await smallBody(request)
    if (Object.keys(body).some(key => operation !== 'read' || key !== 'reportId') || ('reportId' in body && (typeof body.reportId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.reportId)))) throw Error()
  } catch { return finish({ error: 'Invalid report request.' }, 400) }
  try {
    const admission = await (deps.admit ?? checkDeploymentAuthAdmission)({ request, action: 'workspace-read' })
    if (admission.status !== 'allow') return finish({ error: 'Report requests are temporarily unavailable. Try again later.' }, admission.status === 'limited' ? 429 : 503)
    const client = (deps.createClient ?? createRequestSupabaseClient)({ getAll: () => Array.from(current, ([name, value]) => ({ name, value })),
      setAll: (cookies, extra) => { for (const cookie of cookies) { writes.set(cookie.name, cookie); current.set(cookie.name, cookie.value) }; Object.entries(extra).forEach(([key, value]) => headers.set(key, value)) },
    }, deps.env)
    let actor
    try { actor = await requireWorkspaceActor(client, config.url, deps.env) } catch { return finish({ error: 'Sign in again to open your search reports.' }, 401) }
    const selected = await workspace(actor, null)
    if (!selected) return finish({ error: 'Create your workspace first.' }, 409)
    const identity = { actor, organizationId: selected.id }
    if (operation === 'read') return finish({ enabled: true, report: await reports.read(identity, body.reportId as string | undefined) })
    if (operation === 'status') return finish({ enabled: true, operation: await reports.status(identity) })
    const result = await reports.sync(identity)
    return finish({ enabled: true, ...result }, result.state === 'busy' ? 202 : result.state === 'unavailable' ? 503 : 200)
  } catch {
    return finish({ error: 'The report result could not be confirmed. Check status before retrying. No sample data has been substituted.' }, 503)
  }
}

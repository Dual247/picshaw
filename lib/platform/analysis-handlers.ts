import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'
import { AUTH_RESPONSE_HEADERS, createRequestSupabaseClient } from '../supabase/server'
import { readPortalConfig, type PortalEnvironment } from '../supabase/portal-config'
import { requireWorkspaceActor, deploymentWorkspaceStore } from '../supabase/workspace-runtime'
import { checkDeploymentAuthAdmission, type AuthAdmission } from '../supabase/auth-admission'
import { analyzeWebsite } from './website-analysis'

type AnalysisEnvironment = PortalEnvironment & { PIC_SHAW_ANALYSIS_ENABLED?: string }
type Dependencies = { env?: AnalysisEnvironment; createClient?: typeof createRequestSupabaseClient; workspace?: ReturnType<typeof deploymentWorkspaceStore>; analyze?: typeof analyzeWebsite; admit?: AuthAdmission }
async function smallBody(request: NextRequest): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw Error()
  const reader = request.body?.getReader()
  if (!reader) throw Error()
  let bytes = 0, text = ''; const decoder = new TextDecoder('utf-8', { fatal: true })
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(Error('Request body timed out')); void reader.cancel().catch(() => {}) }, 3000) })
  try {
    while (true) {
      const part = await Promise.race([reader.read(), deadline]); if (part.done) break
      bytes += part.value.byteLength
      if (bytes > 4096) { void reader.cancel().catch(() => {}); throw Error() }
      text += decoder.decode(part.value, { stream: true })
    }
    text += decoder.decode()
  } finally { clearTimeout(timer); reader.releaseLock() }
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error()
  return value as Record<string, unknown>
}
export async function handleAnalysis(request: NextRequest, deps: Dependencies = {}) {
  const writes = new Map<string, { name: string; value: string; options: CookieOptions }>()
  const current = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]))
  const headers = new Headers({ ...AUTH_RESPONSE_HEADERS, 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' })
  const finish = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, { status, headers })
    for (const cookie of writes.values()) response.cookies.set(cookie.name, cookie.value, cookie.options)
    return response
  }
  let config
  try { config = readPortalConfig(deps.env) } catch { return finish({ enabled: false, error: 'Website analysis is not configured yet.' }, 503) }
  if (request.headers.get('host') !== 'app.picshaw.com' || new URL(request.url).origin !== config.origin || request.method !== 'POST' || request.headers.get('origin') !== config.origin || (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin') || request.nextUrl.search) return finish({ error: 'Open the portal to continue.' }, 403)
  const enabled = (deps.env ?? process.env).PIC_SHAW_ANALYSIS_ENABLED === 'true'
  const workspace = deps.workspace === undefined ? deploymentWorkspaceStore() : deps.workspace
  if (config.accessMode !== 'pilot' || !config.sessionEnabled || !enabled || !workspace) return finish({ enabled: false, error: 'Website analysis is not enabled for this deployment.' }, 503)
  let body
  try {
    body = await smallBody(request)
    if (Object.keys(body).some(key => key !== 'url' && key !== 'consent') || body.consent !== true || typeof body.url !== 'string' || body.url.length > 2048) throw Error()
  } catch { return finish({ error: 'Invalid analysis request.' }, 400) }
  try {
    const admission = await (deps.admit ?? checkDeploymentAuthAdmission)({ request, action: 'workspace-read' })
    if (admission.status !== 'allow') return finish({ error: 'Analysis requests are temporarily unavailable. Try again later.' }, admission.status === 'limited' ? 429 : 503)
    const client = (deps.createClient ?? createRequestSupabaseClient)({ getAll: () => Array.from(current, ([name, value]) => ({ name, value })),
      setAll: (cookies, extra) => { for (const cookie of cookies) { writes.set(cookie.name, cookie); current.set(cookie.name, cookie.value) }; Object.entries(extra).forEach(([key, value]) => headers.set(key, value)) },
    }, deps.env)
    let actor
    try { actor = await requireWorkspaceActor(client, config.url, deps.env) } catch { return finish({ error: 'Sign in again to analyze your website.' }, 401) }
    const selected = await workspace(actor, null)
    if (!selected) return finish({ error: 'Create your workspace first.' }, 409)
    const analysis = await (deps.analyze ?? analyzeWebsite)(body.url as string)
    // A successful fetch does not preserve authority after logout or membership removal.
    const currentActor = await requireWorkspaceActor(client, config.url, deps.env)
    const currentWorkspace = await workspace(currentActor, null)
    if (currentActor.id !== actor.id || currentActor.sessionId !== actor.sessionId || currentWorkspace?.id !== selected.id) return finish({ error: 'Access changed. Sign in and try again.' }, 401)
    return finish({ enabled: true, analysis })
  } catch {
    return finish({ error: 'This public HTML page could not be safely analyzed. Check the HTTPS URL and try again.' }, 503)
  }
}

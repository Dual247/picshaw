import 'server-only'
import { randomUUID } from 'node:crypto'
import type { WorkspaceActor } from '../supabase/workspace-runtime'
import { createGscAdapter, type ConnectionResolver } from './gsc'
import { PlatformError } from './core'
import type { JourneyResolver } from './journey'
import { tokenCipher, randomSecret, digest, challenge } from './gsc-crypto'
import { googleProvider } from './gsc-provider'

export type GscStore = (actor: WorkspaceActor, organizationId: string, operation: string, payload: Record<string, unknown>) => Promise<Record<string, unknown>>
export type GscIdentity = { actor: WorkspaceActor; organizationId: string }
export type GscStatus = { connectionId: string | null; status: string; selectedProperty: string | null; revocationPending: boolean }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const nonce = /^[A-Za-z0-9_-]{43}$/
export function createGscLifecycle(deps: { store: GscStore; cipher: ReturnType<typeof tokenCipher>; provider: ReturnType<typeof googleProvider>; transport?: typeof fetch }) {
  const { store, cipher, provider } = deps
  const call = (identity: GscIdentity, operation: string, payload: Record<string, unknown> = {}) => store(identity.actor, identity.organizationId, operation, payload)
  const aad = (id: GscIdentity, connection: string, actor: string, generation: number) => `gsc:v1:${id.organizationId}:${connection}:${actor}:${generation}`
  const stateAad = (id: GscIdentity, state: string) => `gsc-pkce:v1:${id.organizationId}:${id.actor.id}:${id.actor.sessionId}:${state}`
  const validateConnection = (connection: string) => { if (!uuid.test(connection)) throw new PlatformError('UNAUTHORIZED', 'Invalid connection.') }
  async function access(identity: GscIdentity, connection: string) {
    validateConnection(connection)
    const lease = randomUUID(), record = await call(identity, 'claim', { connection, lease })
    const generation = Number(record.generation), tokenGeneration = Number(record.tokenGeneration)
    if (!Number.isSafeInteger(generation) || !Number.isSafeInteger(tokenGeneration) || typeof record.tokenActor !== 'string' || typeof record.token !== 'string') throw Error('Invalid private record')
    const context = aad(identity, connection, record.tokenActor, tokenGeneration)
    let tokens
    try { tokens = await provider.refresh(cipher.open(record.token, context)) }
    catch (error) {
      if (error instanceof PlatformError && error.code === 'RECONNECT_REQUIRED') await call(identity, 'invalid', { connection, generation, lease })
      throw error
    }
    await call(identity, 'refreshed', { connection, generation, lease, ...(tokens.refreshToken ? { token: cipher.seal(tokens.refreshToken, context) } : {}) })
    return { token: tokens.accessToken, generation }
  }
  const resolver = (identity: GscIdentity): ConnectionResolver => ({
    async resolve(actorId, organizationId, connectionId) {
      if (actorId !== identity.actor.id || organizationId !== identity.organizationId) return null
      const value = await access(identity, connectionId)
      return { organizationId, connectionId, accessToken: value.token }
    },
  })
  return {
    async status(identity: GscIdentity): Promise<GscStatus> {
      const value = await call(identity, 'status')
      return { connectionId: typeof value.connectionId === 'string' ? value.connectionId : null,
        status: typeof value.status === 'string' ? value.status : 'not_connected',
        selectedProperty: typeof value.selectedProperty === 'string' ? value.selectedProperty : null,
        revocationPending: value.revocationPending === true }
    },
    async start(identity: GscIdentity) {
      const state = randomSecret(), browser = randomSecret(), verifier = randomSecret(), connection = randomUUID()
      await call(identity, 'start', { state: digest(state), browser: digest(browser), connection, verifier: cipher.seal(verifier, stateAad(identity, state)) })
      return { url: provider.authorization(state, challenge(verifier)), browser }
    },
    async callback(identity: GscIdentity, state: string, browser: string, code: string | null, denied: boolean) {
      if (!nonce.test(state) || !nonce.test(browser) || (!denied && (!code || code.length > 4096))) throw Error('Invalid authorization response')
      const binding = { state: digest(state), browser: digest(browser) }
      if (denied) { await call(identity, 'cancel', binding); return }
      // Consumed durably BEFORE the external exchange; ambiguous results cannot be replayed.
      const attempt = await call(identity, 'consume', binding)
      const connection = String(attempt.connectionId), generation = Number(attempt.generation)
      validateConnection(connection)
      if (!Number.isSafeInteger(generation) || typeof attempt.verifier !== 'string') throw Error('Invalid authorization attempt')
      const tokens = await provider.exchange(code!, cipher.open(attempt.verifier, stateAad(identity, state)))
      await call(identity, 'complete', { ...binding, token: cipher.seal(tokens.refreshToken!, aad(identity, connection, identity.actor.id, generation)) })
    },
    async properties(identity: GscIdentity, connection: string, selected?: string) {
      const credential = await access(identity, connection)
      const adapter = createGscAdapter({ resolve: async (actor, org, id) => actor === identity.actor.id && org === identity.organizationId && id === connection ? { organizationId: org, connectionId: id, accessToken: credential.token } : null }, deps.transport)
      const properties = (await adapter.listProperties(identity.actor.id, identity.organizationId, connection))
        .filter(item => ['siteOwner','siteFullUser','siteRestrictedUser'].includes(item.permissionLevel))
      if (selected !== undefined && (!selected || selected.length > 2048 || !properties.some(item => item.siteUrl === selected))) throw new PlatformError('PROPERTY_ACCESS_DENIED', 'Choose an exact property returned by Google.')
      await call(identity, selected === undefined ? 'check' : 'select', { connection, generation: credential.generation, ...(selected === undefined ? {} : { property: selected }) })
      return properties
    },
    async disconnect(identity: GscIdentity, connection: string) {
      validateConnection(connection)
      // Local access is disabled durably before any provider call. Keep encrypted
      // revocation material until Google confirms; repeated clicks retry same token.
      const value = await call(identity, 'disconnect', { connection })
      if (typeof value.token !== 'string') return { revocationPending: false }
      const token = cipher.open(value.token, aad(identity, connection, String(value.tokenActor), Number(value.tokenGeneration)))
      const revoked = await provider.revoke(token)
      if (revoked) await call(identity, 'revoked', { connection, generation: value.generation })
      return { revocationPending: !revoked }
    },
    // One short-lived access token per bounded report, never serialized. Recheck
    // persisted generation and selection before every provider snapshot read.
    async snapshotReader(identity: GscIdentity, connection: string) {
      const credential = await access(identity, connection)
      const adapter = createGscAdapter({ resolve: async (actor, org, id) => actor === identity.actor.id && org === identity.organizationId && id === connection ? { organizationId: org, connectionId: id, accessToken: credential.token } : null }, deps.transport)
      return { async readSnapshot(input: Parameters<typeof adapter.readSnapshot>[0]) {
        if (input.actorId !== identity.actor.id || input.organizationId !== identity.organizationId || input.connectionId !== connection) throw new PlatformError('UNAUTHORIZED', 'Workspace authorization is required.')
        const checked = await call(identity, 'check', { connection, generation: credential.generation })
        if (checked.selectedProperty !== input.propertyId) throw new PlatformError('UNAUTHORIZED', 'The selected property changed.')
        return adapter.readSnapshot(input)
      } }
    },
    resolver,
    journeyResolver(identity: GscIdentity): JourneyResolver {
      return { async resolve(selection) {
        if (selection.organizationId !== identity.organizationId) return null
        const value = await call(identity, 'status')
        if (value.status !== 'active' || value.connectionId !== selection.connectionId || value.selectedProperty !== selection.propertyId) return null
        return { ...selection, actorId: identity.actor.id }
      } }
    },
  }
}

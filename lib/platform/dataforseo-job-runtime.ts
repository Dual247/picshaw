import 'server-only'
import postgres from 'postgres'
import { createSupabasePoolerTls } from '../supabase/database-tls'
import type { WorkspaceActor } from '../supabase/workspace-runtime'
import { createDataForSeoRun } from './dataforseo-runtime'
import { planMentions } from './dataforseo-provider'
import { enqueueDataForSeoJob, executeDataForSeoJob, type DataForSeoJobStore, type JobLease } from './dataforseo-jobs'
import type { DataForSeoJob } from './dataforseo-types'

type Environment = Record<string, string | undefined>
export type DataForSeoGateway = {
  submit(input: {platform:'google'|'chat_gpt';jobId:string}):Promise<DataForSeoJob>;
  read(jobId:string):Promise<DataForSeoJob>;
  latest(platform:'google'|'chat_gpt'):Promise<DataForSeoJob|null>;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function job(value: unknown, requireResult = true): DataForSeoJob {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Job unavailable')
  const row=value as DataForSeoJob
  if (!uuid.test(row.jobId) || typeof row.domain!=='string' || !['google','chat_gpt'].includes(row.platform) || row.rowLimit!==20 || !['queued','running','completed','failed','uncertain'].includes(row.state) || typeof row.createdAt!=='string') throw Error('Job unavailable')
  if (requireResult && row.state==='completed' && (!row.result || row.result.source!=='dataforseo-llm-mentions' || row.result.domain!==row.domain || row.result.platform!==row.platform)) throw Error('Job unavailable')
  return {jobId:row.jobId,domain:row.domain,platform:row.platform,rowLimit:row.rowLimit,state:row.state,createdAt:row.createdAt,updatedAt:row.updatedAt,...(row.state==='completed' && row.result?{result:row.result}:{})}
}
// Called only after verified portal auth and workspace resolution. No browser IDs.
export function createDataForSeoGateway(actor:WorkspaceActor, workspace:{id:string;site:string}, env:Environment=process.env):DataForSeoGateway|null {
  if (env.VERCEL!=='1'||env.VERCEL_ENV!=='production'||env.PIC_SHAW_AUTH_ORIGIN!=='https://app.picshaw.com'||env.PIC_SHAW_PORTAL_ACCESS_MODE!=='pilot'||env.PIC_SHAW_DATAFORSEO_ENABLED!=='true')return null
  if (![actor.id,actor.sessionId,workspace.id].every(id=>uuid.test(id))||!Number.isSafeInteger(actor.expiresAt)||actor.expiresAt<=Date.now()/1000)return null
  const ref=/^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(env.NEXT_PUBLIC_SUPABASE_URL??'')?.[1]
  const host=env.PIC_SHAW_DATAFORSEO_DB_HOST??'',password=env.PIC_SHAW_DATAFORSEO_DB_PASSWORD??''
  if(!ref||!/^[a-z0-9]+(?:-[a-z0-9]+)*\.pooler\.supabase\.com$/.test(host)||password.length<32||password.length>256)return null
  const sql=postgres({host,port:6543,database:'postgres',username:`picshaw_dataforseo.${ref}`,password,ssl:createSupabasePoolerTls(host),prepare:false,max:2,max_pipeline:1,connect_timeout:2,queue_timeout:2,query_timeout:3,cancel_timeout:1,idle_timeout:10,max_lifetime:60,fetch_types:false,onnotice:()=>{},debug:false})
  const store:DataForSeoJobStore={
    enqueue:async input=>{
      const rows=await sql`select picshaw_dataforseo_private.enqueue(${actor.id}::uuid,${actor.sessionId}::uuid,${actor.expiresAt}::bigint,${workspace.id}::uuid,${input.jobId}::text,${input.domain}::text,${input.platform}::text,20::integer) as value`.signal(AbortSignal.timeout(4000))
      if(rows.length!==1)throw Error('Job unavailable');return job(rows[0].value,false)
    },
    start:async jobId=>{
      const rows=await sql`select picshaw_dataforseo_private.start_job(${actor.id}::uuid,${actor.sessionId}::uuid,${actor.expiresAt}::bigint,${workspace.id}::uuid,${jobId}::text) as value`.signal(AbortSignal.timeout(4000))
      if(rows.length!==1)throw Error('Job unavailable')
      if(rows[0].value===null)return null
      const value=rows[0].value as JobLease
      if(!uuid.test(value.lease)||typeof value.domain!=='string'||!['google','chat_gpt'].includes(value.platform)||value.rowLimit!==20)throw Error('Job unavailable')
      return value
    },
    // Bind serialized JSON as text: postgres.js otherwise JSON-encodes the string
    // again when PostgreSQL infers a jsonb parameter, producing a JSON string.
    complete:async(jobId,lease,evidence)=>{await sql`select picshaw_dataforseo_private.complete_job(${actor.id}::uuid,${actor.sessionId}::uuid,${workspace.id}::uuid,${jobId}::text,${lease}::uuid,${JSON.stringify(evidence)}::text::jsonb)`.signal(AbortSignal.timeout(4000))},
    fail:async(jobId,lease,reason)=>{await sql`select picshaw_dataforseo_private.fail_job(${actor.id}::uuid,${actor.sessionId}::uuid,${workspace.id}::uuid,${jobId}::text,${lease}::uuid,${reason}::text)`.signal(AbortSignal.timeout(4000))},
    read:async jobId=>{
      const rows=await sql`select picshaw_dataforseo_private.read_job(${actor.id}::uuid,${actor.sessionId}::uuid,${actor.expiresAt}::bigint,${workspace.id}::uuid,${jobId}::text) as value`.signal(AbortSignal.timeout(4000))
      if(rows.length!==1)throw Error('Job unavailable');return job(rows[0].value)
    },
  }
  return {
    submit:async({platform,jobId})=>{
      if(!uuid.test(jobId))throw Error('Job unavailable')
      const plan=planMentions({domain:workspace.site,platform,limit:20})
      // Check provider configuration before persisting a nonrecoverable dispatch.
      const run=createDataForSeoRun(env)
      if(!run||!(env.PIC_SHAW_DATAFORSEO_APPROVED_DOMAINS??'').split(',').includes(plan.domain))throw Error('Job unavailable')
      const queued=await enqueueDataForSeoJob({domain:plan.domain,platform,jobId},store)
      if(queued.state!=='queued')return store.read(queued.jobId)
      return executeDataForSeoJob(queued.jobId,{store,run:input=>run({...input,actor,workspaceId:workspace.id})})
    },
    read:async jobId=>{if(!uuid.test(jobId))throw Error('Job unavailable');return store.read(jobId)},
    latest:async platform=>{
      if(!['google','chat_gpt'].includes(platform))throw Error('Job unavailable')
      const rows=await sql`select picshaw_dataforseo_private.latest_job(${actor.id}::uuid,${actor.sessionId}::uuid,${actor.expiresAt}::bigint,${workspace.id}::uuid,${platform}::text) as value`.signal(AbortSignal.timeout(4000))
      if(rows.length!==1)throw Error('Job unavailable');return rows[0].value===null?null:job(rows[0].value)
    },
  }
}

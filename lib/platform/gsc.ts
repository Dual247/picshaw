import 'server-only'
import { GSC_TIMEZONE, PlatformError, validateWindow, type Snapshot, type Observation, type Window } from './core'
export const GSC_SCOPE='https://www.googleapis.com/auth/webmasters.readonly'
export type AuthorizedConnection={organizationId:string;connectionId:string;accessToken:string}
// Resolve MUST authenticate actor membership and connection ownership; never trust browser tenant IDs.
export interface ConnectionResolver { resolve(actorId:string,organizationId:string,connectionId:string):Promise<AuthorizedConnection|null> }
export type Property={siteUrl:string;permissionLevel:string}
const base='https://www.googleapis.com/webmasters/v3/sites'
function record(v:unknown):v is Record<string,unknown>{return typeof v==='object' && v!==null && !Array.isArray(v)}
export function createGscAdapter(resolver:ConnectionResolver,transport:typeof fetch=fetch){
 async function connection(actorId:string,organizationId:string,connectionId:string){
  if(!actorId || !organizationId || !connectionId) throw new PlatformError('UNAUTHORIZED','Authenticated workspace and connection required.')
  const c=await resolver.resolve(actorId,organizationId,connectionId)
  if(!c || c.organizationId!==organizationId || c.connectionId!==connectionId || !c.accessToken) throw new PlatformError('UNAUTHORIZED','Connection ownership could not be established.')
  return c
 }
 async function request(url:string,token:string,body?:object):Promise<Record<string,unknown>>{
  let response:Response
  try{response=await transport(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)})}catch{throw new PlatformError('PROVIDER_UNAVAILABLE','Search Console request failed or timed out.')}
  if(!response.ok) throw new PlatformError(response.status===401?'RECONNECT_REQUIRED':response.status===403?'PROPERTY_ACCESS_DENIED':response.status===429?'RATE_LIMITED':'PROVIDER_UNAVAILABLE','Search Console could not return data. No sample data was substituted.')
  let value:unknown
  try{value=await response.json()}catch{throw new PlatformError('INVALID_RESPONSE','Invalid Search Console JSON.')}
  if(!record(value)) throw new PlatformError('INVALID_RESPONSE','Invalid Search Console response.')
  return value
 }
 async function properties(c:AuthorizedConnection):Promise<Property[]>{
  const data=await request(base,c.accessToken)
  if(data.siteEntry===undefined)return []
  if(!Array.isArray(data.siteEntry))throw new PlatformError('INVALID_RESPONSE','Invalid property list.')
  return data.siteEntry.map((p:unknown)=>{if(!record(p)||typeof p.siteUrl!=='string'||typeof p.permissionLevel!=='string')throw new PlatformError('INVALID_RESPONSE','Invalid property entry.');return {siteUrl:p.siteUrl,permissionLevel:p.permissionLevel}})
 }
 return {
  async listProperties(actorId:string,organizationId:string,connectionId:string){return properties(await connection(actorId,organizationId,connectionId))},
  async readSnapshot(input:{actorId:string;organizationId:string;connectionId:string;propertyId:string;snapshotId:string;runId:string;window:Window;dimensions:Snapshot['dimensions'];maxPages?:number}):Promise<Snapshot>{
   validateWindow(input.window)
   if(!input.propertyId||!input.snapshotId||!input.runId||!Array.isArray(input.dimensions)||input.dimensions.some(d=>!['date','page','query'].includes(d))||new Set(input.dimensions).size!==input.dimensions.length)throw new PlatformError('INVALID_REQUEST','Invalid snapshot identifiers or dimensions.')
   const maxPages=input.maxPages??4
   if(!Number.isInteger(maxPages)||maxPages<1||maxPages>10)throw new PlatformError('INVALID_REQUEST','Pagination limit must be 1-10.')
   const c=await connection(input.actorId,input.organizationId,input.connectionId)
   if(!(await properties(c)).some(p=>p.siteUrl===input.propertyId&&['siteOwner','siteFullUser','siteRestrictedUser'].includes(p.permissionLevel)))throw new PlatformError('PROPERTY_ACCESS_DENIED','Selected property is not accessible to this Google connection.')
   const rows:Observation[]=[],seen=new Set<string>(),warnings=['Google returns available top rows, not guaranteed exhaustive data. Anonymized queries are omitted. Final-only requests can still have missing dates.']
   let bounded=false
   for(let page=0;page<maxPages;page++){
    const data=await request(`${base}/${encodeURIComponent(input.propertyId)}/searchAnalytics/query`,c.accessToken,{startDate:input.window.start,endDate:input.window.end,type:'web',dataState:'final',dimensions:input.dimensions,rowLimit:1000,startRow:page*1000})
    if(data.metadata!==undefined){if(!record(data.metadata))throw new PlatformError('INVALID_RESPONSE','Invalid metadata.');if(data.metadata.first_incomplete_date||data.metadata.first_incomplete_hour){bounded=true;warnings.push('Provider signaled incomplete data; review actions suppressed.')}}
    const batch=data.rows??[]
    if(!Array.isArray(batch)||batch.length>1000)throw new PlatformError('INVALID_RESPONSE','Invalid search rows.')
    for(const raw of batch){
     if(!record(raw)||![raw.clicks,raw.impressions,raw.position].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)||(raw.clicks as number)>(raw.impressions as number))throw new PlatformError('INVALID_RESPONSE','Invalid metrics.')
     const keys=raw.keys??[]
     if(!Array.isArray(keys)||keys.length!==input.dimensions.length||keys.some(k=>typeof k!=='string')||seen.has(JSON.stringify(keys)))throw new PlatformError('INVALID_RESPONSE','Invalid or repeated row keys.')
     seen.add(JSON.stringify(keys));const clicks=raw.clicks as number,impressions=raw.impressions as number
     rows.push({keys,clicks,impressions,ctr:impressions?clicks/impressions:0,position:impressions?raw.position as number:null})
    }
    if(batch.length<1000)break
    if(page===maxPages-1){bounded=true;warnings.push('Configured pagination bound reached; review actions suppressed.')}
   }
   return {id:input.snapshotId,organizationId:input.organizationId,propertyId:input.propertyId,runId:input.runId,source:'google-search-console',retrievedAt:new Date().toISOString(),timezone:GSC_TIMEZONE,window:{...input.window},searchType:'web',filters:[],dimensions:[...input.dimensions],dataState:'final',coverage:bounded?'bounded':'available-rows',warnings,rows}
  }
 }
}


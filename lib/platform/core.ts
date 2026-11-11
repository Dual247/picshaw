export const GSC_TIMEZONE = 'America/Los_Angeles' as const
export type Window = { start: string; end: string }
export type Metrics = { clicks: number; impressions: number; ctr: number; position: number | null }
export type Observation = Metrics & { keys: string[] }
export type Snapshot = {
 id: string; organizationId: string; propertyId: string; runId: string; source: 'google-search-console'; retrievedAt: string;
 timezone: typeof GSC_TIMEZONE; window: Window; searchType: 'web'; filters: []; dimensions: ('date' | 'page' | 'query')[];
 dataState: 'final'; coverage: 'available-rows' | 'bounded'; warnings: string[]; rows: Observation[]
}
export type Action = { id: string; rule: string; title: string; reason: string; page: string; current: Observation; prior: Observation | null; snapshotId: string; priorSnapshotId: string; ruleVersion: '1'; status: 'open' }
export class PlatformError extends Error { constructor(public code: string, message: string) { super(message); this.name = 'PlatformError' } }
export function validateWindow(window: Window) {
 for (const d of [window.start, window.end]) {
  const date = new Date(d + 'T00:00:00Z')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== d) throw new PlatformError('INVALID_WINDOW','Invalid calendar date.')
 }
 if (window.start > window.end || Date.parse(window.end)-Date.parse(window.start) > 89*86400000) throw new PlatformError('INVALID_WINDOW','Window must contain 1-90 days.')
}
function shift(date: string, days: number) { const d = new Date(date+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10) }
// Conservative requested windows, not a guarantee that Google has finalized every date.
export function completedWindows(now = new Date(), days = 28, lagDays = 3): { current: Window; prior: Window } {
 if (!Number.isInteger(days) || days < 1 || days > 90 || !Number.isInteger(lagDays) || lagDays < 1 || lagDays > 30) throw new PlatformError('INVALID_WINDOW','Invalid period length or lag.')
 const parts = new Intl.DateTimeFormat('en-US',{timeZone:GSC_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
 const get = (type: string) => parts.find(p=>p.type===type)!.value
 const end = shift(`${get('year')}-${get('month')}-${get('day')}`,-lagDays), start = shift(end,1-days)
 return {current:{start,end},prior:{start:shift(start,-days),end:shift(start,-1)}}
}
// Disjoint rows at one grain only. Query/page sums must not replace separately fetched property totals.
export function aggregate(rows: Metrics[]): Metrics {
 const clicks=rows.reduce((s,r)=>s+r.clicks,0), impressions=rows.reduce((s,r)=>s+r.impressions,0)
 const known=rows.filter(r=>r.position!==null && r.impressions>0), weight=known.reduce((s,r)=>s+r.impressions,0)
 return {clicks,impressions,ctr:impressions?clicks/impressions:0,position:weight===impressions && weight>0?known.reduce((s,r)=>s+r.position!*r.impressions,0)/weight:null}
}
export function buildActions(current: Snapshot, prior: Snapshot): Action[] {
 validateWindow(current.window); validateWindow(prior.window)
 for (const s of [current, prior]) {
  if (s.source !== 'google-search-console' || s.dataState !== 'final' || s.searchType !== 'web' || s.timezone !== GSC_TIMEZONE || !Array.isArray(s.filters) || s.filters.length !== 0 || !['available-rows','bounded'].includes(s.coverage)) throw new PlatformError('SNAPSHOT_MISMATCH','Unsupported source, finality, filters or coverage.')
 }
 if (current.organizationId!==prior.organizationId || current.propertyId!==prior.propertyId || current.searchType!==prior.searchType || current.timezone!==prior.timezone || JSON.stringify(current.filters)!==JSON.stringify(prior.filters) || current.dimensions.join(',')!=='page' || prior.dimensions.join(',')!=='page' || shift(prior.window.end,1)!==current.window.start || Date.parse(current.window.end)-Date.parse(current.window.start)!==Date.parse(prior.window.end)-Date.parse(prior.window.start)) throw new PlatformError('SNAPSHOT_MISMATCH','Actions require comparable adjacent page snapshots.')
 if (current.coverage==='bounded' || prior.coverage==='bounded') return []
 const previous=new Map(prior.rows.map(r=>[r.keys[0],r])), actions: Action[]=[]
 for (const row of current.rows) {
  const old=previous.get(row.keys[0])??null
  const add=(rule:string,title:string,reason:string)=>actions.push({id:`${current.id}:${rule}:${row.keys[0]}`,rule,title,reason,page:row.keys[0],current:row,prior:old,snapshotId:current.id,priorSnapshotId:prior.id,ruleVersion:'1',status:'open'})
  if(old && old.clicks>=30 && old.impressions>=200 && row.impressions>=200 && row.clicks<=old.clicks*.7) add('click-decline','Investigate declining clicks','Clicks fell at least 30% from 30+ baseline clicks. Review demand, ranking and page changes; the cause is not established.')
  if(row.impressions>=500 && row.position!==null && row.position>=8 && row.position<=20) add('ranking-opportunity','Review a page near page-one positions','At least 500 impressions and average position 8-20. Inspect relevant queries and content fit; averages hide variation.')
  if(old && row.impressions>=500 && old.impressions>=500 && row.position!==null && old.position!==null && Math.abs(row.position-old.position)<=1 && old.ctr>0 && row.ctr<=old.ctr*.7) add('ctr-decline','Review declining click-through rate','CTR fell at least 30% while average position changed by at most one. Review query mix and search presentation before editing.')
 }
 return actions.sort((a,b)=>b.current.impressions-a.current.impressions || a.id.localeCompare(b.id)).slice(0,3)
}
export function buildReport(selection:{organizationId:string;propertyId:string;snapshotId:string},current:Snapshot,prior:Snapshot) {
 if(selection.organizationId!==current.organizationId || selection.propertyId!==current.propertyId || selection.snapshotId!==current.id) throw new PlatformError('SNAPSHOT_MISMATCH','Report does not match the selected snapshot.')
 const actions=buildActions(current,prior)
 // Return copied structured data, not executable markup. Render with escaped text nodes.
 return JSON.parse(JSON.stringify({version:1,current,prior,actions,disclaimer:'GSC observations only. Available API rows are not exhaustive. Completion is not proof of improvement. No AI visibility or crawl findings are inferred.'})) as {version:number;current:Snapshot;prior:Snapshot;actions:Action[];disclaimer:string}
}


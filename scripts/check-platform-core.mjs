import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
function load(name, deps={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(`lib/platform/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,module:{exports},Date,Intl,URL,Response,AbortSignal,fetch:()=>{throw Error('REAL NETWORK FORBIDDEN')},require:n=>{if(n==='server-only')return {};if(n in deps)return deps[n];throw Error(n)}});return exports}
const core=load('core'),gsc=load('gsc',{'./core':core}),results=[]
async function test(name,fn){await fn();results.push(name);console.log(`PASS ${name}`)}
const row=(clicks=20,impressions=1000,position=10,key='https://example.com/a')=>({keys:[key],clicks,impressions,ctr:clicks/impressions,position})
const windows=core.completedWindows(new Date('2026-11-10T12:00:00Z'))
const snapshot=(prior=false)=>({id:prior?'prior':'current',organizationId:'org',propertyId:'sc-domain:example.com',runId:'run',source:'google-search-console',retrievedAt:'2026-11-10T12:00:00Z',timezone:core.GSC_TIMEZONE,window:prior?windows.prior:windows.current,searchType:'web',filters:[],dimensions:['page'],dataState:'final',coverage:'available-rows',warnings:[],rows:[row(prior?100:20)]})
await test('Pacific date rather than UTC boundary',()=>{assert.equal(core.completedWindows(new Date('2026-11-10T01:00:00Z')).current.end,'2026-11-06')})
await test('28-day adjacent windows across DST',()=>{assert.equal(windows.current.start,'2026-10-11');assert.equal(windows.current.end,'2026-11-07');assert.equal(windows.prior.end,'2026-10-10')})
await test('leap date and invalid windows',()=>{core.validateWindow({start:'2024-02-29',end:'2024-03-01'});assert.throws(()=>core.validateWindow({start:'2025-02-29',end:'2025-03-01'}));assert.throws(()=>core.completedWindows(new Date(),0))})
await test('CTR and impression-weighted position',()=>{const m=core.aggregate([row(5,100,2),row(90,900,10)]);assert.equal(m.ctr,.095);assert.equal(m.position,9.2);assert.equal(core.aggregate([]).position,null);assert.equal(core.aggregate([row(5,100,null)]).position,null)})
await test('three evidence-backed actions',()=>{const a=core.buildActions(snapshot(),snapshot(true));assert.equal(a.length,3);assert.ok(a.every(x=>x.snapshotId==='current'&&x.priorSnapshotId==='prior'));assert.ok(a.some(x=>x.rule==='click-decline'))})
await test('sparse and empty data do not fabricate actions',()=>{assert.equal(core.buildActions({...snapshot(),rows:[row(1,5,10)]},snapshot(true)).length,0);assert.equal(core.buildActions({...snapshot(),rows:[]},snapshot(true)).length,0)})
await test('partial coverage suppresses actions',()=>assert.equal(core.buildActions({...snapshot(),coverage:'bounded'},snapshot(true)).length,0))
await test('comparison rejects property, tenant, window and dimensions mismatch',()=>{for(const patch of [{propertyId:'other'},{organizationId:'other'},{window:windows.current},{dimensions:['query']}])assert.throws(()=>core.buildActions(snapshot(),{...snapshot(true),...patch}),e=>e.code==='SNAPSHOT_MISMATCH')})
await test('selected report validates identity and copies input',()=>{const s=snapshot();const r=core.buildReport({organizationId:'org',propertyId:s.propertyId,snapshotId:s.id},s,snapshot(true));s.rows[0].clicks=999;assert.equal(r.current.rows[0].clicks,20);assert.throws(()=>core.buildReport({organizationId:'other',propertyId:s.propertyId,snapshotId:s.id},s,snapshot(true)))})
const input={actorId:'actor',organizationId:'org',connectionId:'connection',propertyId:'sc-domain:example.com',snapshotId:'current',runId:'run',window:windows.current,dimensions:['page']}
const resolve=async(_a,organizationId,connectionId)=>({organizationId,connectionId,accessToken:'mock-only'})
function provider(payload={rows:[row()]},status=200){const calls=[];return {calls,fetch:async(url,options)=>{calls.push({url,options});return calls.length===1?Response.json({siteEntry:[{siteUrl:input.propertyId,permissionLevel:'siteOwner'}]}):Response.json(payload,{status})}}}
await test('adapter fixed endpoint, preserved property and final provenance',async()=>{const p=provider(),s=await gsc.createGscAdapter({resolve},p.fetch).readSnapshot(input);assert.equal(s.propertyId,input.propertyId);assert.equal(s.dataState,'final');assert.equal(s.rows[0].ctr,.02);assert.ok(p.calls[1].url.includes('sc-domain%3Aexample.com'));const q=JSON.parse(p.calls[1].options.body);assert.equal(q.dataState,'final');assert.equal(q.type,'web');assert.equal(p.calls[1].options.redirect,'error');assert.ok(!JSON.stringify(s).includes('mock-only'))})
await test('unknown ownership prevents all requests',async()=>{let called=false;await assert.rejects(gsc.createGscAdapter({resolve:async()=>null},async()=>{called=true}).readSnapshot(input),e=>e.code==='UNAUTHORIZED');assert.equal(called,false)})
await test('property permission checked before queries',async()=>{await assert.rejects(gsc.createGscAdapter({resolve},async()=>Response.json({siteEntry:[]})).readSnapshot(input),e=>e.code==='PROPERTY_ACCESS_DENIED')})
for(const [status,code]of [[401,'RECONNECT_REQUIRED'],[403,'PROPERTY_ACCESS_DENIED'],[429,'RATE_LIMITED'],[500,'PROVIDER_UNAVAILABLE']])await test(`provider ${status} fails without fallback`,async()=>{const p=provider({},status);await assert.rejects(gsc.createGscAdapter({resolve},p.fetch).readSnapshot(input),e=>e.code===code)})
await test('empty API response remains empty',async()=>{const p=provider({});assert.equal((await gsc.createGscAdapter({resolve},p.fetch).readSnapshot(input)).rows.length,0)})
await test('bounded pagination explicitly partial',async()=>{const p=provider({rows:Array.from({length:1000},(_,i)=>row(1,10,10,`https://example.com/${i}`))});const s=await gsc.createGscAdapter({resolve},p.fetch).readSnapshot({...input,maxPages:1});assert.equal(s.coverage,'bounded');assert.equal(s.rows.length,1000)})
await test('provider incomplete metadata suppresses recommendations',async()=>{const p=provider({rows:[row()],metadata:{first_incomplete_date:'2026-11-07'}});assert.equal((await gsc.createGscAdapter({resolve},p.fetch).readSnapshot(input)).coverage,'bounded')})
await test('malformed and repeated rows rejected',async()=>{for(const rows of [[row(-1)],[row(),row()]]){const p=provider({rows});await assert.rejects(gsc.createGscAdapter({resolve},p.fetch).readSnapshot(input),e=>e.code==='INVALID_RESPONSE')}})
await test('network failures sanitized',async()=>{await assert.rejects(gsc.createGscAdapter({resolve},async()=>{throw Error('secret')}).readSnapshot(input),e=>e.code==='PROVIDER_UNAVAILABLE'&&!e.message.includes('secret'))})
await test('initial discovery needs connection identity but no selected property',async()=>{
 const calls=[];const adapter=gsc.createGscAdapter({resolve},async(url)=>{calls.push(url);return Response.json({siteEntry:[{siteUrl:'https://example.com/subpath/',permissionLevel:'siteFullUser'}]})})
 const list=await adapter.listProperties('actor','org','connection');assert.equal(list[0].siteUrl,'https://example.com/subpath/');assert.equal(calls.length,1)
})
await test('cross-organization and mismatched connection denied before provider call',async()=>{
 for(const patch of [{organizationId:'other'},{connectionId:'other'}]){let calls=0;const adapter=gsc.createGscAdapter({resolve:async()=>({organizationId:'org',connectionId:'connection',accessToken:'mock-only',...patch})},async()=>{calls++;return Response.json({})});await assert.rejects(adapter.listProperties('actor','org','connection'),e=>e.code==='UNAUTHORIZED');assert.equal(calls,0)}
})
await test('unreadable and mismatched selected properties rejected',async()=>{
 for(const property of [{siteUrl:input.propertyId,permissionLevel:'siteUnverifiedUser'},{siteUrl:'https://example.com/',permissionLevel:'siteOwner'}]){let calls=0;const adapter=gsc.createGscAdapter({resolve},async()=>{calls++;return Response.json({siteEntry:[property]})});await assert.rejects(adapter.readSnapshot(input),e=>e.code==='PROPERTY_ACCESS_DENIED');assert.equal(calls,1)}
})
await test('huge date query rejected before network',async()=>{let calls=0;await assert.rejects(gsc.createGscAdapter({resolve},async()=>{calls++;return Response.json({})}).readSnapshot({...input,window:{start:'2020-01-01',end:'2026-01-01'}}),e=>e.code==='INVALID_WINDOW');assert.equal(calls,0)})
await test('runtime source and finality cannot bypass comparison or report validation',()=>{
 for(const patch of [{source:'demo'},{dataState:'all'},{searchType:'image'},{timezone:'UTC'},{coverage:'unknown'},{filters:[{country:'usa'}]}]){
  const current={...snapshot(),...patch},prior={...snapshot(true),...patch};assert.throws(()=>core.buildActions(current,prior),e=>e.code==='SNAPSHOT_MISMATCH');assert.throws(()=>core.buildReport({organizationId:'org',propertyId:current.propertyId,snapshotId:current.id},current,prior),e=>e.code==='SNAPSHOT_MISMATCH')
 }
})
console.log(`${results.length} platform core tests passed. All provider calls mocked; no external requests.`)


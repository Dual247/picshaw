import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const exports={}
vm.runInNewContext(ts.transpileModule(readFileSync('lib/platform/dataforseo-jobs.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,module:{exports},Error,require:name=>{assert.equal(name,'server-only');return {}}})
let state,calls,auth,lostAck,failComplete,reads,completes
const evidence={source:'dataforseo-llm-mentions',sampledRows:0}
const input={domain:'example.com',platform:'google',jobId:'job'}
function setup(){state='queued';calls=0;auth=true;lostAck=false;failComplete=false;reads=0;completes=0;return {store:{enqueue:async()=>({jobId:'job',state}),start:async()=>{if(state!=='queued')return null;state='running';return {lease:'lease',domain:'example.com',platform:'google',rowLimit:20}},complete:async(_job,lease,value)=>{completes++;assert.equal(lease,'lease');assert.equal(value,evidence);if(failComplete)throw Error('Store unavailable');state='completed';if(lostAck)throw Error('ACK lost')},fail:async()=>{if(state!=='completed')state='uncertain'},read:async()=>{reads++;if(!auth)throw Error('Revoked');return {jobId:'job',state,...(state==='completed'?{result:evidence}:{})}}},run:async value=>{calls++;assert.equal(value.domain,'example.com');return evidence}}}
let n=0;async function test(name,fn){await fn();n++;console.log('PASS '+name)}
await test('enqueue has no paid provider side effect',async()=>{const d=setup();await exports.enqueueDataForSeoJob(input,d.store);assert.equal(calls,0);assert.equal(state,'queued')})
await test('execute claims once persists then freshly reads',async()=>{const d=setup();const r=await exports.executeDataForSeoJob('job',d);assert.equal(calls,1);assert.equal(completes,1);assert.equal(reads,1);assert.equal(r.state,'completed');await exports.executeDataForSeoJob('job',d);assert.equal(calls,1)})
await test('overlapping runner cannot issue second paid call',async()=>{const d=setup();const r=await Promise.all([exports.executeDataForSeoJob('job',d),exports.executeDataForSeoJob('job',d)]);assert.equal(calls,1);assert.equal(r.length,2)})
await test('lost durable completion acknowledgement reads result without refetch',async()=>{const d=setup();lostAck=true;const r=await exports.executeDataForSeoJob('job',d);assert.equal(r.state,'completed');assert.equal(calls,1)})
await test('storage failure never returns in-memory evidence or retries provider',async()=>{const d=setup();failComplete=true;await assert.rejects(exports.executeDataForSeoJob('job',d));assert.equal(state,'uncertain');await exports.executeDataForSeoJob('job',d);assert.equal(calls,1)})
await test('provider failure leaves nonretryable uncertain job',async()=>{const d=setup();d.run=async()=>{calls++;throw Error('Private upstream')};await assert.rejects(exports.executeDataForSeoJob('job',d),error=>!error.message.includes('Private'));assert.equal(calls,1);assert.equal(state,'uncertain')})
await test('revocation before final read withholds retained evidence',async()=>{const d=setup();d.run=async()=>{calls++;auth=false;return evidence};await assert.rejects(exports.executeDataForSeoJob('job',d));assert.equal(state,'completed');assert.equal(calls,1)})
await test('lost start acknowledgement is not automatically retried',async()=>{const d=setup();d.store.start=async()=>{state='running';throw Error('ACK lost')};await assert.rejects(exports.executeDataForSeoJob('job',d));assert.equal(calls,0);assert.equal(state,'running')})
console.log(`${n} DataForSEO durable orchestration checks passed. Store/provider mocked; no network.`)

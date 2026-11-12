import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import vm from 'node:vm'
import { isIP } from 'node:net'
import { Parser } from 'htmlparser2'
import ts from 'typescript'
let records = [{address:'93.184.216.34',family:4}], pages = [], calls = [], dnsCalls = [], timeoutMode = false, dnsHangs = false
const exports = {}
function request(url, options, callback) {
  const req = new EventEmitter()
  req.destroy = error => { if(error)req.emit('error',error);req.emit('close');return req }
  req.end = () => queueMicrotask(() => {
    calls.push({url:url.href,options})
    options.lookup(url.hostname, {all:true}, (error,addresses) => { assert.equal(error,null); assert.deepEqual(JSON.parse(JSON.stringify(addresses)),[{address:records[0].address,family:4}]) })
    const page = pages.shift() ?? {}
    if (page.nextRecords) records = page.nextRecords
    if(page.hang)return
    const response = new EventEmitter();response.statusCode=page.status??200;response.headers=page.headers??{'content-type':'text/html; charset=utf-8'}
    let destroyed=false
    response.destroy=()=>{destroyed=true;req.emit('close')}
    callback(response)
    for(const chunk of page.chunks??[Buffer.from(page.html??'<title>Example</title><h1>Example</h1>')])if(!destroyed)response.emit('data',chunk)
    if(!destroyed){response.emit('end');req.emit('close')}
  })
  return req
}
vm.runInNewContext(ts.transpileModule(readFileSync('lib/platform/website-analysis.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,module:{exports},URL,Buffer,Date,Set,setTimeout:(fn,ms)=>setTimeout(fn,timeoutMode?Math.min(ms,10):ms),clearTimeout,
  require:name=>name==='server-only'?{}:name==='node:dns/promises'?{lookup:async(host,options)=>{dnsCalls.push({host,options});return dnsHangs?new Promise(()=>{}):records}}:name==='node:https'?{request}:name==='node:net'?{isIP}:name==='htmlparser2'?{Parser}:(()=>{throw Error(`Unexpected module ${name}`)})(),
})
const {analyzeWebsite,validateAnalysisUrl,isPublicAnalysisAddress,extractWebsiteEvidence}=exports
let count=0
async function test(name,fn){records=[{address:'93.184.216.34',family:4}];pages=[];calls=[];dnsCalls=[];timeoutMode=false;dnsHangs=false;await fn();count++;console.log(`PASS ${name}`)}
await test('rejects non-HTTPS credentials ports queries fragments and IP encodings before DNS',async()=>{
  for(const url of ['http://example.com','https://a:b@example.com','https://example.com:444','https://example.com/?token=secret','https://example.com/#fragment','https://127.0.0.1','https://2130706433','https://0x7f000001','https://[::1]','https://localhost','https://metadata.google.internal','https://example.com.','https://example.com/\n'])await assert.rejects(analyzeWebsite(url))
  assert.equal(dnsCalls.length,0);assert.equal(calls.length,0)
})
await test('rejects private special documentation and mapped addresses',()=>{
  for(const address of ['0.1.2.3','10.2.3.4','100.64.0.1','100.127.255.254','127.0.0.1','169.254.169.254','168.63.129.16','172.16.0.1','172.31.1.1','192.0.0.1','192.0.2.1','192.168.1.1','192.88.99.1','198.18.0.1','198.19.0.1','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','::ffff:127.0.0.1','2001:db8::1'])assert.equal(isPublicAnalysisAddress(address),false,address)
  for(const address of ['1.1.1.1','8.8.8.8','93.184.216.34','172.32.0.1','100.128.0.1'])assert.equal(isPublicAnalysisAddress(address),true,address)
})
await test('mixed DNS answers fail closed without any request',async()=>{
  records.push({address:'10.0.0.1',family:4});await assert.rejects(analyzeWebsite('https://example.com'),{code:'UNSAFE_TARGET'});assert.equal(calls.length,0)
})
await test('empty DNS response fails closed',async()=>{records=[];await assert.rejects(analyzeWebsite('https://example.com'),{code:'UNSAFE_TARGET'})})
await test('pins connection DNS with no cookies authorization or pooled agent',async()=>{
  await analyzeWebsite('https://example.com');assert.equal(calls.length,1);assert.equal(calls[0].options.agent,false);assert.equal(calls[0].options.family,4);assert.deepEqual(Object.keys(calls[0].options.headers),['Accept','Accept-Encoding','User-Agent']);assert.equal(dnsCalls[0].options.family,4)
})
await test('revalidates redirect URLs before their DNS resolution',async()=>{
  for(const location of ['https://127.0.0.1/','http://example.com/','https://example.com/?secret=x','https://user:pass@example.com']){pages=[{status:302,headers:{location}}];await assert.rejects(analyzeWebsite('https://example.com'))}
  assert.equal(calls.length,4);assert.equal(dnsCalls.length,4)
})
await test('redirect DNS is checked again and cannot switch to a private address',async()=>{
  pages=[{status:302,headers:{location:'https://other.example.com/'},nextRecords:[{address:'127.0.0.1',family:4}]}];await assert.rejects(analyzeWebsite('https://example.com'),{code:'UNSAFE_TARGET'});assert.equal(calls.length,1);assert.equal(dnsCalls.length,2)
})
await test('redirect loop and fourth redirect are bounded',async()=>{
  pages=[{status:302,headers:{location:'/'}}];await assert.rejects(analyzeWebsite('https://example.com'));assert.equal(calls.length,1)
  calls=[];pages=Array.from({length:4},(_,i)=>({status:302,headers:{location:`/next-${i}`}}));await assert.rejects(analyzeWebsite('https://example.com'));assert.equal(calls.length,4)
})
await test('successful redirect preserves requested and final provenance',async()=>{
  pages=[{status:302,headers:{location:'/landing'}},{html:'<title>Landing</title>'}];const result=await analyzeWebsite('https://example.com');assert.equal(result.url,'https://example.com/');assert.equal(result.finalUrl,'https://example.com/landing');assert.equal(result.title,'Landing');assert.equal(dnsCalls.length,2)
})
await test('rejects non-HTML compressed unsupported charset and error status',async()=>{
  for(const page of [{headers:{'content-type':'application/json'}},{headers:{'content-type':'text/html','content-encoding':'gzip'}},{headers:{'content-type':'text/html;charset=iso-8859-1'}},{status:403}]){pages=[page];await assert.rejects(analyzeWebsite('https://example.com'))}
})
await test('rejects declared and streamed oversized bodies',async()=>{
  pages=[{headers:{'content-type':'text/html','content-length':'1048577'}}];await assert.rejects(analyzeWebsite('https://example.com'),{code:'TOO_LARGE'})
  pages=[{chunks:[Buffer.alloc(600000),Buffer.alloc(600000)]}];await assert.rejects(analyzeWebsite('https://example.com'),{code:'TOO_LARGE'})
  assert.throws(()=>extractWebsiteEvidence('a'.repeat(1048577),'https://example.com','https://example.com'),{code:'TOO_LARGE'})
})
await test('total deadline bounds hanging DNS and response',async()=>{
  timeoutMode=true;dnsHangs=true;await assert.rejects(analyzeWebsite('https://example.com'),{code:'UNAVAILABLE'});assert.equal(calls.length,0)
  dnsHangs=false;pages=[{hang:true}];await assert.rejects(analyzeWebsite('https://example.com'),{code:'UNAVAILABLE'})
})
await test('extracts observed evidence without executing scripts or inventing scores',()=>{
  const result=extractWebsiteEvidence('<title>A &amp; B</title><meta name="description" content="Observed copy"><meta name="robots" content="noindex"><link rel="canonical" href="/canonical"><h1>Hello <em>world</em></h1><img src="x"><img alt=""><script type="application/ld+json">alert(1)</script>','https://example.com/','https://example.com/page')
  assert.equal(result.title,'A & B');assert.equal(result.description,'Observed copy');assert.equal(result.headings[0],'Hello world');assert.equal(result.headingCount,1);assert.equal(result.canonical,'https://example.com/canonical');assert.equal(result.images,2);assert.equal(result.imagesWithoutAlt,1);assert.equal(result.structuredDataBlocks,1);assert.ok(result.findings.some(f=>f.detail.includes('noindex')));assert.equal(result.score,undefined);assert.equal(result.limitations.length,3)
})
await test('text output stays bounded and unsafe canonical links are discarded',()=>{
  const result=extractWebsiteEvidence(`<title>${'x'.repeat(5000)}</title><link rel="canonical" href="javascript:alert(1)">${'<h1>Heading</h1>'.repeat(100)}`,'https://example.com/','https://example.com/')
  assert.equal(result.title.length,500);assert.equal(result.headings.length,20);assert.equal(result.headingCount,100);assert.equal(result.canonical,null)
})
console.log(`${count} website analysis checks passed; no real network requests.`)


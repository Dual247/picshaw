import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync('lib/google-conversions.ts','utf8')
const site = readFileSync('components/SiteAnalytics.tsx','utf8')
const policy = readFileSync('app/privacy-policy/page.tsx','utf8')
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const events=[]
const destinations=[]
const timers=new Map()
let id=0
const window={
  location:{href:'https://www.picshaw.com/',origin:'https://www.picshaw.com',assign:u=>destinations.push(u)},
  setTimeout:(fn,ms)=>{assert.equal(ms,2000);timers.set(++id,fn);return id},
  clearTimeout:n=>timers.delete(n),
  gtag:(...args)=>events.push(args)
}
const env=vm.createContext({exports:{},window,URL})
vm.runInContext(compiled,env)
vm.runInContext(env.exports.googleContactConversionScript,env)
assert.equal(window.gtagSendContactEvent('mailto:hello@picshaw.com'),true)
assert.equal(events.length,1)
assert.equal(events[0][1],'conversion_event_contact')
assert.deepEqual(Object.keys(events[0][2]).sort(),['event_callback','event_timeout'])
assert.equal(events[0][2].event_timeout,2000)
assert.equal(typeof events[0][2].event_callback,'function')
events[0][2].event_callback()
events[0][2].event_callback()
for(const cb of timers.values())cb()
assert.deepEqual(destinations,['mailto:hello@picshaw.com'])
events.length=0
assert.equal(window.gtagSendContactEvent('tel:+17379009237'),true)
assert.equal(events[0][1],'conversion_event_contact')
for(const invalid of ['','https://example.com','mailto:someone@example.com','tel:+12345678900','javascript:alert(1)']){
  assert.equal(window.gtagSendContactEvent(invalid),false)
}
window['ga-disable-G-LFJFHY63RR']=true
events.length=0
assert.equal(window.gtagSendContactEvent('tel:+17379009237'),false)
assert.equal(events.length,0)
window['ga-disable-G-LFJFHY63RR']=false
delete window.gtag
assert.equal(window.gtagSendContactEvent('mailto:hello@picshaw.com'),false)
assert.equal(timers.size,1)
assert.ok(source.includes('conversion_event_submit_lead_form'))
assert.ok(site.includes('googleContactConversionScript'))
assert.ok(site.includes("pathname === '/privacy-policy'"))
assert.ok(site.includes('event.preventDefault()'))
assert.ok(policy.includes('A click does not establish'))
console.log('Contact conversion checks passed')

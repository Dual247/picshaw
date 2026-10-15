import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'

const source = await readFile('lib/google-conversions.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const results = []
function fixture(mode = 'normal') {
  const events = [], navigation = [], timers = new Map()
  let timerId = 0
  const window = {
    location: { href: 'https://www.picshaw.com/ai-visibility-audit', origin: 'https://www.picshaw.com', assign: url => navigation.push(url) },
    setTimeout: (callback, milliseconds) => { assert.equal(milliseconds, 2000); timers.set(++timerId, callback); return timerId },
    clearTimeout: id => timers.delete(id),
    gtag: (...args) => { if (mode === 'throws') throw new Error('Blocked analytics'); events.push(args); if (mode === 'immediate') args[2].event_callback() },
  }
  if (mode === 'missing') delete window.gtag
  if (mode === 'disabled') window['ga-disable-G-LFJFHY63RR'] = true
  const context = vm.createContext({ window, URL, exports: {} })
  vm.runInContext(compiled, context)
  vm.runInContext(context.exports.googleLeadConversionScript, context)
  return { window, context, events, navigation, timers, flush: () => { for (const callback of [...timers.values()]) callback() } }
}
function check(name, run) { run(); results.push({ test: name, passed: true }) }

check('Exact supplied event, timeout and no form-field parameters', () => {
  const f = fixture()
  f.context.exports.sendLeadConversion()
  assert.equal(f.events.length, 1)
  assert.equal(f.events[0][0], 'event')
  assert.equal(f.events[0][1], 'conversion_event_submit_lead_form')
  assert.deepEqual(Object.keys(f.events[0][2]).sort(), ['event_callback', 'event_timeout'])
  assert.equal(f.events[0][2].event_timeout, 2000)
  assert.equal(typeof f.events[0][2].event_callback, 'function')
  assert.equal(f.timers.size, 0, 'In-page confirmation must not wait for analytics')
  f.events[0][2].event_callback()
  assert.equal(f.navigation.length, 0)
})
check('Callback navigation happens at most once', () => {
  const f = fixture()
  assert.equal(f.window.gtagSendEvent('/thank-you'), false)
  f.events[0][2].event_callback()
  f.events[0][2].event_callback()
  f.flush()
  assert.deepEqual(f.navigation, ['https://www.picshaw.com/thank-you'])
  assert.equal(f.timers.size, 0)
})
check('Independent fallback works when Google never calls back', () => {
  const f = fixture()
  f.window.gtagSendEvent('/thank-you')
  f.flush()
  f.events[0][2].event_callback()
  assert.deepEqual(f.navigation, ['https://www.picshaw.com/thank-you'])
})
check('Synchronous callback clears fallback timer', () => {
  const f = fixture('immediate')
  f.window.gtagSendEvent('/thank-you')
  assert.equal(f.timers.size, 0)
  assert.equal(f.navigation.length, 1)
})
for (const mode of ['missing', 'disabled', 'throws']) check(`${mode}: tracking cannot break form success or navigation`, () => {
  const f = fixture(mode)
  assert.doesNotThrow(() => f.context.exports.sendLeadConversion())
  assert.equal(f.events.length, 0)
  f.window.gtagSendEvent('/thank-you')
  f.flush()
  assert.deepEqual(f.navigation, ['https://www.picshaw.com/thank-you'])
})
check('External or invalid redirect targets are not followed', () => {
  for (const url of ['https://other.example/thank-you', '//other.example', 'https://[', '']) {
    const f = fixture('immediate')
    assert.doesNotThrow(() => f.window.gtagSendEvent(url))
    f.flush()
    assert.equal(f.navigation.length, 0, url)
  }
})
check('Server rendering and previews without the helper are safe', () => {
  const context = vm.createContext({ exports: {} })
  vm.runInContext(compiled, context)
  assert.doesNotThrow(() => context.exports.sendLeadConversion())
  context.window = {}
  assert.doesNotThrow(() => context.exports.sendLeadConversion())
  context.window.gtagSendEvent = () => { throw new Error('Unexpected analytics failure') }
  assert.doesNotThrow(() => context.exports.sendLeadConversion())
})
for (const file of ['components/EditorialHome.tsx', 'components/Contact.tsx', 'components/ReceptionistEnquiry.tsx']) {
  const text = await readFile(file, 'utf8')
  check(`${file}: one call after confirmed API success`, () => {
    assert.equal((text.match(/sendLeadConversion\(\)/g) || []).length, 1)
    assert.ok(text.indexOf('sendLeadConversion()') > text.indexOf('result?.success !== true'))
  })
}
console.log(JSON.stringify(results, null, 2))

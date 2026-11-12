import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
function load(path, deps) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { exports, module: { exports }, Response, require: name => Object.hasOwn(deps, name) ? deps[name] : require(name) })
  return exports
}
for (const ready of [false, true]) {
  const { PortalShowcase } = load('components/PortalShowcase.tsx', {
    '@/hooks/use-portal-access': { usePortalAccess: () => ready, usePortalOrigin: () => '' },
    './PortalShowcase.module.css': {},
  })
  const html = renderToStaticMarkup(React.createElement(PortalShowcase))
  assert.match(html, /Fictional sample/)
  assert.match(html, /No accounts connected/)
  assert.match(html, /not a screenshot/)
  assert.doesNotMatch(html, /href="[^"]*\/platform\//)
  assert.match(html, /href="\/#contact"/)
  assert.match(html, /Portal coming soon/)
  assert.match(html, /Account creation and login are not enabled yet/)
  assert.doesNotMatch(html, /<form|<iframe|https:\/\/willow/)
}
for (const session of [false, true]) for (const provider of [false, true]) {
  const { GET } = load('app/api/portal-access/route.ts', {
    '@/lib/supabase/portal-config': {
      publicPortalReady: () => session && provider,
    },
  })
  const response = GET()
  assert.equal((await response.json()).ready, session && provider)
  assert.equal(response.headers.get('cache-control'), 'no-store')
}
const hook = readFileSync('hooks/use-portal-access.ts', 'utf8')
assert.match(hook, /useState\(false\)/)
assert.match(hook, /credentials: 'omit'/)
assert.match(hook, /value\?\.ready === true/)
assert.match(hook, /catch\(\(\) => setReady\(false\)\)/)
const header = readFileSync('components/Header.tsx', 'utf8')
assert.doesNotMatch(header, /platform\/sign-in|Portal \/ Preview/)
assert.match(header, /py-8 xl:hidden/)
assert.equal((header.match(/navigation.map/g) || []).length, 2)
assert.match(readFileSync('components/EditorialHome.tsx', 'utf8'), /<PortalShowcase \/>/)
console.log('PASS marketing portal render, closed/open CTAs, capability gate matrix, no-store and privacy contracts')

const home = readFileSync('components/EditorialHome.tsx', 'utf8')
assert.match(home, /href="#contact" className={styles.primaryButton}>Discuss my business/)
assert.match(home, /useState\('unsure'\)/)
assert.ok(home.indexOf('<HomeEnquiry />') < home.indexOf('<section id="work"'))
assert.equal((home.match(/<HomeEnquiry \/>/g) || []).length, 1)
assert.match(home, /response\.ok.*result\?\.success !== true/)
assert.ok(home.indexOf('sendLeadConversion()') > home.indexOf('result?.success !== true'))
assert.match(home, /Three-month minimum/)
console.log('PASS conversion-first homepage, early enquiry, truthful pricing, success-only conversion contract')

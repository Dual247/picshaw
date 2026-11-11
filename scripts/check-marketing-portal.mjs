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
  assert.match(html, /href="\/platform\/preview"/)
  assert.match(html, /href="\/platform\/sign-in"/)
  assert.equal(html.includes('href="/platform/sign-up"'), ready)
  assert.equal(html.includes('Account creation and login are not enabled yet'), !ready)
  assert.doesNotMatch(html, /<form|<iframe|https:\/\/willow/)
}
for (const session of [false, true]) for (const provider of [false, true]) {
  const { GET } = load('app/api/portal-access/route.ts', {
    '@/lib/supabase/portal-config': {
      authAvailability: () => ({ email: provider, google: false, apple: false }),
      lifecycleAvailability: () => ({ session }),
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
assert.match(header, /Portal \/ Preview/)
assert.match(header, /py-8 xl:hidden/)
assert.equal((header.match(/navigation.map/g) || []).length, 2)
assert.match(readFileSync('components/EditorialHome.tsx', 'utf8'), /<PortalShowcase \/>/)
console.log('PASS marketing portal render, closed/open CTAs, capability gate matrix, no-store and privacy contracts')

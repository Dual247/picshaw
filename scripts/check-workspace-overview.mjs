import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const require=createRequire(import.meta.url)
function load(file,deps={}) { const m={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module:m,exports:m.exports,require:n=>Object.hasOwn(deps,n)?deps[n]:require(n)});return m.exports }
const {PortalHeader}=load('components/platform/portal-header.tsx',{'./theme-toggle':{ThemeToggle:()=>null}})
const Page=load('app/(workspace)/platform/page.tsx',{'@/components/platform/portal-header':{PortalHeader}}).default
const html=renderToStaticMarkup(React.createElement(Page))
for(const route of ['reports','ai-visibility','analyze','onboarding','account','preview']) assert.ok(html.includes('href="/platform/'+route+'"'))
assert.ok(html.includes('Choose your next step'))
assert.ok(html.includes('not a live question test or a visibility score'))
assert.ok(html.includes('saved work tracker and repeated buyer-question tests are not available'))
assert.ok(html.includes('Results are not saved'))
assert.ok(html.indexOf('Open Google Search reports')<html.indexOf('View fictional sample workspace'))
assert.equal((html.match(/<h1[ >]/g)||[]).length,1)
assert.ok(!html.includes('<form'))
assert.ok(!renderToStaticMarkup(React.createElement(PortalHeader,{sample:true})).includes('Portal navigation'))
for(const file of ['components/platform/portal-header.tsx','app/(workspace)/platform/page.tsx']) {const source=readFileSync(file,'utf8');assert.ok(!source.includes('fetch('));assert.ok(!source.includes('useEffect'));}
console.log('PASS workspace overview: real tools first, source limitations, no implicit actions, sample separation, navigation')

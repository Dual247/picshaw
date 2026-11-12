
const assert = require('node:assert/strict')
const { readFileSync, existsSync } = require('node:fs')
const { resolve, dirname } = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const root = resolve(__dirname, '../..')
const cache = new Map()
// Compile local TypeScript modules (.ts and .tsx). Real React, Next Link, next-themes and icons render normally.
function load(file) {
  const path = resolve(root, file)
  if (cache.has(path)) return cache.get(path)
  const localModule = { exports: {} }
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(source, { module: localModule, exports: localModule.exports, require(name) {
    // Render the closed deployment state without loading credentials, DB clients or server-only runtime.
    // Runtime admission and configuration gates have their own dedicated test suites.
    if (name === '@/lib/supabase/workspace-runtime') return { readWorkspaceConfig: () => null }
    if (name === '@/lib/supabase/auth-admission') return { authAdmissionConfigured: false }
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? resolve(root, name.slice(2)) : resolve(dirname(path), name)
      const candidates = [base + '.ts', base + '.tsx', resolve(base, 'index.ts'), resolve(base, 'index.tsx')]
      const found = candidates.find(candidate => existsSync(candidate))
      if (!found) throw new Error('Unresolved local TypeScript module: ' + name + ' from ' + path)
      return load(found)
    }
    return require(name)
  }, console }, { filename: path })
  cache.set(path, localModule.exports)
  return localModule.exports
}
for (const route of ['', '/preview', '/onboarding']) {
  const Page = load('app/(workspace)/platform' + route + '/page.tsx').default
  const html = renderToStaticMarkup(React.createElement(Page))
  assert.equal((html.match(/id="main-content"/g) || []).length, 1)
  assert.ok(html.includes('Color theme'))
  assert.ok(html.includes('Light theme') && html.includes('Dark theme') && html.includes('Use system theme'))
  if (route !== '/onboarding') assert.ok(!html.includes('<form'), 'Overview and preview must not submit personal data')
  for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes('id="' + match[1] + '"'), 'Anchor target exists: ' + match[1])
  if (route === '/preview') {
    assert.ok(html.includes('FICTIONAL SAMPLE WORKSPACE'))
    assert.ok(html.includes('18 ') && html.includes('of 60 answers'))
    assert.ok(html.includes('4 failures') && html.includes('42 valid answers'))
    assert.ok(html.includes('Import not available yet'))
    assert.ok(html.includes('No actual engine was queried'))
    assert.ok(html.includes('Completed · fictional'))
    assert.ok(html.includes('No comparable prior sample'))
    assert.ok(!html.includes('href="https://willow'), 'Fictional domain must not be navigable')
    assert.ok((html.match(/<details/g) || []).length >= 7)
  } else if (route === '') {
    assert.match(html, /href="https:\/\/www\.picshaw\.com\/"[^>]*>Back to Picshaw/)
    assert.match(html, /<a\b(?=[^>]*href="\/platform")(?=[^>]*aria-label="Picshaw portal home")[^>]*>/)
    assert.doesNotMatch(html, /href="\/"[^>]*>Back to Picshaw/)
    assert.ok(html.includes('Private data appears only after access is verified'))
    assert.ok(html.includes('href="/platform/reports"'))
    assert.ok(html.includes('href="/platform/preview"'))
  } else {

    assert.ok(html.includes('These fields are disabled and no business details are collected'))
    assert.equal((html.match(/<form/g) || []).length, 1)
    assert.match(html, /<fieldset[^>]* disabled=""/, 'Unavailable onboarding disables the complete form')
    assert.match(html, /<button[^>]*disabled=""[^>]*>Open my workspace<\/button>/)
    assert.match(html, /<fieldset[^>]*disabled=""[\s\S]*id="workspace-name"[\s\S]*id="workspace-site"[\s\S]*type="submit"[\s\S]*<\/fieldset>/, 'Every business field and submit button stays inside the disabled fieldset')
    assert.ok(!/<form[^>]*action=/.test(html), 'No native form submission target')
    assert.ok(html.includes('Existing client workspaces are never assigned automatically'))
    assert.ok(html.includes('We will not visit it or connect any data'))

  }
  console.log('PASS real React server render: /platform' + route)
}
const provider = load('components/platform/theme-provider.tsx').WorkspaceThemeProvider
const rendered = renderToStaticMarkup(React.createElement(provider, null, React.createElement('p', null, 'Theme test')))
assert.ok(rendered.includes('picshaw-workspace-theme'))
assert.ok(rendered.includes('prefers-color-scheme'))
console.log('PASS real next-themes server script: isolated storage key and system preference')
console.log('Browser interaction, persistence and hydration still require browser QA.')



// CSS regression contract, not a browser layout simulation.
const postcss = require('postcss')
const styles = postcss.parse(readFileSync(resolve(root, 'app/(workspace)/workspace.css'), 'utf8'))
function declarations(selector, viewport) {
  const values = {}
  styles.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return
    let parent = rule.parent
    while (parent && parent.type !== 'root') {
      if (parent.type === 'atrule' && parent.name === 'media') {
        const max = parent.params.match(/max-width:\s*(\d+)px/)
        const min = parent.params.match(/min-width:\s*(\d+)px/)
        if ((max && viewport > Number(max[1])) || (min && viewport < Number(min[1]))) return
      }
      parent = parent.parent
    }
    rule.walkDecls(decl => { values[decl.prop] = decl.value })
  })
  return values
}
for (const width of [320, 360, 375, 390, 480, 481, 600, 760]) {
  const header = declarations('.portal-header', width)
  const actions = declarations('.portal-header-actions', width)
  assert.equal(header.height, 'auto', 'Mobile header must grow with its content')
  assert.equal(header['min-height'], '80px')
  assert.equal(header.padding, '16px 20px')
  assert.equal(actions['flex-wrap'], 'nowrap', 'Theme and exit remain together')
  if (width <= 480) {
    assert.equal(header.display, 'grid')
    assert.equal(header['grid-template-columns'], 'minmax(0,1fr)')
    assert.equal(actions.width, '100%')
    assert.equal(actions['justify-content'], 'space-between')
  } else assert.equal(header.display, 'flex')
}
assert.equal(declarations('.portal-header', 761).height, '100px', 'Desktop geometry unchanged')
assert.equal(declarations('.portal-header', 1280).display, 'flex')
console.log('PASS mobile header CSS regression at 320–760px; desktop contract unchanged')


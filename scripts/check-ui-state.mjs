import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const element = (type, props) => ({ type, props })
function load(path, dependencies, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { exports, module: { exports }, ...globals, require(name) {
    if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element }
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw Error(`Unexpected dependency: ${name}`)
  } })
  return exports
}

let mobile = true, mediaListener, removed = false, store
const media = { get matches() { return mobile }, addEventListener(event, fn) { assert.equal(event, 'change'); mediaListener = fn }, removeEventListener(event, fn) { assert.equal(event, 'change'); assert.equal(fn, mediaListener); removed = true } }
const hook = load('hooks/use-mobile.ts', { react: { useSyncExternalStore(subscribe, get, server) { store = { subscribe, get, server }; return get() } } }, { window: { matchMedia(query) { assert.equal(query, '(max-width: 767px)'); return media } } })
assert.equal(hook.useIsMobile(), true)
assert.equal(store.server(), false)
let notices = 0
const stop = store.subscribe(() => notices++)
mobile = false; mediaListener()
assert.equal(notices, 1); assert.equal(store.get(), false)
stop(); assert.equal(removed, true)
assert.ok(readFileSync('components/ui/use-mobile.tsx', 'utf8').includes("export { useIsMobile } from '@/hooks/use-mobile'"))
console.log('PASS shared mobile hook initial/server snapshot, breakpoint change and listener cleanup')

let prev = false, next = true, apiEnabled = true, carouselStore, prevCalls = 0, nextCalls = 0
const listeners = new Map()
const api = { canScrollPrev: () => prev, canScrollNext: () => next, scrollPrev() { prevCalls++ }, scrollNext() { nextCalls++ }, on(event, fn) { listeners.set(event, fn) }, off(event, fn) { assert.equal(listeners.get(event), fn); listeners.delete(event) } }
const react = { createContext: () => ({ Provider: 'provider' }), useCallback: fn => fn, useEffect() {}, useSyncExternalStore(subscribe, get, server) { carouselStore = { subscribe, get, server }; return get() } }
const carousel = load('components/ui/carousel.tsx', { react, 'embla-carousel-react': () => [() => {}, apiEnabled ? api : undefined], 'lucide-react': { ArrowLeft: 'left', ArrowRight: 'right' }, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') }, '@/components/ui/button': { Button: 'button' } })
let value = carousel.Carousel({}).props.value
assert.equal(value.canScrollPrev, false); assert.equal(value.canScrollNext, true); assert.equal(carouselStore.server(), 0)
let changes = 0
const unsubscribe = carouselStore.subscribe(() => changes++)
assert.equal(listeners.size, 2)
prev = true; next = false; listeners.get('select')(); listeners.get('reInit')()
assert.equal(changes, 2); assert.equal(carouselStore.get(), 1)
value.scrollPrev(); value.scrollNext(); assert.equal(prevCalls, 1); assert.equal(nextCalls, 1)
unsubscribe(); assert.equal(listeners.size, 0)
apiEnabled = false
value = carousel.Carousel({}).props.value
assert.equal(value.canScrollPrev, false); assert.equal(value.canScrollNext, false)
carouselStore.subscribe(() => {})()
console.log('PASS carousel initial availability, changes, both listener cleanups and missing API')

let identity = ':R1:'
const sidebarSource = readFileSync('components/ui/sidebar.tsx', 'utf8')
const deps = { react: { createContext: () => ({}), useId: () => identity }, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') } }
for (const match of sidebarSource.matchAll(/from ['"]([^'"]+)['"]/g)) {
  if (!deps[match[1]]) deps[match[1]] = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : () => () => '' })
}
const sidebar = load('components/ui/sidebar.tsx', deps)
const width = () => sidebar.SidebarMenuSkeleton({}).props.children[1].props.style['--skeleton-width']
assert.equal(width(), width())
for (let i = 0; i < 30; i++) { identity = `:R${i}:`; const result = parseInt(width()); assert.ok(result >= 50 && result <= 90) }
assert.ok(!sidebarSource.includes('Math.random'))
console.log('PASS skeleton width is stable per identity and within its display range')
console.log('UI store tests passed. These are mocked unit checks, not browser hydration tests.')

import assert from 'node:assert/strict'
import { readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import vm from 'node:vm'
import ts from 'typescript'

function load(path, dependencies = {}) {
  const source = readFileSync(path, 'utf8')
  const exports = {}
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(compiled, { exports, require(name) { assert.ok(name in dependencies, name); return dependencies[name] } })
  return exports
}
const pricing = load('lib/receptionist.ts')
const { estimateReceptionistUsage, receptionistMoney } = load('lib/receptionist-usage.ts', { './receptionist': pricing })
const tests = []
for (const [minutes, monthly, withSetup, extra] of [[0,399,899,0],[500,399,899,0],[501,399.5,899.5,1],[750,524,1024,250],[1000,649,1149,500],[2000,1149,1649,1500]]) {
  const actual = estimateReceptionistUsage(minutes)
  assert.equal(actual.monthlyTotal, monthly)
  assert.equal(actual.withSetup, withSetup)
  assert.equal(actual.additionalMinutes, extra)
  tests.push({ minutes, monthly, withSetup, passed: true })
}
for (const invalid of [NaN, Infinity, -100]) assert.equal(estimateReceptionistUsage(invalid).monthlyTotal, 399)
assert.equal(receptionistMoney(1649), '$1,649')
assert.equal(pricing.receptionistOffer.monthly, 399)
assert.equal(pricing.receptionistOffer.setup, 500)
assert.equal(pricing.receptionistOffer.includedMinutes, 500)
assert.equal(pricing.receptionistOffer.additionalMinute, 0.5)
const mp4 = 'public/media/receptionist-walkthrough.mp4'
assert.ok(statSync(mp4).size < 2_000_000, 'Keep self-hosted video download lightweight')
const probe = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_entries','format=duration,size:stream=codec_type,codec_name,width,height','-of','json',mp4], { encoding: 'utf8' }))
assert.ok(Math.abs(Number(probe.format.duration) - 42) < 0.1)
assert.equal(probe.streams.filter(stream => stream.codec_type === 'audio').length, 0)
assert.ok(probe.streams.some(stream => stream.codec_name === 'h264' && stream.width === 1280 && stream.height === 720))
const vtt = readFileSync('public/media/receptionist-walkthrough.vtt', 'utf8')
assert.ok(vtt.startsWith('WEBVTT'))
assert.equal((vtt.match(/-->/g) || []).length, 6)
assert.ok(statSync('public/media/receptionist-poster.jpg').size > 1000)
const widget = readFileSync('components/ReceptionistExplainer.tsx', 'utf8')
assert.ok(widget.includes('preload="none"') && widget.includes('controls') && !widget.includes('autoPlay'))
assert.ok(widget.includes('not a real customer call'))
assert.ok(widget.includes('walkthrough-text'))
mkdirSync('validation', { recursive: true })
writeFileSync('validation/receptionist-upgrade-unit.json', JSON.stringify({ tests, media: probe }, null, 2))
console.log(JSON.stringify({ tests, media: probe }, null, 2))

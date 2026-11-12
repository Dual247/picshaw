import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { X509Certificate } from 'node:crypto'
import { checkServerIdentity, rootCertificates } from 'node:tls'
import vm from 'node:vm'
import ts from 'typescript'
import { secureOptions } from '../node_modules/postgres/src/socket.js'

const source = readFileSync('lib/supabase/database-tls.ts', 'utf8').replace(/\r\n/g, '\n')
const publicPem = source.match(/const SUPABASE_DATABASE_CA = `([\s\S]+?)`/)[1]
const fingerprint = '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA'
const host = 'aws-1-us-west-1.pooler.supabase.com'
function load({ text = source, now = Date.parse('2026-11-12T00:00:00Z'), Certificate = X509Certificate } = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, module: { exports },
    Date: class extends Date { static now() { return now } },
    require: name => {
      if (name === 'server-only') return {}
      if (name === 'node:crypto') return { X509Certificate: Certificate }
      if (name === 'node:tls') return { checkServerIdentity }
      throw new Error('Unexpected dependency')
    },
  })
  return exports.createSupabasePoolerTls
}
function unavailable(fn) {
  assert.throws(fn, error => error.message === 'Database TLS configuration unavailable')
}
const certificate = new X509Certificate(publicPem)
assert.equal(certificate.fingerprint256, fingerprint)
assert.equal(certificate.ca, true)
assert.equal(certificate.verify(certificate.publicKey), true)
assert.equal(certificate.subject, certificate.issuer)
assert.equal(certificate.validFrom, 'Apr 28 10:56:53 2021 GMT')
assert.equal(certificate.validTo, 'Apr 26 10:56:53 2031 GMT')
const build = load()
const options = build(host)
assert.deepEqual(Object.keys(options).sort(), ['ca', 'checkServerIdentity', 'rejectUnauthorized', 'servername'])
assert.equal(options.ca, publicPem)
assert.equal(options.rejectUnauthorized, true)
assert.equal(options.servername, host)
assert.equal(options.checkServerIdentity, checkServerIdentity)
assert.equal(Object.isFrozen(options), true)
assert.throws(() => { options.rejectUnauthorized = false }, TypeError)
assert.notEqual(build(host), options, 'Each driver receives its own immutable options')

// Exercise installed postgres 4.1.0 object-mode handling, without connecting.
const installed = secureOptions(options)
assert.equal(installed.ca, publicPem)
assert.equal(installed.rejectUnauthorized, true)
assert.equal(installed.servername, host)
assert.equal(installed.checkServerIdentity, checkServerIdentity)
assert.ok(installed.secureContext, 'Driver parses the CA into a connection-local TLS context')
const normalPeer = { subjectaltname: 'DNS:*.pooler.supabase.com, DNS:*.pooler.supabase.co' }
assert.equal(installed.checkServerIdentity(host, normalPeer), undefined)
assert.equal(installed.checkServerIdentity('wrong.example', normalPeer).code, 'ERR_TLS_CERT_ALTNAME_INVALID')
assert.equal(installed.checkServerIdentity(host, { subjectaltname: 'DNS:unrelated.example' }).code, 'ERR_TLS_CERT_ALTNAME_INVALID')

for (const invalid of [undefined, null, 1, {}, '', '127.0.0.1', 'app.picshaw.com', 'db.abcdefghijklmnopqrst.supabase.co', 'AWS-1-US-WEST-1.pooler.supabase.com', 'aws-1-us-west-1.pooler.supabase.com.', 'aws-1-us-west-1.pooler.supabase.com.evil.example', 'https://' + host, host + ':6543', host + '\n', 'x'.repeat(254) + '.pooler.supabase.com']) unavailable(() => build(invalid))
for (const now of [NaN, Infinity, Date.parse(certificate.validFrom) - 1, Date.parse(certificate.validTo), Date.parse(certificate.validTo) + 1]) unavailable(() => load({ now })(host))
assert.equal(load({ now: Date.parse(certificate.validFrom) })(host).rejectUnauthorized, true)
for (const replacement of ['not a certificate', rootCertificates[0], publicPem + '\nPRIVATE_KEY_MATERIAL', publicPem + '\n' + rootCertificates[0]]) {
  unavailable(() => load({ text: source.replace(publicPem, replacement) })(host))
}
for (const change of [{ ca: false }, { fingerprint256: 'WRONG_FINGERPRINT' }, { validFrom: 'invalid date' }, { validTo: 'invalid date' }]) {
  class ChangedCertificate {
    constructor() { Object.assign(this, { fingerprint256: fingerprint, ca: true, validFrom: certificate.validFrom, validTo: certificate.validTo, publicKey: certificate.publicKey, verify: () => true }, change) }
  }
  unavailable(() => load({ Certificate: ChangedCertificate })(host))
}
class BrokenSignature {
  constructor() { Object.assign(this, { fingerprint256: fingerprint, ca: true, validFrom: certificate.validFrom, validTo: certificate.validTo, publicKey: certificate.publicKey, verify: () => false }) }
}
unavailable(() => load({ Certificate: BrokenSignature })(host))
assert.doesNotMatch(source, /readFile|fetch\(|process\.env|NODE_EXTRA_CA_CERTS|NODE_TLS_REJECT_UNAUTHORIZED|rejectUnauthorized:\s*false|checkServerIdentity:\s*\(/)
console.log('PASS pinned official public CA metadata, invalid/expired/unrelated CA rejection, exact pooler host scope, immutable strict options, installed driver context, and normal hostname failures. No network or trust-store changes.')

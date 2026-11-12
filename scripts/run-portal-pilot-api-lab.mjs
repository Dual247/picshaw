import { createInterface } from 'node:readline'
import { createPilotApiLab, PilotLabError } from './portal-pilot-api-lab.mjs'

// Private stdin only. Never put keys/passwords/tokens/email links in argv, env,
// REPL history, shell interpolation, terminal echo, a file, or a captured HAR.
// This process has no browser automation or listener. No command runs at startup.
const output = value => process.stdout.write(`${JSON.stringify(value)}\n`)
for (const name of ['log', 'warn', 'error', 'info', 'debug', 'trace', 'dir', 'table']) console[name] = () => {}
let lab = null, closed = false, rawInput = false
process.on('uncaughtException', () => { output({ status: 'failed', case: 'uncaught-error-sanitized-cleanup-required' }); process.exit(1) })
process.on('unhandledRejection', () => { output({ status: 'failed', case: 'unhandled-error-sanitized-cleanup-required' }); process.exit(1) })
if (process.argv.length !== 2 || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  output({ status: 'blocked', case: 'no-arguments-and-verified-tls-required' })
  process.exitCode = 2
} else {
  // The desktop exec transport closes non-PTY stdin. For its retained PTY, turn
  // off echo BEFORE the readiness signal. Raw input plus terminal:false does not
  // echo commands. Verify this with a synthetic canary before any secret input.
  if (process.stdin.isTTY) {
    try { process.stdin.setRawMode(true); rawInput = process.stdin.isRaw === true } catch { /* fail below */ }
    if (!rawInput) { output({ status: 'blocked', case: 'private-stdin-unavailable' }); process.exit(2) }
  }
  output({ status: 'pending', case: 'disabled-until-reviewed-init-command' })
  for await (let line of createInterface({ input: process.stdin, terminal: false, crlfDelay: Infinity })) {
    try {
      if (Buffer.byteLength(line) > 8192) throw new PilotLabError('command-too-large')
      const command = JSON.parse(line); line = ''
      if (command.action === 'canary' && !lab) { output({ status: 'pending', case: 'private-stdin-canary-received-not-echoed' }); continue }
      if (command.action === 'init') {
        if (lab || command.reviewedLiveScope !== true) throw new PilotLabError('reviewed-live-scope-required')
        lab = createPilotApiLab({ projectOrigin: command.projectOrigin, publishableKey: command.publishableKey, transport: globalThis.fetch, observe: output })
        output({ status: 'pending', case: 'initialized-no-live-action-yet' })
      } else {
        if (!lab) throw new PilotLabError('init-required')
        await lab.run(command)
        if (command.action === 'close') { closed = true; break }
      }
    } catch (error) {
      output({ status: 'failed', case: error instanceof PilotLabError ? error.code : 'command-error-sanitized' })
      process.exitCode = 1
      break // No retry after an uncertain mutation. Operator must inspect first.
    }
  }
  if (lab && !closed) await lab.run({ action: 'close' })
  if (rawInput) process.stdin.setRawMode(false)
  process.stdin.pause()
}

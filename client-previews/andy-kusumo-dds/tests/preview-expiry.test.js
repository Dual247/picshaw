import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import lifecycle from '../preview-lifecycle.json' with { type: 'json' };
import { lifecycleWindow, MAXIMUM_LIFETIME_MS, previewDenial, previewIsActive } from '../preview-policy.js';
import proxy from '../proxy.js';

const start = 1795046463000;
const end = 1795651263000;
const hosts = ['www.picshaw.com', 'picshaw-andy-kusumo-dds-preview.vercel.app', 'picshaw-andy-kusumo-dds-preview-ash-patels-projects.vercel.app', 'preview-deployment.vercel.app'];
function publicFiles(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? publicFiles(path.join(directory, entry.name), relative) : [relative];
  });
}
const files = publicFiles(fileURLToPath(new URL('../public/', import.meta.url)));

test('immutable source window is exactly seven days from first publication, and rejects reset/overlong config', () => {
  assert.deepEqual(lifecycleWindow(lifecycle), { firstPublishedAt: start, expiresAt: end });
  assert.equal(end - start, MAXIMUM_LIFETIME_MS);
  assert.equal(previewIsActive(start - 1, lifecycle), false);
  assert.equal(previewIsActive(start, lifecycle), true);
  assert.equal(previewIsActive(end - 1, lifecycle), true);
  assert.equal(previewIsActive(end, lifecycle), false);
  assert.equal(previewIsActive(end + 86400000, lifecycle), false);
  assert.equal(previewIsActive(NaN, lifecycle), false);
  for (const invalid of [null, {}, { ...lifecycle, expiresAt: 'bad' }, { ...lifecycle, expiresAtEpochMs: end + 1 }, { ...lifecycle, expiresAt: new Date(end + 1).toISOString(), expiresAtEpochMs: end + 1 }, { ...lifecycle, maximumLifetimeHours: 720 }]) {
    assert.equal(previewIsActive(start, invalid), false);
  }
});

test('all public files and aliases are open before deadline and blocked exactly at deadline', async () => {
  for (const host of hosts) {
    for (const file of ['', 'previews/andy-kusumo-dds/', ...files]) {
      const request = new Request(`https://${host}/${file}`);
      assert.equal(previewDenial(request, lifecycle, end - 1), null, file);
      const response = previewDenial(request, lifecycle, end);
      assert.equal(response.status, 410, host + '/' + file);
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
      assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store');
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
      const body = await response.text();
      assert.match(body, /This preview has expired/);
      assert.doesNotMatch(body, /Andy\ Kusumo,\ DDS/);
    }
  }
});

test('request paths, methods, headers and client clocks cannot bypass expiry', async () => {
  for (const rawPath of ['/../index.html', '/%2e%2e/index.html', '/%252e%252e%252findex.html', '/assets/..%2findex.html', '/assets/%00test', '/index.html?now=0&expiresAt=9999999999999', '/assets/index.html']) {
    for (const method of ['GET', 'HEAD', 'POST', 'OPTIONS']) {
      const response = previewDenial(new Request('https://picshaw-andy-kusumo-dds-preview.vercel.app' + rawPath, { method, headers: { 'x-preview-now': '0', 'x-forwarded-host': 'www.picshaw.com', 'cache-control': 'max-age=999999999', 'range': 'bytes=0-99' } }), lifecycle, end);
      assert.equal(response.status, 410);
      if (method === 'HEAD') assert.equal(await response.text(), '');
    }
  }
  assert.equal(previewDenial(new Request('https://preview.test/%252e%252e%252fsecret'), lifecycle, start).status, 404);
  assert.equal(previewDenial(new Request('https://preview.test/%00secret'), lifecycle, start).status, 404);
  assert.equal(previewDenial(new Request('https://preview.test/', { method: 'POST' }), lifecycle, start).status, 405);
});

test('deployed middleware itself uses the server clock and no-store before expiry', async () => {
  const realNow = Date.now;
  try {
    Date.now = () => end - 1;
    const active = proxy(new Request('https://preview.test/assets/font-2.ttf'));
    assert.equal(active.headers.get('x-middleware-next'), '1');
    assert.match(active.headers.get('cache-control'), /no-store/);
    assert.equal(active.headers.get('x-picshaw-preview-expires'), lifecycle.expiresAt);
    Date.now = () => end;
    const expired = proxy(new Request('https://preview.test/assets/font-2.ttf?now=0'));
    assert.equal(expired.status, 410);
    assert.equal(expired.headers.get('x-picshaw-preview-expires'), lifecycle.expiresAt);
  } finally {
    Date.now = realNow;
  }
  const config = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.equal(config.proxy.entrypoint, 'proxy.js');
  assert.equal(config.proxy.matcher, undefined, 'No route may be excluded from expiry');
});

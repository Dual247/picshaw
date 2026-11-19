// The first publication window is persistent source data, never a build-time or
// client-provided clock. Invalid or overlong configuration fails closed.
export const MAXIMUM_LIFETIME_MS = 168 * 60 * 60 * 1000;

export const PRIVATE_RESPONSE_HEADERS = Object.freeze({
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
});

const EXPIRED_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>This preview has expired</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f5f1;color:#1b2524;font:16px/1.7 Arial,sans-serif}main{max-width:480px;padding:40px}p{color:#5b6662}h1{font-size:34px;line-height:1.2;letter-spacing:-1px}small{letter-spacing:2px;font-weight:700}a{color:inherit;text-underline-offset:4px}</style></head><body><main><small>PICSHAW</small><h1>This preview has expired.</h1><p>This website concept is no longer available to view.</p><p><a href="https://www.picshaw.com/">Visit Picshaw</a></p></main></body></html>`;

export function lifecycleWindow(policy) {
  if (!policy || typeof policy !== 'object') return null;
  const firstPublishedAt = Date.parse(policy.firstPublishedAt);
  const expiresAt = Date.parse(policy.expiresAt);
  if (!Number.isSafeInteger(firstPublishedAt) || !Number.isSafeInteger(expiresAt)) return null;
  if (policy.firstPublishedAtEpochMs !== firstPublishedAt || policy.expiresAtEpochMs !== expiresAt) return null;
  if (expiresAt <= firstPublishedAt || expiresAt - firstPublishedAt > MAXIMUM_LIFETIME_MS) return null;
  if (policy.maximumLifetimeHours !== 168) return null;
  return Object.freeze({ firstPublishedAt, expiresAt });
}

export function previewIsActive(now, policy) {
  const window = lifecycleWindow(policy);
  return !!window && Number.isSafeInteger(now) && now >= window.firstPublishedAt && now < window.expiresAt;
}

function privateResponse(body, status, request, extraHeaders = {}) {
  return new Response(request.method === 'HEAD' ? null : body, {
    status,
    headers: {
      ...PRIVATE_RESPONSE_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      ...extraHeaders
    }
  });
}

function suspiciousPath(url) {
  try {
    // A static-file handler, rather than user input, resolves the path. Reject
    // malformed/double-encoded traversal attempts before passing it through.
    let path = new URL(url).pathname;
    for (let round = 0; round < 4; round += 1) {
      if (path.includes('\\') || path.includes('\0') || path.split('/').includes('..')) return true;
      const decoded = decodeURIComponent(path);
      if (decoded === path) return false;
      path = decoded;
    }
    return /%[0-9a-f]{2}/i.test(path) || path.includes('\\') || path.includes('\0') || path.split('/').includes('..');
  } catch {
    return true;
  }
}

export function previewDenial(request, policy, now = Date.now()) {
  // Do this before examining method, hostname or pathname: every alias and
  // every asset request receives 410 at the exact immutable deadline.
  if (!previewIsActive(now, policy)) return privateResponse(EXPIRED_HTML, 410, request);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return privateResponse('Method not allowed', 405, request, { Allow: 'GET, HEAD' });
  }
  if (suspiciousPath(request.url)) return privateResponse('Not found', 404, request);
  return null;
}

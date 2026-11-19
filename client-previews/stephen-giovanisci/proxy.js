import { next } from '@vercel/functions';
import lifecycle from './preview-lifecycle.json' with { type: 'json' };
import { PRIVATE_RESPONSE_HEADERS, previewDenial } from './preview-policy.js';

// vercel.json deliberately specifies no matcher: this runs before CDN cache on
// every request, including index.html, scripts, styles, images and font files.
export default function proxy(request) {
  const denied = previewDenial(request, lifecycle);
  const response = denied ?? next({ headers: PRIVATE_RESPONSE_HEADERS });
  // Dynamic evidence that this request passed through the expiration gate.
  response.headers.set('X-Picshaw-Preview-Expires', lifecycle.expiresAt);
  return response;
}

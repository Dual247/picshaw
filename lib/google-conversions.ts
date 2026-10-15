/** Installed only inside SiteAnalytics' existing production-only Google tag. */
export const googleLeadConversionScript = `
  window.gtagSendEvent = function (url) {
    var destination = null;
    if (typeof url === 'string' && url.trim()) {
      try {
        var candidate = new URL(url, window.location.href);
        // Only allow internal HTTP(S) thank-you pages, never executable URLs.
        if (candidate.origin === window.location.origin &&
            (candidate.protocol === 'https:' || candidate.protocol === 'http:')) {
          destination = candidate.href;
        }
      } catch (_) { /* Invalid destinations must not interrupt an enquiry. */ }
    }
    var completed = false;
    var timer;
    var callback = function () {
      if (completed) return;
      completed = true;
      if (timer !== undefined) window.clearTimeout(timer);
      if (destination) window.location.assign(destination);
    };
    // Google's callback timeout cannot run if gtag.js is blocked or never loads.
    // The independent fallback also prevents a late callback navigating twice.
    if (destination) timer = window.setTimeout(callback, 2000);
    try {
      if (typeof window.gtag !== 'function' || window['ga-disable-G-LFJFHY63RR'] === true) {
        callback();
        return false;
      }
      window.gtag('event', 'conversion_event_submit_lead_form', {
        'event_callback': callback,
        'event_timeout': 2000
      });
    } catch (_) { callback(); }
    return false;
  };
`

/** Call once after /api/contact confirms { success: true }, never on a click. */
export function sendLeadConversion(): void {
  if (typeof window === 'undefined') return
  const analyticsWindow = window as Window & { gtagSendEvent?: (url?: string) => false }
  try {
    // No helper in development/previews; do not initialise tracking from a form.
    // Do not send names, emails, phone numbers, website inputs or message text.
    analyticsWindow.gtagSendEvent?.()
  } catch { /* Analytics must never turn an accepted enquiry into a form error. */ }
}

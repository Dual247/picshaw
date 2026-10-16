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

/** A separate consent-gated contact event; never replaces the form lead helper. */
export const googleContactConversionScript = "\n  window.gtagSendContactEvent = function (url) {\n    if (typeof url !== 'string' || !url) return false;\n\n    var destination;\n    try {\n      var candidate = new URL(url);\n      // Only Picshaw's published email and phone links count as contact actions.\n      var isEmail = candidate.protocol === 'mailto:' && candidate.pathname.toLowerCase() === 'hello@picshaw.com';\n      var isPhone = candidate.protocol === 'tel:' && candidate.pathname === '+17379009237';\n      if (!isEmail && !isPhone) return false;\n      destination = candidate.href;\n    } catch (_) {\n      return false;\n    }\n\n    // A missing or disabled tag must never delay a native contact link.\n    if (typeof window.gtag !== 'function' || window['ga-disable-G-LFJFHY63RR'] === true) {\n      return false;\n    }\n\n    var completed = false;\n    var timer;\n    var callback = function () {\n      if (completed) return;\n      completed = true;\n      if (timer !== undefined) window.clearTimeout(timer);\n      window.location.assign(destination);\n    };\n    // Fallback if a blocked network request never invokes Google's callback.\n    timer = window.setTimeout(callback, 2000);\n\n    try {\n      window.gtag('event', 'conversion_event_contact', {\n        'event_callback': callback,\n        'event_timeout': 2000\n      });\n    } catch (_) {\n      callback();\n    }\n    // The caller prevents native navigation only when tracking was started.\n    return true;\n  };\n"

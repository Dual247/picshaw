# Google lead conversion event

The existing Google tag remains `G-LFJFHY63RR`. The supplied event name is preserved exactly: `conversion_event_submit_lead_form`.

`SiteAnalytics` installs `window.gtagSendEvent` with the existing data-layer initialization and production-only guard. The homepage, Contact/audit, and AI receptionist forms call `sendLeadConversion()` only after `/api/contact` returns an HTTP success with JSON `success: true`. Page views, button clicks, form steps, validation failures, unsuccessful or malformed responses and network failures do not trigger this event. The existing pending-submit guards prevent simultaneous duplicate submissions. A separately accepted enquiry after resetting the form can count again; this is not server-side lead deduplication.

No name, email, phone, website-input value or message is attached as an event parameter. The existing Google base tag and Vercel analytics are retained. No consent settings are overridden. The helper honours `ga-disable-G-LFJFHY63RR`. Tracking failures cannot turn an accepted enquiry into a form error. If the initialization/helper is unavailable, forms still work; delivery is not guaranteed when scripts are blocked.

The current forms show in-page success, so they call the helper without a URL and do not delay or redirect. The optional URL parameter accepts only same-origin HTTP(S) destinations. Google's `event_callback` and `event_timeout: 2000` are retained, with an independent navigation fallback if Google's script never calls back. Navigation can happen only once. The callback indicates client-side processing, not verified receipt or conversion attribution.

## Validation

The dedicated workflow builds production and preview configurations and tests all three forms with all email submissions and external analytics requests intercepted. It covers accepted submissions, duplicate pending submissions, separate resubmissions, invalid/failed responses, tracking failures, event payloads and preview exclusion. No test events are sent to the actual Google property.

## Account-side check

After deployment, use Google Tag Assistant or Analytics Realtime/DebugView to verify the exact event from an approved test enquiry. Check whether it is already marked as a key event and associated with the intended Google Ads conversion action before creating anything new. This code does not configure key events, Ads account links, imports, counting rules, attribution or bidding. No Ads conversion destination/label was supplied, so none is invented. Avoid counting the same lead through overlapping conversion actions.

References:
- https://developers.google.com/tag-platform/gtagjs/reference/parameters
- https://support.google.com/analytics/answer/12966437

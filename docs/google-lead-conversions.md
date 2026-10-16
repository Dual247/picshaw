# Google lead conversion event

The existing Google tag remains `G-LFJFHY63RR`. The supplied event name is preserved exactly: `conversion_event_submit_lead_form`.

`SiteAnalytics` installs `window.gtagSendEvent` with the existing data-layer initialization and production-only guard. The homepage, Contact/audit, and AI receptionist forms call `sendLeadConversion()` only after `/api/contact` returns an HTTP success with JSON `success: true`. Page views, button clicks, form steps, validation failures, unsuccessful or malformed responses and network failures do not trigger this event. The existing pending-submit guards prevent simultaneous duplicate submissions. A separately accepted enquiry after resetting the form can count again; this is not server-side lead deduplication.

No name, email, phone, website-input value or message is attached as an event parameter. The Google base tag and Vercel Analytics now load only after a visitor explicitly allows optional analytics. Google Consent Mode v2 sets advertising-related storage, user data and personalization to denied. Refusing analytics leaves the enquiry forms working but prevents client-side conversion events. Visitors can change this choice from the footer; Global Privacy Control forces optional tracking off. The helper honours `ga-disable-G-LFJFHY63RR`. Tracking failures cannot turn an accepted enquiry into a form error. If the initialization/helper is unavailable, forms still work; delivery is not guaranteed when scripts are blocked.

The current forms show in-page success, so they call the helper without a URL and do not delay or redirect. The optional URL parameter accepts only same-origin HTTP(S) destinations. Google's `event_callback` and `event_timeout: 2000` are retained, with an independent navigation fallback if Google's script never calls back. Navigation can happen only once. The callback indicates client-side processing, not verified receipt or conversion attribution.

## Validation

The dedicated workflow builds production and preview configurations and tests all three forms with all email submissions and external analytics requests intercepted. It covers accepted submissions, duplicate pending submissions, separate resubmissions, invalid/failed responses, tracking failures, event payloads and preview exclusion. No test events are sent to the actual Google property.

## Account-side check

After deployment, use Google Tag Assistant or Analytics Realtime/DebugView to verify the exact event from an approved test enquiry. Check whether it is already marked as a key event and associated with the intended Google Ads conversion action before creating anything new. This code does not configure key events, Ads account links, imports, counting rules, attribution or bidding. No Ads conversion destination/label was supplied, so none is invented. Avoid counting the same lead through overlapping conversion actions.

References:
- https://developers.google.com/tag-platform/gtagjs/reference/parameters
- https://support.google.com/analytics/answer/12966437


## Contact link conversion (conversion_event_contact)

The Google tag also installs a **separate** window.gtagSendContactEvent(url) helper. The event is exactly conversion_event_contact, with the supplied event_callback and event_timeout: 2000, and no personal-data parameters. This does **not** overwrite window.gtagSendEvent, which is retained exclusively for successful form submissions.

When an opted-in visitor clicks a normal same-tab mailto:hello@picshaw.com or tel:+17379009237 link on a marketing/service page, the handler sends one conversion_event_contact event and allows the callback to open the mail client or dialer. An independent two-second navigation fallback handles blocked Google callbacks. Only the published Picshaw contact destinations are eligible. If the visitor rejects analytics, the tag is not ready, the tag is disabled, or scripts fail, contact links follow native browser behavior without a delay. The Privacy Policy page is excluded so that privacy requests are not counted as marketing conversions. Form attempts and navigation to the contact section are not contact-click conversions.

A contact-link click is a **proxy for intent**, not a verified email or completed telephone call. Actual accepted form enquiries remain measured by conversion_event_submit_lead_form. Do not set both as primary bidding conversions without evaluating double counting.

The supplied code does not include a Google Ads AW-.../label destination. Reporting in Google Ads requires the existing Google tag or GA4 to be connected to the correct Ads conversion action in the relevant Google account. This code cannot verify Ads account linking or import settings.

All local browser integration tests intercept external Google calls and never send real leads or ad events.

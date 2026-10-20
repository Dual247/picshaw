# Ask Picshaw: quick answers and lead capture

## Behaviour
Bottom-right, user-opened widget available on all pages through the root layout. The answer library/form chunk loads on first open; there is no timed pop-up, live-agent claim, separate model API or extra subscription. It is an automated, curated FAQ assistant, not an open-ended generative AI chatbot. It accepts typed questions, uses topic rules and a small amount of conversational context, offers relevant service-page links and a visible optional handoff to Ash. An unknown request produces an honest fallback, not a fabricated answer.

Retainer and receptionist prices use their existing configuration exports. One-time Growth Site and monthly Growth retainer remain distinct. Founding availability, audit-credit eligibility, timelines and quotes require confirmation. Content links are predetermined internal links, never user-supplied URLs. User messages render as text, never HTML. The bot neither browses customer URLs nor books calls.

## Privacy and leads
Chat turns and drafts are memory-only; retain the last 12 exchanges during same-tab client navigation. Clear chat or refresh removes them. Nothing is sent to a model or chat API. The optional lead form suggests only the latest question, which the visitor can edit before submitting. Submit sends displayed contact/request fields, not the conversation history, to the existing /api/contact and Resend pipeline. Email and request are required; a website is optional for new businesses. Service code chatbot identifies the lead source. A honeypot and ordinary server validation reject invalid submissions; these are not a comprehensive spam filter or global rate limiter.

No opening/question analytics is explicitly added. The existing consent-gated Google lead event runs after confirmed API success only. No chat or lead field contents are passed to that event. Chat server requests deliberately skip optional server analytics. Global Privacy Control and rejected analytics do not block using the assistant. The general privacy page includes a dedicated addendum at #chat-assistant. Existing website analytics may operate when allowed; keep GA enhanced-measurement settings under review.

The privacy-choice panel takes visual priority over the launcher. On mobile, the launcher sits above the fixed contact bar. Non-modal dialog semantics allow visitors to continue using the page; Escape/minimise return focus to the launcher. Opening moves focus inside; responses use a separate polite live announcement. No fake typing, urgency or reserved places.

## Validation
- check-chatbot.mjs: supported questions, ambiguous pricing, short follow-ups, shared prices, answer links, prompt-like input, lead source, HTML escaping, provider failure and optional-website submissions. All provider calls mocked.
- check-chatbot-browser.mjs: no auto-open, denied/granted/GPC consent, source links/navigation retention, clear, safe rendering, editable handoff without transcript, success/error/retry/duplicate guard, Google conversion isolation and six viewport sizes including landscape. All external requests intercepted; no real emails, calls, Google events or leads submitted.
- Existing site, contact and conversion suites remain in place.

## Operations
Watch hello@picshaw.com for subjects beginning New chatbot enquiry. Respond normally; there is no live chat console or confirmed response-time promise. Review curated answers whenever services or non-centralised website-build prices change. Later generative-AI expansion needs an explicitly configured provider, cost/abuse controls, service-grounded retrieval and updated privacy disclosure before chat text is sent externally.

Accessibility reference: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ (this widget is intentionally non-modal, not an aria-modal=true dialog).

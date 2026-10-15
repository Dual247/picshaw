# Picshaw privacy policy and consent — implementation review
Updated: 2026-10-15

## Verified in current repository
- Next.js site hosted on Vercel, Vercel Web Analytics and Google tag GA4 G-LFJFHY63RR.
- Website submissions go to /api/contact (Zod validation), Resend sends details to hello@picshaw.com. No public form attaches content to analytics event parameters.
- Home, dedicated audit, and receptionist demo forms have distinct service codes; receptionist optional phone is included inside email message.
- The AI receptionist is a founding-pilot enquiry page, not a live call product or a public recording service.
- Blog integration with BabyLoveGrowth uses server-side read API to display published content. It is not a browser-facing visitor tracker.
- Existing forms state they do not automatically subscribe users to marketing.
- Professional outreach and CRM are part of Picshaw business operations; verify all providers and actual data retention periodically.

## Compliance work delivered with this change
- Public canonical /privacy-policy included in footer, sitemap, and form notices.
- Preference interface offers equal prominence to allow/reject analytics; default is no optional tracking, and browser GPC blocks it.
- Consent stored locally with an expiration of 180 days; choices can be revisited from the site footer and privacy notice.
- Production Google Analytics and Vercel Analytics only render on affirmative consent. Google ad-storage/user-data/personalisation consent stays denied and allow_google_signals/allow_ad_personalization_signals are off.
- Revocation drops local first-party GA cookies where accessible, disables GA and reloads to remove optional browser trackers.
- Existing forms and success-only Google conversion event function independent of analytics availability.

## Operator verification needed (legal and operational; not code assumptions)
1. Confirm Picshaw's full legal entity name (if incorporated), postal address, and any mandatory privacy contact details; the current policy uses Picshaw and hello@picshaw.com.
2. Audit Vercel, Resend, email inbox, Google Analytics and HubSpot account configurations, their access roles, retention settings, subprocessors, contracts / DPA and actual deletion procedures. Align document with other sales, marketing, CRM, ad and phone services outside this repository.
3. Assess CCPA/other state-law threshold applicability, UK/EU GDPR targeting and representative/transfer/safeguard obligations if serving UK/EU residents.
4. Review future ad pixels, remarketing and new tracking before activation. Obtain consent and update categories/rights accordingly; this change covers currently visible site code, not third-party dashboard settings.
5. Review California and other state rules on unsolicited B2B email/telephone outreach and any separate phone call recording consent/retention needed before an AI receptionist pilot handles real callers.
6. Define and implement actual deletion/archiving timetables for enquiries and prospect records. The website cannot automatically purge third-party CRM or mailbox data.
7. Obtain qualified privacy counsel review, as a policy alone cannot guarantee compliance and this is not a legal certification.

Regulatory guidance consulted:
- https://oag.ca.gov/privacy/facts/online-privacy/privacy-policy
- https://oag.ca.gov/privacy/ccpa
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/
- https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/
- https://support.google.com/analytics/answer/14009635

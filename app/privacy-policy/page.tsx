import type { ReactNode } from 'react'
import Link from 'next/link'
import { ContentPage } from '@/components/ContentPage'
import { PrivacySettingsButton } from '@/components/SiteAnalytics'
import { pageMetadata } from '@/lib/site'

export const metadata = pageMetadata(
  'Privacy Policy',
  'How Picshaw collects, uses, shares and protects information, including website enquiries, Google Analytics, cookies and your privacy choices.',
  '/privacy-policy',
)

const updated = '2026-10-15'
const sections = [
  ['overview', 'Who this notice covers'],
  ['information', 'Information we collect'],
  ['uses', 'Why and how we use it'],
  ['analytics', 'Cookies, analytics and tracking'],
  ['disclosures', 'Who receives information'],
  ['outreach', 'Business outreach and communications'],
  ['receptionist', 'AI receptionist enquiries'],
  ['retention', 'How long we keep information'],
  ['security', 'Security'],
  ['rights', 'Your privacy rights'],
  ['california', 'California and US privacy disclosures'],
  ['international', 'International visitors and transfers'],
  ['children', 'Children and third-party links'],
  ['changes', 'Changes and contact'],
] as const

function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section id={id} aria-labelledby={id + '-title'} className="scroll-mt-32 border-t border-border pt-9">
    <h2 id={id + '-title'} className="mb-5 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h2>
    <div className="space-y-4 text-base leading-8 text-muted-foreground">{children}</div>
  </section>
}
const L = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} className="text-primary underline underline-offset-4 hover:text-foreground">{children}</a>

export default function PrivacyPolicyPage() {
  return <ContentPage
    title="Privacy Policy"
    eyebrow="Your information / Your choice"
    intro="Clear details on the personal information Picshaw handles, why we use it, and the choices available to you."
    path="/privacy-policy"
  >
    <div className="max-w-4xl">
      <p className="mb-8 text-sm text-muted-foreground">Effective and last updated: <time dateTime={updated}>October 15, 2026</time></p>
      <div className="mb-12 border-l-2 border-primary bg-card/60 px-6 py-7">
        <h2 className="mb-3 text-xl font-semibold">In brief</h2>
        <p className="text-sm leading-7 text-muted-foreground">We use information you submit to respond to enquiries and deliver agreed services. The website uses essential hosting and security technology. Google Analytics and Vercel Web Analytics run only after you allow optional analytics. We do not sell enquiry lists. You can review your analytics decision at any time or contact us to request access, correction or deletion where applicable.</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-2">
          <PrivacySettingsButton className="text-sm font-medium text-primary underline underline-offset-4" />
          <L href="mailto:hello@picshaw.com?subject=Privacy%20request">Email a privacy request</L>
        </div>
      </div>
      <nav aria-label="Privacy policy contents" className="mb-14 rounded-xl border border-border p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-primary">On this page</p>
        <ol className="grid list-decimal gap-x-10 gap-y-2 pl-5 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
          {sections.map(([id, heading]) => <li key={id}><a href={'#' + id} className="underline-offset-4 hover:text-foreground hover:underline">{heading}</a></li>)}
        </ol>
      </nav>

      <div className="space-y-12">
        <Part id="overview" title="1. Who this notice covers">
          <p>This notice describes how <strong className="text-foreground">Picshaw</strong>, an independent digital services business based in Los Angeles, California (referred to as “Picshaw”, “we” or “us”), processes personal information when you browse <L href="https://www.picshaw.com">picshaw.com</L>, contact us, enquire about services, or communicate with us as a business contact. Contact: <L href="mailto:hello@picshaw.com">hello@picshaw.com</L>.</p>
          <p>For a client project in which we process personal information solely on a client&apos;s instructions, the client may be responsible for its own privacy notice and contract terms. This notice does not replace those terms or any separate notice required for an actual AI telephone service.</p>
        </Part>

        <Part id="information" title="2. Information we collect">
          <div className="overflow-x-auto"><table className="w-full min-w-[540px] border-collapse text-left text-sm leading-7">
            <thead><tr className="border-b border-border text-foreground"><th scope="col" className="pb-3 pr-5 font-semibold">Category</th><th scope="col" className="pb-3 font-semibold">Examples and source</th></tr></thead>
            <tbody className="[&_tr]:border-b [&_tr]:border-border/70 [&_td]:py-4">
              <tr><th scope="row" className="pr-5 align-top font-medium text-foreground">Enquiries</th><td>Name, email, company, website URL, service interests, and any business goals or message you choose to provide through forms, email or calls. The AI receptionist demo form also asks for optional phone and call-coverage preferences.</td></tr>
              <tr><th scope="row" className="pr-5 align-top font-medium text-foreground">Client relationships</th><td>Business contact details, proposals, agreed project details, communications, invoicing and service records when we work together.</td></tr>
              <tr><th scope="row" className="pr-5 align-top font-medium text-foreground">B2B prospects</th><td>Professional names, roles, public business contact details, employer, published website information, referral source and outreach/follow-up history, from professional listings, public websites, referrals and direct interactions.</td></tr>
              <tr><th scope="row" className="pr-5 align-top font-medium text-foreground">Technical information</th><td>IP address, browser and device characteristics, request timing, visited paths and security/error records made available to our hosting and infrastructure providers when you use the site.</td></tr>
              <tr><th scope="row" className="pr-5 align-top font-medium text-foreground">Optional analytics</th><td>If you allow analytics: page views, approximate location, traffic sources, device/browser information, cookies or similar identifiers, and events such as successfully submitted enquiries and clicks on Picshaw email or phone links. A click does not establish that an email or call was completed. We do not intentionally send form field contents to analytics tools.</td></tr>
              <tr><th scope="row" className="pr-5 align-top font-medium text-foreground">Privacy preference</th><td>Your optional analytics choice and when you made it, stored on your device so we can remember your selection.</td></tr>
            </tbody>
          </table></div>
          <p>Please do not put passwords, payment-card numbers, medical information or other confidential personal information in public enquiry forms. We do not ask for that information there. You can browse our public pages without submitting a form.</p>
        </Part>

        <Part id="uses" title="3. Why and how we use it">
          <p>We use information to answer requests, provide quotes and project information, deliver contracted work, manage client and business relationships, coordinate legitimate follow-ups, maintain the website, identify and prevent abuse, meet legal obligations, and measure site performance when you choose to allow analytics.</p>
          <p>Where EU or UK data-protection law applies, our potential lawful bases include steps requested before a contract or performance of a contract (enquiries and services), legitimate interests (ordinary B2B relationships, security, service improvement and proportionate professional outreach), compliance with law (records and lawful requests), and consent (optional analytics and marketing where required). Legitimate interests are subject to individual rights and a balancing assessment; marketing messages are also subject to applicable electronic-marketing rules.</p>
          <p>Required form fields are marked. If you do not provide the requested contact details, we may be unable to respond. We do not use enquiry submissions to make solely automated decisions with legal or similarly significant effects.</p>
        </Part>

        <Part id="analytics" title="4. Cookies, analytics and tracking">
          <p><strong className="text-foreground">Necessary technology:</strong> our host, Vercel, processes requests and may use essential operational or security technology to deliver the site. This includes routine server logs. The site uses browser local storage to remember an analytics preference; that preference is retained for up to 180 days unless changed or browser storage is cleared.</p>
          <p><strong className="text-foreground">Optional analytics:</strong> only after an affirmative choice, our site loads Google Analytics (Google tag <code>G-LFJFHY63RR</code>) and Vercel Web Analytics. Google Analytics may use cookies such as <code>_ga</code> and related identifiers and may receive page-visit, device and conversion information. Cookie lifetimes depend on Google settings and your browser. Vercel Web Analytics is designed to provide aggregated, cookieless measurement. Our site&apos;s Google configuration disables advertising-personalisation signals; form values are not included as custom conversion parameters. These services may independently process technical request information.</p>
          <p><strong className="text-foreground">Your decision:</strong> select “Allow analytics” or “Reject optional” in our preference panel. Before you allow it, we do not load these optional analytics scripts. You can reopen <PrivacySettingsButton className="font-medium text-primary underline underline-offset-4" /> at any time; withdrawing consent takes effect for future visits and stops optional tracking after the site refreshes. Blocking or clearing cookies through your browser may also change how preferences work. Refusing analytics does not affect your ability to enquire.</p>
          <p><strong className="text-foreground">Browser signals:</strong> when a browser sends a supported Global Privacy Control (GPC) signal, we treat it as an instruction to disable optional analytics on that browser. We do not separately act on legacy “Do Not Track” headers because there is no consistently implemented standard; use the preference control or contact us directly.</p>
        </Part>

        <Part id="disclosures" title="5. Who receives information">
          <p>We disclose information only as appropriate to deliver the site, respond to enquiries, operate the business or meet lawful obligations. Recipient categories may include:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li><strong className="text-foreground">Website infrastructure:</strong> Vercel, for hosting, request delivery, security and, only with consent, Web Analytics.</li>
            <li><strong className="text-foreground">Enquiry delivery:</strong> Resend, which transmits website enquiry messages to our business inbox; email service providers that hold and route our correspondence.</li>
            <li><strong className="text-foreground">Customer and prospect management:</strong> CRM and productivity providers, such as HubSpot where used, to record business contacts, conversations and agreed follow-ups.</li>
            <li><strong className="text-foreground">Optional measurement:</strong> Google Analytics, only when you grant optional analytics consent.</li>
            <li><strong className="text-foreground">Professional and service providers:</strong> contractors, advisers or technology vendors engaged for legitimate operational or project needs under appropriate access restrictions.</li>
            <li><strong className="text-foreground">Legal and business circumstances:</strong> authorities where legally required, or relevant parties in an actual or proposed business transaction, subject to appropriate safeguards.</li>
          </ul>
          <p>We do not sell lists of names, email addresses or submitted enquiry details. Where local laws treat disclosure of online identifiers to an analytics or advertising service as “sharing” even without a payment, that disclosure occurs only if you choose to allow our optional analytics, and you can withdraw that choice. We do not knowingly use our current website tag to run personalised advertising campaigns based on your browsing activity.</p>
        </Part>

        <Part id="outreach" title="6. Business outreach and communications">
          <p>Picshaw may contact business owners and professionals about services relevant to their business using contact details they provide, public professional sources or introductions. We may store those contacts and follow-up outcomes in a business relationship system. Contacting us through the website does <strong className="text-foreground">not</strong> automatically subscribe you to a newsletter.</p>
          <p>If you receive outreach you do not want, reply requesting removal or email <L href="mailto:hello@picshaw.com?subject=Stop%20outreach">hello@picshaw.com</L>. We will stop the relevant promotional contact and may keep minimal information needed to honour your opt-out. This does not prevent important communications relating to an existing contract or a request you made.</p>
        </Part>

        <Part id="receptionist" title="7. AI receptionist enquiries">
          <p>The AI receptionist page currently offers enquiries for a <strong className="text-foreground">founding pilot</strong>. Submitting its form does not activate a telephone service or create a customer call recording. We use demo enquiry data to assess fit, respond and discuss possible pilot arrangements.</p>
          <p>Before any operational voice assistant is launched for a customer, applicable caller notices, call recording/transcription choices, vendor access, retention, security and roles in processing personal information must be established under appropriate service-specific terms and disclosures. Do not submit third-party caller recordings or sensitive customer records through the general website forms.</p>
        </Part>

        <Part id="retention" title="8. How long we keep information">
          <p>We retain enquiries, correspondence and professional contact records only for as long as reasonably required to deal with requests, pursue an ongoing business relationship, follow up appropriately, handle disputes or comply with legal obligations. We assess the length according to the age of the contact, whether there is an active engagement, and applicable limitation, tax and accounting periods. A request to delete information is assessed against any lawful need to retain it.</p>
          <p>Infrastructure and email providers apply their own documented storage, backup and logging periods. Optional analytics retention depends on the analytics provider&apos;s configuration. Your browser preference record expires after 180 days, unless you change or clear it sooner. If you would like details about a particular record, contact us.</p>
        </Part>

        <Part id="security" title="9. Security">
          <p>We use reasonable administrative, technical and organisational measures appropriate to the nature of information, including HTTPS for website transmission, restricting access to relevant service providers and minimising unnecessary information in analytics events. We review access and operational practices as services change. No website, email or third-party system can be guaranteed completely secure. Please avoid sending sensitive information through general enquiry forms.</p>
        </Part>

        <Part id="rights" title="10. Your privacy rights">
          <p>Depending on where you live and applicable law, you may have the right to request information about data we hold, access or a copy, correct inaccuracies, request deletion, object to processing (including direct marketing), restrict certain uses, request portability, withdraw consent or opt out of specified disclosures. Some requests are subject to legal exceptions and identity verification. We will not discriminate against you for exercising an applicable statutory right.</p>
          <p><strong className="text-foreground">To make a request:</strong> email <L href="mailto:hello@picshaw.com?subject=Privacy%20rights%20request">hello@picshaw.com</L> with “Privacy rights request” in the subject. Tell us what you would like us to do and the contact details we should locate. Please do not include identity documents unless we specifically explain why they are needed. We may ask for information reasonably necessary to verify your request or an authorised agent; we respond within the period required by applicable law.</p>
          <p><strong className="text-foreground">Marketing objections:</strong> you may object to direct marketing at any time by replying to the message or contacting us, without having to justify the request.</p>
        </Part>

        <Part id="california" title="11. California and US privacy disclosures">
          <p>California residents have rights under privacy laws such as the California Consumer Privacy Act (CCPA) where that statute applies to the business. These can include rights to know, correct, delete, opt out of sale or sharing, limit certain sensitive-information uses, and receive equal treatment. Other US states may provide comparable rights, subject to eligibility and exceptions. We provide the request channel above whether or not a particular statutory threshold applies.</p>
          <p>The categories of information collected, their sources, purposes and categories of recipients are described in sections 2–6 above. We do not knowingly collect sensitive personal information through public forms for purposes such as profiling, and we do not knowingly sell the personal information of minors. We do not exchange enquiry contact lists for money. To opt out of optional analytics-related disclosures, use <PrivacySettingsButton className="font-medium text-primary underline underline-offset-4" /> or send a privacy request; GPC is honoured as explained above. We do not require you to agree to optional analytics as a condition of contacting us.</p>
          <p>We will review any verified requests to know, delete, correct or limit as required by law and will explain any lawful exception. If you have a concern about the accuracy of our disclosures, contact <L href="mailto:hello@picshaw.com">hello@picshaw.com</L>.</p>
        </Part>

        <Part id="international" title="12. International visitors and transfers">
          <p>Picshaw operates from the United States. Information may be processed in the US and other countries where our service providers operate. Those places may have different data-protection rules from your location. Where EU or UK privacy law applies, international transfers and service-provider arrangements may need additional legal safeguards; contact us to ask about safeguards applicable to your information.</p>
          <p>If the EU GDPR or UK GDPR applies, you may have rights to access, correction, erasure, restriction, portability and objection, as well as the right to withdraw analytics consent without affecting prior lawful processing. You may complain to your local data-protection authority (for the UK, the <L href="https://ico.org.uk/make-a-complaint/">Information Commissioner&apos;s Office</L>). We would welcome the opportunity to resolve a concern directly first, but you do not have to contact us before a regulator.</p>
        </Part>

        <Part id="children" title="13. Children and third-party links">
          <p>Our business services and site are not directed at children under 16, and we do not knowingly collect personal information from them through the forms. If you believe a child submitted personal information, contact us so we can review and delete it as appropriate.</p>
          <p>Links to third-party websites, including external photography sources or social platforms, are governed by those sites&apos; own policies when you leave Picshaw. We are not responsible for third-party privacy practices.</p>
        </Part>

        <Part id="changes" title="14. Changes and contact">
          <p>We may revise this policy when our services, processors, technologies or applicable law change. We will update the effective date and provide additional notice where legally required, including before materially different uses of information where required.</p>
          <p>Questions, complaints or rights requests: <L href="mailto:hello@picshaw.com?subject=Privacy%20request">hello@picshaw.com</L>. Picshaw, Los Angeles, California, United States.</p>
          <p><Link href="/" className="text-primary underline underline-offset-4">Return to the homepage</Link> or review <PrivacySettingsButton className="font-medium text-primary underline underline-offset-4" />.</p>
        </Part>
      </div>
    </div>
  </ContentPage>
}

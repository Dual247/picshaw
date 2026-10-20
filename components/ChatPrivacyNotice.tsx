/** Addendum to the existing privacy policy; no new route or independent tracker. */
export function ChatPrivacyNotice() {
  return <section id="chat-assistant" className="mb-12 max-w-4xl scroll-mt-32 rounded-xl border border-primary/30 bg-card p-6 md:p-8" aria-labelledby="chat-privacy-title">
    <p className="mb-3 text-xs uppercase tracking-widest text-primary">Chat assistant notice · Added October 19, 2026</p>
    <h2 id="chat-privacy-title" className="text-2xl font-semibold">Quick answers and chat enquiries</h2>
    <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
      <p>The Ask Picshaw widget provides automated answers from curated information about our services. It is not a live agent and does not send questions to an AI model, run a website audit or make bookings. Conversation text stays in the current browser tab; it is not written to cookies or browser storage. It remains available during in-site navigation, and is removed by Clear chat or a page refresh.</p>
      <p>Sending a request is optional. The request form can suggest your latest question as a starting point, but you can edit it before sending. Only the displayed form details—your email, any optional name, business and website, selected service interest and your request—are submitted to Picshaw via our existing hosting and Resend email-delivery providers. The full conversation is not attached or automatically sent. These submitted details are handled under the enquiry purposes, recipient, retention and rights provisions below.</p>
      <p>Opening the widget and asking questions do not send chat analytics. A successful request can trigger our existing Google lead-conversion event only when optional analytics has been allowed; form contents and chat text are not included in that event. Rejecting analytics or using Global Privacy Control does not prevent use of the chat or request form. Please do not enter sensitive personal information, customer records or passwords.</p>
      <p>For privacy questions or requests, email <a href="mailto:hello@picshaw.com?subject=Privacy%20request" className="text-primary underline underline-offset-4">hello@picshaw.com</a>.</p>
    </div>
  </section>
}

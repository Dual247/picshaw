const faqs = [
  { question: 'How is this only $1,000 when agencies charge $10k+?', answer: 'Picshaw keeps the process focused and works directly with you. The $1,000 Website Refresh covers an agreed scope; larger sites, integrations and ongoing work are quoted separately. There is no claim that every project or agency is comparable.' },
  { question: 'Will this actually help me get more customers?', answer: 'The work is designed to make your services clearer and the route to an enquiry easier. Calls and completed enquiries should be measured. More customers or a particular conversion increase cannot be guaranteed.' },
  { question: 'What if I already have a website?', answer: 'Send its address for a review. We look at your existing content, design, mobile experience and enquiry flow before recommending a refresh or a different scope.' },
  { question: 'How does this help me rank on Google?', answer: 'SEO foundations include useful page content, headings, titles, descriptions, internal links and crawlable pages. They support search eligibility, but they do not guarantee a particular ranking. Ongoing SEO is a separate scope.' },
  { question: 'What do you need from me to get started?', answer: 'Your current website address, logo, main services and an explanation of what you want the site to achieve. Access and any hosting, domain or booking requirements are agreed before implementation.' },
  { question: 'Who runs Picshaw?', answer: 'Picshaw is run by Ash Patel, a Los Angeles-based founder who began building websites in 2005. The studio focuses on practical websites for local businesses.' },
  { question: 'What happens after my site launches?', answer: 'You receive a handoff, with ownership and account arrangements agreed in the project scope. For ongoing content and optimization, Picshaw offers a Monthly Partner option from $500 per month. Ongoing work is optional.' },
]

export function FAQ() {
  return <section id="faq" className="relative scroll-mt-28 py-32 md:py-48">
    <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20"><div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
      <div className="lg:sticky lg:top-32 lg:self-start"><p className="mb-6 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">FAQ</p><h2 className="headline-editorial text-4xl font-bold md:text-5xl">You have<br />questions</h2><p className="mt-6 max-w-md text-lg text-muted-foreground">Start with the common questions below. Get in touch for a recommendation about your own website.</p></div>
      <div className="divide-y divide-border">{faqs.map((faq, index) => <details key={faq.question} open={index < 2} className="group py-6"><summary className="cursor-pointer rounded-sm text-lg font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{faq.question}</summary><p className="pt-4 leading-relaxed text-muted-foreground">{faq.answer}</p></details>)}</div>
    </div></div>
  </section>
}

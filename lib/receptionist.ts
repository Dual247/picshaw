export const receptionistOffer = {
  setup: 500,
  monthly: 399,
  includedMinutes: 500,
  additionalMinute: 0.5,
  currency: 'USD',
} as const

export const receptionistFAQs = [
  {
    question: 'What is an AI receptionist?',
    answer: 'An AI receptionist is a voice assistant that answers incoming calls using information and rules approved by your business. Picshaw’s proposed managed service focuses on unanswered and after-hours enquiries: capturing details, asking agreed questions and arranging an appropriate next step.',
  },
  {
    question: 'Who is the founding pilot designed for?',
    answer: 'The initial pilot is designed for independent plumbing businesses that need help with routine enquiries when their team cannot answer. Other local service businesses can enquire, but suitability and scope are confirmed individually. This is not an emergency-response or medical-intake service.',
  },
  {
    question: 'Can I keep my existing phone number?',
    answer: 'The preferred pilot setup uses unanswered or after-hours call forwarding from your existing business number, where your carrier supports it. We check routing and a fallback before activation. Number porting is not a prerequisite, and compatibility is confirmed during setup.',
  },
  {
    question: 'Can it book appointments?',
    answer: 'The pilot can be scoped to arrange owner callbacks or quote consultations against an authorised calendar. A time is confirmed only after the booking system accepts it. Otherwise, the assistant records a request for your team to confirm. Technician dispatch, binding quotes and promised arrival times are outside the initial scope.',
  },
  {
    question: 'What does the founding pilot cost?',
    answer: `The guide price is $${receptionistOffer.setup} for setup plus $${receptionistOffer.monthly} per month, including ${receptionistOffer.includedMinutes} call minutes. Additional minutes are $${receptionistOffer.additionalMinute.toFixed(2)} each. Prices are in USD. Applicable taxes, bespoke integration costs, the review cadence and service terms are confirmed in your proposal before any payment or activation.`,
  },
  {
    question: 'What happens when the assistant cannot help?',
    answer: 'The intended workflow is to take a callback request or attempt a transfer to an approved contact, according to your rules. It must not invent an answer or claim an action succeeded when it did not. We agree escalation, unsuccessful-transfer handling and a phone-routing fallback before launch.',
  },
  {
    question: 'Will callers know they are speaking to AI?',
    answer: 'Yes. The assistant should introduce itself as an AI assistant. Recording or transcription settings, any required notices and consent, and data handling must be agreed for your launch location before calls are activated. Do not use the initial pilot to collect payment-card details or medical information.',
  },
  {
    question: 'Is the service already live?',
    answer: 'Founding-pilot enquiries are open. Demo availability and activation are confirmed individually after a business-fit check, provider approvals, phone-routing checks and workflow testing. This page does not provide a live AI phone line or instant activation. Submitting the form does not book an appointment, start a subscription or authorise a payment.',
  },
]

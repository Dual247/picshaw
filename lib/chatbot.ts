import { auditPrice, corePrice, foundingPrice, growthStartingPrice, annualDiscount, usd, RETAINER_PATH } from './retainer'
import { receptionistOffer } from './receptionist'

/** Curated local answers, not generative AI, a website scan or live availability. */
export type ChatTopic = 'overview' | 'pricing' | 'core' | 'founding' | 'growth' | 'annual' | 'audit' | 'credit' | 'website' | 'receptionist' | 'local' | 'results' | 'timing' | 'existing' | 'privacy' | 'human' | 'custom' | 'unknown'
export type ChatAnswer = { topic: ChatTopic; text: string; links: { label: string; href: string }[]; suggestions: string[] }
export const starterQuestions = ['How can you get me more enquiries?', 'What does it cost?', 'Can you improve my website?', 'Tell me about the AI receptionist']
export const chatInterests = [
  ['ai-visibility', 'AI visibility / more enquiries'], ['core', 'Core monthly plan'], ['founding', 'Los Angeles founding rate'],
  ['growth', 'Growth / more locations'], ['annual', 'Annual Core'], ['audit', 'AI Visibility Audit'],
  ['website', 'Website design / refresh'], ['receptionist', 'AI receptionist pilot'], ['other', 'A specific question / other request'],
] as const
export function interestFor(topic: ChatTopic): string {
  if (chatInterests.some(([value]) => value === topic)) return topic
  return ['overview', 'pricing', 'local', 'results', 'timing', 'existing', 'credit'].includes(topic) ? 'ai-visibility' : 'other'
}
const planLink = { label: 'Monthly plans and full terms', href: RETAINER_PATH }
const auditLink = { label: 'What the audit includes', href: '/ai-visibility-audit' }
const websiteLink = { label: 'Website design options', href: '/website-redesign' }
const voiceLink = { label: 'Receptionist pilot details', href: '/ai-receptionist' }
const methodologyLink = { label: 'How we measure progress', href: '/methodology' }
const answer = (topic: ChatTopic, text: string, links: ChatAnswer['links'] = [], suggestions: string[] = []): ChatAnswer => ({ topic, text, links, suggestions })
function forTopic(topic: ChatTopic): ChatAnswer {
  switch (topic) {
    case 'overview': return answer(topic, 'We help local businesses become easier to discover in AI search and make their websites easier to enquire through. The aim is more relevant customer opportunities—not just more views. We improve service pages, search foundations, business information and enquiry paths. Which part would help your business most?', [{ label: 'Explore AI-search visibility', href: '/ai-search-optimization' }], ['Show me monthly plans', 'I need a better website', 'I miss customer calls'])
    case 'pricing': return answer(topic, `Core AI visibility is ${usd(corePrice)}/month: three months minimum, then month to month. A single-location audit is ${usd(auditPrice)} once. A website refresh is $1,000; a larger Growth Site starts at $2,500. These are separate scopes, not a bundle. Which service are you considering?`, [planLink, websiteLink], ['What is included in Core?', 'Is there a founding rate?', 'What does the audit include?'])
    case 'core': return answer(topic, `Core is ${usd(corePrice)}/month for one location and one primary market: three months minimum, then month to month. Each month we re-test about 20 buyer questions across ChatGPT and Google AI, check access and business listings, support your eligible Google Business Profile, create or rewrite one page/guide, and review referrals and enquiries in a 30-minute walkthrough.`, [planLink], ['How does the audit credit work?', 'Can I keep my current website?'])
    case 'founding': return answer(topic, `The first three eligible Los Angeles clients can apply for Core at ${usd(foundingPrice)}/month, locked for six months. Same Core scope; three months minimum, with a case study published only with permission. I cannot check remaining places or reserve one here. Ash confirms availability, eligibility and subsequent pricing in the proposal.`, [planLink], ['What is included in Core?', 'I would like a proposal'])
    case 'growth': return answer(topic, `Growth AI visibility starts at ${usd(growthStartingPrice)}/month, quoted for a second market or location. It includes two content pieces a month and a quarterly strategy review, with a three-month minimum. This is different from the one-time Growth Site website build. Include your locations in a request for Ash to scope.`, [planLink], ['Compare with Core', 'I would like a proposal'])
    case 'annual': return answer(topic, `Twelve months of standard Core prepaid is ${usd(corePrice * 12 * (1 - annualDiscount))}, instead of ${usd(corePrice * 12)}: ${annualDiscount * 100}% off (${usd(corePrice * (1 - annualDiscount))} effective monthly). This is a 12-month commitment, not a three-month plan. Annual and founding discounts do not stack; written terms apply.`, [planLink], ['What is included in Core?', 'I would like a proposal'])
    case 'audit': return answer(topic, `The single-location AI Visibility Audit is ${usd(auditPrice)} once. It reviews search access, business accuracy, buyer questions and the route to an enquiry. You receive a baseline, evidence log, priority action plan and walkthrough. Fixes and ongoing work are separate. It is a paid audit, not an instant free website scan.`, [auditLink], ['How does the audit credit work?', 'What happens each month?'])
    case 'credit': return answer(topic, `Start a qualifying retainer within 30 days of the ${usd(auditPrice)} audit walkthrough and ${usd(auditPrice / 2)} is credited against month one. Standard Core's first retainer month would then be ${usd(corePrice - auditPrice / 2)} before applicable taxes, followed by ${usd(corePrice)}/month. The audit fee is separate; eligibility is confirmed in writing, and the credit is not a cash refund.`, [auditLink, planLink], ['Show me monthly plans', 'I would like a proposal'])
    case 'website': return answer(topic, 'The Website Refresh is $1,000 for an agreed refresh scope. A larger Growth Site starts at $2,500. We focus on clear services, mobile usability and an easier route to call or enquire. A new site or extra integrations needs a confirmed scope; ongoing AI visibility is separate. Tell Ash what you need for a recommendation.', [websiteLink], ['Can I keep my current website?', 'What about AI visibility?', 'I would like a proposal'])
    case 'existing': return answer(topic, 'You do not need to replace a good website to work with Picshaw. We assess the current site and platform before recommending fixes or a separately scoped redesign. Domain, hosting, booking tools and access are checked before changes. I cannot inspect a URL from this chat, but you can include it in a request—even if you have not launched a site yet.', [websiteLink, auditLink], ['What does the audit include?', 'Show me monthly plans'])
    case 'receptionist': return answer(topic, `The AI receptionist founding pilot is ${usd(receptionistOffer.monthly)}/month plus ${usd(receptionistOffer.setup)} setup, including ${receptionistOffer.includedMinutes} call minutes; extra minutes are $${receptionistOffer.additionalMinute.toFixed(2)}. It handles scoped unanswered/after-hours enquiries and callbacks. Booking and forwarding depend on tested setup. It is a pilot, not instant activation, emergency dispatch or medical intake. Ash can confirm fit and demo availability.`, [voiceLink], ['Can I request a demo?', 'What else does Picshaw offer?'])
    case 'local': return answer(topic, 'Core combines AI visibility with scoped local-search work: check details across Google Business Profile, Apple Maps, Bing and key directories; prepare profile updates and review-response drafts; and improve service content. Profile work needs eligibility, access and approvals. We do not fabricate reviews or guarantee positions.', [planLink, { label: 'Local search approach', href: '/local-seo' }], ['What does Core cost?', 'Can I keep my current website?'])
    case 'results': return answer(topic, 'We work towards better discovery and more relevant enquiries, but cannot guarantee rankings, AI recommendations or lead volumes. Reports separate sampled AI mentions, identifiable AI referrals, landing-page visits and enquiries. Website concepts demonstrate design, not verified client results. Ash can discuss which evidence would be useful for your business.', [methodologyLink], ['What happens each month?', 'What does the audit include?'])
    case 'timing': return answer(topic, 'Start and delivery dates are agreed in your proposal. Core has a three-month minimum followed by month-to-month work; that is not a promise of results within three months. Cancellation notice, annual commitments and any refunds follow your written terms. For a specific deadline or existing agreement, send Ash the details.', [planLink], ['I have a specific deadline', 'I would like a proposal'])
    case 'privacy': return answer(topic, 'I am an automated guide using Picshaw’s published information, not a live person or a website auditor. Questions are answered in this tab without sending them to a model or chat server. Only the form details you review and submit are emailed to Picshaw. Clear chat or refresh to remove this conversation. Please leave out sensitive information.', [{ label: 'Chat and enquiry privacy', href: '/privacy-policy#chat-assistant' }], ['What else does Picshaw offer?'])
    case 'human': return answer(topic, 'Use “Send a request to Ash” below, add a reply email and describe what you need. A website is optional, and you can review everything before sending. This requests a reply; it does not book a call, reserve a founding place or start paid work.', [], ['What does it cost?', 'Tell me about the AI receptionist'])
    case 'custom': return answer(topic, 'That needs a tailored scope rather than a guessed answer. Tell Ash about the functionality, platform, market or deadline you have in mind using “Send a request to Ash”. He can assess suitability and pricing before any work starts. You do not need an existing website to enquire.', [websiteLink], ['Talk to Ash', 'What does it cost?'])
    default: return answer('unknown', 'I do not have a verified answer for that specific question. I can explain Picshaw’s services and prices, or pass on your request once you review and submit it to Ash. What are you looking to achieve?', [], ['Show me monthly plans', 'Can you improve my website?', 'Talk to Ash'])
  }
}

export function getChatAnswer(input: string, previous?: ChatTopic): ChatAnswer {
  const q = input.slice(0, 1200).normalize('NFKC').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim()
  if (!q) return forTopic('overview')
  if (/\b(privacy|personal data|delete my|recording this chat|are you (a bot|ai|human)|live agent|ignore (all|previous)|system prompt|api key|password|credit card|social security)\b/.test(q)) return forTopic('privacy')
  if (/\b(guarantee|guaranteed|proof|testimonials?|case studies|rank first|number one|results?|roi)\b/.test(q)) return forTopic('results')
  if (/\b(ash|talk to|speak to|book a call|proposal|quote|specific request|human|person|get started|sign up|ready to start)\b/.test(q)) return forTopic('human')
  if (/\b(what else|which services|what services|what do you (offer|do))\b/.test(q)) return forTopic('overview')
  const voice = /\b(receptionist|voice|miss(ed)? (a |customer )?calls?|answer(ing)? (the |my )?(phone|calls?)|after.hours|call forwarding|appointment|demo)\b/.test(q)
  const annual = /\b(annual|yearly|prepay|prepaid|12 months|twelve months)\b/.test(q)
  const founding = /\b(founding|founder rate|first three|first 3|1250 a month)\b/.test(q)
  const discount = /\b(discount|cheaper|offer a deal)\b/.test(q)
  const audit = /\b(audit|scan|assessment)\b/.test(q)
  const core = /\b(core|retainer|monthly plan)\b/.test(q)
  const website = /\b(growth site|redesign|rebuild|refresh|new (web)?site|better website|improve my website|website design|web design|build (me |a |my )?(web)?site)\b/.test(q)
  const growth = /\b(growth|two locations|2 locations|second (market|location)|multiple (markets|locations)|multi.location)\b/.test(q)
  const pricing = /\b(price|prices|pricing|cost|costs|how much|charge|budget|expensive|afford)\b/.test(q)
  // Short follow-ups refer to the last topic; explicit new services take priority.
  const followUp = !voice && !audit && !website && !core && !growth && !founding && q.split(' ').length <= 12
  if (voice || (followUp && previous === 'receptionist' && (pricing || annual || discount))) {
    if (annual || discount) return answer('receptionist', `The published receptionist pilot price is ${usd(receptionistOffer.monthly)}/month plus ${usd(receptionistOffer.setup)} setup. The Core annual and LA founding discounts are for the AI Visibility Retainer, not this voice service. Ask Ash to quote any different receptionist billing arrangement.`, [voiceLink], ['Tell me about the AI receptionist', 'Talk to Ash'])
    return forTopic('receptionist')
  }
  if (/\b(credit|half (the|my)|625)\b/.test(q) || (audit && discount)) return forTopic('credit')
  if (audit && core) return answer('pricing', `The audit is a one-time ${usd(auditPrice)} diagnosis; Core is ${usd(corePrice)}/month for ongoing improvements, three months minimum. Start a qualifying retainer within 30 days of the audit walkthrough for a ${usd(auditPrice / 2)} month-one credit. They are separate scopes.`, [auditLink, planLink], ['What does the audit include?', 'What is included in Core?'])
  if (audit) return forTopic('audit')
  if (website) return forTopic('website')
  if (annual) return forTopic('annual')
  if (founding || discount) return forTopic('founding')
  if (/\b(keep|existing|current|wordpress|squarespace|shopify|wix|webflow|hosting|domain|already have|no website|dont have a website)\b/.test(q)) return forTopic('existing')
  if (growth) return forTopic('growth')
  if (/\b(how (long|soon|fast)|when|deadline|cancel|minimum|commitment|contract|timing|refund)\b/.test(q)) {
    if (founding || previous === 'founding') return forTopic('founding')
    if (previous === 'annual') return forTopic('annual')
    return forTopic('timing')
  }
  if (followUp && (pricing || /\b(included|per month|one time|does that include)\b/.test(q)) && previous && ['core', 'founding', 'growth', 'annual', 'audit', 'website', 'receptionist'].includes(previous)) return forTopic(previous)
  if (core || /\b(each month|every month|included|deliverables|ongoing|per month)\b/.test(q)) return forTopic('core')
  if (/\b(google (business|maps)|apple maps|bing|local seo|listings|directories|reviews?)\b/.test(q)) return forTopic('local')
  if (pricing) return forTopic('pricing')
  if (/\b(custom|integration|integrate|chatbot|payment|ecommerce|e.commerce|shop|booking system|crm)\b/.test(q)) return forTopic('custom')
  if (/\b(hi|hello|hey|help|services|offer|aeo|seo|ai search|chatgpt|visibility|enquiries|leads|customers|traffic|dentist|dental|plumb(er|ing)|roof(ing|er)|accountant|salon|contractor|landscap(er|ing)|business|practice)\b/.test(q)) return forTopic('overview')
  if (/^(thanks|thank you|ok|okay|great)[.! ]*$/.test(q)) return answer('overview', 'You’re welcome. Keep asking questions or send Ash a request whenever you are ready.', [], ['What does it cost?', 'Talk to Ash'])
  return forTopic('unknown')
}

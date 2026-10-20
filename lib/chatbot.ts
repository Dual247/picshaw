import { auditPrice, corePrice, foundingPrice, growthStartingPrice, annualDiscount, usd, RETAINER_PATH } from './retainer'
import { receptionistOffer } from './receptionist'

/** Local, curated answers. No model, external request, site scan or live availability claim. */
export type ChatTopic = 'overview' | 'pricing' | 'core' | 'founding' | 'growth' | 'annual' | 'audit' | 'credit' | 'website' | 'receptionist' | 'local' | 'results' | 'timing' | 'existing' | 'privacy' | 'human' | 'unknown'
export type ChatAnswer = { topic: ChatTopic; text: string; links: { label: string; href: string }[]; suggestions: string[] }
export const starterQuestions = ['How can you get me more enquiries?', 'What does it cost?', 'Can you improve my website?', 'Tell me about the AI receptionist']
export const chatInterests = [
  ['ai-visibility', 'AI visibility / more enquiries'], ['core', 'Core monthly plan'], ['founding', 'Los Angeles founding rate'],
  ['growth', 'Growth / more locations'], ['annual', 'Annual Core'], ['audit', 'AI Visibility Audit'],
  ['website', 'Website design / refresh'], ['receptionist', 'AI receptionist pilot'], ['other', 'A specific question / other request'],
] as const
export function interestFor(topic: ChatTopic): string {
  if (chatInterests.some(([value]) => value === topic)) return topic
  if (['overview', 'pricing', 'local', 'results', 'timing', 'existing', 'credit'].includes(topic)) return 'ai-visibility'
  return 'other'
}
const planLink = { label: 'Monthly plans and full terms', href: RETAINER_PATH }
const auditLink = { label: 'What the audit includes', href: '/ai-visibility-audit' }
const websiteLink = { label: 'Website design options', href: '/website-redesign' }
const voiceLink = { label: 'Receptionist pilot details', href: '/ai-receptionist' }
const methodologyLink = { label: 'How we measure progress', href: '/methodology' }
const answer = (topic: ChatTopic, text: string, links: ChatAnswer['links'] = [], suggestions: string[] = []): ChatAnswer => ({ topic, text, links, suggestions })

function forTopic(topic: ChatTopic): ChatAnswer {
  switch (topic) {
    case 'overview': return answer(topic, 'We help local businesses become easier to discover in AI search and make their websites easier to enquire through. The aim is more relevant customer opportunities—not just more views. We work on clear service pages, search foundations, business information and enquiry paths. What would help your business most?', [{ label: 'Explore AI-search visibility', href: '/ai-search-optimization' }], ['Show me monthly plans', 'I need a better website', 'I miss customer calls'])
    case 'pricing': return answer(topic, `Core AI visibility is ${usd(corePrice)}/month: three months minimum, then month to month. A single-location audit is ${usd(auditPrice)} once. A website refresh is $1,000; a larger Growth Site starts at $2,500. These are separate scopes, not one bundled price. Which service are you considering?`, [planLink, websiteLink], ['What is included in Core?', 'Is there a founding rate?', 'What does the audit include?'])
    case 'core': return answer(topic, `Core is ${usd(corePrice)}/month for one location and one primary market, with a three-month minimum, then month to month. Each month: re-test about 20 buyer questions across ChatGPT and Google AI, check access and business listings, support your eligible Google Business Profile, create or rewrite one page/guide with appropriate structured data, and review referrals and enquiries in a 30-minute walkthrough.`, [planLink], ['How does the audit credit work?', 'Can I keep my current website?'])
    case 'founding': return answer(topic, `The first three eligible Los Angeles clients can apply for Core at ${usd(foundingPrice)}/month, locked for six months. It is the same Core scope, with a three-month minimum and a case study published only with permission. I cannot check remaining places or reserve one here—Ash confirms availability and eligibility in your proposal.`, [planLink], ['What is included in Core?', 'I would like a proposal'])
    case 'growth': return answer(topic, `Growth AI visibility starts at ${usd(growthStartingPrice)}/month, quoted for a second market or location. It includes two content pieces per month and a quarterly strategy review, with a three-month minimum. This is different from the one-time Growth Site website build. Share your locations in a request so Ash can confirm the right scope.`, [planLink], ['Compare with Core', 'I would like a proposal'])
    case 'annual': return answer(topic, `Twelve months of standard Core prepaid is ${usd(corePrice * 12 * (1 - annualDiscount))}, instead of ${usd(corePrice * 12)}: a ${annualDiscount * 100}% discount (${usd(corePrice * (1 - annualDiscount))} effective monthly). This is a 12-month commitment, not a three-month plan. The annual and founding discounts do not stack; written terms apply.`, [planLink], ['What is included in Core?', 'I would like a proposal'])
    case 'audit': return answer(topic, `The single-location AI Visibility Audit is ${usd(auditPrice)}. It reviews search access, accurate business information, buyer questions and the route to an enquiry. You receive a baseline, evidence log, priority action plan and walkthrough. Fixes and ongoing work are separate. It is a paid audit—not an instant free website scan.`, [auditLink], ['How does the audit credit work?', 'What happens each month?'])
    case 'credit': return answer(topic, `Start a qualifying retainer within 30 days of the ${usd(auditPrice)} audit walkthrough and ${usd(auditPrice / 2)} is credited against month one. For standard Core, that makes the first retainer month ${usd(corePrice - auditPrice / 2)} before any applicable taxes, followed by ${usd(corePrice)}/month. Eligibility is confirmed in writing; the credit is not a cash refund.`, [auditLink, planLink], ['Show me monthly plans', 'I would like a proposal'])
    case 'website': return answer(topic, 'The Website Refresh is $1,000 for an agreed refresh scope. A larger Growth Site starts at $2,500. We focus on clear services, mobile usability and an easier route to call or enquire. New integrations or a new website from scratch need a confirmed scope. Ongoing AI visibility is separate. Tell Ash what you need and he can recommend the right starting point.', [websiteLink], ['Can I keep my current website?', 'What about AI visibility?', 'I would like a proposal'])
    case 'existing': return answer(topic, 'You do not need to replace a good website to work with Picshaw. We can assess the existing site and its platform before recommending fixes or a separately scoped redesign. Domain, hosting, booking tools and access are checked before changes. I cannot inspect your URL from this chat, but you can include it in your request.', [websiteLink, auditLink], ['What does the audit include?', 'Show me monthly plans'])
    case 'receptionist': return answer(topic, `The AI receptionist founding pilot is ${usd(receptionistOffer.monthly)}/month plus ${usd(receptionistOffer.setup)} setup, including ${receptionistOffer.includedMinutes} call minutes; extra minutes are $${receptionistOffer.additionalMinute.toFixed(2)}. It focuses on unanswered/after-hours enquiries and callbacks. Calendar booking and number forwarding depend on confirmed setup. It is a pilot—not instant activation, emergency dispatch or medical intake. Ash can discuss fit and demo availability.`, [voiceLink], ['Can I request a demo?', 'What else does Picshaw offer?'])
    case 'local': return answer(topic, 'Core combines AI visibility with scoped local-search work: check business details across Google Business Profile, Apple Maps, Bing and relevant directories; prepare profile updates and review-response drafts; and improve useful service content. Profile work needs eligibility, verification, access and approvals. We do not fabricate reviews or guarantee positions.', [planLink, { label: 'Local search approach', href: '/local-seo' }], ['What does Core cost?', 'Can I keep my current website?'])
    case 'results': return answer(topic, 'We work towards better discovery and more relevant enquiries, but cannot guarantee rankings, ChatGPT recommendations or a number of leads. Reports distinguish sampled AI mentions, identifiable AI referrals, landing-page visits and enquiries. Website concepts demonstrate design, not proven client results. Ash can discuss what evidence would be useful for your business.', [methodologyLink], ['What happens each month?', 'What does the audit include?'])
    case 'timing': return answer(topic, 'The start and delivery dates are agreed in your proposal. Core has a three-month minimum, followed by month-to-month work, but that is not a promise of results within three months. We review evidence monthly and adjust priorities. Need something by a particular date? Include the deadline in a request for Ash to assess.', [planLink], ['I have a specific deadline', 'I would like a proposal'])
    case 'privacy': return answer(topic, 'I am an automated guide using Picshaw’s published information—not a live person or an AI website auditor. Questions are answered in this tab without sending them to a model or a chat server. Only the details you review and submit in the request form are emailed to Picshaw. Clear chat or refresh to remove this conversation. Please keep sensitive information out.', [{ label: 'Chat and enquiry privacy', href: '/privacy-policy#chat-assistant' }], ['What else does Picshaw offer?'])
    case 'human': return answer(topic, 'Absolutely. Use “Send a request to Ash” below, add a reply email and describe what you need. A website is optional. You can review everything before sending. This requests a reply—it does not book a call, reserve a founding place or start paid work.', [], ['What does it cost?', 'Tell me about the AI receptionist'])
    default: return answer('unknown', 'I do not have a verified answer for that specific request. I can help with Picshaw’s services and pricing, or you can send the question to Ash for a tailored reply. Nothing is sent until you review and submit the request.', [], ['Show me monthly plans', 'Can you improve my website?', 'Talk to Ash'])
  }
}

export function getChatAnswer(input: string, previous?: ChatTopic): ChatAnswer {
  const q = input.slice(0, 1200).normalize('NFKC').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim()
  if (!q) return forTopic('overview')
  // Treat input as text only. Never execute, browse URLs, or infer a completed action.
  if (/\b(privacy|personal data|delete my|recording this chat|human or|are you (a bot|ai|human)|live agent)\b/.test(q)) return forTopic('privacy')
  if (/\b(ignore (all|previous)|system prompt|api key|password|credit card|social security)\b/.test(q)) return forTopic('privacy')
  if (/\b(guarantee|guaranteed|proof|testimonials?|case studies|rank first|number one|results?|roi)\b/.test(q)) return forTopic('results')
  if (/\b(credit|half (the|my)|625)\b/.test(q)) return forTopic('credit')
  if (/\b(annual|yearly|prepay|prepaid|12 months|twelve months)\b/.test(q)) return forTopic('annual')
  if (/\b(founding|founder rate|discount|first three|first 3|1250 a month)\b/.test(q)) return forTopic('founding')
  if (/\b(receptionist|voice|miss(ed)? (a |customer )?calls?|answer(ing)? (the |my )?(phone|calls?)|after hours|call forwarding|appointment|demo)\b/.test(q)) return forTopic('receptionist')
  if (/\b(keep|existing|current|wordpress|squarespace|shopify|wix|webflow|hosting|domain|already have|no website|dont have a website)\b/.test(q)) return forTopic('existing')
  if (/\b(growth site|redesign|rebuild|refresh|new (web)?site|better website|improve my website|website design|web design|build (me |a |my )?(web)?site)\b/.test(q)) return forTopic('website')
  if (/\b(growth|two locations|2 locations|second (market|location)|multiple (markets|locations)|multi.location)\b/.test(q)) return forTopic('growth')
  if (/\b(core|retainer|monthly|each month|every month|included|deliverables|ongoing|per month)\b/.test(q)) return forTopic('core')
  if (/\b(audit|scan|assessment|walkthrough)\b/.test(q)) return forTopic('audit')
  if (/\b(google (business|maps)|apple maps|bing|local seo|listings|directories|reviews?)\b/.test(q)) return forTopic('local')
  if (/\b(how (long|soon|fast)|when|deadline|cancel|minimum|commitment|contract|timing)\b/.test(q)) return forTopic('timing')
  if (/\b(ash|human|person|quote|proposal|specific (request|question)|contact you|talk to|speak to|book a call|get started|sign up|ready to start)\b/.test(q)) return forTopic('human')
  if (/\b(price|prices|pricing|cost|costs|how much|charge|budget|expensive|afford)\b/.test(q)) {
    const relevant = previous && ['core', 'founding', 'growth', 'annual', 'audit', 'website', 'receptionist'].includes(previous)
    return forTopic(relevant ? previous! : 'pricing')
  }
  if (/\b(hi|hello|hey|help|services|offer|aeo|seo|ai search|chatgpt|visibility|enquiries|leads|customers|traffic|dentist|dental|plumb(er|ing)|roof(ing|er)|accountant|salon|contractor|landscap(er|ing)|business|practice)\b/.test(q)) return forTopic('overview')
  if (/^(thanks|thank you|ok|okay|great)[.! ]*$/.test(q)) return answer('overview', 'You’re welcome. You can keep asking questions or send Ash a request whenever you are ready.', [], ['What does it cost?', 'Talk to Ash'])
  return forTopic('unknown')
}

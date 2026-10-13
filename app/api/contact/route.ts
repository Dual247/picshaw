import { Resend } from 'resend'
import { z } from 'zod'
import { track } from '@vercel/analytics/server'

const serviceLabels: Record<string, string> = { audit: 'AI Visibility Audit', aeo: 'AEO implementation or ongoing support', receptionist: 'AI receptionist demo / founding pilot', '1k': '$1,000 Website Refresh', '2.5k': '$2,500+ Growth Site', monthly: 'Website Partnership', unsure: 'Help me decide' }
const inputSchema = z.object({
  name: z.string().trim().max(150).default(''), email: z.string().trim().email().max(254),
  business: z.string().trim().max(200).default(''), website: z.string().trim().max(2048).default(''),
  message: z.string().trim().max(5000).default(''), service_interest: z.enum(['audit', 'aeo', 'receptionist', '1k', '2.5k', 'monthly', 'unsure']),
}).superRefine((input, context) => {
  // A website is not a prerequisite for the receptionist pilot. Retain the existing audit/review requirement.
  if (input.service_interest !== 'receptionist' && !input.website) context.addIssue({ code: z.ZodIssueCode.custom, path: ['website'], message: 'A website is required.' })
  if (input.service_interest === 'receptionist') {
    if (!input.name) context.addIssue({ code: z.ZodIssueCode.custom, path: ['name'], message: 'Your name is required.' })
    if (!input.business) context.addIssue({ code: z.ZodIssueCode.custom, path: ['business'], message: 'Your business name is required.' })
  }
})
function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') }
export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }) }
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Please check the required fields and try again.' }, { status: 400 })
  if (!process.env.RESEND_API_KEY) return Response.json({ error: 'Messaging is temporarily unavailable. Please email hello@picshaw.com.' }, { status: 503 })
  const { name, email, business, website, message, service_interest } = parsed.data
  const isAeo = service_interest === 'audit' || service_interest === 'aeo'
  const isReceptionist = service_interest === 'receptionist'
  const enquiryLabel = isReceptionist ? 'AI receptionist enquiry' : isAeo ? 'AI visibility enquiry' : 'website review request'
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'Picshaw Contact <hello@picshaw.com>', to: ['hello@picshaw.com'], replyTo: email,
      subject: `New ${enquiryLabel}${name ? ` from ${name.replace(/[\r\n]/g, ' ')}` : ''}`,
      html: `<h2>New Picshaw Enquiry</h2><p><strong>Looking for:</strong> ${escapeHtml(serviceLabels[service_interest])}</p><p><strong>Website:</strong> ${escapeHtml(website || 'Not provided')}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Name:</strong> ${escapeHtml(name || 'Not provided')}</p><p><strong>Business:</strong> ${escapeHtml(business || 'Not provided')}</p><p><strong>Business and goals:</strong></p><p>${escapeHtml(message || 'Not provided').replace(/\n/g, '<br/>')}</p><p>This is an enquiry. No payment or paid engagement has been authorised.</p>`,
    })
    if (error) { console.error('Contact email provider rejected the request.'); return Response.json({ error: 'Failed to send message.' }, { status: 502 }) }
    // Provider acceptance is not guaranteed inbox delivery. Never send personal lead details to analytics.
    if (process.env.VERCEL_ENV === 'production' && process.env.NEXT_PUBLIC_ANALYTICS_EVENTS === 'true') {
      const eventName = isReceptionist ? 'receptionist_enquiry_completed' : isAeo ? 'aeo_enquiry_completed' : 'review_request_completed'
      const form = isReceptionist ? 'receptionist_enquiry' : isAeo ? 'aeo_enquiry' : 'website_review'
      try { await track(eventName, { form }) } catch { console.warn('Contact analytics unavailable; email was accepted.') }
    }
    return Response.json({ success: true })
  } catch { console.error('Contact email delivery request failed.'); return Response.json({ error: 'Something went wrong.' }, { status: 500 }) }
}

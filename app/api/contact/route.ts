import { Resend } from 'resend'
import { z } from 'zod'
import { track } from '@vercel/analytics/server'

const serviceLabels: Record<string, string> = { '1k': '$1,000 Website Refresh', '2.5k': '$2,500+ Growth Site', monthly: 'Monthly Partnership', unsure: 'Not sure yet' }
const inputSchema = z.object({
  name: z.string().trim().max(150).default(''),
  email: z.string().trim().email().max(254),
  business: z.string().trim().max(200).default(''),
  website: z.string().trim().min(1).max(2048),
  message: z.string().trim().max(5000).default(''),
  service_interest: z.enum(['1k', '2.5k', 'monthly', 'unsure']),
})
function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}
export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }) }
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Please check the required fields and try again.' }, { status: 400 })
  if (!process.env.RESEND_API_KEY) return Response.json({ error: 'Messaging is temporarily unavailable. Please email hello@picshaw.com.' }, { status: 503 })
  const { name, email, business, website, message, service_interest } = parsed.data
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'Picshaw Contact <hello@picshaw.com>', to: ['hello@picshaw.com'], replyTo: email,
      subject: `New website review request${name ? ` from ${name.replace(/[\r\n]/g, ' ')}` : ''}`,
      html: `<h2>New Contact Form Submission</h2><p><strong>Looking for:</strong> ${escapeHtml(serviceLabels[service_interest])}</p><p><strong>Website:</strong> ${escapeHtml(website)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Name:</strong> ${escapeHtml(name || 'Not provided')}</p><p><strong>Business:</strong> ${escapeHtml(business || 'Not provided')}</p><p><strong>Biggest frustration:</strong></p><p>${escapeHtml(message || 'Not provided').replace(/\n/g, '<br/>')}</p>`,
    })
    if (error) {
      console.error('Contact email provider rejected the request.')
      return Response.json({ error: 'Failed to send message.' }, { status: 502 })
    }
    // Provider acceptance, not guaranteed inbox delivery. Count once here, never on button click.
    // Do not send personal lead details or the submitted website to analytics.
    if (process.env.VERCEL_ENV === 'production' && process.env.NEXT_PUBLIC_ANALYTICS_EVENTS === 'true') {
      try { await track('review_request_completed', { form: 'website_review' }) } catch { console.warn('Contact analytics unavailable; email was accepted.') }
    }
    return Response.json({ success: true })
  } catch {
    console.error('Contact email delivery request failed.')
    return Response.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

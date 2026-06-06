import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const serviceLabels: Record<string, string> = {
  "1k": "$1,000 Website Refresh",
  "2.5k": "$2,500+ Growth Site",
  monthly: "Monthly Partnership",
  unsure: "Not sure yet",
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name = "",
      email = "",
      business = "",
      website = "",
      message = "",
      service_interest = "",
    } = body ?? {}

    // Basic validation for the required fields.
    if (!email || !website || !service_interest) {
      return Response.json(
        { error: "Missing required fields." },
        { status: 400 }
      )
    }

    const service = serviceLabels[service_interest] ?? service_interest
    const safe = {
      name: escapeHtml(name || "Not provided"),
      email: escapeHtml(email),
      business: escapeHtml(business || "Not provided"),
      website: escapeHtml(website),
      message: escapeHtml(message || "Not provided"),
      service: escapeHtml(service),
    }

    const { error } = await resend.emails.send({
      from: "Picshaw Contact <onboarding@resend.dev>",
      to: ["hello@picshaw.com"],
      replyTo: email,
      subject: `New website review request${name ? ` from ${name}` : ""}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Looking for:</strong> ${safe.service}</p>
        <p><strong>Website:</strong> ${safe.website}</p>
        <p><strong>Email:</strong> ${safe.email}</p>
        <p><strong>Name:</strong> ${safe.name}</p>
        <p><strong>Business:</strong> ${safe.business}</p>
        <p><strong>Biggest frustration:</strong></p>
        <p>${safe.message.replace(/\n/g, "<br/>")}</p>
      `,
    })

    if (error) {
      console.error("[v0] Resend error:", error)
      return Response.json(
        { error: "Failed to send message." },
        { status: 502 }
      )
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error("[v0] Contact route error:", err)
    return Response.json({ error: "Something went wrong." }, { status: 500 })
  }
}

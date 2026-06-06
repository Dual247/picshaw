"use client"

import { useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { AnimatedButton } from "./AnimatedButton"
import { ArrowUpRight, Check, Phone } from "lucide-react"

const serviceOptions = [
  { value: "1k", label: "$1,000 Website Refresh" },
  { value: "2.5k", label: "$2,500+ Growth Site" },
  { value: "monthly", label: "Monthly Partnership" },
  { value: "unsure", label: "Not sure yet" },
]

// TODO: Replace with actual phone number (CallRail or tracking number)
const PHONE_NUMBER = "(737) 900-9237"
const PHONE_NUMBER_TEL = "tel:+17379009237"

export function Contact() {
  const [step, setStep] = useState(1)
  const [selectedService, setSelectedService] = useState("")
  const [serviceError, setServiceError] = useState(false)
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    business: "",
    website: "",
    message: "",
  })

  const prefersReducedMotion = useReducedMotion()

  const handleStep1Continue = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate service selection
    if (!selectedService) {
      setServiceError(true)
      return
    }
    
    setServiceError(false)
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("submitting")

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          service_interest: selectedService,
        }),
      })

      if (!res.ok) {
        throw new Error("Request failed")
      }

      setStatus("success")
      setFormData({
        name: "",
        email: "",
        business: "",
        website: "",
        message: "",
      })
      setSelectedService("")
    } catch (err) {
      console.error("[v0] Contact submit error:", err)
      setStatus("error")
    }
  }

  const handleBack = () => {
    setStep(1)
  }

  return (
    <section id="contact" className="relative py-32 md:py-48">
      <div className="absolute inset-0 gradient-glow" />
      <div className="relative mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
          {/* Left - Header */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            className="lg:sticky lg:top-32 lg:self-start"
          >
            <span className="mb-6 inline-flex items-center gap-3 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
              <span className="h-px w-8 bg-primary" />
              Let&apos;s Talk
            </span>
            <h2 className="headline-editorial text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
              Ready to stop<br />losing customers?
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Send over your current website. I&apos;ll take a look and tell you exactly what I&apos;d improve—and whether the $1k refresh is right for you. No pitch deck. No discovery call. Just a straight answer.
            </p>

            {/* Quick contact info */}
            <div className="mt-10 space-y-4">
              <a
                href="mailto:hello@picshaw.com"
                className="group flex items-center gap-3 text-foreground transition-colors hover:text-primary"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card transition-colors group-hover:border-primary/30">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <span>hello@picshaw.com</span>
                <ArrowUpRight size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
              {/* Phone number */}
              <a
                href={PHONE_NUMBER_TEL}
                className="group flex items-center gap-3 text-foreground transition-colors hover:text-primary"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card transition-colors group-hover:border-primary/30">
                  <Phone size={16} />
                </span>
                <span>{PHONE_NUMBER}</span>
                <ArrowUpRight size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
              <p className="flex items-center gap-3 text-muted-foreground">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <span>Los Angeles, CA</span>
              </p>
            </div>

            {/* Trust signal */}
            <div className="mt-10 rounded-lg border border-border bg-card/50 p-6">
              <p className="text-sm font-medium text-foreground">What happens next:</p>
              <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">1</span>
                  I review your website within 24 hours
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">2</span>
                  You get a reply with my honest recommendation
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">3</span>
                  If we&apos;re a fit, we start that week
                </li>
              </ol>
            </div>
          </motion.div>

          {/* Right - Form */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
            className="rounded-2xl border border-border bg-card/50 p-8 md:p-10"
          >
            {/* Progress indicator */}
            <div className="mb-8 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Step {step} of 2
              </span>
              <div className="flex gap-2">
                <div className={`h-2 w-12 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-border"}`} />
                <div className={`h-2 w-12 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-border"}`} />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {status === "success" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center py-12 text-center"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Check size={28} />
                  </span>
                  <h3 className="mt-6 text-2xl font-bold text-foreground">
                    Message sent!
                  </h3>
                  <p className="mt-3 max-w-sm text-muted-foreground">
                    Got it! I&apos;ll review your site and reply with a recommendation within 24 hours.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("idle")
                      setStep(1)
                    }}
                    className="mt-8 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Send another message
                  </button>
                </motion.div>
              ) : step === 1 ? (
                <motion.form
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleStep1Continue}
                  className="space-y-6"
                >
                  {/* Website URL */}
                  <div>
                    <label htmlFor="contact-website" className="mb-2 block text-sm font-medium text-foreground">
                      Current website URL <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      id="contact-website"
                      name="website"
                      required
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      placeholder="yourbusiness.com"
                    />
                    {/* TODO: Pre-fill from query param for campaign tracking */}
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="contact-email" className="mb-2 block text-sm font-medium text-foreground">
                      Email <span className="text-primary">*</span>
                    </label>
                    <input
                      type="email"
                      id="contact-email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      placeholder="you@business.com"
                    />
                  </div>

                  {/* Service Selection - Radio Inputs styled as cards */}
                  <fieldset>
                    <legend className="mb-3 block text-sm font-medium text-foreground">
                      What are you looking for? <span className="text-primary">*</span>
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {serviceOptions.map((option) => (
                        <label
                          key={option.value}
                          className={`relative cursor-pointer rounded-lg border px-4 py-3 text-left text-sm transition-all ${
                            selectedService === option.value
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                          } ${serviceError && !selectedService ? "border-red-500/50" : ""}`}
                        >
                          <input
                            type="radio"
                            name="service_interest"
                            value={option.value}
                            checked={selectedService === option.value}
                            onChange={(e) => {
                              setSelectedService(e.target.value)
                              setServiceError(false)
                            }}
                            className="sr-only"
                            aria-describedby={serviceError ? "service-error" : undefined}
                          />
                          <span className="flex items-center gap-2">
                            {selectedService === option.value && (
                              <Check size={14} className="text-primary" />
                            )}
                            {option.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    {serviceError && (
                      <p id="service-error" className="mt-2 text-sm text-red-500">
                        Please select what you&apos;re looking for
                      </p>
                    )}
                  </fieldset>

                  {/* Continue Button */}
                  <AnimatedButton type="submit" size="lg" className="w-full justify-center" showArrow>
                    Continue
                  </AnimatedButton>
                </motion.form>
              ) : (
                <motion.form
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleSubmit}
                  className="space-y-6"
                >
                  {/* Back button */}
                  <button
                    type="button"
                    onClick={handleBack}
                    className="mb-2 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>

                  {/* Name */}
                  <div>
                    <label htmlFor="contact-name" className="mb-2 block text-sm font-medium text-foreground">
                      Your name
                    </label>
                    <input
                      type="text"
                      id="contact-name"
                      name="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      placeholder="John Smith"
                    />
                  </div>

                  {/* Business Name */}
                  <div>
                    <label htmlFor="contact-business" className="mb-2 block text-sm font-medium text-foreground">
                      Business name
                    </label>
                    <input
                      type="text"
                      id="contact-business"
                      name="business"
                      value={formData.business}
                      onChange={(e) => setFormData({ ...formData, business: e.target.value })}
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      placeholder="Smith Plumbing Co."
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="contact-message" className="mb-2 block text-sm font-medium text-foreground">
                      What&apos;s your biggest frustration with your current site?
                    </label>
                    <textarea
                      id="contact-message"
                      name="message"
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                      placeholder="e.g., &quot;It looks outdated and I&apos;m embarrassed to send people there&quot; or &quot;I&apos;m not getting any calls from it&quot;"
                    />
                  </div>

                  {/* Hidden fields to include step 1 data */}
                  <input type="hidden" name="website" value={formData.website} />
                  <input type="hidden" name="email" value={formData.email} />
                  <input type="hidden" name="service_interest" value={selectedService} />

                  {/* Submit */}
                  <AnimatedButton type="submit" size="lg" className="w-full justify-center" showArrow disabled={status === "submitting"}>
                    {status === "submitting" ? "Sending..." : "Get My Free Website Review"}
                  </AnimatedButton>

                  {status === "error" && (
                    <p className="text-center text-sm text-red-500">
                      Something went wrong. Please try again or email hello@picshaw.com directly.
                    </p>
                  )}

                  <p className="text-center text-xs text-muted-foreground">
                    No spam. No sales pitch. Just an honest assessment of your site.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

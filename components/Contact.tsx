"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { AnimatedButton } from "./AnimatedButton"
import { ArrowUpRight } from "lucide-react"

const budgetOptions = [
  { value: "1k", label: "$1,000 Website Refresh" },
  { value: "2.5k", label: "$2,500+ Growth Site" },
  { value: "monthly", label: "Monthly Partnership" },
  { value: "unsure", label: "Not sure yet" },
]

export function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    business: "",
    website: "",
    budget: "",
    message: "",
  })
  const [selectedBudget, setSelectedBudget] = useState("")

  const prefersReducedMotion = useReducedMotion()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    alert(
      "Got it! I&apos;ll review your site and reply with a recommendation within 24 hours."
    )
    setFormData({
      name: "",
      email: "",
      business: "",
      website: "",
      budget: "",
      message: "",
    })
    setSelectedBudget("")
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
          <motion.form
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border bg-card/50 p-8 md:p-10"
          >
            <div className="space-y-6">
              {/* Name & Email Row */}
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label htmlFor="contact-name" className="mb-2 block text-sm font-medium text-foreground">
                    Your name
                  </label>
                  <input
                    type="text"
                    id="contact-name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="mb-2 block text-sm font-medium text-foreground">
                    Email
                  </label>
                  <input
                    type="email"
                    id="contact-email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    placeholder="john@business.com"
                  />
                </div>
              </div>

              {/* Business & Website Row */}
              <div className="grid gap-6 md:grid-cols-2">
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
                <div>
                  <label htmlFor="contact-website" className="mb-2 block text-sm font-medium text-foreground">
                    Current website
                  </label>
                  <input
                    type="url"
                    id="contact-website"
                    name="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    placeholder="https://smithplumbing.com"
                  />
                </div>
              </div>

              {/* Budget - Visual Selection */}
              <div>
                <label className="mb-3 block text-sm font-medium text-foreground">
                  What are you looking for?
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {budgetOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSelectedBudget(option.value)
                        setFormData({ ...formData, budget: option.label })
                      }}
                      className={`rounded-lg border px-4 py-3 text-left text-sm transition-all ${
                        selectedBudget === option.value
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
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

              {/* Submit */}
              <AnimatedButton type="submit" size="lg" className="w-full justify-center" showArrow>
                Get My Free Website Review
              </AnimatedButton>
              
              <p className="text-center text-xs text-muted-foreground">
                No spam. No sales pitch. Just an honest assessment of your site.
              </p>
            </div>
          </motion.form>
        </div>
      </div>
    </section>
  )
}

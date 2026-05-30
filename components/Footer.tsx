"use client"

import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Mail } from "lucide-react"

export function Footer() {
  const currentYear = new Date().getFullYear()
  const prefersReducedMotion = useReducedMotion()
  const [leadMagnetEmail, setLeadMagnetEmail] = useState("")

  const handleLeadMagnetSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Wire up to email automation (ConvertKit, Mailchimp, etc.)
    alert("Thanks! Check your inbox for the checklist.")
    setLeadMagnetEmail("")
  }

  const links = [
    { label: "Work", href: "#work" },
    { label: "Services", href: "#services" },
    { label: "Process", href: "#process" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
    { label: "Contact", href: "#contact" },
  ]

  return (
    <footer className="relative border-t border-border bg-card/20 pb-28 pt-20 lg:pb-20">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        {/* Lead Magnet Section */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="mb-16 rounded-xl border border-border bg-card/50 p-6 md:p-8"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-md">
              <h3 className="text-lg font-semibold text-foreground">
                Not ready yet? Get the free checklist
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                5 signs your website is losing customers — and how to fix them
              </p>
            </div>
            <form onSubmit={handleLeadMagnetSubmit} className="flex w-full max-w-sm gap-3">
              <div className="relative flex-1">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={leadMagnetEmail}
                  onChange={(e) => setLeadMagnetEmail(e.target.value)}
                  placeholder="you@business.com"
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  aria-label="Email for checklist"
                />
              </div>
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Send
                <ArrowRight size={14} />
              </button>
            </form>
          </div>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="flex flex-col gap-12 lg:flex-row lg:items-end lg:justify-between"
        >
          {/* Brand */}
          <div>
            <a href="#" className="inline-block">
              <span className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Picshaw
              </span>
            </a>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Los Angeles Web Design Studio
            </p>
            <p className="mt-6 max-w-sm text-muted-foreground">
              Premium websites for local businesses. Cinematic design, built to convert.
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center gap-8">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </motion.div>

        {/* Bottom */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground md:flex-row">
          <p>&copy; {currentYear} Picshaw. All rights reserved.</p>
          <p>
            Designed in{" "}
            <span className="text-foreground">Los Angeles, CA</span>
          </p>
        </div>
      </div>
    </footer>
  )
}

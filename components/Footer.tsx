"use client"

import { motion, useReducedMotion } from "framer-motion"

export function Footer() {
  const currentYear = new Date().getFullYear()
  const prefersReducedMotion = useReducedMotion()

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

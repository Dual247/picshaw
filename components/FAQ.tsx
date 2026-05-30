"use client"

import { useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Plus } from "lucide-react"

const faqs = [
  {
    question: "How is this only $1,000 when agencies charge $10k+?",
    answer:
      "Big agencies have big overhead: account managers, project managers, fancy offices, long meetings. I work directly with you, use efficient tools, and focus only on what moves the needle. You get premium design without paying for a bloated process.",
  },
  {
    question: "Will this actually help me get more customers?",
    answer:
      "That's the entire point. Every design decision is made to convert: click-to-call buttons, quote forms above the fold, trust signals, fast loading, mobile optimization. This isn't art—it's a sales tool for your business.",
  },
  {
    question: "What if I already have a website?",
    answer:
      "Perfect—that's what the refresh is for. I take your existing content, improve the design, fix the mobile experience, optimize for Google, and add conversion elements. Your site goes from \"it works\" to \"it sells.\"",
  },
  {
    question: "How does this help me rank on Google?",
    answer:
      "I build with SEO foundations: proper heading structure, meta descriptions, fast page speed, mobile responsiveness, and clean code. For local businesses, I also set up Google Business Profile integration and local schema markup. This gives you the best shot at ranking for \"[your service] + [your city]\" searches.",
  },
  {
    question: "What do you need from me to get started?",
    answer:
      "Your current website URL (if you have one), your logo, and 20 minutes to tell me about your business and goals. I handle everything else—design, copy improvements, development, and launch.",
  },
  {
    question: "Who runs Picshaw?",
    answer:
      "I'm a Los Angeles-based web designer who got tired of watching local businesses get overcharged by agencies for mediocre work. I started Picshaw to give service businesses, restaurants, and local shops access to premium web design at a price that makes sense.",
  },
  {
    question: "What happens after my site launches?",
    answer:
      "You own it. I provide a handoff with everything you need to make basic updates. If you want ongoing optimization, content updates, or new pages, I offer a monthly partnership starting at $500/month. But there's no pressure—plenty of clients launch and run with it.",
  },
]

// Track which FAQ items should be expanded by default (first 2)
const DEFAULT_EXPANDED_INDICES = [0, 1]

export function FAQ() {
  // Initialize with first 2 items expanded
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set(DEFAULT_EXPANDED_INDICES))
  const prefersReducedMotion = useReducedMotion()

  const toggleIndex = (index: number) => {
    setOpenIndices(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  return (
    <section id="faq" className="relative py-32 md:py-48">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
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
              FAQ
            </span>
            <h2 className="headline-editorial text-4xl font-bold text-foreground md:text-5xl">
              You have<br />questions
            </h2>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              I&apos;ve answered the most common ones below. Still curious? The contact form is right there.
            </p>
          </motion.div>

          {/* Right - Accordion */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
            className="divide-y divide-border"
          >
            {faqs.map((faq, index) => (
              <div key={index}>
                <button
                  onClick={() => toggleIndex(index)}
                  className="group flex w-full items-start justify-between gap-6 py-6 text-left"
                  aria-expanded={openIndices.has(index)}
                >
                  <span className="text-lg font-medium text-foreground transition-colors group-hover:text-primary">
                    {faq.question}
                  </span>
                  <motion.span
                    animate={{ rotate: openIndices.has(index) ? 45 : 0 }}
                    transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                    className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-primary group-hover:text-primary"
                  >
                    <Plus size={14} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {openIndices.has(index) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-6 pr-12 leading-relaxed text-muted-foreground">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

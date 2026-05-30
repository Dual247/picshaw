"use client"

import { motion, useReducedMotion } from "framer-motion"

const phrases = [
  "Website Refreshes",
  "Landing Pages",
  "Local SEO",
  "Mobile-First",
  "$1k Launch",
  "7-10 Days",
  "Premium Design",
  "Built to Convert",
]

export function Marquee() {
  const prefersReducedMotion = useReducedMotion()

  const duplicatedPhrases = [...phrases, ...phrases, ...phrases]

  return (
    <section className="relative overflow-hidden border-y border-border/50 bg-card/20 py-5">
      <motion.div
        animate={prefersReducedMotion ? {} : { x: ["0%", "-33.333%"] }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear",
        }}
        className="flex whitespace-nowrap"
      >
        {duplicatedPhrases.map((phrase, index) => (
          <span
            key={index}
            className="mx-6 flex items-center gap-6 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground md:mx-10 md:gap-10 md:text-sm"
          >
            {phrase}
            <span className="h-1 w-1 rounded-full bg-primary" />
          </span>
        ))}
      </motion.div>
    </section>
  )
}

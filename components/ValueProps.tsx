"use client"

import { motion, useReducedMotion } from "framer-motion"

const values = [
  {
    number: "01",
    title: "Fast launch",
    description: "Launch-ready in 7-10 days, not months.",
  },
  {
    number: "02",
    title: "Premium feel",
    description: "Modern design that builds trust instantly.",
  },
  {
    number: "03",
    title: "Built to convert",
    description: "Clear CTAs and mobile-first layouts.",
  },
  {
    number: "04",
    title: "SEO-ready",
    description: "Clean structure for search visibility.",
  },
]

export function ValueProps() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {values.map((value, index) => (
            <motion.div
              key={value.title}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.1, ease: [0.23, 1, 0.32, 1] }}
              className="group relative bg-background p-8 transition-colors duration-500 hover:bg-card md:p-10"
            >
              <span className="absolute right-6 top-6 text-6xl font-bold text-foreground/[0.03] transition-all duration-500 group-hover:text-primary/10 md:text-7xl">
                {value.number}
              </span>
              
              <div className="relative">
                <h3 className="mb-3 text-lg font-semibold text-foreground md:text-xl">
                  {value.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                  {value.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

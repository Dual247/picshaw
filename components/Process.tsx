"use client"

import { motion, useReducedMotion } from "framer-motion"

const steps = [
  {
    number: "01",
    title: "Share your current site",
    description: "Send your URL and tell us what&apos;s not working. Are you getting enough calls? Do visitors bounce? We&apos;ll diagnose the problem.",
  },
  {
    number: "02",
    title: "Get a clear direction",
    description: "Within 48 hours, you&apos;ll receive a mockup showing exactly how your new site will look and convert. No guessing.",
  },
  {
    number: "03",
    title: "Review and refine",
    description: "See your site come to life. Request changes. We don&apos;t launch until you&apos;re confident it represents your business.",
  },
  {
    number: "04",
    title: "Go live and grow",
    description: "Your new site launches. Phones ring. Quote forms fill up. You wonder why you waited so long.",
  },
]

export function Process() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section id="process" className="relative py-32 md:py-48">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        {/* Section Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="mb-20 md:mb-24"
        >
          <span className="mb-6 inline-flex items-center gap-3 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            <span className="h-px w-8 bg-primary" />
            How It Works
          </span>
          <h2 className="headline-editorial max-w-3xl text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
            From embarrassing<br />to impressive in days
          </h2>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            No lengthy discovery calls. No 47-page proposals. Just a fast, focused process that gets your new website live while you focus on running your business.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Connection line */}
          <div className="absolute bottom-0 left-8 top-0 w-px bg-gradient-to-b from-primary via-border to-transparent lg:left-1/2 lg:-translate-x-px" />

          {/* Steps */}
          <div className="space-y-16 lg:space-y-24">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: [0.23, 1, 0.32, 1] }}
                className={`relative flex items-start gap-8 lg:gap-16 ${
                  index % 2 === 1 ? "lg:flex-row-reverse" : ""
                }`}
              >
                {/* Number circle */}
                <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-background text-lg font-bold text-primary lg:absolute lg:left-1/2 lg:-translate-x-1/2">
                  {step.number}
                </div>

                {/* Content */}
                <div className={`flex-1 lg:w-1/2 ${index % 2 === 1 ? "lg:pr-24 lg:text-right" : "lg:pl-24"}`}>
                  <div className={`lg:max-w-md ${index % 2 === 1 ? "lg:ml-auto" : ""}`}>
                    <h3 className="mb-3 text-2xl font-semibold text-foreground md:text-3xl">
                      {step.title}
                    </h3>
                    <p className="text-lg leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Spacer for alternating layout */}
                <div className="hidden flex-1 lg:block" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Timeline note */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="mt-20 text-center"
        >
          <p className="inline-flex items-center gap-3 rounded-full border border-border bg-card/50 px-6 py-3 text-sm text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Average time from start to launch: <span className="font-medium text-foreground">8 days</span>
          </p>
        </motion.div>
      </div>
    </section>
  )
}

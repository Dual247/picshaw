"use client"

import { motion, useReducedMotion } from "framer-motion"
import { AnimatedButton } from "./AnimatedButton"
import { Check, ArrowRight, Zap } from "lucide-react"

const packages = [
  {
    name: "Website Refresh",
    price: "$1,000",
    priceNote: "fixed price",
    tagline: "Stop losing customers to competitors with better websites",
    description:
      "For LA business owners tired of explaining away their outdated site. Get a modern, mobile-first website that actually converts visitors into calls and bookings.",
    features: [
      "Complete visual redesign",
      "Mobile-first (60% of your visitors)",
      "Click-to-call + quote forms",
      "Google-ready SEO structure",
      "Fast loading (under 3 seconds)",
      "Contact page that converts",
      "Basic analytics setup",
      "Live in 7-10 days",
    ],
    cta: "Refresh My Website",
    featured: true,
  },
  {
    name: "Growth Site",
    price: "From $2,500",
    priceNote: "",
    tagline: "Dominate your service area on Google",
    description:
      "Multi-page sites with dedicated pages for every service and neighborhood you want to rank for. Built for businesses ready to own their local market.",
    features: [
      "5-10 page website",
      "Service + area pages for SEO",
      "Google Business optimization",
      "Conversion copywriting",
      "Custom photography direction",
      "2 revision rounds",
    ],
    cta: "Plan a Growth Site",
    featured: false,
  },
  {
    name: "Monthly Partner",
    price: "From $500",
    priceNote: "/month",
    tagline: "Keep growing after launch",
    description:
      "Ongoing optimization, fresh content, and new landing pages. For businesses that want a web partner, not a one-time vendor.",
    features: [
      "Monthly SEO updates",
      "New service/area pages",
      "Conversion optimization",
      "Content updates",
      "Analytics review calls",
      "Priority support",
    ],
    cta: "Ask About Monthly",
    featured: false,
  },
]

export function Pricing() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section id="pricing" className="relative py-32 md:py-48">
      <div className="absolute inset-0 gradient-glow" />
      <div className="relative mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        {/* Section Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="mb-20 text-center md:mb-24"
        >
          <span className="mb-6 inline-flex items-center gap-3 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            <span className="h-px w-8 bg-primary" />
            Investment
            <span className="h-px w-8 bg-primary" />
          </span>
          <h2 className="headline-editorial mx-auto max-w-3xl text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
            One price. No surprises.<br />Results in days.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Most LA agencies quote $5-15k and take 3 months. We deliver a better website for $1k in under two weeks.
          </p>
        </motion.div>

        {/* Featured Package - Full Width Hero Card */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="mb-12"
        >
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-8 md:p-12">
            {/* Background accent */}
            <div className="absolute right-0 top-0 h-96 w-96 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
            
            <div className="relative grid gap-10 lg:grid-cols-2 lg:gap-16">
              {/* Left - Pricing info */}
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                  <Zap size={14} />
                  Best Value for LA Businesses
                </span>
                <h3 className="mt-6 text-3xl font-bold text-foreground md:text-4xl">
                  {packages[0].name}
                </h3>
                <p className="mt-2 text-lg text-muted-foreground">{packages[0].tagline}</p>
                
                <div className="mt-8 flex items-baseline gap-3">
                  <span className="text-6xl font-bold tracking-tight text-foreground md:text-7xl">
                    $1k
                  </span>
                  <span className="text-xl text-muted-foreground">{packages[0].priceNote}</span>
                </div>
                
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                  {packages[0].description}
                </p>
                
                <div className="mt-8">
                  <AnimatedButton href="#contact" size="lg" showArrow>
                    {packages[0].cta}
                  </AnimatedButton>
                </div>
              </div>
              
              {/* Right - Features */}
              <div className="flex flex-col justify-center">
                <p className="mb-6 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Everything you need to start converting:
                </p>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {packages[0].features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                        <Check size={14} className="text-primary" />
                      </span>
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                {/* Trust signal */}
                <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  2 spots available this month
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Other Packages - Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {packages.slice(1).map((pkg, index) => (
            <motion.div
              key={pkg.name}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: index * 0.1, ease: [0.23, 1, 0.32, 1] }}
              className="group relative overflow-hidden rounded-xl border border-border bg-card/50 p-8 transition-all duration-500 hover:border-border/80 hover:bg-card"
            >
              <h3 className="text-xl font-semibold text-foreground">{pkg.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{pkg.tagline}</p>
              
              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-foreground">{pkg.price}</span>
                {pkg.priceNote && <span className="text-muted-foreground">{pkg.priceNote}</span>}
              </div>
              
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {pkg.description}
              </p>
              
              <ul className="mt-6 space-y-3">
                {pkg.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <Check size={16} className="shrink-0 text-muted-foreground" />
                    <span className="text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <div className="mt-8">
                <a
                  href="#contact"
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
                >
                  {pkg.cta}
                  <ArrowRight size={16} />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

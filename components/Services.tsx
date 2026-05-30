"use client"

import { motion, useReducedMotion } from "framer-motion"
import { RefreshCw, FileText, MapPin, Palette, Gauge, ArrowUpRight } from "lucide-react"

const services = [
  {
    icon: RefreshCw,
    title: "Website Refreshes",
    description:
      "Your 2018 site is costing you business. We rebuild it with modern design, mobile-first layouts, and clear calls-to-action that turn browsers into buyers.",
    link: "#contact",
  },
  {
    icon: FileText,
    title: "Landing Pages",
    description:
      "Dedicated pages for your services, neighborhoods, or seasonal offers. Built to rank on Google and convert the traffic into calls.",
    link: "#contact",
  },
  {
    icon: MapPin,
    title: "Local Business Sites",
    description:
      "Contractor? Med spa? Restaurant? We build sites that show up when locals search, with quote forms, booking buttons, and maps that drive foot traffic.",
    link: "#contact",
  },
  {
    icon: Palette,
    title: "Brand Polish",
    description:
      "Look like a business that charges premium prices. Refined typography, professional photography treatment, and visual consistency across every page.",
    link: "#contact",
  },
  {
    icon: Gauge,
    title: "SEO + Performance",
    description:
      "Fast pages, proper headings, meta descriptions, and Google Business integration. The technical foundation that helps you rank for \"[your service] near me.\"",
    link: "#contact",
  },
]

export function Services() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section id="services" className="relative py-32 md:py-48">
      <div className="absolute inset-0 gradient-glow" />
      <div className="relative mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
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
            What We Build
          </span>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <h2 className="headline-editorial max-w-2xl text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
              Websites that make<br />your phone ring
            </h2>
            <p className="max-w-md text-muted-foreground md:text-right">
              No bloated agency retainers. No 6-month timelines. Just sharp, conversion-focused websites for LA businesses.
            </p>
          </div>
        </motion.div>

        {/* Services Grid - Asymmetric Bento */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => (
            <motion.a
              key={service.title}
              href={service.link}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.08, ease: [0.23, 1, 0.32, 1] }}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card/50 p-8 transition-all duration-500 hover:border-primary/30 hover:bg-card ${
                index === 0 ? "md:col-span-2 lg:col-span-1 lg:row-span-2" : ""
              }`}
            >
              {/* Hover gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              
              <div className="relative">
                <div className="mb-6 inline-flex rounded-lg border border-border bg-muted/30 p-3 text-foreground transition-all duration-300 group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary">
                  <service.icon size={24} strokeWidth={1.5} />
                </div>
                
                <h3 className="mb-3 text-xl font-semibold text-foreground md:text-2xl">
                  {service.title}
                </h3>
                
                <p className={`leading-relaxed text-muted-foreground ${index === 0 ? "lg:text-lg" : ""}`}>
                  {service.description}
                </p>
              </div>
              
              <div className="relative mt-6 flex items-center gap-2 text-sm font-medium text-foreground/60 transition-colors duration-300 group-hover:text-primary">
                Get started
                <ArrowUpRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  )
}

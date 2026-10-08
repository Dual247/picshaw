"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"
import { AnimatedButton } from "./AnimatedButton"
import { ProjectPreview } from "./ProjectPreview"
import { projects } from "@/lib/work-showcase"

export function WorkShowcase() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section id="work" className="relative py-32 md:py-48">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="mb-20 md:mb-32"
        >
          <span className="mb-4 inline-flex items-center gap-3 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            <span className="h-px w-8 bg-primary" />Design Concepts
          </span>
          <h2 className="headline-editorial text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
            Different businesses.<br />Distinctive websites.
          </h2>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Explore illustrative website concepts for home services, aesthetics, and hospitality. Each with a look and experience of its own.
          </p>
        </motion.div>
        <div className="space-y-24 md:space-y-40">
          {projects.map((project, index) => (
            <motion.article
              key={project.title}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
              className="group relative"
            >
              <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
                <figure className={`relative min-w-0 lg:col-span-7 ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                  <span aria-hidden="true" className="pointer-events-none absolute -top-8 right-0 text-[150px] font-bold leading-none text-foreground/[0.03] md:-top-16 md:text-[250px]">
                    {project.index}
                  </span>
                  <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#161615] p-1.5 shadow-2xl md:p-2">
                    <div className="flex items-center gap-3 px-3 pb-2 pt-1.5 md:px-4 md:pb-3">
                      <div aria-hidden="true" className="flex shrink-0 gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-white/20" />
                        <span className="h-2 w-2 rounded-full bg-white/20" />
                        <span className="h-2 w-2 rounded-full bg-white/20" />
                      </div>
                      <div className="min-w-0 flex-1 text-center">
                        {project.destination ? (
                          <a
                            href={project.destination.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Visit ${project.title} website (opens in a new tab)`}
                            className="text-[10px] text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:text-xs"
                          >
                            {project.destination.host}
                          </a>
                        ) : (
                          <span className="text-[10px] tracking-wide text-muted-foreground md:text-xs">{project.title} — concept preview</span>
                        )}
                      </div>
                      <ArrowUpRight aria-hidden="true" size={12} className="shrink-0 text-muted-foreground" />
                    </div>
                    <div className="overflow-hidden rounded-md">
                      <ProjectPreview project={project} />
                    </div>
                  </div>
                  <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] leading-relaxed text-muted-foreground">
                    <span>Illustrative website design</span>
                    <a href={project.photography.url} target="_blank" rel="noopener noreferrer" className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground">
                      Photography: {project.photography.name} / Unsplash
                    </a>
                  </figcaption>
                </figure>
                <div className={`relative z-10 min-w-0 lg:col-span-5 ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{project.category}</span>
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-primary" />
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{project.tag}</span>
                  </div>
                  <h3 className="mt-6 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{project.title}</h3>
                  <div className="mt-6 inline-flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                    <project.icon aria-hidden="true" size={20} className="shrink-0 text-primary" />
                    <span className="text-lg font-bold text-primary">{project.focus}</span>
                  </div>
                  {project.result && (
                    <div className="mt-6">
                      <p className="text-xl font-bold text-primary">{project.result.label}</p>
                      <a href={project.result.evidence.url} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
                        {project.result.evidence.label}
                      </a>
                    </div>
                  )}
                  <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{project.description}</p>
                  <div className="mt-8">
                    <AnimatedButton href="#contact" variant="outline">
                      Discuss a design like this<ArrowUpRight size={16} />
                    </AnimatedButton>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="mt-32 text-center"
        >
          <p className="text-lg text-muted-foreground">Let’s build your website.</p>
          <div className="mt-6">
            <AnimatedButton href="#contact" size="lg" showArrow>Start My Project</AnimatedButton>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

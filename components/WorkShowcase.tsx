"use client"

import { motion, useReducedMotion } from "framer-motion"
import { AnimatedButton } from "./AnimatedButton"
import { ArrowUpRight } from "lucide-react"
import Image from "next/image"
import { projects } from "@/lib/work-showcase"

export function WorkShowcase() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section id="work" className="relative py-32 md:py-48">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        {/* Section Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="mb-20 md:mb-32"
        >
          <span className="mb-4 inline-flex items-center gap-3 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
            <span className="h-px w-8 bg-primary" />
            Design Concepts
          </span>
          <h2 className="headline-editorial text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
            Website ideas for<br />LA businesses
          </h2>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Explore website design concepts for home services, med spas, and restaurants.
          </p>
        </motion.div>

        {/* Projects */}
        <div className="space-y-32 md:space-y-48">
          {projects.map((project, index) => (
            <motion.article
              key={project.title}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
              className="group relative"
            >
              <div className={`grid items-center gap-12 lg:grid-cols-12 lg:gap-16 ${index % 2 === 1 ? "" : ""}`}>
                {/* Image side - takes 7 columns */}
                <div className={`relative lg:col-span-7 ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                  {/* Project number watermark */}
                  <span className="pointer-events-none absolute -top-8 right-0 text-[150px] font-bold leading-none text-foreground/[0.03] md:-top-16 md:text-[250px]">
                    {project.index}
                  </span>
                  
                  <div className="relative overflow-hidden rounded-xl border border-border/30 bg-card shadow-2xl">
                    {/* Gradient overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${project.accent} z-10 pointer-events-none`} />
                    
                    {/* Browser chrome */}
                    <div className="flex items-center gap-2 border-b border-border/50 bg-muted/50 px-4 py-3">
                      <div className="flex gap-1.5">
                        <div className="h-3 w-3 rounded-full bg-red-500/60" />
                        <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                        <div className="h-3 w-3 rounded-full bg-green-500/60" />
                      </div>
                      <div className="ml-4 flex-1 rounded-md bg-background/50 px-3 py-1">
                        {project.destination ? (
                          <a
                            href={project.destination.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Visit ${project.title} website (opens in a new tab)`}
                            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            {project.destination.host}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Design concept preview</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Website concept preview */}
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={project.image}
                        alt={`${project.title} website design concept`}
                        fill
                        className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                  </div>
                </div>

                {/* Content side - takes 5 columns */}
                <div className={`relative z-10 lg:col-span-5 ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {project.category}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-primary" />
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {project.tag}
                    </span>
                  </div>
                  
                  <h3 className="mt-6 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                    {project.title}
                  </h3>
                  
                  {/* Design focus; measured results require linked evidence. */}
                  <div className="mt-6 inline-flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                    <project.icon size={20} className="text-primary" />
                    <span className="text-xl font-bold text-primary">{project.focus}</span>
                  </div>

                  {project.result && (
                    <div className="mt-6">
                      <p className="text-xl font-bold text-primary">{project.result.label}</p>
                      <a
                        href={project.result.evidence.url}
                        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                      >
                        {project.result.evidence.label}
                      </a>
                    </div>
                  )}
                  
                  <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                    {project.description}
                  </p>
                  
                  <div className="mt-8">
                    <AnimatedButton href="#contact" variant="outline">
                      Discuss a design like this
                      <ArrowUpRight size={16} />
                    </AnimatedButton>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="mt-32 text-center"
        >
          <p className="text-lg text-muted-foreground">
            Let’s build your website.
          </p>
          <div className="mt-6">
            <AnimatedButton href="#contact" size="lg" showArrow>
              Start My Project
            </AnimatedButton>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

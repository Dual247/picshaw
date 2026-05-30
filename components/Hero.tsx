"use client"

import { motion, useReducedMotion } from "framer-motion"
import { AnimatedButton } from "./AnimatedButton"
import { CheckCircle2 } from "lucide-react"

export function Hero() {
  const prefersReducedMotion = useReducedMotion()

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const fadeUp = {
    initial: { opacity: 0, y: 30 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.7,
        ease: [0.23, 1, 0.32, 1],
      },
    },
  }

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-background">
      {/* Layered backgrounds */}
      <div className="absolute inset-0 hero-gradient" />
      <div className="absolute inset-0 grid-lines opacity-40" />
      
      {/* Large background text */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.02 }}
          transition={{ duration: 1.5, delay: 0.8 }}
          className="whitespace-nowrap text-[20vw] font-bold uppercase tracking-tighter text-foreground"
        >
          PICSHAW
        </motion.span>
      </div>
      
      {/* Animated accent line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, ease: [0.77, 0, 0.175, 1], delay: 0.3 }}
        className="absolute top-0 left-0 right-0 h-px origin-left bg-gradient-to-r from-primary via-primary/50 to-transparent"
      />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1400px] flex-col justify-center px-6 py-32 md:px-12 lg:px-20">
        <motion.div
          variants={prefersReducedMotion ? {} : stagger}
          initial="initial"
          animate="animate"
          className="max-w-4xl"
        >
          {/* Eyebrow with credibility */}
          <motion.div 
            variants={prefersReducedMotion ? {} : fadeUp}
            className="mb-6 flex items-center gap-4"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              2 spots left this month
            </span>
          </motion.div>

          {/* Main Headline - Bold and direct */}
          <motion.h1
            variants={prefersReducedMotion ? {} : fadeUp}
            className="headline-editorial text-[clamp(2.8rem,9vw,7rem)] font-bold leading-[0.9] tracking-tight text-foreground"
          >
            <span className="block">Your site is</span>
            <span className="block">
              <span className="relative inline-block">
                <span className="text-gradient">costing you</span>
              </span>
            </span>
            <span className="block">customers.</span>
          </motion.h1>

          {/* Subheadline - Pain point + solution */}
          <motion.p
            variants={prefersReducedMotion ? {} : fadeUp}
            className="mt-8 max-w-xl text-xl leading-relaxed text-muted-foreground md:text-2xl"
          >
            Every visitor who bounces is calling your competitor. 
            I build fast, modern websites that turn searchers into customers.
          </motion.p>

          {/* Value props - quick wins */}
          <motion.div
            variants={prefersReducedMotion ? {} : fadeUp}
            className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            {["Mobile-first design", "Google-optimized", "Live in 7-10 days"].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-primary" />
                {item}
              </span>
            ))}
          </motion.div>

          {/* Price anchor - THE offer */}
          <motion.div
            variants={prefersReducedMotion ? {} : fadeUp}
            className="mt-12 inline-flex items-baseline gap-3 rounded-2xl border border-border/50 bg-card/50 px-8 py-6 backdrop-blur-sm"
          >
            <span className="text-6xl font-bold tracking-tighter text-foreground md:text-7xl">$1k</span>
            <div className="flex flex-col">
              <span className="text-lg font-medium text-foreground">complete website</span>
              <span className="text-sm text-muted-foreground">Not a deposit. Not a down payment.</span>
            </div>
          </motion.div>

          {/* CTAs */}
          <motion.div
            variants={prefersReducedMotion ? {} : fadeUp}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <AnimatedButton href="#contact" size="lg" showArrow>
              Get Your Free Quote
            </AnimatedButton>
            <AnimatedButton href="#work" variant="outline" size="lg">
              See the Work
            </AnimatedButton>
          </motion.div>

          {/* Social proof - founder-led */}
          <motion.div
            variants={prefersReducedMotion ? {} : fadeUp}
            className="mt-12 flex items-center gap-4 border-t border-border/50 pt-8"
          >
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 w-10 rounded-full border-2 border-background bg-gradient-to-br from-muted to-muted-foreground/20"
                />
              ))}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">50+ LA businesses trust Picshaw</p>
              <p className="text-xs text-muted-foreground">Averaging 3x more leads after launch</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={prefersReducedMotion ? {} : { y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center gap-2 text-muted-foreground"
          >
            <span className="text-xs uppercase tracking-widest">Scroll</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

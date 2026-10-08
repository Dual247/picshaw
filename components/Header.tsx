"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Menu, X, ArrowUpRight } from "lucide-react"
import { AnimatedButton } from "./AnimatedButton"
import { BrandLogo } from "./BrandLogo"

// TODO: Replace with actual phone number (CallRail or tracking number)
const PHONE_NUMBER = "(737) 900-9237"
const PHONE_NUMBER_TEL = "tel:+17379009237"

const navItems = [
  { label: "Work", href: "#work" },
  { label: "Services", href: "#services" },
  { label: "Process", href: "#process" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
]

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      <motion.header
        initial={prefersReducedMotion ? {} : { y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled ? "glass border-b border-border py-4" : "py-6"
        }`}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 md:px-12 lg:px-20">
          <a href="#" aria-label="Picshaw home" className="relative z-10 flex shrink-0 items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <BrandLogo showStudio />
          </a>
          <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex xl:gap-10">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="relative text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hidden shrink-0 lg:block">
            <AnimatedButton href="#contact" size="sm">
              Get Your Free Website Review
              <ArrowUpRight size={14} />
            </AnimatedButton>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted lg:hidden"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls={isMobileMenuOpen ? "mobile-navigation" : undefined}
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="glass border-b border-border lg:hidden"
            >
              <nav id="mobile-navigation" aria-label="Mobile navigation" className="mx-auto max-w-[1400px] px-6 py-8">
                <div className="flex flex-col gap-6">
                  {navItems.map((item, index) => (
                    <motion.a
                      key={item.label}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="text-2xl font-medium text-foreground"
                    >
                      {item.label}
                    </motion.a>
                  ))}
                  <div className="pt-4" onClick={() => setIsMobileMenuOpen(false)}>
                    <AnimatedButton href="#contact" className="w-full justify-center">
                      Get Your Free Website Review
                    </AnimatedButton>
                  </div>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
      <motion.div
        initial={prefersReducedMotion ? {} : { y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border p-4 lg:hidden"
      >
        <div className="flex flex-col items-center gap-2">
          <AnimatedButton href="#contact" className="w-full justify-center" showArrow>
            Get Your Free Website Review
          </AnimatedButton>
          <a href={PHONE_NUMBER_TEL} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Or call <span className="underline underline-offset-2">{PHONE_NUMBER}</span>
          </a>
        </div>
      </motion.div>
    </>
  )
}

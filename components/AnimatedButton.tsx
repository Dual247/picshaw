"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface AnimatedButtonProps {
  children: React.ReactNode
  href?: string
  onClick?: () => void
  variant?: "primary" | "secondary" | "outline"
  size?: "sm" | "md" | "lg"
  className?: string
  showArrow?: boolean
  type?: "button" | "submit"
  disabled?: boolean
}

export function AnimatedButton({
  children,
  href,
  onClick,
  variant = "primary",
  size = "md",
  className,
  showArrow = false,
  type = "button",
  disabled = false,
}: AnimatedButtonProps) {
  const baseStyles =
    "relative inline-flex items-center justify-center gap-2.5 font-medium transition-all duration-500 rounded-lg overflow-hidden group"

  const variants = {
    primary:
      "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30",
    secondary:
      "bg-card border border-border text-foreground hover:border-foreground/20 hover:bg-muted",
    outline:
      "border border-border text-foreground hover:border-foreground/30 bg-transparent",
  }

  const sizes = {
    sm: "px-5 py-2.5 text-sm",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
  }

  const combinedClassName = cn(baseStyles, variants[variant], sizes[size], disabled && "opacity-60 pointer-events-none", className)

  const content = (
    <>
      <span className="relative z-10 flex items-center gap-2.5">
        {children}
        {showArrow && (
          <ArrowRight 
            size={16} 
            className="transition-transform duration-300 group-hover:translate-x-1" 
          />
        )}
      </span>
      {variant === "primary" && (
        <span className="absolute inset-0 -z-10 bg-gradient-to-r from-primary via-primary to-primary/80 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      )}
    </>
  )

  if (href) {
    return (
      <motion.a
        href={href}
        className={combinedClassName}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        {content}
      </motion.a>
    )
  }

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={combinedClassName}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      {content}
    </motion.button>
  )
}

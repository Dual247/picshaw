"use client"

import { motion, useReducedMotion } from "framer-motion"

interface LogoProps {
  showTagline?: boolean
  size?: "sm" | "md" | "lg"
}

export function Logo({ showTagline = true, size = "md" }: LogoProps) {
  const prefersReducedMotion = useReducedMotion()
  
  const sizes = {
    sm: { mark: 28, text: "text-lg", gap: "gap-2" },
    md: { mark: 36, text: "text-xl md:text-2xl", gap: "gap-3" },
    lg: { mark: 48, text: "text-2xl md:text-3xl", gap: "gap-4" },
  }
  
  const s = sizes[size]

  return (
    <a href="#" className={`relative z-10 flex items-center ${s.gap} group`}>
      {/* Logomark - Abstract "P" shape with creative flair */}
      <motion.div
        whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="relative"
        style={{ width: s.mark, height: s.mark }}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Background circle with gradient */}
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF4A2B" />
              <stop offset="100%" stopColor="#FF6B4A" />
            </linearGradient>
            <linearGradient id="accentGradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7B6EF6" />
              <stop offset="100%" stopColor="#9D93F8" />
            </linearGradient>
          </defs>
          
          {/* Main shape - stylized "P" that looks like a camera aperture/shutter */}
          <rect
            x="4"
            y="4"
            width="40"
            height="40"
            rx="12"
            fill="url(#logoGradient)"
            className="transition-all duration-300 group-hover:fill-[#FF5A3B]"
          />
          
          {/* Inner "P" shape */}
          <path
            d="M16 12V36M16 12H28C32.4183 12 36 15.5817 36 20V20C36 24.4183 32.4183 28 28 28H16"
            stroke="#FAFAF8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          
          {/* Accent dot - represents creativity/spark */}
          <circle
            cx="36"
            cy="36"
            r="5"
            fill="url(#accentGradient)"
            className="transition-all duration-300 group-hover:fill-[#8B7EFF]"
          />
        </svg>
      </motion.div>

      {/* Wordmark */}
      <div className="flex flex-col">
        <span className={`${s.text} font-bold tracking-tight text-foreground leading-none`}>
          Picshaw
        </span>
        {showTagline && (
          <span className="hidden text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:block leading-none mt-1">
            LA Web Studio
          </span>
        )}
      </div>
    </a>
  )
}

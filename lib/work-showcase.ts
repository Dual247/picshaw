import { Calendar, Phone, Star, type LucideIcon } from "lucide-react"

type Evidence = {
  label: string
  // Publicly reachable proof, including a local path only if served by the site.
  url: `https://${string}` | `/${string}`
  reviewedOn: string
}

type Project = {
  title: string
  category: string
  tag: string
  focus: string
  description: string
  index: string
  image: string
  accent: string
  icon: LucideIcon
  // Populate only with an approved destination and a source verifying the project.
  destination: {
    host: string
    url: `https://${string}`
    evidence: Evidence
  } | null
  // Performance claims must cite supporting material, not repeated marketing copy.
  result: {
    label: string
    evidence: Evidence
  } | null
}

// The 2026-10-07 repository audit found no verified clients, destinations, or
// performance evidence for these examples. See docs/work-showcase-evidence.md.
export const projects: Project[] = [
  {
    title: "Pacific Plumbing Co.",
    category: "Home Services",
    tag: "Website Refresh",
    focus: "Clear service calls to action",
    description:
      "A plumbing website concept with prominent service information and contact options, designed to make it easy for visitors to request help.",
    index: "01",
    image: "/images/project-plumbing.png",
    accent: "from-blue-500/20 to-transparent",
    icon: Phone,
    destination: null,
    result: null,
  },
  {
    title: "Glow Aesthetics LA",
    category: "Med Spa",
    tag: "Booking Experience",
    focus: "A welcoming booking experience",
    description:
      "A med spa website concept with a polished visual style, treatment information, and clear consultation calls to action.",
    index: "02",
    image: "/images/project-medspa.png",
    accent: "from-rose-400/20 to-transparent",
    icon: Calendar,
    destination: null,
    result: null,
  },
  {
    title: "Ember Kitchen",
    category: "Restaurant",
    tag: "Brand Website",
    focus: "Menus and reservations in focus",
    description:
      "A restaurant website concept that brings the dining experience forward with prominent menu and reservation calls to action.",
    index: "03",
    image: "/images/project-restaurant.png",
    accent: "from-amber-500/20 to-transparent",
    icon: Star,
    destination: null,
    result: null,
  },
]

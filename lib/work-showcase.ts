import { Calendar, Phone, Star, type LucideIcon } from "lucide-react"

type Evidence = {
  label: string
  // Publicly reachable proof, including a local path only if served by the site.
  url: `https://${string}` | `/${string}`
  reviewedOn: string
}

export type Project = {
  title: string
  category: string
  tag: string
  focus: string
  description: string
  index: string
  image: string
  imageAlt: string
  imagePosition: string
  photography: { name: string; url: `https://${string}` }
  preview: {
    theme: "home" | "wellness" | "dining"
    brand: string
    strapline: string
    eyebrow: string
    headline: [string, string]
    description: string
    action: string
    navigation: [string, string, string]
    footer: string
  }
  icon: LucideIcon
  // Populate only with an approved destination and a source verifying the project.
  destination: {
    host: string
    url: `https://${string}`
    evidence: Evidence
  } | null
  // Performance claims must cite supporting material, not repeated marketing copy.
  result: { label: string; evidence: Evidence } | null
}

// These are illustrative design concepts, not verified client projects.
// Destination/result evidence requirements: docs/work-showcase-evidence.md.
// Photography sources and usage notes: docs/brand-and-showcase-assets.md.
export const projects: Project[] = [
  {
    title: "Pacific Plumbing Co.",
    category: "Home Services",
    tag: "Website Refresh",
    focus: "Clear service calls to action",
    description:
      "A confident, easy-to-navigate home-services concept. Architectural photography, clear service information, and a direct route to requesting help.",
    index: "01",
    image: "https://images.unsplash.com/photo-1629079447777-1e605162dc8d?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "A bright contemporary bathroom with a white vanity and blue cabinetry",
    imagePosition: "50% 50%",
    photography: {
      name: "Steven Ungermann",
      url: "https://unsplash.com/photos/white-ceramic-sink-with-mirror-1AF5hP6F4tI",
    },
    preview: {
      theme: "home",
      brand: "PACIFIC",
      strapline: "PLUMBING CO.",
      eyebrow: "A BETTER KIND OF HOME SERVICE",
      headline: ["Good homes.", "Great plumbing."],
      description: "Thoughtful service. Lasting repairs. A little more peace of mind.",
      action: "Request a visit",
      navigation: ["Services", "Our approach", "Contact"],
      footer: "REPAIRS / INSTALLATIONS / EVERYDAY CARE",
    },
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
      "A calm, editorial aesthetics concept. Natural-light photography, warm neutrals, and considered typography create a welcoming path to consultation.",
    index: "02",
    image: "https://images.unsplash.com/photo-1581182800629-7d90925ad072?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "A sunlit natural-beauty portrait used as illustrative editorial photography",
    imagePosition: "51% 45%",
    photography: {
      name: "Fleur Kaan",
      url: "https://unsplash.com/photos/woman-in-white-tank-top-w4Dj3MshHQ0",
    },
    preview: {
      theme: "wellness",
      brand: "glow",
      strapline: "AESTHETICS / LOS ANGELES",
      eyebrow: "BEAUTY, ON YOUR TERMS",
      headline: ["A little care.", "A lasting glow."],
      description: "A considered approach to skin, self-care, and feeling like yourself.",
      action: "Explore your glow",
      navigation: ["Our philosophy", "Treatments", "Visit us"],
      footer: "SKIN / SELF-CARE / A MOMENT FOR YOU",
    },
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
      "An atmospheric restaurant concept with warm, inviting photography. A distinctive editorial layout puts the dining experience, menu, and reservations first.",
    index: "03",
    image: "https://images.unsplash.com/photo-1508424757105-b6d5ad9329d0?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "A warm restaurant interior with timber tables, pendant lights, and greenery",
    imagePosition: "50% 55%",
    photography: {
      name: "Kayleigh Harrington",
      url: "https://unsplash.com/photos/group-of-people-inside-the-restaurant-yhn4okt6ci0",
    },
    preview: {
      theme: "dining",
      brand: "ember",
      strapline: "KITCHEN & COMPANY",
      eyebrow: "PULL UP A CHAIR",
      headline: ["Good food.", "Better company."],
      description: "Seasonal plates, slow evenings, and a place at the table.",
      action: "Find your table",
      navigation: ["The kitchen", "Menu", "Reservations"],
      footer: "SEASONAL KITCHEN / LOS ANGELES",
    },
    icon: Star,
    destination: null,
    result: null,
  },
]

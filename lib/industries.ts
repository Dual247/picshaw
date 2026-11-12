import industryData from '@/content/industries.json'
import type { ContentSection } from '@/lib/content'

export type Industry = {
  slug: string
  name: string
  title: string
  description: string
  eyebrow: string
  intro: string
  summary: string
  services: string[]
  sections: ContentSection[]
  questions: { question: string; answer: string }[]
}

export const industries: Industry[] = industryData
export const getIndustry = (slug: string) => industries.find(industry => industry.slug === slug)

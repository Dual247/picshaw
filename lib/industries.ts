import industryData from '@/content/industries.json'
import type { ContentSection } from '@/lib/content'

export type IndustrySpotlight = {
  headline: string
  outcomes: string[]
  cta: string
  journey: {
    query: string
    page: string
    details: string[]
    action: string
    handoff: string
  }
}

export type Industry = {
  slug: string
  name: string
  title: string
  description: string
  eyebrow: string
  intro: string
  summary: string
  spotlight?: IndustrySpotlight
  services: string[]
  sections: ContentSection[]
  questions: { question: string; answer: string }[]
}

export const industries: Industry[] = industryData
export const getIndustry = (slug: string) => industries.find(industry => industry.slug === slug)
const featuredSlugs = ['med-spas', 'dentists', 'law-firms', 'accounting-firms', 'construction-companies']
export const featuredIndustries = featuredSlugs.flatMap(slug => {
  const industry = getIndustry(slug)
  return industry ? [industry] : []
})

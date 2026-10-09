import serviceData from '@/content/services.json'
import articleData from '@/content/articles.json'

export type ContentLink = { label: string; href: string }
export type ContentSection = {
  id: string
  title: string
  paragraphs: string[]
  bullets?: string[]
  links?: ContentLink[]
  sources?: ContentLink[]
}
export type Service = {
  slug: string; title: string; description: string; eyebrow: string; intro: string
  sections: ContentSection[]; questions: { question: string; answer: string }[]
}
export type Article = {
  slug: string; title: string; description: string; category: string
  status: 'published' | 'draft'; reviewedAt: string; publishedAt: string; updatedAt?: string
  author: string; primaryIntent: string; relatedServices: string[]
  intro: string; sections: ContentSection[]
}
export const services = serviceData as Service[]
const articles = articleData as Article[]
export const getService = (slug: string) => services.find(service => service.slug === slug)
export function getPublishedArticles() {
  return articles.filter(article => article.status === 'published' && Date.parse(article.publishedAt) <= Date.now())
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}
export const getArticle = (slug: string) => getPublishedArticles().find(article => article.slug === slug)
export function displayDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(date))
}

// Only these public page categories may be sent as custom event properties.
// Never pass form values, arbitrary URLs, query strings or referrer URLs here.
export function pageCategory(pathname: string) {
  if (pathname === '/') return 'home'
  if (pathname === '/blog') return 'blog'
  if (pathname.startsWith('/blog/')) return 'article'
  if (pathname === '/about') return 'about'
  if (['/website-redesign', '/local-seo', '/ai-search-optimization', '/web-design-for-contractors'].includes(pathname)) return 'service'
  return 'other'
}

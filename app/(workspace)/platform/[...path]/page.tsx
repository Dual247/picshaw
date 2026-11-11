import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Keep unmatched workspace paths inside this root; never echo their contents.
// Explicit future routes take precedence over this catch-all.
export default function UnknownPlatformPage() {
  notFound()
}

import Link from 'next/link'
import { SearchConsoleConnect } from '@/components/platform/search-console-connect'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export default function ConnectSearchConsolePage() {
  return <main className="mx-auto max-w-3xl space-y-6 px-6 py-12"><Link href="/platform">Back to workspace</Link><h1 className="text-3xl font-semibold">Connect your search data</h1><SearchConsoleConnect /></main>
}

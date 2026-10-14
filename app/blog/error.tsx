'use client'

import Link from 'next/link'

export default function BlogError({ reset }: { reset: () => void }) {
  return <main id="main-content" className="mx-auto max-w-3xl px-6 py-36">
    <h1 className="text-3xl font-semibold">This article is temporarily unavailable.</h1>
    <p className="my-6 leading-7">Please try again. Our existing guides and contact details are still available.</p>
    <button onClick={reset} className="mr-6 rounded-lg bg-primary px-5 py-3 text-primary-foreground">Try again</button>
    <Link href="/blog" className="underline">Back to the guides</Link>
    <p className="mt-6"><a href="mailto:hello@picshaw.com" className="underline">hello@picshaw.com</a></p>
  </main>
}

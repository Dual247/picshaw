import Link from 'next/link'

export default function PlatformNotFound() {
  return <main id="main-content" className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
    <p className="mb-10 text-3xl font-semibold">picshaw<span className="text-primary">.</span></p>
    <h1 className="mb-6 text-4xl font-semibold">Workspace page unavailable</h1>
    <p className="mb-8 text-muted-foreground">This workspace page does not exist. Return to the portal to find setup details, sign-in options and the sample workspace.</p>
    <Link href="/platform" prefetch={false} className="w-fit text-primary underline">Return to portal</Link>
  </main>
}


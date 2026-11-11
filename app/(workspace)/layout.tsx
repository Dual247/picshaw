import type { Metadata } from 'next'
import { WorkspaceThemeProvider } from '@/components/platform/theme-provider'
import '../globals.css'
import './workspace.css'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = {
 title: 'Picshaw | Client portal',
 description: 'Client portal setup and a clearly labeled fictional sample. No live customer data.',
 robots: { index: false, follow: false, noarchive: true },
 referrer: 'no-referrer',
}
// A separate root document prevents marketing scripts from surviving navigation.
// This boundary is not authentication or tenant authorization.
export default function WorkspaceLayout({children}:Readonly<{children:React.ReactNode}>) {
 return <html lang="en" suppressHydrationWarning><body className="workspace-root font-sans antialiased"><WorkspaceThemeProvider><a href="#main-content" className="portal-skip">Skip to content</a>{children}</WorkspaceThemeProvider></body></html>
}

'use client'
import { ThemeProvider } from 'next-themes'
export function WorkspaceThemeProvider({children}:{children:React.ReactNode}) {
 return <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="picshaw-workspace-theme" disableTransitionOnChange>{children}</ThemeProvider>
}

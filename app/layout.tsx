import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
const inter = Inter({ subsets: ['latin'] })
export const metadata: Metadata = {
  title: 'AiNews Control Center',
  icons: {
    icon: '/icon.png',
  }
}
import { ThemeProvider } from '@/components/ThemeProvider'
import { ClientErrorReporter } from '@/components/ClientErrorReporter'
import { TutorialProvider } from '@/components/tutorial/TutorialProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TutorialProvider>
            <ClientErrorReporter />
            {children}
            <Toaster />
          </TutorialProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'
const inter = Inter({ subsets: ['latin'] })
export const metadata: Metadata = {
  title: 'AiNews Control Center',
  icons: {
    icon: '/favicon.svg',
  }
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-zinc-50 antialiased`}>
        {children}
        <Toaster theme="dark" position="top-right" />
      </body>
    </html>
  )
}

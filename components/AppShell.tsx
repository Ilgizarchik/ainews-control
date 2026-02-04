'use client'
import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { LogOut, Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

const SideNav = dynamic(() => import('./SideNav').then(mod => mod.SideNav), {
  ssr: false,
  loading: () => <div className="w-64 h-full border-r border-border bg-card" />
})

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch by only rendering client-specific parts after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Close sheet when route changes
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Pre-hydration skeleton for SideNav
  const SideNavSkeleton = () => <div className="w-64 h-full border-r border-border bg-card" />

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full">
        {mounted ? <SideNav /> : <SideNavSkeleton />}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 z-30">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Trigger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <VisuallyHidden.Root>
                  <SheetTitle>Navigation Menu</SheetTitle>
                </VisuallyHidden.Root>
                {mounted ? <SideNav /> : <SideNavSkeleton />}
              </SheetContent>
            </Sheet>

            <div className="text-sm text-zinc-500 hidden sm:block">Панель управления</div>
            {/* Mobile Title if needed */}
            <div className="text-sm font-semibold sm:hidden">AiNews</div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {/* Hide 'Logout' text on mobile, just icon */}
            <Button variant="ghost" onClick={handleLogout} className="text-zinc-500 dark:text-zinc-400 px-2 sm:px-4">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </header>

        {/* Main content with proper padding for mobile/desktop */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 w-full">
          {children}
        </main>
      </div>
    </div>
  )
}

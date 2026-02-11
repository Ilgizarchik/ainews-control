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



// Скелет SideNav для SSR и фазы монтирования
const SideNavSkeleton = () => (
  <nav className="flex flex-col gap-2 p-4 w-64 border-r border-border h-full bg-card">
    <div className="flex items-center gap-3 mb-8 px-2">
      <div className="h-10 w-10 bg-muted rounded-xl animate-pulse" />
      <div className="h-4 w-20 bg-muted rounded animate-pulse" />
    </div>
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="h-10 w-full bg-muted/50 rounded-md animate-pulse" />
      ))}
    </div>
  </nav>
)

const SideNav = dynamic(() => import('./SideNav').then(mod => mod.SideNav), {
  ssr: false,
  loading: SideNavSkeleton
})

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Избегаем рассинхронизации гидрации, рендеря клиентские части после монтирования
  useEffect(() => {
    setMounted(true)
  }, [])

  // Закрываем шторку при смене маршрута
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!mounted) {
    return (
      <div className="flex h-screen overflow-hidden bg-background" suppressHydrationWarning>
        <div className="hidden md:block h-full shrink-0" suppressHydrationWarning>
          <SideNavSkeleton />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden w-full" suppressHydrationWarning>
          <header className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 bg-background/95 shrink-0" />
          <main className="flex-1 overflow-auto p-4 sm:p-6 w-full">
            {children}
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background" suppressHydrationWarning>
      {/* Десктопный сайдбар */}
      <div className="hidden md:block h-full shrink-0" suppressHydrationWarning>
        <SideNav />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden w-full" suppressHydrationWarning>
        <header className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0 z-30">
          <div className="flex items-center gap-4">
            {/* Триггер мобильного меню */}
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
                <SideNav />
              </SheetContent>
            </Sheet>

            <div className="text-sm text-zinc-500 hidden sm:block">Панель управления</div>
            {/* Мобильный заголовок при необходимости */}
            <div className="text-sm font-semibold sm:hidden">AiNews</div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {/* Скрываем текст 'Выйти' на мобильных, оставляем только иконку */}
            <Button variant="ghost" onClick={handleLogout} className="text-zinc-500 dark:text-zinc-400 px-2 sm:px-4">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </header>

        {/* Основной контент с корректными отступами для мобилы/десктопа */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 w-full">
          {children}
        </main>
      </div>
    </div>
  )
}

'use client'
import { SideNav } from './SideNav'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SideNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50">
          <div className="text-sm text-zinc-500">Admin Dashboard</div>
          <Button variant="ghost" onClick={handleLogout} className="text-zinc-400">
            <LogOut className="h-4 w-4 mr-2" /> Logout
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}

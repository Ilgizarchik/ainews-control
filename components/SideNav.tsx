'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, FileText, Terminal, Settings, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { title: 'Calendar', href: '/calendar', icon: Calendar },
  { title: 'Content', href: '/content', icon: FileText },
  { title: 'Prompts', href: '/prompts', icon: Terminal },
  { title: 'Recipes', href: '/recipes', icon: Settings },
]

export function SideNav() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-2 p-4 w-64 border-r border-zinc-800 h-full bg-zinc-900/50">
      <div className="flex items-center gap-2 mb-8 px-2">
        <LayoutDashboard className="h-6 w-6 text-blue-500" />
        <span className="font-bold text-lg">AiNews Control</span>
      </div>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors", pathname.startsWith(item.href) ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50")}>
          <item.icon className="h-4 w-4" />
          {item.title}
        </Link>
      ))}
    </nav>
  )
}

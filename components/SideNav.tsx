'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, FileText, Terminal, Settings, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { title: 'Publications', href: '/publications', icon: Calendar },
  { title: 'Content', href: '/content', icon: FileText },
  { title: 'Prompts', href: '/prompts', icon: Terminal },
  { title: 'Recipes', href: '/recipes', icon: Settings },
]

export function SideNav() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-2 p-4 w-64 border-r border-border h-full bg-card">
      <div className="flex items-center gap-2 mb-8 px-2">
        <LayoutDashboard className="h-6 w-6 text-blue-500" />
        <span className="font-bold text-lg text-foreground">AiNews Control</span>
      </div>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors", pathname.startsWith(item.href) ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
          <item.icon className="h-4 w-4" />
          {item.title}
        </Link>
      ))}
    </nav>
  )
}

'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, FileText, Terminal, Settings, LayoutDashboard, ChevronDown, ChevronRight, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'

type NavItem = {
  title: string
  href: string
  icon: any
  subItems?: { title: string; href: string }[]
}

const items: NavItem[] = [
  { title: 'Публикации', href: '/publications', icon: Calendar },
  { title: 'Контент', href: '/content', icon: FileText },
  { title: 'Промпты', href: '/prompts', icon: Terminal },
  { title: 'Рецепты', href: '/recipes', icon: BookOpen },
  { title: 'Настройки', href: '/settings', icon: Settings },
]

export function SideNav() {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>(['/prompts'])

  const toggleExpand = (href: string) => {
    setExpandedItems(prev =>
      prev.includes(href)
        ? prev.filter(h => h !== href)
        : [...prev, href]
    )
  }



  return (
    <nav className="flex flex-col gap-2 p-4 w-64 border-r border-border h-full bg-card" suppressHydrationWarning>
      <Link
        href="/publications"
        className="flex items-center gap-3 mb-8 px-2 transition-opacity hover:opacity-80"
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
          <img src="/logo.png" alt="AiNews Control" className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-base leading-tight text-foreground tracking-tight">AiNews</span>
          <span className="font-bold text-base leading-tight text-foreground/80 tracking-tight text-[13px]">Control</span>
        </div>
      </Link>
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href)
        const isExpanded = expandedItems.includes(item.href)
        const hasSubItems = item.subItems && item.subItems.length > 0

        return (
          <div key={item.href}>
            <div className="flex items-center">
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>

              {hasSubItems && (
                <button
                  onClick={() => toggleExpand(item.href)}
                  className={cn(
                    "p-2 rounded-md transition-colors",
                    isActive
                      ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>

            {hasSubItems && isExpanded && (
              <div className="ml-6 mt-1 space-y-1">
                {item.subItems!.map((subItem) => (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-colors",
                      pathname === subItem.href || (pathname === item.href && subItem.href.includes('#'))
                        ? "text-foreground bg-muted/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                    {subItem.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, FileText, Terminal, Settings, LayoutDashboard, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const items = [
  { title: 'Publications', href: '/publications', icon: Calendar },
  { title: 'Content', href: '/content', icon: FileText },
  {
    title: 'Prompts',
    href: '/prompts',
    icon: Terminal,
    subItems: [
      { title: 'Системная логика', href: '/prompts?tab=system' },
      { title: 'Промпты для соц. сетей', href: '/prompts?tab=social' }
    ]
  },
  { title: 'Recipes', href: '/recipes', icon: Settings },
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
    <nav className="flex flex-col gap-2 p-4 w-64 border-r border-border h-full bg-card">
      <div className="flex items-center gap-2 mb-8 px-2">
        <LayoutDashboard className="h-6 w-6 text-blue-500" />
        <span className="font-bold text-lg text-foreground">AiNews Control</span>
      </div>
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

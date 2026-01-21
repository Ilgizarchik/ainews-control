'use client'

import { useState } from 'react'
import { CalendarView } from './CalendarView'
import { BoardView } from './BoardView'
import { cn } from '@/lib/utils'
import { LayoutGrid, Calendar as CalendarIcon, Filter, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLATFORM_CONFIG } from '@/lib/platform-config'

type Tab = 'board' | 'calendar'

export function PublicationsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('board')

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b pb-4">
                {/* Title Section */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Content Calendar</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Schedule and monitor your AI-generated posts.
                    </p>
                </div>

                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">

                    {/* 1. Improved Legend (Hidden on very small screens, Visible on desktop) */}
                    {/* 1. Improved Legend (Hidden on very small screens, Visible on desktop) */}
                    <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-muted/30 rounded-md border border-border mr-2">
                        {Object.values(PLATFORM_CONFIG).map((platform) => (
                            <div key={platform.label} className="flex items-center gap-1.5" title={platform.label}>
                                <span className={cn("w-2 h-2 rounded-full shadow-sm", platform.color.replace('text-', 'bg-'))} />
                                <span className="text-xs font-medium text-foreground">{platform.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Separator */}
                    <div className="h-6 w-[1px] bg-border mx-1 hidden sm:block" />

                    <div className="flex bg-muted p-1 rounded-lg border border-border">
                        <button
                            onClick={() => setActiveTab('board')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                activeTab === 'board'
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Board
                        </button>
                        <button
                            onClick={() => setActiveTab('calendar')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                activeTab === 'calendar'
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <CalendarIcon className="h-3.5 w-3.5" />
                            Calendar
                        </button>
                    </div>

                    {/* 2. Action Buttons */}
                    <Button variant="outline" className="h-8 gap-2 px-3 text-xs">
                        <Filter className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Filter</span>
                    </Button>

                    <Button className="h-8 bg-foreground text-background hover:bg-foreground/90 gap-2 px-3 text-xs">
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">New Post</span>
                    </Button>
                </div>
            </div>

            <div className="main-content flex-1 min-h-0 bg-card rounded-xl border border-border overflow-hidden">
                {activeTab === 'board' ? <BoardView /> : <CalendarView />}
            </div>
        </div>
    )
}

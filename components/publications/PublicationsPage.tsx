'use client'

import { useState } from 'react'
import { CalendarViewBig } from './CalendarViewBig'
import { BoardView } from './BoardView'
import { DraftsView } from './DraftsView'
import { cn } from '@/lib/utils'
import { LayoutGrid, Calendar as CalendarIcon, Filter, Plus, FileEdit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLATFORM_CONFIG } from '@/lib/platform-config'

import { CreatePostDialog } from './CreatePostDialog'

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect } from 'react';

type Tab = 'board' | 'calendar' | 'drafts'

function SortableTab({
    tab,
    activeTab,
    onClick
}: {
    tab: Tab,
    activeTab: Tab,
    onClick: (t: Tab) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: tab });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const icons = {
        drafts: FileEdit,
        board: LayoutGrid,
        calendar: CalendarIcon
    }

    const labels = {
        drafts: 'Черновики',
        board: 'Доска',
        calendar: 'Календарь'
    }

    const Icon = icons[tab]

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onClick(tab)}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-grab active:cursor-grabbing",
                activeTab === tab
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
        >
            <Icon className="h-3.5 w-3.5" />
            {labels[tab]}
        </button>
    )
}

export function PublicationsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('drafts')
    const [tabOrder, setTabOrder] = useState<Tab[]>(['drafts', 'board', 'calendar'])
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const savedOrder = localStorage.getItem('publications-tab-order')
        if (savedOrder) {
            try {
                const parsed = JSON.parse(savedOrder)
                // Validate that we have valid tabs
                if (Array.isArray(parsed) && parsed.every(t => ['drafts', 'board', 'calendar'].includes(t))) {
                    setTabOrder(parsed as Tab[])
                    // Set the first tab as active if we have a saved order
                    if (parsed.length > 0) {
                        setActiveTab(parsed[0] as Tab)
                    }
                }
            } catch (e) {
                console.error("Failed to parse saved tab order", e)
            }
        }
    }, [])

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setTabOrder((items) => {
                const oldIndex = items.indexOf(active.id as Tab);
                const newIndex = items.indexOf(over.id as Tab);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                localStorage.setItem('publications-tab-order', JSON.stringify(newOrder))
                return newOrder;
            });
        }
    }

    return (
        <div className="flex flex-col h-full">
            <CreatePostDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSuccess={() => {
                    // Switch to drafts tab when new post is created
                    setActiveTab('drafts')
                }}
            />
            {/* Hero Header with Video Background */}
            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 p-6 rounded-xl overflow-hidden border border-border/50 shadow-sm bg-card/40 group">

                {/* Video Background Layer */}
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-xl">
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover opacity-60 dark:opacity-50 saturate-50 scale-105 group-hover:scale-110 group-hover:saturate-100 transition-all duration-[2s] ease-out"
                    >
                        <source src="/hero-video.mp4" type="video/mp4" />
                    </video>
                    {/* Gradient Overlay for Text Readability */}
                    <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
                </div>

                {/* Title Section */}
                <div className="relative z-10 w-full mb-4 sm:mb-0 text-center sm:text-left sm:w-auto">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center justify-center sm:justify-start gap-2">
                        Календарь публикаций
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto sm:mx-0">
                        Управление и планирование AI-контента.
                    </p>
                </div>

                {/* Actions Toolbar */}
                <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">

                    {/* 1. Improved Legend (Hidden on very small screens, Visible on desktop) */}
                    <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-background/80 backdrop-blur-sm rounded-md border border-border mr-2 shadow-sm">
                        {Object.values(PLATFORM_CONFIG).map((platform) => (
                            <div key={platform.label} className="flex items-center gap-1.5" title={platform.label}>
                                <span className={cn("w-2 h-2 rounded-full shadow-sm", platform.dotClass)} />
                                <span className="text-xs font-medium text-foreground">{platform.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Separator - Hide on mobile */}
                    <div className="h-6 w-[1px] bg-border mx-1 hidden lg:block" />

                    {/* Tabs & Button Container - Flex row on mobile to keep them together */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                        {mounted ? (
                            <DndContext
                                id="tabs-dnd-context"
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <div className="flex bg-background/50 backdrop-blur-sm p-1 rounded-lg border border-border">
                                    <SortableContext
                                        items={tabOrder}
                                        strategy={horizontalListSortingStrategy}
                                    >
                                        {tabOrder.map((tab) => (
                                            <SortableTab
                                                key={tab}
                                                tab={tab}
                                                activeTab={activeTab}
                                                onClick={setActiveTab}
                                            />
                                        ))}
                                    </SortableContext>
                                </div>
                            </DndContext>
                        ) : (
                            // Fallback for SSR/Hydration
                            <div className="flex bg-background/50 backdrop-blur-sm p-1 rounded-lg border border-border">
                                {tabOrder.map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                            activeTab === tab
                                                ? "bg-primary text-primary-foreground shadow-sm"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        )}
                                    >
                                        {/* Initial render simple button without dnd hooks */}
                                        {tab === 'drafts' && <FileEdit className="h-3.5 w-3.5" />}
                                        {tab === 'board' && <LayoutGrid className="h-3.5 w-3.5" />}
                                        {tab === 'calendar' && <CalendarIcon className="h-3.5 w-3.5" />}

                                        {tab === 'drafts' && 'Черновики'}
                                        {tab === 'board' && 'Доска'}
                                        {tab === 'calendar' && 'Календарь'}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <Button
                            onClick={() => setIsCreateOpen(true)}
                            size="icon"
                            className="h-[38px] w-[38px] sm:w-auto sm:h-9 sm:px-4 shadow-lg shadow-emerald-500/20 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white border-0 shrink-0"
                        >
                            <Plus className="w-5 h-5 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline font-semibold ml-2">Создать пост</span>
                        </Button>
                    </div>
                </div>
            </div>

            <div className="main-content flex-1 min-h-0 bg-card rounded-xl border border-border overflow-hidden">
                {activeTab === 'drafts' && <DraftsView />}
                {activeTab === 'board' && <BoardView />}
                {activeTab === 'calendar' && <CalendarViewBig />}
            </div>
        </div>
    )
}

// Tag color configurations for consistent styling across the app
export const TAG_COLORS: Record<string, { bg: string, text: string, icon: string }> = {
    hunting: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        text: 'text-emerald-700 dark:text-emerald-400',
        icon: 'text-emerald-600 dark:text-emerald-500'
    },
    weapons: {
        bg: 'bg-red-50 dark:bg-red-950/30',
        text: 'text-red-700 dark:text-red-400',
        icon: 'text-red-600 dark:text-red-500'
    },
    dogs: {
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        text: 'text-amber-700 dark:text-amber-400',
        icon: 'text-amber-600 dark:text-amber-500'
    },
    recipes: {
        bg: 'bg-orange-50 dark:bg-orange-950/30',
        text: 'text-orange-700 dark:text-orange-400',
        icon: 'text-orange-600 dark:text-orange-500'
    },
    culture: {
        bg: 'bg-purple-50 dark:bg-purple-950/30',
        text: 'text-purple-700 dark:text-purple-400',
        icon: 'text-purple-600 dark:text-purple-500'
    },
    travel: {
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        text: 'text-blue-700 dark:text-blue-400',
        icon: 'text-blue-600 dark:text-blue-500'
    },
    law: {
        bg: 'bg-slate-50 dark:bg-slate-950/30',
        text: 'text-slate-700 dark:text-slate-400',
        icon: 'text-slate-600 dark:text-slate-500'
    },
    events: {
        bg: 'bg-pink-50 dark:bg-pink-950/30',
        text: 'text-pink-700 dark:text-pink-400',
        icon: 'text-pink-600 dark:text-pink-500'
    },
    conservation: {
        bg: 'bg-green-50 dark:bg-green-950/30',
        text: 'text-green-700 dark:text-green-400',
        icon: 'text-green-600 dark:text-green-500'
    },
    other: {
        bg: 'bg-gray-50 dark:bg-gray-950/30',
        text: 'text-gray-700 dark:text-gray-400',
        icon: 'text-gray-600 dark:text-gray-500'
    }
}

// Helper to get tag colors with fallback
export function getTagColors(tag: string) {
    return TAG_COLORS[tag] || TAG_COLORS.other
}

// Badge-style colors for selected tags (pills)
export const TAG_BADGE_COLORS: Record<string, string> = {
    hunting: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25",
    weapons: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 hover:bg-red-500/25",
    dogs: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25",
    recipes: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/25",
    culture: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/25",
    travel: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/25",
    law: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30 hover:bg-slate-500/25",
    events: "bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/30 hover:bg-pink-500/25",
    conservation: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/25",
    other: "bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/30 hover:bg-gray-500/25"
}

// Helper to get badge colors with fallback
export function getTagBadgeColors(tag: string) {
    return TAG_BADGE_COLORS[tag] || TAG_BADGE_COLORS.other
}

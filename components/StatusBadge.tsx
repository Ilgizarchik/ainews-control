import { cn } from "@/lib/utils"
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    processing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    published: "bg-green-500/10 text-green-500 border-green-500/20",
    error: "bg-red-500/10 text-red-500 border-red-500/20",
  }
  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-medium border", styles[status] || styles.queued)}>
      {status}
    </span>
  )
}

import * as React from "react"
import { cn } from "@/lib/utils"

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default'|'ghost'|'outline'|'secondary' }>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: "bg-zinc-100 text-zinc-900 hover:bg-zinc-100/90",
      ghost: "hover:bg-zinc-800 hover:text-zinc-50",
      outline: "border border-zinc-800 bg-transparent hover:bg-zinc-800",
      secondary: "bg-zinc-800 text-zinc-50 hover:bg-zinc-800/80"
    }
    return (
      <button
        ref={ref}
        className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2", variants[variant], className)}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
export { Button }

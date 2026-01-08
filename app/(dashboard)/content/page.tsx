'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/useRealtime'
import Link from 'next/link'
import { format } from 'date-fns'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'

export default function ContentPage() {
  const [data, setData] = useState<any[]>([])
  const supabase = createClient()
  const fetch = async () => {
    const { data } = await supabase.from('news_items').select('*').order('created_at', { ascending: false }).limit(50)
    if (data) setData(data)
  }
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    fetch()
  }, [])
  useRealtime('news_items', fetch)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Content Feed</h1>
      <div className="border border-border rounded-md bg-card overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted text-muted-foreground border-b border-border">
            <tr><th className="p-4">Date</th><th className="p-4">Title</th><th className="p-4">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mounted && data.map(i => (
              <tr key={i.id} className="hover:bg-muted/50 transition-colors">
                <td className="p-4 text-muted-foreground">{format(new Date(i.created_at), 'MM/dd HH:mm')}</td>
                <td className="p-4 text-foreground">{i.title}</td>
                <td className="p-4"><StatusBadge status={i.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

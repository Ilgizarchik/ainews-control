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
    if(data) setData(data)
  }
  useEffect(() => { fetch() }, [])
  useRealtime('news_items', fetch)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Content Feed</h1>
      <div className="border border-zinc-800 rounded-md bg-zinc-900/50">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
            <tr><th className="p-4">Date</th><th className="p-4">Title</th><th className="p-4">Status</th></tr>
          </thead>
          <tbody>
            {data.map(i => (
              <tr key={i.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                <td className="p-4 text-zinc-500">{format(new Date(i.created_at), 'MM/dd HH:mm')}</td>
                <td className="p-4">{i.title}</td>
                <td className="p-4"><StatusBadge status={i.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

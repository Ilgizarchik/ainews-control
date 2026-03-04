import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBoardJobsCached, getBoardJobsRaw } from '@/lib/publications-cache'

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createClient()
    const {
      data: { user },
      error: userError,
    } = await sessionClient.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const forceFresh = request.nextUrl.searchParams.get('fresh') === '1'
    const payload = forceFresh ? await getBoardJobsRaw() : await getBoardJobsCached()

    return NextResponse.json(
      {
        success: true,
        recipes: payload.recipes || [],
        jobs: payload.jobs || [],
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
        return NextResponse.json({ error: 'id parameter required' }, { status: 400 })
    }

    const supabase = await createClient()

    // @ts-ignore
    const { data, error } = await supabase
        .from('review_items')
        .select('id, draft_title, draft_image_file_id')
        .eq('id', id)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        draft: data,
        tokenConfigured: false,
        tokenPreview: null
    })
}

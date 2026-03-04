import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import fs from 'fs'
import path from 'path'

const BACKUP_BUCKET = process.env.BACKUP_STORAGE_BUCKET || 'system-backups'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename: rawFilename } = await params
        const filename = decodeURIComponent(rawFilename)

        const sessionClient = await createClient()
        const { data: { user }, error: userError } = await sessionClient.auth.getUser()
        if (userError || !user) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return new NextResponse('Invalid filename', { status: 400 })
        }

        const adminDb = createAdminClient()
        const { data: fileBlob, error } = await adminDb.storage.from(BACKUP_BUCKET).download(filename)

        if (error || !fileBlob) {
            // Backward compatibility for legacy local backups in /public
            const localPath = path.join(process.cwd(), 'public', filename)
            if (!fs.existsSync(localPath)) {
                return new NextResponse('File not found', { status: 404 })
            }

            const buffer = fs.readFileSync(localPath)
            return new NextResponse(buffer, {
                headers: {
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Content-Type': 'application/gzip',
                },
            })
        }

        const buffer = Buffer.from(await fileBlob.arrayBuffer())
        const contentType = fileBlob.type || 'application/gzip'

        return new NextResponse(buffer, {
            headers: {
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': contentType,
            },
        })
    } catch (error: any) {
        return new NextResponse(error?.message || 'Internal error', { status: 500 })
    }
}

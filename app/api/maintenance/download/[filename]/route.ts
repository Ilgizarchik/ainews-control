import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import fs from 'fs'
import path from 'path'
import { getBackupAbsolutePath, isValidBackupFilename } from '@/lib/backup-storage'

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

        if (!isValidBackupFilename(filename)) {
            return new NextResponse('Invalid filename', { status: 400 })
        }

        const localBackupPath = getBackupAbsolutePath(filename)
        if (fs.existsSync(localBackupPath)) {
            const buffer = fs.readFileSync(localBackupPath)
            return new NextResponse(buffer, {
                headers: {
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Content-Type': 'application/gzip',
                },
            })
        }

        // Backward compatibility for legacy backups in /public
        const legacyPublicPath = path.join(process.cwd(), 'public', filename)
        if (!fs.existsSync(legacyPublicPath)) {
            return new NextResponse('File not found', { status: 404 })
        }

        const buffer = fs.readFileSync(legacyPublicPath)
        return new NextResponse(buffer, {
            headers: {
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': 'application/gzip',
            },
        })
    } catch (error: any) {
        return new NextResponse(error?.message || 'Internal error', { status: 500 })
    }
}

import { z } from 'zod'

export const ContentActionErrorCodeSchema = z.enum([
    'STALE_DATA',
    'SUPABASE_ERROR',
    'GENERATION_ERROR',
    'UNKNOWN_ERROR',
])

export const ContentActionErrorSchema = z.object({
    code: ContentActionErrorCodeSchema,
    message: z.string(),
})

export const ContentActionResultSchema = z.discriminatedUnion('success', [
    z.object({
        success: z.literal(true),
        message: z.string().optional(),
        data: z.unknown().optional(),
    }),
    z.object({
        success: z.literal(false),
        error: ContentActionErrorSchema,
    }),
])

export type ContentActionResult = z.infer<typeof ContentActionResultSchema>
export type ContentActionErrorCode = z.infer<typeof ContentActionErrorCodeSchema>

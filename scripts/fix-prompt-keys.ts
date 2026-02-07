import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    const { data, error } = await supabase
        .from('system_prompts')
        .select('id, key')

    if (error) {
        console.error(error)
        return
    }

    let fixes = 0
    for (const p of data) {
        if (p.key !== p.key.trim()) {
            const cleanKey = p.key.trim()

            // Fix it
            const { error: updateError } = await supabase
                .from('system_prompts')
                .update({ key: cleanKey })
                .eq('id', p.id)

            if (updateError) {
                console.error(`Failed to update ${p.id}:`, updateError)
            } else {
                fixes++
            }
        }
    }

    if (fixes === 0) {
    } else {
    }
}

main()

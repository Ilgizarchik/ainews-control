import { createAdminClient } from './lib/supabase/admin.js';

async function check() {
    const supabase = createAdminClient();
    const { data: settings } = await supabase.from('project_settings').select('key, value').eq('project_key', 'ainews');
    console.log('--- SETTINGS ---');
    console.log(JSON.stringify(settings, null, 2));

    const { data: chats } = await supabase.from('telegram_chats').select('*');
    console.log('--- CHATS ---');
    console.log(JSON.stringify(chats, null, 2));
}

check();

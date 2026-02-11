
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const { fetch } = require('undici');

const supabaseUrl = 'https://rshqequtbqvrqbgfykhq.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''; // We might need a service role key if RLS is on, but based on meta it is disabled

async function fixRecentImages() {
    console.log('--- Image Fix Script Started ---');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch last 20 news items
    const { data: items, error } = await supabase
        .from('news_items')
        .select('id, canonical_url, image_url')
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) {
        console.error('Error fetching items:', error);
        return;
    }

    console.log(`Found ${items.length} recent items to check.`);

    const isPlaceholder = (url) => {
        if (!url) return true;
        return url.includes('data:image/') ||
            url.includes('spacer') ||
            url.includes('transparent') ||
            url.includes('placeholder') ||
            url.length < 10;
    };

    for (const item of items) {
        if (!item.image_url || isPlaceholder(item.image_url)) {
            console.log(`Fixing image for: ${item.canonical_url}`);

            try {
                const res = await fetch(item.canonical_url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                });
                const html = await res.text();
                const $ = cheerio.load(html);

                const ogImage = $('meta[property="og:image"]').attr('content') ||
                    $('meta[name="twitter:image"]').attr('content') ||
                    $('link[rel="image_src"]').attr('href');

                if (ogImage && !isPlaceholder(ogImage)) {
                    console.log(`   -> Found OG image: ${ogImage}`);
                    const { error: updateError } = await supabase
                        .from('news_items')
                        .update({ image_url: ogImage })
                        .eq('id', item.id);

                    if (updateError) console.error(`   !! Update failed for ${item.id}:`, updateError);
                    else console.log(`   OK: Updated ${item.id}`);
                } else {
                    console.log(`   !! No valid OG image found.`);
                }
            } catch (e) {
                console.error(`   !! Error processing ${item.canonical_url}:`, e.message);
            }
        }
    }
    console.log('--- Image Fix Script Completed ---');
}

fixRecentImages();

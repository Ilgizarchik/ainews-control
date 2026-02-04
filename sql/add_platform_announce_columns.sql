-- Add platform-specific announce fields to review_items
-- These store AI-generated announcements tailored for each social media platform

ALTER TABLE review_items 
ADD COLUMN IF NOT EXISTS draft_announce_tg TEXT,
ADD COLUMN IF NOT EXISTS draft_announce_vk TEXT,
ADD COLUMN IF NOT EXISTS draft_announce_ok TEXT,
ADD COLUMN IF NOT EXISTS draft_announce_fb TEXT,
ADD COLUMN IF NOT EXISTS draft_announce_x TEXT,
ADD COLUMN IF NOT EXISTS draft_announce_threads TEXT,
ADD COLUMN IF NOT EXISTS draft_announce_site TEXT;

COMMENT ON COLUMN review_items.draft_announce_tg IS 'AI-generated announcement for Telegram';
COMMENT ON COLUMN review_items.draft_announce_vk IS 'AI-generated announcement for VK';
COMMENT ON COLUMN review_items.draft_announce_ok IS 'AI-generated announcement for OK';
COMMENT ON COLUMN review_items.draft_announce_fb IS 'AI-generated announcement for Facebook';
COMMENT ON COLUMN review_items.draft_announce_x IS 'AI-generated announcement for X/Twitter';
COMMENT ON COLUMN review_items.draft_announce_threads IS 'AI-generated announcement for Threads';
COMMENT ON COLUMN review_items.draft_announce_site IS 'AI-generated announcement for Website';

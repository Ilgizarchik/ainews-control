-- Performance indexes for the heaviest dashboard Supabase queries.

-- Drafts list queries.
CREATE INDEX IF NOT EXISTS idx_news_items_drafts_ready_created_at
    ON public.news_items (created_at DESC)
    WHERE status = 'drafts_ready';

CREATE INDEX IF NOT EXISTS idx_review_items_draft_status_created_at
    ON public.review_items (status, created_at DESC)
    WHERE status IN ('needs_review', 'drafts_ready');

-- Content moderation list queries (filter + sort).
CREATE INDEX IF NOT EXISTS idx_news_items_gate_pending_pub_created
    ON public.news_items (gate1_decision, approve1_decision, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_items_approve_decision_pub_created
    ON public.news_items (approve1_decision, published_at DESC, created_at DESC);

-- Publication queue and calendar queries.
CREATE INDEX IF NOT EXISTS idx_publish_jobs_publish_at
    ON public.publish_jobs (publish_at);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_news_platform
    ON public.publish_jobs (news_id, platform);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_review_platform
    ON public.publish_jobs (review_id, platform);

-- Active recipe lookup.
CREATE INDEX IF NOT EXISTS idx_publish_recipes_active_main_platform
    ON public.publish_recipes (is_active, is_main, platform);

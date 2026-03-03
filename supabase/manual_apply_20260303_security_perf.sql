-- Manual patch for Supabase SQL Editor.
-- Apply when supabase db push is unstable due network/pooler timeouts.
-- Includes:
--   1) Security hardening (RLS, RPC execute grants, function search_path)
--   2) Performance indexes for dashboard queries

-- ======================================================================
-- 1) SECURITY HARDENING
-- ======================================================================

DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'ingestion_sources',
        'news_items',
        'project_settings',
        'publish_jobs',
        'publish_recipes',
        'review_items',
        'system_prompts',
        'telegram_chats'
    ]
    LOOP
        IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
            EXECUTE format('DROP POLICY IF EXISTS authenticated_full_access ON public.%I', tbl);
            EXECUTE format(
                'CREATE POLICY authenticated_full_access ON public.%I
                 FOR ALL TO authenticated
                 USING (true)
                 WITH CHECK (true)',
                tbl
            );
        END IF;
    END LOOP;

    IF to_regclass('public.ai_correction_logs') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.ai_correction_logs ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS authenticated_read_only ON public.ai_correction_logs';
        EXECUTE 'CREATE POLICY authenticated_read_only ON public.ai_correction_logs FOR SELECT TO authenticated USING (true)';
    END IF;

    IF to_regclass('public.app_secrets') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS authenticated_full_access ON public.app_secrets';
        EXECUTE 'DROP POLICY IF EXISTS authenticated_read_only ON public.app_secrets';
    END IF;
END $$;

DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT
            n.nspname AS schema_name,
            p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS identity_args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = ANY (ARRAY[
              'set_main_recipe',
              'toggle_recipe_active',
              'invoke_ingestion',
              'invoke_publications'
          ])
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
            fn.schema_name,
            fn.function_name,
            fn.identity_args
        );

        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',
            fn.schema_name,
            fn.function_name,
            fn.identity_args
        );
        EXECUTE format(
            'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon',
            fn.schema_name,
            fn.function_name,
            fn.identity_args
        );
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
            fn.schema_name,
            fn.function_name,
            fn.identity_args
        );
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
            fn.schema_name,
            fn.function_name,
            fn.identity_args
        );
    END LOOP;
END $$;

-- ======================================================================
-- 2) PERFORMANCE INDEXES
-- ======================================================================

CREATE INDEX IF NOT EXISTS idx_news_items_drafts_ready_created_at
    ON public.news_items (created_at DESC)
    WHERE status = 'drafts_ready';

CREATE INDEX IF NOT EXISTS idx_review_items_draft_status_created_at
    ON public.review_items (status, created_at DESC)
    WHERE status IN ('needs_review', 'drafts_ready');

CREATE INDEX IF NOT EXISTS idx_news_items_gate_pending_pub_created
    ON public.news_items (gate1_decision, approve1_decision, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_items_approve_decision_pub_created
    ON public.news_items (approve1_decision, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_publish_at
    ON public.publish_jobs (publish_at);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_news_platform
    ON public.publish_jobs (news_id, platform);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_review_platform
    ON public.publish_jobs (review_id, platform);

CREATE INDEX IF NOT EXISTS idx_publish_recipes_active_main_platform
    ON public.publish_recipes (is_active, is_main, platform);

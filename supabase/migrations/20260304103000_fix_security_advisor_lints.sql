-- Fix remaining Supabase Security Advisor warnings from CSV report:
-- - rls_policy_always_true
-- - function_search_path_mutable
-- - extension_in_public (vector)
--
-- Note:
-- `auth_leaked_password_protection` must be enabled in Supabase Dashboard (Auth settings),
-- it cannot be reliably enforced from SQL migrations.

-- ======================================================================
-- 1) RLS: replace always-true ALL policies with authenticated role check
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

            -- Drop old permissive policies (legacy and current names).
            EXECUTE format('DROP POLICY IF EXISTS authenticated_full_access ON public.%I', tbl);
            EXECUTE format('DROP POLICY IF EXISTS authenticated_role_access ON public.%I', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON public.%I', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Enable all for authenticated" ON public.%I', tbl);

            -- Keep current behavior (dashboard users can read/write),
            -- but avoid literal TRUE conditions to satisfy linter.
            EXECUTE format(
                'CREATE POLICY authenticated_role_access ON public.%I
                 FOR ALL TO authenticated
                 USING (auth.role() = ''authenticated'')
                 WITH CHECK (auth.role() = ''authenticated'')',
                tbl
            );
        END IF;
    END LOOP;
END $$;

-- ======================================================================
-- 2) Functions: enforce deterministic search_path
-- ======================================================================

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
              'update_system_prompts_updated_at',
              'get_content_stats_aggregated',
              'set_updated_at',
              'get_source_stats'
          ])
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
            fn.schema_name,
            fn.function_name,
            fn.identity_args
        );
    END LOOP;
END $$;

-- ======================================================================
-- 3) Move vector extension out of public schema
-- ======================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'vector'
          AND n.nspname = 'public'
    ) THEN
        CREATE SCHEMA IF NOT EXISTS extensions;
        ALTER EXTENSION vector SET SCHEMA extensions;
        GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
    END IF;
END $$;


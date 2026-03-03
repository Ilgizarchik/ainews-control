-- Security hardening for Supabase Security Advisor findings.
-- 1) Enforce RLS on public tables.
-- 2) Restrict table access to authenticated users.
-- 3) Lock down public RPC execution and set deterministic search_path.

DO $$
DECLARE
    tbl text;
BEGIN
    -- Tables that are used by the authenticated dashboard UI.
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

    -- Logs are visible to authenticated users, writes are done by server/service role.
    IF to_regclass('public.ai_correction_logs') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.ai_correction_logs ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS authenticated_read_only ON public.ai_correction_logs';
        EXECUTE 'CREATE POLICY authenticated_read_only ON public.ai_correction_logs FOR SELECT TO authenticated USING (true)';
    END IF;

    -- Sensitive table: no client policy, service role only.
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

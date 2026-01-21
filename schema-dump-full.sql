
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- ENUMS
CREATE TYPE public.content_status AS ENUM (
    'generated',
    'needs_fix',
    'approved',
    'rejected'
);

CREATE TYPE public.content_type AS ENUM (
    'announce',
    'longread'
);

CREATE TYPE public.gate_decision AS ENUM (
    'send_to_approve',
    'needs_review',
    'reject'
);

CREATE TYPE public.job_status AS ENUM (
    'queued',
    'published',
    'failed',
    'cancelled',
    'processing',
    'error'
);

CREATE TYPE public.news_status AS ENUM (
    'found',
    'rejected',
    'needs_review',
    'filtered',
    'approved_for_adaptation',
    'generated',
    'approved_for_publish',
    'published',
    'error',
    'quarantine',
    'drafts_ready',
    'queued'
);

CREATE TYPE public.output_status AS ENUM (
    'generated',
    'needs_review',
    'approved',
    'rejected',
    'error'
);

CREATE TYPE public.output_type AS ENUM (
    'announce',
    'longread'
);

CREATE TYPE public.pending_action AS ENUM (
    'wait_schedule_time',
    'wait_redo_comment'
);

CREATE TYPE public.sync_status AS ENUM (
    'synced',
    'to_sync'
);

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.toggle_recipe_active(target_id uuid, new_state boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  is_currently_main boolean;
  replacement_id uuid;
BEGIN
  SELECT is_main INTO is_currently_main FROM publish_recipes WHERE id = target_id;

  IF new_state = true THEN
    UPDATE publish_recipes SET is_active = true WHERE id = target_id;
    RETURN;
  END IF;

  IF new_state = false AND is_currently_main = false THEN
    UPDATE publish_recipes SET is_active = false WHERE id = target_id;
    RETURN;
  END IF;

  IF new_state = false AND is_currently_main = true THEN
    SELECT id INTO replacement_id FROM publish_recipes 
    WHERE is_active = true AND id != target_id 
    LIMIT 1;

    IF replacement_id IS NULL THEN
      RAISE EXCEPTION 'Cannot disable the last active main platform.';
    END IF;

    UPDATE publish_recipes SET is_active = false, is_main = false WHERE id = target_id;
    UPDATE publish_recipes SET is_main = true WHERE id = replacement_id;
  END IF;
END;
$function$;

-- TABLES

CREATE TABLE public.news_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    canonical_url text NOT NULL,
    source_name text DEFAULT 'huntportal'::text NOT NULL,
    published_at timestamp with time zone,
    status public.news_status DEFAULT 'found'::public.news_status NOT NULL,
    rss_summary text,
    locked_at timestamp with time zone,
    sent_to_approve1_at timestamp with time zone,
    gate1_decision text,
    gate1_score integer,
    gate1_tags text[],
    gate1_reason text,
    gate1_raw jsonb,
    gate1_processed_at timestamp with time zone,
    approve1_message_id bigint,
    approve1_chat_id bigint,
    factpack jsonb,
    draft_status text,
    draft_questions jsonb,
    draft_announce text,
    draft_longread text,
    draft_image_prompt text,
    drafts_updated_at timestamp with time zone,
    sent_to_approve2_at timestamp with time zone,
    approve2_message_id bigint,
    approve2_chat_id bigint,
    approve2_decision text,
    approve2_decided_at timestamp with time zone,
    approve2_decided_by bigint,
    rewrite2_state text,
    rewrite2_requested_at timestamp with time zone,
    rewrite2_clarify_message_id bigint,
    rewrite2_questions jsonb,
    rewrite2_instructions text,
    rewrite2_answers text,
    approve1_decision text,
    approve1_decided_at timestamp with time zone,
    approve1_decided_by text,
    image_url text,
    draft_image_file_id text,
    published_at_planned timestamp with time zone,
    rewrite2_question_message_id bigint,
    approve2_text_message_id bigint,
    approve2_longread_msg_ids jsonb,
    approve2_photo_message_id bigint,
    draft_title text,
    published_url text
);

CREATE TABLE public.project_settings (
    project_key text NOT NULL,
    key text NOT NULL,
    value text,
    is_active boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.publish_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    news_id uuid,
    platform text,
    status public.job_status DEFAULT 'queued'::public.job_status,
    publish_at timestamp with time zone,
    published_at_actual timestamp with time zone,
    external_id text,
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.publish_recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform text NOT NULL,
    is_active boolean DEFAULT true,
    is_main boolean DEFAULT false,
    delay_hours integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.system_prompts (
    id bigint NOT NULL,
    key text NOT NULL,
    content text NOT NULL,
    description text
);

CREATE TABLE public.telegram_chats (
    id bigint NOT NULL,
    project_key text DEFAULT 'ainews'::text NOT NULL,
    purpose text NOT NULL,
    chat_id bigint NOT NULL,
    title text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    vk_group_id text,
    vk_token text,
    ok_group_id text,
    ok_access_token text
);

-- CONSTRAINTS

ALTER TABLE ONLY public.news_items
    ADD CONSTRAINT news_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.news_items
    ADD CONSTRAINT news_items_canonical_url_key UNIQUE (canonical_url);

ALTER TABLE ONLY public.project_settings
    ADD CONSTRAINT project_settings_pkey PRIMARY KEY (project_key, key);

ALTER TABLE ONLY public.publish_jobs
    ADD CONSTRAINT publish_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.publish_jobs
    ADD CONSTRAINT publish_jobs_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news_items(id);

ALTER TABLE ONLY public.publish_recipes
    ADD CONSTRAINT publish_recipes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.system_prompts
    ADD CONSTRAINT system_prompts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.system_prompts
    ADD CONSTRAINT system_prompts_key_key UNIQUE (key);

ALTER TABLE ONLY public.telegram_chats
    ADD CONSTRAINT telegram_chats_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.telegram_chats
    ADD CONSTRAINT telegram_chats_project_key_purpose_key UNIQUE (project_key, purpose);

-- TRIGGERS

CREATE TRIGGER trg_news_items_updated_at BEFORE UPDATE ON public.news_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS POLICIES

ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin All Access News" ON public.news_items FOR ALL TO public USING ((auth.role() = 'authenticated'::text));

ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin All Access Prompts" ON public.system_prompts FOR ALL TO public USING ((auth.role() = 'authenticated'::text));

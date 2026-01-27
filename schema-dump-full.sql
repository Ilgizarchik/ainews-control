-- Extensions
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- Enums
CREATE TYPE public.content_status AS ENUM ('needs_fix', 'approved', 'rejected', 'generated');
CREATE TYPE public.content_type AS ENUM ('announce', 'longread');
CREATE TYPE public.gate_decision AS ENUM ('send_to_approve', 'needs_review', 'reject');
CREATE TYPE public.job_status AS ENUM ('queued', 'published', 'failed', 'cancelled', 'processing', 'error');
CREATE TYPE public.news_status AS ENUM ('filtered', 'found', 'rejected', 'needs_review', 'approved_for_adaptation', 'generated', 'approved_for_publish', 'published', 'error', 'quarantine', 'drafts_ready', 'queued', 'intake', 'brief_ready', 'await_manual_image', 'approve2_sent');
CREATE TYPE public.output_status AS ENUM ('error', 'generated', 'needs_review', 'approved', 'rejected');
CREATE TYPE public.output_type AS ENUM ('announce', 'longread');
CREATE TYPE public.pending_action AS ENUM ('wait_redo_comment', 'wait_schedule_time');
CREATE TYPE public.review_status AS ENUM ('rejected', 'brief_ready', 'await_manual_image', 'intake', 'drafts_ready', 'approve2_sent', 'published');
CREATE TYPE public.sync_status AS ENUM ('synced', 'to_sync');

-- Functions
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

-- Tables
CREATE TABLE public.news_items (
    approve2_chat_id bigint,
    approve2_decision text,
    image_url text,
    draft_image_file_id text,
    draft_image_prompt text,
    draft_longread text,
    draft_announce text,
    draft_title text,
    approve1_decided_by text,
    published_url text,
    approve1_decision text,
    rewrite2_state text,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    published_at timestamp with time zone,
    status public.news_status NOT NULL DEFAULT 'found'::public.news_status,
    locked_at timestamp with time zone,
    gate1_reason text,
    gate1_tags text[],
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    sent_to_approve1_at timestamp with time zone,
    gate1_score integer,
    gate1_raw jsonb,
    gate1_processed_at timestamp with time zone,
    approve1_message_id bigint,
    approve1_chat_id bigint,
    approve1_decided_at timestamp with time zone,
    drafts_updated_at timestamp with time zone,
    approve2_message_id bigint,
    gate1_decision text,
    approve2_decided_at timestamp with time zone,
    approve2_decided_by bigint,
    approve2_text_message_id bigint,
    approve2_photo_message_id bigint,
    approve2_longread_msg_ids jsonb,
    rewrite2_requested_at timestamp with time zone,
    rewrite2_request_message_id bigint,
    rewrite2_question_message_id bigint,
    rewrite2_requester_id bigint,
    rewrite2_chat_id bigint,
    factpack jsonb DEFAULT '{}'::jsonb,
    rss_summary text,
    source_name text NOT NULL DEFAULT 'huntportal'::text,
    canonical_url text NOT NULL,
    title text NOT NULL
);

CREATE TABLE public.project_settings (
    project_key text NOT NULL,
    is_active boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    key text NOT NULL,
    value text
);

CREATE TABLE public.publish_jobs (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    error_message text,
    external_id text,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    news_id uuid,
    platform text,
    status public.job_status DEFAULT 'queued'::public.job_status,
    publish_at timestamp with time zone,
    published_at_actual timestamp with time zone,
    retry_count integer DEFAULT 0
);

CREATE TABLE public.publish_recipes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    is_active boolean DEFAULT true,
    is_main boolean DEFAULT false,
    delay_hours integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    platform text NOT NULL
);

CREATE TABLE public.review_items (
    factpack jsonb DEFAULT '{}'::jsonb,
    approve2_decision text,
    status public.review_status DEFAULT 'intake'::public.review_status,
    draft_announce text,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    approve2_decided_by bigint,
    approve2_decided_at timestamp with time zone,
    rewrite2_question_message_id bigint,
    draft_longread text,
    draft_image_file_id text,
    rewrite2_request_message_id bigint,
    rewrite2_requested_at timestamp with time zone,
    rewrite2_chat_id bigint,
    draft_title text,
    rewrite2_requester_id bigint,
    approve2_longread_msg_ids jsonb,
    approve2_message_id bigint,
    approve2_announce_message_id bigint,
    approve2_photo_message_id bigint,
    user_chat_id bigint NOT NULL,
    title_seed text,
    approve2_chat_id bigint,
    rewrite2_state text
);

CREATE TABLE public.system_prompts (
    content text NOT NULL,
    description text,
    id bigint NOT NULL,
    key text NOT NULL
);

CREATE TABLE public.telegram_chats (
    vk_token text,
    ok_group_id text,
    ok_access_token text,
    title text,
    purpose text NOT NULL,
    project_key text NOT NULL DEFAULT 'ainews'::text,
    id bigint NOT NULL,
    chat_id bigint NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    vk_group_id text
);

-- Triggers
CREATE TRIGGER trg_news_items_updated_at BEFORE UPDATE ON public.news_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Позволяет автоматически создавать createClient с нужными опциями
  // вместо createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_secrets: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      ingestion_sources: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          is_active: boolean | null
          last_run_at: string | null
          last_status: string | null
          name: string
          selectors: Json | null
          type: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          last_status?: string | null
          name: string
          selectors?: Json | null
          type: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          selectors?: Json | null
          type?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      news_items: {
        Row: {
          approve1_chat_id: number | null
          approve1_decided_at: string | null
          approve1_decided_by: string | null
          approve1_decision: string | null
          approve1_message_id: number | null
          approve2_chat_id: number | null
          approve2_decided_at: string | null
          approve2_decided_by: number | null
          approve2_decision: string | null
          approve2_longread_msg_ids: Json | null
          approve2_message_id: number | null
          approve2_photo_message_id: number | null
          approve2_text_message_id: number | null
          canonical_url: string
          created_at: string
          draft_announce: string | null
          draft_announce_fb: string | null
          draft_announce_ok: string | null
          draft_announce_site: string | null
          draft_announce_tg: string | null
          draft_announce_threads: string | null
          draft_announce_vk: string | null
          draft_announce_x: string | null
          draft_image_file_id: string | null
          draft_image_prompt: string | null
          draft_image_url: string | null
          draft_longread: string | null
          draft_longread_site: string | null
          draft_title: string | null
          drafts_updated_at: string | null
          factpack: Json | null
          gate1_decision: string | null
          gate1_processed_at: string | null
          gate1_raw: Json | null
          gate1_reason: string | null
          gate1_score: number | null
          gate1_tags: string[] | null
          id: string
          image_url: string | null
          is_viewed: boolean | null
          locked_at: string | null
          published_at: string | null
          published_at_actual: string | null
          published_url: string | null
          rewrite2_chat_id: number | null
          rewrite2_question_message_id: number | null
          rewrite2_request_message_id: number | null
          rewrite2_requested_at: string | null
          rewrite2_requester_id: number | null
          rewrite2_state: string | null
          rss_summary: string | null
          sent_to_approve1_at: string | null
          source_name: string
          status: Database["public"]["Enums"]["news_status"]
          title: string
          updated_at: string
        }
        Insert: {
          approve1_chat_id?: number | null
          approve1_decided_at?: string | null
          approve1_decided_by?: string | null
          approve1_decision?: string | null
          approve1_message_id?: number | null
          approve2_chat_id?: number | null
          approve2_decided_at?: string | null
          approve2_decided_by?: number | null
          approve2_decision?: string | null
          approve2_longread_msg_ids?: Json | null
          approve2_message_id?: number | null
          approve2_photo_message_id?: number | null
          approve2_text_message_id?: number | null
          canonical_url: string
          created_at?: string
          draft_announce?: string | null
          draft_announce_fb?: string | null
          draft_announce_ok?: string | null
          draft_announce_site?: string | null
          draft_announce_tg?: string | null
          draft_announce_threads?: string | null
          draft_announce_vk?: string | null
          draft_announce_x?: string | null
          draft_image_file_id?: string | null
          draft_image_prompt?: string | null
          draft_image_url?: string | null
          draft_longread?: string | null
          draft_longread_site?: string | null
          draft_title?: string | null
          drafts_updated_at?: string | null
          factpack?: Json | null
          gate1_decision?: string | null
          gate1_processed_at?: string | null
          gate1_raw?: Json | null
          gate1_reason?: string | null
          gate1_score?: number | null
          gate1_tags?: string[] | null
          id?: string
          image_url?: string | null
          is_viewed?: boolean | null
          locked_at?: string | null
          published_at?: string | null
          published_at_actual?: string | null
          published_url?: string | null
          rewrite2_chat_id?: number | null
          rewrite2_question_message_id?: number | null
          rewrite2_request_message_id?: number | null
          rewrite2_requested_at?: string | null
          rewrite2_requester_id?: number | null
          rewrite2_state?: string | null
          rss_summary?: string | null
          sent_to_approve1_at?: string | null
          source_name?: string
          status?: Database["public"]["Enums"]["news_status"]
          title: string
          updated_at?: string
        }
        Update: {
          approve1_chat_id?: number | null
          approve1_decided_at?: string | null
          approve1_decided_by?: string | null
          approve1_decision?: string | null
          approve1_message_id?: number | null
          approve2_chat_id?: number | null
          approve2_decided_at?: string | null
          approve2_decided_by?: number | null
          approve2_decision?: string | null
          approve2_longread_msg_ids?: Json | null
          approve2_message_id?: number | null
          approve2_photo_message_id?: number | null
          approve2_text_message_id?: number | null
          canonical_url?: string
          created_at?: string
          draft_announce?: string | null
          draft_announce_fb?: string | null
          draft_announce_ok?: string | null
          draft_announce_site?: string | null
          draft_announce_tg?: string | null
          draft_announce_threads?: string | null
          draft_announce_vk?: string | null
          draft_announce_x?: string | null
          draft_image_file_id?: string | null
          draft_image_prompt?: string | null
          draft_image_url?: string | null
          draft_longread?: string | null
          draft_longread_site?: string | null
          draft_title?: string | null
          drafts_updated_at?: string | null
          factpack?: Json | null
          gate1_decision?: string | null
          gate1_processed_at?: string | null
          gate1_raw?: Json | null
          gate1_reason?: string | null
          gate1_score?: number | null
          gate1_tags?: string[] | null
          id?: string
          image_url?: string | null
          is_viewed?: boolean | null
          locked_at?: string | null
          published_at?: string | null
          published_at_actual?: string | null
          published_url?: string | null
          rewrite2_chat_id?: number | null
          rewrite2_question_message_id?: number | null
          rewrite2_request_message_id?: number | null
          rewrite2_requested_at?: string | null
          rewrite2_requester_id?: number | null
          rewrite2_state?: string | null
          rss_summary?: string | null
          sent_to_approve1_at?: string | null
          source_name?: string
          status?: Database["public"]["Enums"]["news_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_settings: {
        Row: {
          is_active: boolean | null
          key: string
          project_key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          is_active?: boolean | null
          key: string
          project_key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          is_active?: boolean | null
          key?: string
          project_key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      publish_jobs: {
        Row: {
          created_at: string | null
          error_message: string | null
          external_id: string | null
          id: string
          news_id: string | null
          platform: string | null
          publish_at: string | null
          published_at_actual: string | null
          published_url: string | null
          retry_count: number | null
          review_id: string | null
          social_content: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          news_id?: string | null
          platform?: string | null
          publish_at?: string | null
          published_at_actual?: string | null
          published_url?: string | null
          retry_count?: number | null
          review_id?: string | null
          social_content?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          news_id?: string | null
          platform?: string | null
          publish_at?: string | null
          published_at_actual?: string | null
          published_url?: string | null
          retry_count?: number | null
          review_id?: string | null
          social_content?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publish_jobs_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_jobs_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "review_items"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_recipes: {
        Row: {
          created_at: string | null
          delay_hours: number | null
          id: string
          is_active: boolean | null
          is_main: boolean | null
          platform: string
        }
        Insert: {
          created_at?: string | null
          delay_hours?: number | null
          id?: string
          is_active?: boolean | null
          is_main?: boolean | null
          platform: string
        }
        Update: {
          created_at?: string | null
          delay_hours?: number | null
          id?: string
          is_active?: boolean | null
          is_main?: boolean | null
          platform?: string
        }
        Relationships: []
      }
      review_items: {
        Row: {
          approve2_announce_message_id: number | null
          approve2_chat_id: number | null
          approve2_decided_at: string | null
          approve2_decided_by: number | null
          approve2_decision: string | null
          approve2_longread_msg_ids: Json | null
          approve2_message_id: number | null
          approve2_photo_message_id: number | null
          approve2_text_message_id: number | null
          created_at: string | null
          draft_announce: string | null
          draft_announce_fb: string | null
          draft_announce_ok: string | null
          draft_announce_site: string | null
          draft_announce_tg: string | null
          draft_announce_threads: string | null
          draft_announce_vk: string | null
          draft_announce_x: string | null
          draft_image_file_id: string | null
          draft_image_prompt: string | null
          draft_image_url: string | null
          draft_longread: string | null
          draft_longread_site: string | null
          draft_title: string | null
          drafts_updated_at: string | null
          factpack: Json | null
          id: string
          published_url: string | null
          rewrite2_chat_id: number | null
          rewrite2_question_message_id: number | null
          rewrite2_request_message_id: number | null
          rewrite2_requested_at: string | null
          rewrite2_requester_id: number | null
          rewrite2_state: string | null
          status: Database["public"]["Enums"]["review_status"] | null
          title_seed: string | null
          updated_at: string | null
          user_chat_id: number
        }
        Insert: {
          approve2_announce_message_id?: number | null
          approve2_chat_id?: number | null
          approve2_decided_at?: string | null
          approve2_decided_by?: number | null
          approve2_decision?: string | null
          approve2_longread_msg_ids?: Json | null
          approve2_message_id?: number | null
          approve2_photo_message_id?: number | null
          approve2_text_message_id?: number | null
          created_at?: string | null
          draft_announce?: string | null
          draft_announce_fb?: string | null
          draft_announce_ok?: string | null
          draft_announce_site?: string | null
          draft_announce_tg?: string | null
          draft_announce_threads?: string | null
          draft_announce_vk?: string | null
          draft_announce_x?: string | null
          draft_image_file_id?: string | null
          draft_image_prompt?: string | null
          draft_image_url?: string | null
          draft_longread?: string | null
          draft_longread_site?: string | null
          draft_title?: string | null
          drafts_updated_at?: string | null
          factpack?: Json | null
          id?: string
          published_url?: string | null
          rewrite2_chat_id?: number | null
          rewrite2_question_message_id?: number | null
          rewrite2_request_message_id?: number | null
          rewrite2_requested_at?: string | null
          rewrite2_requester_id?: number | null
          rewrite2_state?: string | null
          status?: Database["public"]["Enums"]["review_status"] | null
          title_seed?: string | null
          updated_at?: string | null
          user_chat_id: number
        }
        Update: {
          approve2_announce_message_id?: number | null
          approve2_chat_id?: number | null
          approve2_decided_at?: string | null
          approve2_decided_by?: number | null
          approve2_decision?: string | null
          approve2_longread_msg_ids?: Json | null
          approve2_message_id?: number | null
          approve2_photo_message_id?: number | null
          approve2_text_message_id?: number | null
          created_at?: string | null
          draft_announce?: string | null
          draft_announce_fb?: string | null
          draft_announce_ok?: string | null
          draft_announce_site?: string | null
          draft_announce_tg?: string | null
          draft_announce_threads?: string | null
          draft_announce_vk?: string | null
          draft_announce_x?: string | null
          draft_image_file_id?: string | null
          draft_image_prompt?: string | null
          draft_image_url?: string | null
          draft_longread?: string | null
          draft_longread_site?: string | null
          draft_title?: string | null
          drafts_updated_at?: string | null
          factpack?: Json | null
          id?: string
          published_url?: string | null
          rewrite2_chat_id?: number | null
          rewrite2_question_message_id?: number | null
          rewrite2_request_message_id?: number | null
          rewrite2_requested_at?: string | null
          rewrite2_requester_id?: number | null
          rewrite2_state?: string | null
          status?: Database["public"]["Enums"]["review_status"] | null
          title_seed?: string | null
          updated_at?: string | null
          user_chat_id?: number
        }
        Relationships: []
      }
      system_prompts: {
        Row: {
          category: string | null
          content: string
          description: string | null
          id: number
          key: string
          model: string | null
          provider: string | null
          temperature: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          description?: string | null
          id?: number
          key: string
          model?: string | null
          provider?: string | null
          temperature?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          description?: string | null
          id?: number
          key?: string
          model?: string | null
          provider?: string | null
          temperature?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      telegram_chats: {
        Row: {
          chat_id: number
          created_at: string
          id: number
          is_active: boolean
          ok_access_token: string | null
          ok_group_id: string | null
          project_key: string
          purpose: string
          title: string | null
          updated_at: string
          vk_group_id: string | null
          vk_token: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          id: number
          is_active?: boolean
          ok_access_token?: string | null
          ok_group_id?: string | null
          project_key?: string
          purpose: string
          title?: string | null
          updated_at?: string
          vk_group_id?: string | null
          vk_token?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          id?: number
          is_active?: boolean
          ok_access_token?: string | null
          ok_group_id?: string | null
          project_key?: string
          purpose?: string
          title?: string | null
          updated_at?: string
          vk_group_id?: string | null
          vk_token?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      invoke_ingestion: { Args: never; Returns: undefined }
      invoke_publications: { Args: never; Returns: undefined }
      set_main_recipe: { Args: { target_id: string }; Returns: undefined }
      toggle_recipe_active: {
        Args: { new_state: boolean; target_id: string }
        Returns: undefined
      }
    }
    Enums: {
      content_status: "generated" | "needs_fix" | "approved" | "rejected"
      content_type: "announce" | "longread"
      gate_decision: "send_to_approve" | "needs_review" | "reject"
      job_status:
        | "queued"
        | "published"
        | "failed"
        | "cancelled"
        | "processing"
        | "error"
      news_status:
        | "found"
        | "rejected"
        | "needs_review"
        | "filtered"
        | "approved_for_adaptation"
        | "generated"
        | "approved_for_publish"
        | "published"
        | "error"
        | "quarantine"
        | "drafts_ready"
        | "queued"
        | "intake"
        | "brief_ready"
        | "await_manual_image"
        | "approve2_sent"
      output_status:
        | "generated"
        | "needs_review"
        | "approved"
        | "rejected"
        | "error"
      output_type: "announce" | "longread"
      pending_action: "wait_schedule_time" | "wait_redo_comment"
      review_status:
        | "intake"
        | "brief_ready"
        | "await_manual_image"
        | "drafts_ready"
        | "approve2_sent"
        | "published"
        | "rejected"
        | "needs_review"
        | "approved_for_publish"
      sync_status: "synced" | "to_sync"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      content_status: ["generated", "needs_fix", "approved", "rejected"],
      content_type: ["announce", "longread"],
      gate_decision: ["send_to_approve", "needs_review", "reject"],
      job_status: [
        "queued",
        "published",
        "failed",
        "cancelled",
        "processing",
        "error",
      ],
      news_status: [
        "found",
        "rejected",
        "needs_review",
        "filtered",
        "approved_for_adaptation",
        "generated",
        "approved_for_publish",
        "published",
        "error",
        "quarantine",
        "drafts_ready",
        "queued",
        "intake",
        "brief_ready",
        "await_manual_image",
        "approve2_sent",
      ],
      output_status: [
        "generated",
        "needs_review",
        "approved",
        "rejected",
        "error",
      ],
      output_type: ["announce", "longread"],
      pending_action: ["wait_schedule_time", "wait_redo_comment"],
      review_status: [
        "intake",
        "brief_ready",
        "await_manual_image",
        "drafts_ready",
        "approve2_sent",
        "published",
        "rejected",
        "needs_review",
        "approved_for_publish",
      ],
      sync_status: ["synced", "to_sync"],
    },
  },
} as const

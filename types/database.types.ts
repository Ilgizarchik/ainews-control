export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      news_items: {
        Row: {
          id: string
          title: string
          canonical_url: string
          image_url: string | null
          status: string
          created_at: string
          updated_at: string
          published_at: string | null
          draft_announce: string | null
          draft_longread: string | null
          draft_image_file_id: string | null
        }
        Insert: {
          id?: string
          title?: string
          canonical_url?: string
          image_url?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          published_at?: string | null
          draft_announce?: string | null
          draft_longread?: string | null
          draft_image_file_id?: string | null
        }
        Update: {
          id?: string
          title?: string
          canonical_url?: string
          image_url?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          published_at?: string | null
          draft_announce?: string | null
          draft_longread?: string | null
          draft_image_file_id?: string | null
        }
      }
      publish_jobs: {
        Row: {
          id: string
          news_id: string
          platform: string
          status: string
          publish_at: string
          created_at: string
          updated_at: string
          retry_count: number
          published_at_actual: string | null
          external_id: string | null
          error_message: string | null
        }
        Insert: {
          id?: string
          news_id?: string
          platform?: string
          status?: string
          publish_at?: string
          created_at?: string
          updated_at?: string
          retry_count?: number
          published_at_actual?: string | null
          external_id?: string | null
          error_message?: string | null
        }
        Update: {
          id?: string
          news_id?: string
          platform?: string
          status?: string
          publish_at?: string
          created_at?: string
          updated_at?: string
          retry_count?: number
          published_at_actual?: string | null
          external_id?: string | null
          error_message?: string | null
        }
      }
      publish_recipes: {
        Row: {
          id: string
          platform: string
          is_active: boolean
          is_main: boolean
          delay_hours: number
        }
        Insert: {
          id?: string
          platform?: string
          is_active?: boolean
          is_main?: boolean
          delay_hours?: number
        }
        Update: {
          id?: string
          platform?: string
          is_active?: boolean
          is_main?: boolean
          delay_hours?: number
        }
      }
      system_prompts: {
        Row: {
          id: number | string
          key: string
          content: string
          updated_at: string
        }
        Insert: {
          id?: number | string
          key?: string
          content?: string
          updated_at?: string
        }
        Update: {
          id?: number | string
          key?: string
          content?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      set_main_recipe: {
        Args: { target_id: string }
        Returns: void
      }
      toggle_recipe_active: {
        Args: { target_id: string; new_state: boolean }
        Returns: void
      }
    }
  }
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_edits: {
        Row: {
          created_at: string
          created_by: string | null
          creative_id: string | null
          draft_id: string | null
          id: string
          model: string | null
          prompt: string
          response: string | null
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          creative_id?: string | null
          draft_id?: string | null
          id?: string
          model?: string | null
          prompt: string
          response?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          creative_id?: string | null
          draft_id?: string | null
          id?: string
          model?: string | null
          prompt?: string
          response?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_edits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_edits_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_edits_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          approved_at: string | null
          client_comment: string | null
          created_at: string
          draft_id: string
          expires_at: string | null
          id: string
          rejected_at: string | null
          token: string
        }
        Insert: {
          approved_at?: string | null
          client_comment?: string | null
          created_at?: string
          draft_id: string
          expires_at?: string | null
          id?: string
          rejected_at?: string | null
          token: string
        }
        Update: {
          approved_at?: string | null
          client_comment?: string | null
          created_at?: string
          draft_id?: string
          expires_at?: string | null
          id?: string
          rejected_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          brand_kit_id: string
          created_at: string
          height: number | null
          id: string
          kind: string
          label: string | null
          metadata: Json
          mime_type: string | null
          storage_path: string
          width: number | null
        }
        Insert: {
          brand_kit_id: string
          created_at?: string
          height?: number | null
          id?: string
          kind: string
          label?: string | null
          metadata?: Json
          mime_type?: string | null
          storage_path: string
          width?: number | null
        }
        Update: {
          brand_kit_id?: string
          created_at?: string
          height?: number | null
          id?: string
          kind?: string
          label?: string | null
          metadata?: Json
          mime_type?: string | null
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_brand_kit_id_fkey"
            columns: ["brand_kit_id"]
            isOneToOne: false
            referencedRelation: "brand_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_kits: {
        Row: {
          client_id: string
          created_at: string
          do_list: string[] | null
          dont_list: string[] | null
          guidelines_url: string | null
          id: string
          name: string
          palette: Json
          typography: Json
          updated_at: string
          voice_tone: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          do_list?: string[] | null
          dont_list?: string[] | null
          guidelines_url?: string | null
          id?: string
          name: string
          palette?: Json
          typography?: Json
          updated_at?: string
          voice_tone?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          do_list?: string[] | null
          dont_list?: string[] | null
          guidelines_url?: string | null
          id?: string
          name?: string
          palette?: Json
          typography?: Json
          updated_at?: string
          voice_tone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          phone: string | null
          role: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          phone?: string | null
          role?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_members: {
        Row: {
          client_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_services: {
        Row: {
          client_id: string
          ended_on: string | null
          service_id: string
          started_on: string
        }
        Insert: {
          client_id: string
          ended_on?: string | null
          service_id: string
          started_on?: string
        }
        Update: {
          client_id?: string
          ended_on?: string | null
          service_id?: string
          started_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          industry: string | null
          legal_name: string | null
          name: string
          notes: string | null
          portal_token: string | null
          primary_contact_id: string | null
          slug: string
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          industry?: string | null
          legal_name?: string | null
          name: string
          notes?: string | null
          portal_token?: string | null
          primary_contact_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string | null
          legal_name?: string | null
          name?: string
          notes?: string | null
          portal_token?: string | null
          primary_contact_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_primary_contact_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_drafts: {
        Row: {
          caption: string | null
          client_id: string
          compliance_report: Json | null
          created_at: string
          created_by: string | null
          embedding: string | null
          hashtags: string[] | null
          hook: string | null
          id: string
          pillar: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: string
          transcript_id: string | null
          updated_at: string
          video_script: string | null
          video_url: string | null
        }
        Insert: {
          caption?: string | null
          client_id: string
          compliance_report?: Json | null
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: string
          pillar?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          transcript_id?: string | null
          updated_at?: string
          video_script?: string | null
          video_url?: string | null
        }
        Update: {
          caption?: string | null
          client_id?: string
          compliance_report?: Json | null
          created_at?: string
          created_by?: string | null
          embedding?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: string
          pillar?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          transcript_id?: string | null
          updated_at?: string
          video_script?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_drafts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_drafts_transcript_id_fkey"
            columns: ["transcript_id"]
            isOneToOne: false
            referencedRelation: "transcripts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          auto_renew: boolean
          client_id: string
          created_at: string
          currency: string
          document_url: string | null
          ends_on: string | null
          id: string
          monthly_value_cents: number | null
          notes: string | null
          starts_on: string
          title: string
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          client_id: string
          created_at?: string
          currency?: string
          document_url?: string | null
          ends_on?: string | null
          id?: string
          monthly_value_cents?: number | null
          notes?: string | null
          starts_on: string
          title: string
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          client_id?: string
          created_at?: string
          currency?: string
          document_url?: string | null
          ends_on?: string | null
          id?: string
          monthly_value_cents?: number | null
          notes?: string | null
          starts_on?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      creatives: {
        Row: {
          created_at: string
          draft_id: string | null
          height: number | null
          id: string
          image_url: string
          render_css: string | null
          render_html: string | null
          slide_id: string | null
          version: number
          width: number | null
        }
        Insert: {
          created_at?: string
          draft_id?: string | null
          height?: number | null
          id?: string
          image_url: string
          render_css?: string | null
          render_html?: string | null
          slide_id?: string | null
          version?: number
          width?: number | null
        }
        Update: {
          created_at?: string
          draft_id?: string | null
          height?: number | null
          id?: string
          image_url?: string
          render_css?: string | null
          render_html?: string | null
          slide_id?: string | null
          version?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creatives_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creatives_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "slides"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          client_id: string
          created_at: string
          ends_on: string
          id: string
          month: number
          starts_on: string
          year: number
        }
        Insert: {
          client_id: string
          created_at?: string
          ends_on: string
          id?: string
          month: number
          starts_on: string
          year: number
        }
        Update: {
          client_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          month?: number
          starts_on?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          google_event_id: string | null
          google_meet_url: string | null
          id: string
          starts_at: string
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          google_event_id?: string | null
          google_meet_url?: string | null
          id?: string
          starts_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          google_event_id?: string | null
          google_meet_url?: string | null
          id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reports: {
        Row: {
          client_id: string
          content: Json
          generated_at: string
          generated_by: string | null
          id: string
          model: string | null
          month: number
          year: number
        }
        Insert: {
          client_id: string
          content: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          model?: string | null
          month: number
          year: number
        }
        Update: {
          client_id?: string
          content?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          model?: string | null
          month?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string | null
          body: string
          client_id: string
          created_at: string
          id: string
          pinned: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          client_id: string
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_metrics: {
        Row: {
          captured_at: string
          comments: number | null
          follows: number | null
          id: string
          impressions: number | null
          likes: number | null
          profile_visits: number | null
          published_post_id: string
          raw: Json
          reach: number | null
          saves: number | null
          shares: number | null
          video_views: number | null
        }
        Insert: {
          captured_at?: string
          comments?: number | null
          follows?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          profile_visits?: number | null
          published_post_id: string
          raw?: Json
          reach?: number | null
          saves?: number | null
          shares?: number | null
          video_views?: number | null
        }
        Update: {
          captured_at?: string
          comments?: number | null
          follows?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          profile_visits?: number | null
          published_post_id?: string
          raw?: Json
          reach?: number | null
          saves?: number | null
          shares?: number | null
          video_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_published_post_id_fkey"
            columns: ["published_post_id"]
            isOneToOne: false
            referencedRelation: "published_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          locale: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          locale?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          locale?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      published_posts: {
        Row: {
          created_at: string
          draft_id: string
          external_id: string
          id: string
          permalink: string | null
          platform: Database["public"]["Enums"]["platform"]
          post_type: Database["public"]["Enums"]["post_type"]
          published_at: string
        }
        Insert: {
          created_at?: string
          draft_id: string
          external_id: string
          id?: string
          permalink?: string | null
          platform: Database["public"]["Enums"]["platform"]
          post_type: Database["public"]["Enums"]["post_type"]
          published_at?: string
        }
        Update: {
          created_at?: string
          draft_id?: string
          external_id?: string
          id?: string
          permalink?: string | null
          platform?: Database["public"]["Enums"]["platform"]
          post_type?: Database["public"]["Enums"]["post_type"]
          published_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "published_posts_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_posts: {
        Row: {
          attempt_count: number
          created_at: string
          draft_id: string
          id: string
          last_error: string | null
          platform: Database["public"]["Enums"]["platform"]
          post_type: Database["public"]["Enums"]["post_type"]
          published_post_id: string | null
          scheduled_for: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          draft_id: string
          id?: string
          last_error?: string | null
          platform: Database["public"]["Enums"]["platform"]
          post_type: Database["public"]["Enums"]["post_type"]
          published_post_id?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          draft_id?: string
          id?: string
          last_error?: string | null
          platform?: Database["public"]["Enums"]["platform"]
          post_type?: Database["public"]["Enums"]["post_type"]
          published_post_id?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_published_fkey"
            columns: ["published_post_id"]
            isOneToOne: false
            referencedRelation: "published_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          default_monthly_cents: number | null
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          default_monthly_cents?: number | null
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          default_monthly_cents?: number | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      slides: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          draft_id: string
          headline: string | null
          id: string
          position: number
          template_id: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          draft_id: string
          headline?: string | null
          id?: string
          position: number
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          draft_id?: string
          headline?: string | null
          id?: string
          position?: number
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slides_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slides_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          cycle_id: string | null
          description: string | null
          due_at: string | null
          id: string
          is_template: boolean
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          cycle_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          is_template?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          cycle_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          is_template?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string
          created_at: string
          css: string
          html: string
          id: string
          name: string
          preview_url: string | null
        }
        Insert: {
          category: string
          created_at?: string
          css: string
          html: string
          id?: string
          name: string
          preview_url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          css?: string
          html?: string
          id?: string
          name?: string
          preview_url?: string | null
        }
        Relationships: []
      }
      transcripts: {
        Row: {
          content: string
          created_at: string
          id: string
          language: string
          meeting_id: string
          source: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          language?: string
          meeting_id: string
          source?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          language?: string
          meeting_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_client_access: { Args: { target_client: string }; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      match_drafts: {
        Args: {
          match_client: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          id: string
          pillar: string
          similarity: number
          title: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      client_status: "prospect" | "active" | "paused" | "archived"
      content_status:
        | "draft"
        | "text_review"
        | "creative_review"
        | "client_review"
        | "approved"
        | "scheduled"
        | "published"
        | "archived"
      meeting_status: "scheduled" | "completed" | "cancelled"
      platform: "instagram" | "linkedin" | "tiktok"
      post_type: "carousel" | "single_image" | "reel" | "story" | "text"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "blocked" | "review" | "done"
      user_role: "owner" | "staff" | "client"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      client_status: ["prospect", "active", "paused", "archived"],
      content_status: [
        "draft",
        "text_review",
        "creative_review",
        "client_review",
        "approved",
        "scheduled",
        "published",
        "archived",
      ],
      meeting_status: ["scheduled", "completed", "cancelled"],
      platform: ["instagram", "linkedin", "tiktok"],
      post_type: ["carousel", "single_image", "reel", "story", "text"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "blocked", "review", "done"],
      user_role: ["owner", "staff", "client"],
    },
  },
} as const


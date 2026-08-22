export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "ai_edits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "brand_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "brand_kits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_members: {
        Row: {
          client_id: string
          created_at: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          tenant_id?: string
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
            foreignKeyName: "client_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
        }
        Insert: {
          client_id: string
          ended_on?: string | null
          service_id: string
          started_on?: string
          tenant_id?: string
        }
        Update: {
          client_id?: string
          ended_on?: string | null
          service_id?: string
          started_on?: string
          tenant_id?: string
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
          {
            foreignKeyName: "client_services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          portal_user_id: string | null
          posts_per_cycle: number
          primary_contact_id: string | null
          slug: string
          social_enabled: boolean
          status: Database["public"]["Enums"]["client_status"]
          tenant_id: string
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
          portal_user_id?: string | null
          posts_per_cycle?: number
          primary_contact_id?: string | null
          slug: string
          social_enabled?: boolean
          status?: Database["public"]["Enums"]["client_status"]
          tenant_id?: string
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
          portal_user_id?: string | null
          posts_per_cycle?: number
          primary_contact_id?: string | null
          slug?: string
          social_enabled?: boolean
          status?: Database["public"]["Enums"]["client_status"]
          tenant_id?: string
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
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      content_drafts: {
        Row: {
          approved_internal_at: string | null
          backlog_added_on: string
          caption: string | null
          channels: Database["public"]["Enums"]["platform"][]
          client_approved_at: string | null
          client_comment: string | null
          client_id: string
          compliance_report: Json | null
          created_at: string
          created_by: string | null
          design_feedback: string | null
          design_state: Database["public"]["Enums"]["design_state"]
          direction_ok: boolean
          embedding: string | null
          hashtags: string[] | null
          hook: string | null
          id: string
          material_url: string | null
          note_design: string | null
          note_publish: string | null
          origin: Database["public"]["Enums"]["content_origin"] | null
          pillar: string | null
          post_type: Database["public"]["Enums"]["post_type"] | null
          publish_on: string | null
          publish_time: string
          published_at: string | null
          return_reason: string | null
          sent_to_client_at: string | null
          sent_up_at: string | null
          slide_count: number | null
          source_ref: string | null
          status: Database["public"]["Enums"]["content_status"]
          tenant_id: string
          title: string
          transcript_id: string | null
          updated_at: string
          video_script: string | null
          video_url: string | null
          why_now: string | null
          window_note: string | null
        }
        Insert: {
          approved_internal_at?: string | null
          backlog_added_on?: string
          caption?: string | null
          channels?: Database["public"]["Enums"]["platform"][]
          client_approved_at?: string | null
          client_comment?: string | null
          client_id: string
          compliance_report?: Json | null
          created_at?: string
          created_by?: string | null
          design_feedback?: string | null
          design_state?: Database["public"]["Enums"]["design_state"]
          direction_ok?: boolean
          embedding?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: string
          material_url?: string | null
          note_design?: string | null
          note_publish?: string | null
          origin?: Database["public"]["Enums"]["content_origin"] | null
          pillar?: string | null
          post_type?: Database["public"]["Enums"]["post_type"] | null
          publish_on?: string | null
          publish_time?: string
          published_at?: string | null
          return_reason?: string | null
          sent_to_client_at?: string | null
          sent_up_at?: string | null
          slide_count?: number | null
          source_ref?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          tenant_id?: string
          title: string
          transcript_id?: string | null
          updated_at?: string
          video_script?: string | null
          video_url?: string | null
          why_now?: string | null
          window_note?: string | null
        }
        Update: {
          approved_internal_at?: string | null
          backlog_added_on?: string
          caption?: string | null
          channels?: Database["public"]["Enums"]["platform"][]
          client_approved_at?: string | null
          client_comment?: string | null
          client_id?: string
          compliance_report?: Json | null
          created_at?: string
          created_by?: string | null
          design_feedback?: string | null
          design_state?: Database["public"]["Enums"]["design_state"]
          direction_ok?: boolean
          embedding?: string | null
          hashtags?: string[] | null
          hook?: string | null
          id?: string
          material_url?: string | null
          note_design?: string | null
          note_publish?: string | null
          origin?: Database["public"]["Enums"]["content_origin"] | null
          pillar?: string | null
          post_type?: Database["public"]["Enums"]["post_type"] | null
          publish_on?: string | null
          publish_time?: string
          published_at?: string | null
          return_reason?: string | null
          sent_to_client_at?: string | null
          sent_up_at?: string | null
          slide_count?: number | null
          source_ref?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          tenant_id?: string
          title?: string
          transcript_id?: string | null
          updated_at?: string
          video_script?: string | null
          video_url?: string | null
          why_now?: string | null
          window_note?: string | null
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
            foreignKeyName: "content_drafts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "creatives_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
          year: number
        }
        Insert: {
          client_id: string
          created_at?: string
          ends_on: string
          id?: string
          month: number
          starts_on: string
          tenant_id?: string
          year: number
        }
        Update: {
          client_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          month?: number
          starts_on?: string
          tenant_id?: string
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
          {
            foreignKeyName: "cycles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          access_note: string | null
          captured_on: string
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          tenant_id: string
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          access_note?: string | null
          captured_on?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          tenant_id?: string
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          access_note?: string | null
          captured_on?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda_url: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          decisions: string[]
          ends_at: string | null
          google_event_id: string | null
          google_meet_url: string | null
          id: string
          starts_at: string
          status: Database["public"]["Enums"]["meeting_status"]
          summary: string | null
          tenant_id: string
          title: string
          transcript_url: string | null
          updated_at: string
        }
        Insert: {
          agenda_url?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          decisions?: string[]
          ends_at?: string | null
          google_event_id?: string | null
          google_meet_url?: string | null
          id?: string
          starts_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
          summary?: string | null
          tenant_id?: string
          title: string
          transcript_url?: string | null
          updated_at?: string
        }
        Update: {
          agenda_url?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          decisions?: string[]
          ends_at?: string | null
          google_event_id?: string | null
          google_meet_url?: string | null
          id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          summary?: string | null
          tenant_id?: string
          title?: string
          transcript_url?: string | null
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
          {
            foreignKeyName: "meetings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          client_id: string | null
          created_at: string
          id: string
          room: string
          sender_id: string
          tenant_id: string
        }
        Insert: {
          body: string
          client_id?: string | null
          created_at?: string
          id?: string
          room?: string
          sender_id: string
          tenant_id: string
        }
        Update: {
          body?: string
          client_id?: string | null
          created_at?: string
          id?: string
          room?: string
          sender_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "monthly_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "post_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          google_access_token: string | null
          google_email: string | null
          google_refresh_token: string | null
          google_scopes: string[] | null
          google_token_expires_at: string | null
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
          google_access_token?: string | null
          google_email?: string | null
          google_refresh_token?: string | null
          google_scopes?: string[] | null
          google_token_expires_at?: string | null
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
          google_access_token?: string | null
          google_email?: string | null
          google_refresh_token?: string | null
          google_scopes?: string[] | null
          google_token_expires_at?: string | null
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "published_posts_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "content_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "scheduled_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
        }
        Insert: {
          created_at?: string
          default_monthly_cents?: number | null
          description?: string | null
          id?: string
          name: string
          slug: string
          tenant_id?: string
        }
        Update: {
          created_at?: string
          default_monthly_cents?: number | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_logins: {
        Row: {
          access_roles: string[]
          client_id: string
          created_at: string
          created_by: string | null
          holder: string
          id: string
          mfa: string | null
          note: string | null
          platform: string
          rotated_on: string | null
          secret_enc: string | null
          site: string | null
          tenant_id: string
          updated_at: string
          username: string
        }
        Insert: {
          access_roles?: string[]
          client_id: string
          created_at?: string
          created_by?: string | null
          holder?: string
          id?: string
          mfa?: string | null
          note?: string | null
          platform: string
          rotated_on?: string | null
          secret_enc?: string | null
          site?: string | null
          tenant_id?: string
          updated_at?: string
          username: string
        }
        Update: {
          access_roles?: string[]
          client_id?: string
          created_at?: string
          created_by?: string | null
          holder?: string
          id?: string
          mfa?: string | null
          note?: string | null
          platform?: string
          rotated_on?: string | null
          secret_enc?: string | null
          site?: string | null
          tenant_id?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_logins_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_logins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_logins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "slides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
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
          tenant_id?: string
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
          tenant_id?: string
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
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string
        }
        Insert: {
          category: string
          created_at?: string
          css: string
          html: string
          id?: string
          name: string
          preview_url?: string | null
          tenant_id?: string
        }
        Update: {
          category?: string
          created_at?: string
          css?: string
          html?: string
          id?: string
          name?: string
          preview_url?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          branding: Json
          created_at: string
          id: string
          name: string
          slug: string
          theme: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          id?: string
          name: string
          slug: string
          theme?: string
        }
        Update: {
          branding?: Json
          created_at?: string
          id?: string
          name?: string
          slug?: string
          theme?: string
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
          tenant_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          language?: string
          meeting_id: string
          source?: string | null
          tenant_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          language?: string
          meeting_id?: string
          source?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcripts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      is_portal_user: { Args: never; Returns: boolean }
      is_tenant_member: { Args: { target_tenant: string }; Returns: boolean }
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
      owns_portal_client: { Args: { target_client: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      client_status: "prospect" | "active" | "paused" | "archived"
      content_origin:
        | "research"
        | "client_request"
        | "meeting"
        | "follow_up"
        | "dated_event"
      content_status:
        | "backlog"
        | "draft"
        | "text_review"
        | "creative_review"
        | "client_review"
        | "changes_requested"
        | "rejected"
        | "approved"
        | "scheduled"
        | "published"
        | "archived"
      design_state: "todo" | "done" | "signed_off"
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
  public: {
    Enums: {
      client_status: ["prospect", "active", "paused", "archived"],
      content_origin: [
        "research",
        "client_request",
        "meeting",
        "follow_up",
        "dated_event",
      ],
      content_status: [
        "backlog",
        "draft",
        "text_review",
        "creative_review",
        "client_review",
        "changes_requested",
        "rejected",
        "approved",
        "scheduled",
        "published",
        "archived",
      ],
      design_state: ["todo", "done", "signed_off"],
      meeting_status: ["scheduled", "completed", "cancelled"],
      platform: ["instagram", "linkedin", "tiktok"],
      post_type: ["carousel", "single_image", "reel", "story", "text"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "blocked", "review", "done"],
      user_role: ["owner", "staff", "client"],
    },
  },
} as const

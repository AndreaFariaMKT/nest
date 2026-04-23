// Minimal hand-rolled types for the tables the app currently touches.
// TODO: replace with `supabase gen types typescript --local > database.ts`
// once we automate it (tracked for Sprint 2 polish).

export type ClientStatus = "prospect" | "active" | "paused" | "archived";
export type UserRole = "owner" | "staff" | "client";
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "review"
  | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "review",
  "done",
];
export const TASK_PRIORITIES: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export type BrandColor = { name: string; hex: string };
export type BrandTypography = { headings: string; body: string };

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          client_id: string | null;
          cycle_id: string | null;
          assignee_id: string | null;
          created_by: string | null;
          title: string;
          description: string | null;
          status: TaskStatus;
          priority: TaskPriority;
          due_at: string | null;
          completed_at: string | null;
          is_template: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          cycle_id?: string | null;
          assignee_id?: string | null;
          created_by?: string | null;
          title: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          due_at?: string | null;
          completed_at?: string | null;
          is_template?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
      };
      services: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          default_monthly_cents: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          default_monthly_cents?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>;
      };
      client_services: {
        Row: {
          client_id: string;
          service_id: string;
          started_on: string;
          ended_on: string | null;
        };
        Insert: {
          client_id: string;
          service_id: string;
          started_on?: string;
          ended_on?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["client_services"]["Insert"]
        >;
      };
      content_drafts: {
        Row: {
          id: string;
          client_id: string;
          transcript_id: string | null;
          title: string;
          pillar: string | null;
          hook: string | null;
          caption: string | null;
          hashtags: string[];
          status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          transcript_id?: string | null;
          title: string;
          pillar?: string | null;
          hook?: string | null;
          caption?: string | null;
          hashtags?: string[];
          status?: string;
          created_by?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["content_drafts"]["Insert"]
        >;
      };
      slides: {
        Row: {
          id: string;
          draft_id: string;
          position: number;
          template_id: string | null;
          headline: string | null;
          body: string | null;
          data: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          draft_id: string;
          position: number;
          template_id?: string | null;
          headline?: string | null;
          body?: string | null;
          data?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["slides"]["Insert"]>;
      };
      scheduled_posts: {
        Row: {
          id: string;
          draft_id: string;
          platform: "instagram" | "linkedin" | "tiktok";
          post_type: "carousel" | "single_image" | "reel" | "story" | "text";
          scheduled_for: string;
          published_post_id: string | null;
          status: string;
          attempt_count: number;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          draft_id: string;
          platform: "instagram" | "linkedin" | "tiktok";
          post_type: "carousel" | "single_image" | "reel" | "story" | "text";
          scheduled_for: string;
          published_post_id?: string | null;
          status?: string;
          attempt_count?: number;
          last_error?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["scheduled_posts"]["Insert"]
        >;
      };
      creatives: {
        Row: {
          id: string;
          slide_id: string | null;
          draft_id: string | null;
          version: number;
          image_url: string;
          width: number | null;
          height: number | null;
          render_html: string | null;
          render_css: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slide_id?: string | null;
          draft_id?: string | null;
          version?: number;
          image_url: string;
          width?: number | null;
          height?: number | null;
          render_html?: string | null;
          render_css?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["creatives"]["Insert"]>;
      };
      ai_edits: {
        Row: {
          id: string;
          creative_id: string | null;
          draft_id: string | null;
          prompt: string;
          response: string | null;
          model: string | null;
          tokens_in: number | null;
          tokens_out: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          creative_id?: string | null;
          draft_id?: string | null;
          prompt: string;
          response?: string | null;
          model?: string | null;
          tokens_in?: number | null;
          tokens_out?: number | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["ai_edits"]["Insert"]>;
      };
      transcripts: {
        Row: {
          id: string;
          meeting_id: string | null;
          language: string;
          content: string;
          source: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          meeting_id?: string | null;
          language?: string;
          content: string;
          source?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["transcripts"]["Insert"]
        >;
      };
      contracts: {
        Row: {
          id: string;
          client_id: string;
          title: string;
          monthly_value_cents: number | null;
          currency: string;
          starts_on: string;
          ends_on: string | null;
          auto_renew: boolean;
          document_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          title: string;
          monthly_value_cents?: number | null;
          currency?: string;
          starts_on: string;
          ends_on?: string | null;
          auto_renew?: boolean;
          document_url?: string | null;
          notes?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["contracts"]["Insert"]
        >;
      };
      brand_assets: {
        Row: {
          id: string;
          brand_kit_id: string;
          kind: string;
          label: string | null;
          storage_path: string;
          mime_type: string | null;
          width: number | null;
          height: number | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_kit_id: string;
          kind: string;
          label?: string | null;
          storage_path: string;
          mime_type?: string | null;
          width?: number | null;
          height?: number | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<
          Database["public"]["Tables"]["brand_assets"]["Insert"]
        >;
      };
      brand_kits: {
        Row: {
          id: string;
          client_id: string;
          name: string;
          palette: BrandColor[];
          typography: BrandTypography;
          voice_tone: string | null;
          do_list: string[];
          dont_list: string[];
          guidelines_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          name: string;
          palette?: BrandColor[];
          typography?: BrandTypography;
          voice_tone?: string | null;
          do_list?: string[];
          dont_list?: string[];
          guidelines_url?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["brand_kits"]["Insert"]
        >;
      };
      clients: {
        Row: {
          id: string;
          slug: string;
          name: string;
          legal_name: string | null;
          industry: string | null;
          status: ClientStatus;
          website: string | null;
          notes: string | null;
          primary_contact_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          legal_name?: string | null;
          industry?: string | null;
          status?: ClientStatus;
          website?: string | null;
          notes?: string | null;
          primary_contact_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          locale: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          locale?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
    };
  };
}

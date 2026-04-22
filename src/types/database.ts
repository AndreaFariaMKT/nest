// Minimal hand-rolled types for the tables the app currently touches.
// TODO: replace with `supabase gen types typescript --local > database.ts`
// once we automate it (tracked for Sprint 2 polish).

export type ClientStatus = "prospect" | "active" | "paused" | "archived";
export type UserRole = "owner" | "staff" | "client";

export type BrandColor = { name: string; hex: string };
export type BrandTypography = { headings: string; body: string };

export interface Database {
  public: {
    Tables: {
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

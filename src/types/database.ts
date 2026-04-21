// Minimal hand-rolled types for the tables the app currently touches.
// TODO: replace with `supabase gen types typescript --local > database.ts`
// once we automate it (tracked for Sprint 2 polish).

export type ClientStatus = "prospect" | "active" | "paused" | "archived";
export type UserRole = "owner" | "staff" | "client";

export interface Database {
  public: {
    Tables: {
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

/**
 * Database types for the BergLabs schema.
 * Hand-written to match supabase/migrations. Regenerate with
 * `npm run db:types` once a Supabase project is linked.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "owner" | "admin" | "agent";
export type InviteRole = "admin" | "agent";
export type ListingStatus = "draft" | "final";
export type PropertyType = "villa" | "apartment" | "townhouse" | "vacation_home";
export type TargetAudience = "family" | "first_time_buyer" | "investor";
export type ListingTone = "classic" | "warm" | "luxury";
export type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";
export type InvitationStatus = "pending" | "accepted" | "revoked";

/** The three generated parts of a listing ad. */
export interface GeneratedListingText {
  headline: string;
  body: string;
  facts: string;
  [key: string]: Json | undefined;
}

/** Claude vision output for a single image. */
export interface ImageAnalysisResult {
  room_type: string;
  light: string;
  condition: string;
  materials: string[];
  notable_details: string[];
  summary: string;
  confirmed: boolean;
  [key: string]: Json | undefined;
}

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          org_number: string | null;
          stripe_customer_id: string | null;
          subscription_status: SubscriptionStatus;
          seats_purchased: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          org_number?: string | null;
          stripe_customer_id?: string | null;
          subscription_status?: SubscriptionStatus;
          seats_purchased?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          org_number?: string | null;
          stripe_customer_id?: string | null;
          subscription_status?: SubscriptionStatus;
          seats_purchased?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          full_name: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          email: string;
          full_name?: string;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          full_name?: string;
          role?: UserRole;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      listings: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string | null;
          address: string;
          property_type: PropertyType;
          rooms: number | null;
          area_sqm: number | null;
          supplementary_area_sqm: number | null;
          plot_area_sqm: number | null;
          price: number | null;
          monthly_fee: number | null;
          operating_cost: number | null;
          build_year: number | null;
          key_features: string;
          target_audience: TargetAudience | null;
          tone: ListingTone;
          generated_text: GeneratedListingText | null;
          status: ListingStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by: string;
          address?: string;
          property_type?: PropertyType;
          rooms?: number | null;
          area_sqm?: number | null;
          supplementary_area_sqm?: number | null;
          plot_area_sqm?: number | null;
          price?: number | null;
          monthly_fee?: number | null;
          operating_cost?: number | null;
          build_year?: number | null;
          key_features?: string;
          target_audience?: TargetAudience | null;
          tone?: ListingTone;
          generated_text?: GeneratedListingText | null;
          status?: ListingStatus;
        };
        Update: {
          address?: string;
          property_type?: PropertyType;
          rooms?: number | null;
          area_sqm?: number | null;
          supplementary_area_sqm?: number | null;
          plot_area_sqm?: number | null;
          price?: number | null;
          monthly_fee?: number | null;
          operating_cost?: number | null;
          build_year?: number | null;
          key_features?: string;
          target_audience?: TargetAudience | null;
          tone?: ListingTone;
          generated_text?: GeneratedListingText | null;
          status?: ListingStatus;
        };
        Relationships: [
          {
            foreignKeyName: "listings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "listings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_images: {
        Row: {
          id: string;
          listing_id: string;
          organization_id: string;
          storage_path: string;
          ai_analysis_result: ImageAnalysisResult | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          organization_id: string;
          storage_path: string;
          ai_analysis_result?: ImageAnalysisResult | null;
          sort_order?: number;
        };
        Update: {
          storage_path?: string;
          ai_analysis_result?: ImageAnalysisResult | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "listing_images_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      listing_versions: {
        Row: {
          id: string;
          listing_id: string;
          organization_id: string;
          content: GeneratedListingText;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          organization_id: string;
          content: GeneratedListingText;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "listing_versions_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "listings";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          organization_id: string;
          stripe_subscription_id: string;
          plan: string;
          seats: number;
          status: Exclude<SubscriptionStatus, "inactive">;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          stripe_subscription_id: string;
          plan?: string;
          seats?: number;
          status: Exclude<SubscriptionStatus, "inactive">;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
        };
        Update: {
          plan?: string;
          seats?: number;
          status?: Exclude<SubscriptionStatus, "inactive">;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: InviteRole;
          invited_by: string | null;
          status: InvitationStatus;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role?: InviteRole;
          invited_by: string;
          status?: InvitationStatus;
        };
        Update: {
          status?: InvitationStatus;
          accepted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      user_org_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      create_organization: {
        Args: { org_name: string; org_number_input?: string | null };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Organization = Tables<"organizations">;
export type Profile = Tables<"profiles">;
export type Listing = Tables<"listings">;
export type ListingImage = Tables<"listing_images">;
export type ListingVersion = Tables<"listing_versions">;
export type Subscription = Tables<"subscriptions">;
export type Invitation = Tables<"invitations">;

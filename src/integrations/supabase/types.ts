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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          store_id: string
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          store_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      flagged_reports: {
        Row: {
          created_at: string
          details: string
          id: string
          reason: string
          recipe_id: string | null
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_author_id: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string
          id?: string
          reason: string
          recipe_id?: string | null
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_author_id?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: string
          reason?: string
          recipe_id?: string | null
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_author_id?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      pantries: {
        Row: {
          contact: string
          hours: string
          id: string
          location: string
          name: string
          updated_at: string
        }
        Insert: {
          contact?: string
          hours?: string
          id?: string
          location?: string
          name: string
          updated_at?: string
        }
        Update: {
          contact?: string
          hours?: string
          id?: string
          location?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pantry_events: {
        Row: {
          created_at: string
          details: string
          ends_at: string | null
          id: string
          location: string
          pantry_id: string
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string
          details?: string
          ends_at?: string | null
          id?: string
          location?: string
          pantry_id: string
          starts_at: string
          title: string
        }
        Update: {
          created_at?: string
          details?: string
          ends_at?: string | null
          id?: string
          location?: string
          pantry_id?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pantry_events_pantry_id_fkey"
            columns: ["pantry_id"]
            isOneToOne: false
            referencedRelation: "pantries"
            referencedColumns: ["id"]
          },
        ]
      }
      pantry_posts: {
        Row: {
          body: string
          created_at: string
          id: string
          items: string[]
          pantry_id: string
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          items?: string[]
          pantry_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          items?: string[]
          pantry_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pantry_posts_pantry_id_fkey"
            columns: ["pantry_id"]
            isOneToOne: false
            referencedRelation: "pantries"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          current_price: number
          id: string
          name: string
          origin: string
          producer: string
          promo_ends_at: string | null
          promo_label: string | null
          promo_price: number | null
          store_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          current_price: number
          id?: string
          name: string
          origin?: string
          producer?: string
          promo_ends_at?: string | null
          promo_label?: string | null
          promo_price?: number | null
          store_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          current_price?: number
          id?: string
          name?: string
          origin?: string
          producer?: string
          promo_ends_at?: string | null
          promo_label?: string | null
          promo_price?: number | null
          store_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      recipe_feedback: {
        Row: {
          body: string
          created_at: string
          id: string
          rating: number
          recipe_id: string
          status: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          rating: number
          recipe_id: string
          status?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          rating?: number
          recipe_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_feedback_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          allergen_tags: string[]
          chef_id: string | null
          chef_name: string
          created_at: string
          cuisine: string
          description: string
          dietary_tags: string[]
          est_cost: number
          id: string
          ingredients: string[]
          minutes: number
          religious_compliance: string[]
          servings: number
          steps: string[]
          title: string
        }
        Insert: {
          allergen_tags?: string[]
          chef_id?: string | null
          chef_name?: string
          created_at?: string
          cuisine?: string
          description?: string
          dietary_tags?: string[]
          est_cost?: number
          id?: string
          ingredients?: string[]
          minutes?: number
          religious_compliance?: string[]
          servings?: number
          steps?: string[]
          title: string
        }
        Update: {
          allergen_tags?: string[]
          chef_id?: string | null
          chef_name?: string
          created_at?: string
          cuisine?: string
          description?: string
          dietary_tags?: string[]
          est_cost?: number
          id?: string
          ingredients?: string[]
          minutes?: number
          religious_compliance?: string[]
          servings?: number
          steps?: string[]
          title?: string
        }
        Relationships: []
      }
      store_reviews: {
        Row: {
          body: string
          created_at: string
          id: string
          owner_response: string | null
          product_id: string | null
          rating: number
          responded_at: string | null
          status: string
          store_id: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          owner_response?: string | null
          product_id?: string | null
          rating: number
          responded_at?: string | null
          status?: string
          store_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          owner_response?: string | null
          product_id?: string | null
          rating?: number
          responded_at?: string | null
          status?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          accessibility_flags: string[]
          address: string
          budget_friendly: boolean
          created_at: string
          cuisines: string[]
          description: string
          dietary_stock: string[]
          distance_miles: number
          hours: string
          id: string
          name: string
          owner_id: string | null
          transit_modes: string[]
          vendor_type: string
        }
        Insert: {
          accessibility_flags?: string[]
          address?: string
          budget_friendly?: boolean
          created_at?: string
          cuisines?: string[]
          description?: string
          dietary_stock?: string[]
          distance_miles?: number
          hours?: string
          id?: string
          name: string
          owner_id?: string | null
          transit_modes?: string[]
          vendor_type?: string
        }
        Update: {
          accessibility_flags?: string[]
          address?: string
          budget_friendly?: boolean
          created_at?: string
          cuisines?: string[]
          description?: string
          dietary_stock?: string[]
          distance_miles?: number
          hours?: string
          id?: string
          name?: string
          owner_id?: string | null
          transit_modes?: string[]
          vendor_type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_display_names: {
        Args: { _ids: string[] }
        Returns: {
          display_name: string
          id: string
        }[]
      }
      has_any_app_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff_moderator: { Args: { _user_id: string }; Returns: boolean }
      is_store_owner: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      moderate_report: {
        Args: { _action: string; _report_id: string }
        Returns: undefined
      }
      respond_to_review: {
        Args: { _response: string; _review_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "student"
        | "vendor"
        | "chef"
        | "pantry_staff"
        | "moderator"
        | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "student",
        "vendor",
        "chef",
        "pantry_staff",
        "moderator",
        "admin",
      ],
    },
  },
} as const

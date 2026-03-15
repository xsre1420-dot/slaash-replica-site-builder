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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      marketing_settings: {
        Row: {
          created_at: string
          id: string
          meta_pixel_id: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta_pixel_id?: string | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          meta_pixel_id?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_governorate: string | null
          customer_name: string
          customer_phone: string
          delivery_fee: number | null
          id: string
          items: Json
          notes: string | null
          owner_id: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_governorate?: string | null
          customer_name: string
          customer_phone: string
          delivery_fee?: number | null
          id?: string
          items: Json
          notes?: string | null
          owner_id: string
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_governorate?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number | null
          id?: string
          items?: Json
          notes?: string | null
          owner_id?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          owner_id: string
          product_id: string
          rating: number
          reviewer_name: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          owner_id: string
          product_id: string
          rating: number
          reviewer_name: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          product_id?: string
          rating?: number
          reviewer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          additional_images: string[] | null
          category: string | null
          colors: Json | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          owner_id: string
          price: number
          sizes: string[] | null
          stock_quantity: number | null
          updated_at: string
          variants: Json | null
        }
        Insert: {
          additional_images?: string[] | null
          category?: string | null
          colors?: Json | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          owner_id: string
          price?: number
          sizes?: string[] | null
          stock_quantity?: number | null
          updated_at?: string
          variants?: Json | null
        }
        Update: {
          additional_images?: string[] | null
          category?: string | null
          colors?: Json | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          owner_id?: string
          price?: number
          sizes?: string[] | null
          stock_quantity?: number | null
          updated_at?: string
          variants?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          store_name: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          store_name?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          store_name?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          banner_images: string[] | null
          created_at: string
          custom_domain: string | null
          delivery_prices: Json | null
          domain_verified: boolean | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          menu_accent_color: string | null
          menu_background_color: string | null
          menu_text_color: string | null
          owner_id: string
          payment_methods: Json | null
          primary_banner_index: number | null
          privacy_policy: string | null
          return_policy: string | null
          store_font: string | null
          store_governorate: string | null
          store_logo: string | null
          store_name: string | null
          store_slug: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          banner_images?: string[] | null
          created_at?: string
          custom_domain?: string | null
          delivery_prices?: Json | null
          domain_verified?: boolean | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          menu_accent_color?: string | null
          menu_background_color?: string | null
          menu_text_color?: string | null
          owner_id: string
          payment_methods?: Json | null
          primary_banner_index?: number | null
          privacy_policy?: string | null
          return_policy?: string | null
          store_font?: string | null
          store_governorate?: string | null
          store_logo?: string | null
          store_name?: string | null
          store_slug?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          banner_images?: string[] | null
          created_at?: string
          custom_domain?: string | null
          delivery_prices?: Json | null
          domain_verified?: boolean | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          menu_accent_color?: string | null
          menu_background_color?: string | null
          menu_text_color?: string | null
          owner_id?: string
          payment_methods?: Json | null
          primary_banner_index?: number | null
          privacy_policy?: string | null
          return_policy?: string | null
          store_font?: string | null
          store_governorate?: string | null
          store_logo?: string | null
          store_name?: string | null
          store_slug?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      suggested_products: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          product_id: string
          suggested_product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          product_id: string
          suggested_product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          product_id?: string
          suggested_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggested_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggested_products_suggested_product_id_fkey"
            columns: ["suggested_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_store_by_slug: {
        Args: { p_slug: string }
        Returns: {
          banner_images: string[]
          delivery_prices: Json
          facebook_url: string
          instagram_url: string
          menu_accent_color: string
          menu_background_color: string
          menu_text_color: string
          owner_id: string
          payment_methods: Json
          primary_banner_index: number
          privacy_policy: string
          return_policy: string
          store_logo: string
          store_name: string
          store_slug: string
          whatsapp_number: string
        }[]
      }
      get_store_categories: {
        Args: { p_owner_id: string }
        Returns: {
          display_order: number
          id: string
          name: string
        }[]
      }
      get_store_products: {
        Args: { p_owner_id: string }
        Returns: {
          additional_images: string[]
          category: string
          colors: Json
          description: string
          discount_type: string
          discount_value: number
          id: string
          image_url: string
          name: string
          original_price: number
          price: number
          sizes: string[]
          variants: Json
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          first_order_date: string | null
          id: string
          last_order_date: string | null
          name: string | null
          owner_id: string
          phone: string
          total_orders: number | null
          total_spent: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          first_order_date?: string | null
          id?: string
          last_order_date?: string | null
          name?: string | null
          owner_id: string
          phone: string
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          first_order_date?: string | null
          id?: string
          last_order_date?: string | null
          name?: string | null
          owner_id?: string
          phone?: string
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string | null
          id: string
          is_active: boolean | null
          minimum_order_amount: number | null
          owner_id: string
          start_date: string | null
          updated_at: string
          usage_limit: number | null
          used_count: number | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          minimum_order_amount?: number | null
          owner_id: string
          start_date?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          minimum_order_amount?: number | null
          owner_id?: string
          start_date?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number | null
        }
        Relationships: []
      }
      marketing_settings: {
        Row: {
          created_at: string
          email_marketing_enabled: boolean | null
          facebook_access_token: string | null
          google_analytics_id: string | null
          id: string
          marketing_enabled: boolean | null
          meta_pixel_id: string | null
          owner_id: string
          sms_marketing_enabled: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_marketing_enabled?: boolean | null
          facebook_access_token?: string | null
          google_analytics_id?: string | null
          id?: string
          marketing_enabled?: boolean | null
          meta_pixel_id?: string | null
          owner_id: string
          sms_marketing_enabled?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_marketing_enabled?: boolean | null
          facebook_access_token?: string | null
          google_analytics_id?: string | null
          id?: string
          marketing_enabled?: boolean | null
          meta_pixel_id?: string | null
          owner_id?: string
          sms_marketing_enabled?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_name: string
          product_price: number
          quantity: number
          subtotal: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          product_price?: number
          quantity?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_time: number | null
          id: string
          notes: string | null
          owner_id: string
          payment_method: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_time?: number | null
          id?: string
          notes?: string | null
          owner_id: string
          payment_method?: string | null
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_time?: number | null
          id?: string
          notes?: string | null
          owner_id?: string
          payment_method?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_reviews: {
        Row: {
          comment: string
          created_at: string
          helpful_count: number
          id: string
          is_approved: boolean
          is_featured: boolean
          owner_id: string
          product_id: string
          rating: number
          reviewer_email: string | null
          reviewer_name: string
          updated_at: string
        }
        Insert: {
          comment: string
          created_at?: string
          helpful_count?: number
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          owner_id: string
          product_id: string
          rating: number
          reviewer_email?: string | null
          reviewer_name: string
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          helpful_count?: number
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          owner_id?: string
          product_id?: string
          rating?: number
          reviewer_email?: string | null
          reviewer_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          additional_images: string[] | null
          category: string
          colors: Json | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          min_stock_level: number | null
          name: string
          owner_id: string
          price: number
          sizes: Json | null
          stock_quantity: number | null
          updated_at: string
          variants: Json | null
        }
        Insert: {
          additional_images?: string[] | null
          category: string
          colors?: Json | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock_level?: number | null
          name: string
          owner_id: string
          price: number
          sizes?: Json | null
          stock_quantity?: number | null
          updated_at?: string
          variants?: Json | null
        }
        Update: {
          additional_images?: string[] | null
          category?: string
          colors?: Json | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock_level?: number | null
          name?: string
          owner_id?: string
          price?: number
          sizes?: Json | null
          stock_quantity?: number | null
          updated_at?: string
          variants?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          store_name: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          id: string
          store_name?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          store_name?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          banner_images: string[] | null
          created_at: string
          delivery_prices: Json | null
          id: string
          menu_accent_color: string | null
          menu_background_color: string | null
          menu_text_color: string | null
          owner_id: string
          primary_banner_index: number | null
          store_governorate: string | null
          store_logo: string | null
          store_name: string | null
          updated_at: string
        }
        Insert: {
          banner_images?: string[] | null
          created_at?: string
          delivery_prices?: Json | null
          id?: string
          menu_accent_color?: string | null
          menu_background_color?: string | null
          menu_text_color?: string | null
          owner_id: string
          primary_banner_index?: number | null
          store_governorate?: string | null
          store_logo?: string | null
          store_name?: string | null
          updated_at?: string
        }
        Update: {
          banner_images?: string[] | null
          created_at?: string
          delivery_prices?: Json | null
          id?: string
          menu_accent_color?: string | null
          menu_background_color?: string | null
          menu_text_color?: string | null
          owner_id?: string
          primary_banner_index?: number | null
          store_governorate?: string | null
          store_logo?: string | null
          store_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_visits: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          page_path: string | null
          user_agent: string | null
          visitor_ip: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          page_path?: string | null
          user_agent?: string | null
          visitor_ip?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          page_path?: string | null
          user_agent?: string | null
          visitor_ip?: string | null
        }
        Relationships: []
      }
      suggested_products: {
        Row: {
          created_at: string
          display_order: number
          id: string
          owner_id: string
          product_id: string
          suggested_product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          owner_id: string
          product_id: string
          suggested_product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          owner_id?: string
          product_id?: string
          suggested_product_id?: string
        }
        Relationships: []
      }
      user_access: {
        Row: {
          created_at: string | null
          end_date: string | null
          start_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          start_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          start_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_valid_store_visit: {
        Args: { p_owner_id: string; p_visitor_ip: string }
        Returns: boolean
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

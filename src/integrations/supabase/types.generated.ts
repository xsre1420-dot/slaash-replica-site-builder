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
      analytics_event_outbox: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owner_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          owner_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          owner_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      analytics_event_outbox_default: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owner_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          owner_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          owner_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      analytics_event_outbox_y2025m12: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owner_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          owner_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          owner_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      analytics_event_outbox_y2026m01: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owner_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          owner_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          owner_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      analytics_event_outbox_y2026m02: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owner_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          owner_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          owner_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      analytics_event_outbox_y2026m03: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owner_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          owner_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          owner_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      analytics_event_outbox_y2026m04: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owner_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          owner_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          owner_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      analytics_event_outbox_y2026m05: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owner_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          owner_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          owner_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      analytics_event_outbox_y2026m06: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owner_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          owner_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          owner_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      analytics_event_outbox_y2026m07: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owner_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          owner_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          owner_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      analytics_event_outbox_y2026m08: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owner_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          owner_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          owner_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      analytics_event_outbox_y2026m09: {
        Row: {
          created_at: string
          event_type: string
          id: number
          owner_id: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          owner_id: string
          payload?: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          owner_id?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          name: string | null
          owner_id: string
          store_id: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          name?: string | null
          owner_id: string
          store_id?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          name?: string | null
          owner_id?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
          store_id: string | null
          total_orders: number | null
          total_spent: number | null
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
          store_id?: string | null
          total_orders?: number | null
          total_spent?: number | null
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
          store_id?: string | null
          total_orders?: number | null
          total_spent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          errors: Json
          failed_count: number
          id: string
          job_type: string
          owner_id: string
          payload: Json
          processed_rows: number
          started_at: string | null
          status: string
          store_id: string | null
          success_count: number
          total_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          errors?: Json
          failed_count?: number
          id?: string
          job_type?: string
          owner_id: string
          payload?: Json
          processed_rows?: number
          started_at?: string | null
          status?: string
          store_id?: string | null
          success_count?: number
          total_rows?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          errors?: Json
          failed_count?: number
          id?: string
          job_type?: string
          owner_id?: string
          payload?: Json
          processed_rows?: number
          started_at?: string | null
          status?: string
          store_id?: string | null
          success_count?: number
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements_archive: {
        Row: {
          archived_at: string
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          archived_at?: string
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          archived_at?: string
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_default: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2024m06: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2024m07: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2024m08: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2024m09: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2024m10: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2024m11: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2024m12: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2025m01: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2025m02: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2025m03: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2025m04: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2025m05: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2025m06: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2025m07: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2025m08: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2025m09: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2025m10: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2025m11: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2025m12: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2026m01: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2026m02: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2026m03: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2026m04: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2026m05: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2026m06: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2026m07: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2026m08: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2026m09: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2026m10: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2026m11: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      inventory_movements_y2026m12: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id: string
          product_id: string
          quantity_delta: number
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          admin_read_at: string | null
          converted_at: string | null
          converted_user_id: string | null
          created_at: string
          expected_monthly_orders: string | null
          full_name: string
          governorate: string | null
          id: string
          instagram_url: string | null
          notes: string | null
          selected_plan_id: string | null
          selected_plan_name: string | null
          source: string
          status: string
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          admin_read_at?: string | null
          converted_at?: string | null
          converted_user_id?: string | null
          created_at?: string
          expected_monthly_orders?: string | null
          full_name: string
          governorate?: string | null
          id?: string
          instagram_url?: string | null
          notes?: string | null
          selected_plan_id?: string | null
          selected_plan_name?: string | null
          source?: string
          status?: string
          updated_at?: string
          whatsapp_number: string
        }
        Update: {
          admin_read_at?: string | null
          converted_at?: string | null
          converted_user_id?: string | null
          created_at?: string
          expected_monthly_orders?: string | null
          full_name?: string
          governorate?: string | null
          id?: string
          instagram_url?: string | null
          notes?: string | null
          selected_plan_id?: string | null
          selected_plan_name?: string | null
          source?: string
          status?: string
          updated_at?: string
          whatsapp_number?: string
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
      merchant_access_codes: {
        Row: {
          agreed_price: number | null
          auth_email: string
          auth_password: string
          code_expires_at: string
          code_hash: string
          code_hint: string
          created_at: string
          created_by: string | null
          duration_months: number
          id: string
          lead_id: string
          notes: string | null
          plan_id: string
          redeemed_at: string | null
          redeemed_user_id: string | null
          status: string
          store_name: string | null
          subscription_end_at: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          agreed_price?: number | null
          auth_email: string
          auth_password: string
          code_expires_at: string
          code_hash: string
          code_hint: string
          created_at?: string
          created_by?: string | null
          duration_months: number
          id?: string
          lead_id: string
          notes?: string | null
          plan_id: string
          redeemed_at?: string | null
          redeemed_user_id?: string | null
          status?: string
          store_name?: string | null
          subscription_end_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          agreed_price?: number | null
          auth_email?: string
          auth_password?: string
          code_expires_at?: string
          code_hash?: string
          code_hint?: string
          created_at?: string
          created_by?: string | null
          duration_months?: number
          id?: string
          lead_id?: string
          notes?: string | null
          plan_id?: string
          redeemed_at?: string | null
          redeemed_user_id?: string | null
          status?: string
          store_name?: string | null
          subscription_end_at?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_access_codes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      order_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          order_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          order_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_audit_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_chargebacks: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          owner_id: string
          payment_transaction_id: string | null
          provider_dispute_id: string | null
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id: string
          owner_id: string
          payment_transaction_id?: string | null
          provider_dispute_id?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          owner_id?: string
          payment_transaction_id?: string | null
          provider_dispute_id?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_chargebacks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_chargebacks_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          owner_id: string | null
          product_id: string | null
          product_name: string | null
          product_price: number | null
          quantity: number | null
          subtotal: number | null
          variant_metadata: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string | null
          product_id?: string | null
          product_name?: string | null
          product_price?: number | null
          quantity?: number | null
          subtotal?: number | null
          variant_metadata?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string | null
          product_id?: string | null
          product_name?: string | null
          product_price?: number | null
          quantity?: number | null
          subtotal?: number | null
          variant_metadata?: Json | null
        }
        Relationships: []
      }
      order_items_archive: {
        Row: {
          archived_at: string
          created_at: string
          id: string
          order_id: string | null
          owner_id: string | null
          product_id: string | null
          product_name: string | null
          product_price: number | null
          quantity: number | null
          subtotal: number | null
          variant_metadata: Json | null
        }
        Insert: {
          archived_at?: string
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string | null
          product_id?: string | null
          product_name?: string | null
          product_price?: number | null
          quantity?: number | null
          subtotal?: number | null
          variant_metadata?: Json | null
        }
        Update: {
          archived_at?: string
          created_at?: string
          id?: string
          order_id?: string | null
          owner_id?: string | null
          product_id?: string | null
          product_name?: string | null
          product_price?: number | null
          quantity?: number | null
          subtotal?: number | null
          variant_metadata?: Json | null
        }
        Relationships: []
      }
      order_refunds: {
        Row: {
          amount: number
          created_at: string
          id: string
          metadata: Json
          order_id: string
          owner_id: string
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          metadata?: Json
          order_id: string
          owner_id: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string
          owner_id?: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_returns: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_id: string
          owner_id: string
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          owner_id: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          owner_id?: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_side_effects_outbox: {
        Row: {
          created_at: string
          effects_pending: string[]
          id: number
          last_error: string | null
          order_id: string
          owner_id: string
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          effects_pending?: string[]
          id?: number
          last_error?: string | null
          order_id: string
          owner_id: string
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          effects_pending?: string[]
          id?: number
          last_error?: string | null
          order_id?: string
          owner_id?: string
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_side_effects_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_webhook_outbox: {
        Row: {
          attempts: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          next_attempt_at: string
          order_id: string
          owner_id: string
          payload: Json
          processed_at: string | null
          status: string
          store_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          order_id: string
          owner_id: string
          payload?: Json
          processed_at?: string | null
          status?: string
          store_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          order_id?: string
          owner_id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_webhook_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_webhook_outbox_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_code: string | null
          created_at: string | null
          customer_address: string | null
          customer_governorate: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_fee: number | null
          delivery_status: string
          delivery_time: number | null
          discount_amount: number | null
          id: string
          idempotency_key: string | null
          marketing_attribution: Json | null
          meta_conversion_sent_at: string | null
          notes: string | null
          owner_id: string | null
          payment_method: string | null
          payment_status: string
          restaurant_owner_id: string | null
          status: string | null
          store_id: string | null
          total_amount: number | null
          total_price: number
          updated_at: string
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_governorate?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_status?: string
          delivery_time?: number | null
          discount_amount?: number | null
          id?: string
          idempotency_key?: string | null
          marketing_attribution?: Json | null
          meta_conversion_sent_at?: string | null
          notes?: string | null
          owner_id?: string | null
          payment_method?: string | null
          payment_status?: string
          restaurant_owner_id?: string | null
          status?: string | null
          store_id?: string | null
          total_amount?: number | null
          total_price: number
          updated_at?: string
        }
        Update: {
          coupon_code?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_governorate?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_status?: string
          delivery_time?: number | null
          discount_amount?: number | null
          id?: string
          idempotency_key?: string | null
          marketing_attribution?: Json | null
          meta_conversion_sent_at?: string | null
          notes?: string | null
          owner_id?: string | null
          payment_method?: string | null
          payment_status?: string
          restaurant_owner_id?: string | null
          status?: string | null
          store_id?: string | null
          total_amount?: number | null
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_owner_id_fkey"
            columns: ["restaurant_owner_id"]
            isOneToOne: false
            referencedRelation: "restaurant_owner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_owner_id_fkey"
            columns: ["restaurant_owner_id"]
            isOneToOne: false
            referencedRelation: "restaurant_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_archive: {
        Row: {
          archived_at: string
          coupon_code: string | null
          created_at: string | null
          customer_address: string | null
          customer_governorate: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_fee: number | null
          delivery_status: string
          delivery_time: number | null
          discount_amount: number | null
          id: string
          idempotency_key: string | null
          marketing_attribution: Json | null
          meta_conversion_sent_at: string | null
          notes: string | null
          owner_id: string | null
          payment_method: string | null
          payment_status: string
          restaurant_owner_id: string | null
          status: string | null
          store_id: string | null
          total_amount: number | null
          total_price: number
          updated_at: string
        }
        Insert: {
          archived_at?: string
          coupon_code?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_governorate?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_status?: string
          delivery_time?: number | null
          discount_amount?: number | null
          id?: string
          idempotency_key?: string | null
          marketing_attribution?: Json | null
          meta_conversion_sent_at?: string | null
          notes?: string | null
          owner_id?: string | null
          payment_method?: string | null
          payment_status?: string
          restaurant_owner_id?: string | null
          status?: string | null
          store_id?: string | null
          total_amount?: number | null
          total_price: number
          updated_at?: string
        }
        Update: {
          archived_at?: string
          coupon_code?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_governorate?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_status?: string
          delivery_time?: number | null
          discount_amount?: number | null
          id?: string
          idempotency_key?: string | null
          marketing_attribution?: Json | null
          meta_conversion_sent_at?: string | null
          notes?: string | null
          owner_id?: string | null
          payment_method?: string | null
          payment_status?: string
          restaurant_owner_id?: string | null
          status?: string | null
          store_id?: string | null
          total_amount?: number | null
          total_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          order_id: string
          owner_id: string
          payment_method: string
          provider: string
          provider_payment_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          order_id: string
          owner_id: string
          payment_method: string
          provider?: string
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          order_id?: string
          owner_id?: string
          payment_method?: string
          provider?: string
          provider_payment_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string | null
          id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          display_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_data_lifecycle_policies: {
        Row: {
          archive_after_days: number | null
          data_tier: string
          hot_retention_days: number | null
          notes: string | null
          partition_strategy: string
          purge_after_days: number | null
          table_name: string
        }
        Insert: {
          archive_after_days?: number | null
          data_tier: string
          hot_retention_days?: number | null
          notes?: string | null
          partition_strategy?: string
          purge_after_days?: number | null
          table_name: string
        }
        Update: {
          archive_after_days?: number | null
          data_tier?: string
          hot_retention_days?: number | null
          notes?: string | null
          partition_strategy?: string
          purge_after_days?: number | null
          table_name?: string
        }
        Relationships: []
      }
      platform_schema_version: {
        Row: {
          applied_at: string
          notes: string | null
          version: number
        }
        Insert: {
          applied_at?: string
          notes?: string | null
          version: number
        }
        Update: {
          applied_at?: string
          notes?: string | null
          version?: number
        }
        Relationships: []
      }
      product_create_idempotency: {
        Row: {
          created_at: string
          idempotency_key: string
          owner_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          idempotency_key: string
          owner_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          idempotency_key?: string
          owner_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_create_idempotency_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      product_views: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          page_path: string | null
          product_id: string
          store_slug: string | null
          user_agent: string | null
          visitor_ip: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          page_path?: string | null
          product_id: string
          store_slug?: string | null
          user_agent?: string | null
          visitor_ip?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          page_path?: string | null
          product_id?: string
          store_slug?: string | null
          user_agent?: string | null
          visitor_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_views_product_id_fkey"
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
          archived_at: string | null
          category: string | null
          colors: Json | null
          cost: number | null
          created_at: string | null
          description: string | null
          discount_end_date: string | null
          discount_start_date: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          low_stock_threshold: number | null
          min_stock_level: number | null
          name: string
          original_price: number | null
          owner_id: string
          price: number
          product_slug: string | null
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          sizes: Json | null
          sku: string | null
          stock_quantity: number | null
          store_id: string | null
          tags: Json | null
          updated_at: string
          variants: Json | null
        }
        Insert: {
          additional_images?: string[] | null
          archived_at?: string | null
          category?: string | null
          colors?: Json | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          discount_end_date?: string | null
          discount_start_date?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          low_stock_threshold?: number | null
          min_stock_level?: number | null
          name: string
          original_price?: number | null
          owner_id: string
          price: number
          product_slug?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sizes?: Json | null
          sku?: string | null
          stock_quantity?: number | null
          store_id?: string | null
          tags?: Json | null
          updated_at?: string
          variants?: Json | null
        }
        Update: {
          additional_images?: string[] | null
          archived_at?: string | null
          category?: string | null
          colors?: Json | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          discount_end_date?: string | null
          discount_start_date?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          low_stock_threshold?: number | null
          min_stock_level?: number | null
          name?: string
          original_price?: number | null
          owner_id?: string
          price?: number
          product_slug?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sizes?: Json | null
          sku?: string | null
          stock_quantity?: number | null
          store_id?: string | null
          tags?: Json | null
          updated_at?: string
          variants?: Json | null
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
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          store_name: string | null
          updated_at: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          store_name?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          store_name?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      restaurant_owners: {
        Row: {
          created_at: string | null
          id: string
          password_hash: string
          restaurant_logo: string | null
          restaurant_name: string | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          password_hash: string
          restaurant_logo?: string | null
          restaurant_name?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          password_hash?: string
          restaurant_logo?: string | null
          restaurant_name?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      rpc_rate_limits: {
        Row: {
          hit_count: number
          rate_key: string
          window_start: string
        }
        Insert: {
          hit_count?: number
          rate_key: string
          window_start?: string
        }
        Update: {
          hit_count?: number
          rate_key?: string
          window_start?: string
        }
        Relationships: []
      }
      shipment_tracking_events: {
        Row: {
          created_at: string
          id: string
          location: string | null
          note: string | null
          shipment_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          note?: string | null
          shipment_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          note?: string | null
          shipment_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_fee: number
          estimated_delivery_at: string | null
          failed_reason: string | null
          governorate: string | null
          id: string
          order_id: string
          owner_id: string
          recipient_name: string | null
          recipient_phone: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          estimated_delivery_at?: string | null
          failed_reason?: string | null
          governorate?: string | null
          id?: string
          order_id: string
          owner_id: string
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          estimated_delivery_at?: string | null
          failed_reason?: string | null
          governorate?: string | null
          id?: string
          order_id?: string
          owner_id?: string
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_daily_stats: {
        Row: {
          cancelled_order_count: number
          completed_order_count: number
          completed_revenue: number
          gross_revenue: number
          order_count: number
          owner_id: string
          stat_date: string
          unique_visitors: number
          updated_at: string
          visit_count: number
        }
        Insert: {
          cancelled_order_count?: number
          completed_order_count?: number
          completed_revenue?: number
          gross_revenue?: number
          order_count?: number
          owner_id: string
          stat_date: string
          unique_visitors?: number
          updated_at?: string
          visit_count?: number
        }
        Update: {
          cancelled_order_count?: number
          completed_order_count?: number
          completed_revenue?: number
          gross_revenue?: number
          order_count?: number
          owner_id?: string
          stat_date?: string
          unique_visitors?: number
          updated_at?: string
          visit_count?: number
        }
        Relationships: []
      }
      store_plugins: {
        Row: {
          config: Json
          enabled: boolean
          id: string
          installed_at: string
          plugin_id: string
          store_id: string
        }
        Insert: {
          config?: Json
          enabled?: boolean
          id?: string
          installed_at?: string
          plugin_id: string
          store_id: string
        }
        Update: {
          config?: Json
          enabled?: boolean
          id?: string
          installed_at?: string
          plugin_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_plugins_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
          order_webhook_url: string | null
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
          storefront_cache_version: number
          terms_conditions: string | null
          updated_at: string
          whatsapp_number: string | null
          whatsapp_order_confirmation: string | null
          whatsapp_welcome_message: string | null
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
          order_webhook_url?: string | null
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
          storefront_cache_version?: number
          terms_conditions?: string | null
          updated_at?: string
          whatsapp_number?: string | null
          whatsapp_order_confirmation?: string | null
          whatsapp_welcome_message?: string | null
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
          order_webhook_url?: string | null
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
          storefront_cache_version?: number
          terms_conditions?: string | null
          updated_at?: string
          whatsapp_number?: string | null
          whatsapp_order_confirmation?: string | null
          whatsapp_welcome_message?: string | null
        }
        Relationships: []
      }
      store_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          owner_id: string
          plan_id: string
          provider_subscription_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          owner_id: string
          plan_id?: string
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          owner_id?: string
          plan_id?: string
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      store_visitor_daily_keys: {
        Row: {
          created_at: string
          owner_id: string
          stat_date: string
          visitor_ip: string
        }
        Insert: {
          created_at?: string
          owner_id: string
          stat_date: string
          visitor_ip: string
        }
        Update: {
          created_at?: string
          owner_id?: string
          stat_date?: string
          visitor_ip?: string
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
      store_visits_default: {
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
      store_visits_y2024m06: {
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
      store_visits_y2024m07: {
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
      store_visits_y2024m08: {
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
      store_visits_y2024m09: {
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
      store_visits_y2024m10: {
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
      store_visits_y2024m11: {
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
      store_visits_y2024m12: {
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
      store_visits_y2025m01: {
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
      store_visits_y2025m02: {
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
      store_visits_y2025m03: {
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
      store_visits_y2025m04: {
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
      store_visits_y2025m05: {
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
      store_visits_y2025m06: {
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
      store_visits_y2025m07: {
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
      store_visits_y2025m08: {
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
      store_visits_y2025m09: {
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
      store_visits_y2025m10: {
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
      store_visits_y2025m11: {
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
      store_visits_y2025m12: {
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
      store_visits_y2026m01: {
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
      store_visits_y2026m02: {
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
      store_visits_y2026m03: {
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
      store_visits_y2026m04: {
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
      store_visits_y2026m05: {
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
      store_visits_y2026m06: {
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
      store_visits_y2026m07: {
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
      store_visits_y2026m08: {
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
      store_visits_y2026m09: {
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
      store_visits_y2026m10: {
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
      store_visits_y2026m11: {
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
      store_visits_y2026m12: {
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
      storefront_footer_products: {
        Row: {
          created_at: string
          display_order: number
          id: string
          owner_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          owner_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          owner_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_footer_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string | null
          id: string
          name: string
          owner_id: string | null
          settings: Json | null
          slug: string
          store_name: string | null
          store_slug: string | null
          theme_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          owner_id?: string | null
          settings?: Json | null
          slug: string
          store_name?: string | null
          store_slug?: string | null
          theme_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          settings?: Json | null
          slug?: string
          store_name?: string | null
          store_slug?: string | null
          theme_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "restaurant_owner_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "restaurant_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_interval_months: number
          created_at: string
          features: Json
          id: string
          is_active: boolean
          name: string
          price_amount: number
        }
        Insert: {
          billing_interval_months?: number
          created_at?: string
          features?: Json
          id: string
          is_active?: boolean
          name: string
          price_amount?: number
        }
        Update: {
          billing_interval_months?: number
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_amount?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          converted_at: string | null
          created_at: string
          end_date: string | null
          id: string
          lead_id: string | null
          notes: string | null
          plan_name: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          plan_name?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          plan_name?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
      restaurant_owner_profiles: {
        Row: {
          created_at: string | null
          id: string | null
          restaurant_logo: string | null
          restaurant_name: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          restaurant_logo?: string | null
          restaurant_name?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          restaurant_logo?: string | null
          restaurant_name?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _access_code_random_part: { Args: { p_len: number }; Returns: string }
      _dashboard_period_json: {
        Args: {
          p_completed_revenue: number
          p_orders: number
          p_refunds?: number
          p_source?: string
          p_visits: number
        }
        Returns: Json
      }
      _platform_col_exists: {
        Args: { p_column: string; p_table: string }
        Returns: boolean
      }
      _platform_fn_exists: { Args: { p_name: string }; Returns: boolean }
      _platform_is_partitioned: { Args: { p_table: string }; Returns: boolean }
      _platform_rename_table_constraints: {
        Args: { p_suffix?: string; p_table: string }
        Returns: undefined
      }
      _platform_table_exists: { Args: { p_table: string }; Returns: boolean }
      _product_sizes_to_jsonb: { Args: { p_sizes: unknown }; Returns: Json }
      _product_sizes_to_text_array: {
        Args: { p_sizes: unknown }
        Returns: string[]
      }
      _resolve_store_owner_by_slug: {
        Args: { p_slug: string }
        Returns: string
      }
      adjust_product_variants: {
        Args: {
          p_color: string
          p_qty_delta: number
          p_size: string
          p_variants: Json
        }
        Returns: Json
      }
      admin_generate_access_code: {
        Args: {
          p_agreed_price?: number
          p_lead_id: string
          p_notes?: string
          p_plan_id?: string
          p_store_name?: string
        }
        Returns: Json
      }
      admin_get_lead: { Args: { p_lead_id: string }; Returns: Json }
      admin_leads_stats: { Args: never; Returns: Json }
      admin_list_lead_access_codes: {
        Args: { p_lead_id: string }
        Returns: Json
      }
      admin_list_leads:
        | {
            Args: {
              p_filter?: string
              p_limit?: number
              p_offset?: number
              p_search?: string
              p_status?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_limit?: number
              p_offset?: number
              p_search?: string
              p_status?: string
            }
            Returns: Json
          }
      admin_list_subscriptions: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_mark_lead_contacted: { Args: { p_lead_id: string }; Returns: Json }
      admin_unread_leads_count: { Args: never; Returns: number }
      admin_update_lead: {
        Args: {
          p_lead_id: string
          p_mark_read?: boolean
          p_notes?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_upsert_subscription: {
        Args: {
          p_end_date?: string
          p_notes?: string
          p_plan_name: string
          p_start_date?: string
          p_status?: string
          p_user_id: string
        }
        Returns: Json
      }
      approve_product_review: { Args: { p_review_id: string }; Returns: Json }
      archive_inventory_movements_batch: {
        Args: { p_batch_size?: number; p_older_than_days?: number }
        Returns: Json
      }
      archive_orders_batch: {
        Args: { p_batch_size?: number; p_older_than_days?: number }
        Returns: Json
      }
      attach_order_marketing_attribution: {
        Args: { p_attribution?: Json; p_order_id: string; p_store_slug: string }
        Returns: Json
      }
      audit_merchant_analytics_health: {
        Args: { p_owner_id: string }
        Returns: Json
      }
      audit_merchant_inventory_integrity: {
        Args: { p_owner_id: string }
        Returns: Json
      }
      auth_user_store_ids: { Args: never; Returns: string[] }
      bump_storefront_cache_version: {
        Args: { p_owner_id: string }
        Returns: number
      }
      calculate_delivery_fee: {
        Args: { p_governorate: string; p_owner_id: string }
        Returns: number
      }
      calculate_delivery_fee_by_slug: {
        Args: { p_governorate: string; p_store_slug: string }
        Returns: number
      }
      check_rpc_rate_limit: {
        Args: { p_key: string; p_max?: number; p_window_seconds?: number }
        Returns: boolean
      }
      checkout_resolve_duplicate_order: {
        Args: {
          p_idempotency_key?: string
          p_order_id?: string
          p_owner_id: string
        }
        Returns: Json
      }
      claim_order_webhook_outbox_batch: {
        Args: { p_limit?: number }
        Returns: Json
      }
      count_merchant_orders_by_workflow: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_delivery_status?: string
          p_max_value?: number
          p_min_value?: number
          p_order_status?: string
          p_owner_id: string
          p_payment_status?: string
          p_search?: string
        }
        Returns: Json
      }
      create_merchant_product_with_stock: {
        Args: { p_initial_stock?: number; p_owner_id: string; p_payload: Json }
        Returns: Json
      }
      create_order_with_stock_deduction:
        | {
            Args: {
              p_coupon_code?: string
              p_customer_address: string
              p_customer_governorate: string
              p_customer_name: string
              p_customer_phone: string
              p_idempotency_key: string
              p_items: Json
              p_notes: string
              p_order_id: string
              p_owner_id: string
              p_payment_method?: string
              p_total_amount: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_coupon_code?: string
              p_customer_address: string
              p_customer_governorate: string
              p_customer_name: string
              p_customer_phone: string
              p_idempotency_key: string
              p_items: Json
              p_notes: string
              p_order_id: string
              p_owner_id: string
              p_payment_method?: string
              p_store_slug?: string
              p_total_amount: number
            }
            Returns: Json
          }
      effective_product_unit_price: {
        Args: {
          p_discount_end: string
          p_discount_start: string
          p_discount_type: string
          p_discount_value: number
          p_original_price: number
          p_price: number
        }
        Returns: number
      }
      enqueue_product_import_job: {
        Args: { p_owner_id: string; p_rows: Json; p_store_id: string }
        Returns: Json
      }
      expire_product_discounts: { Args: never; Returns: number }
      finalize_order_webhook_delivery: {
        Args: { p_error?: string; p_id: string; p_success: boolean }
        Returns: Json
      }
      get_analytics_pipeline_status: { Args: never; Returns: Json }
      get_approved_product_reviews: {
        Args: { p_product_id: string; p_slug: string }
        Returns: Json
      }
      get_background_jobs_status: { Args: never; Returns: Json }
      get_checkout_products_by_ids: {
        Args: { p_product_ids: string[]; p_slug: string }
        Returns: Json
      }
      get_current_restaurant_owner_id: { Args: never; Returns: string }
      get_dashboard_statistics_batch: {
        Args: { p_owner_id: string }
        Returns: Json
      }
      get_merchant_product_by_id: {
        Args: { p_product_id: string }
        Returns: Json
      }
      get_merchant_product_reviews: {
        Args: { p_product_id: string }
        Returns: Json
      }
      get_my_subscription: { Args: never; Returns: Json }
      get_order_by_idempotency_key: {
        Args: {
          p_idempotency_key: string
          p_owner_id?: string
          p_store_slug?: string
        }
        Returns: Json
      }
      get_order_items_for_statistics: {
        Args: {
          p_end: string
          p_limit?: number
          p_owner_id: string
          p_start: string
        }
        Returns: Json
      }
      get_order_payment_summary: {
        Args: { p_order_id: string; p_owner_id: string }
        Returns: Json
      }
      get_order_shipment: {
        Args: { p_order_id: string; p_owner_id: string }
        Returns: Json
      }
      get_owner_bootstrap: { Args: { p_user_id: string }; Returns: Json }
      get_owner_checkout_products_by_ids: {
        Args: { p_owner_id: string; p_product_ids: string[] }
        Returns: Json
      }
      get_owner_orders_page: {
        Args: {
          p_date_from?: string
          p_limit?: number
          p_offset?: number
          p_owner_id: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      get_owner_products_page: {
        Args: {
          p_category?: string
          p_cursor?: string
          p_limit?: number
          p_offset?: number
          p_owner_id: string
          p_profile?: string
          p_search?: string
        }
        Returns: Json
      }
      get_statistics_page_bundle: {
        Args: {
          p_current_end: string
          p_current_start: string
          p_owner_id: string
          p_previous_end: string
          p_previous_start: string
        }
        Returns: Json
      }
      get_store_bundle: { Args: { p_slug: string }; Returns: Json }
      get_store_categories_by_slug: {
        Args: { p_slug: string }
        Returns: {
          display_order: number
          id: string
          name: string
        }[]
      }
      get_store_for_user: { Args: { p_user_id: string }; Returns: Json }
      get_store_marketing_for_owner: {
        Args: { p_owner_id: string }
        Returns: Json
      }
      get_store_marketing_public: { Args: { p_slug: string }; Returns: Json }
      get_store_meta: {
        Args: { p_include_policies?: boolean; p_slug: string }
        Returns: Json
      }
      get_store_policies: { Args: { p_slug: string }; Returns: Json }
      get_store_product_by_id: {
        Args: { p_product_id: string; p_slug: string }
        Returns: Json
      }
      get_store_products_by_slug: {
        Args: { p_slug: string }
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
          stock_quantity: number
          variants: Json
        }[]
      }
      get_store_products_page: {
        Args: {
          p_category?: string
          p_cursor?: string
          p_limit?: number
          p_search?: string
          p_slug: string
        }
        Returns: Json
      }
      get_store_statistics: {
        Args: { p_end: string; p_owner_id: string; p_start: string }
        Returns: Json
      }
      get_storefront_cache_version: {
        Args: { p_slug: string }
        Returns: number
      }
      get_storefront_footer_products: {
        Args: { p_slug: string }
        Returns: Json
      }
      get_storefront_page_bundle: {
        Args: {
          p_category?: string
          p_cursor?: string
          p_limit?: number
          p_search?: string
          p_slug: string
        }
        Returns: Json
      }
      get_suggested_products_for_store: {
        Args: { p_product_id: string; p_slug: string }
        Returns: Json
      }
      has_active_subscription: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      hash_access_code: { Args: { p_code: string }; Returns: string }
      increment_product_stock: {
        Args: {
          p_delta: number
          p_min_stock_level?: number
          p_owner_id: string
          p_product_id: string
          p_reason?: string
        }
        Returns: Json
      }
      is_checkout_fast_path: { Args: never; Returns: boolean }
      is_payment_method_allowed: {
        Args: { p_owner_id: string; p_payment_method: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { p_user_id?: string }; Returns: boolean }
      is_username_available: { Args: { p_username: string }; Returns: boolean }
      is_valid_product_view: {
        Args: { p_owner_id: string; p_product_id: string; p_visitor_ip: string }
        Returns: boolean
      }
      is_valid_store_visit: {
        Args: { p_owner_id: string; p_visitor_ip: string }
        Returns: boolean
      }
      list_merchant_orders: {
        Args: {
          p_cursor?: string
          p_date_from?: string
          p_date_to?: string
          p_delivery_status?: string
          p_max_value?: number
          p_min_value?: number
          p_order_status?: string
          p_owner_id: string
          p_page?: number
          p_page_size?: number
          p_payment_status?: string
          p_search?: string
          p_workflow_tab?: string
        }
        Returns: Json
      }
      list_public_store_slugs: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          store_slug: string
          updated_at: string
        }[]
      }
      log_sensitive_access: {
        Args: { operation: string; record_id: string; table_name: string }
        Returns: undefined
      }
      lookup_product_idempotency: {
        Args: { p_key: string; p_owner_id: string }
        Returns: string
      }
      mark_delivery_failed: {
        Args: { p_owner_id: string; p_reason?: string; p_shipment_id: string }
        Returns: Json
      }
      mark_meta_conversion_sent: {
        Args: { p_order_id: string; p_owner_id: string }
        Returns: boolean
      }
      merchant_orders_base_filter: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_delivery_status?: string
          p_max_value?: number
          p_min_value?: number
          p_order_status?: string
          p_owner_id: string
          p_payment_status?: string
          p_search?: string
          p_workflow_tab?: string
        }
        Returns: {
          coupon_code: string | null
          created_at: string | null
          customer_address: string | null
          customer_governorate: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_fee: number | null
          delivery_status: string
          delivery_time: number | null
          discount_amount: number | null
          id: string
          idempotency_key: string | null
          marketing_attribution: Json | null
          meta_conversion_sent_at: string | null
          notes: string | null
          owner_id: string | null
          payment_method: string | null
          payment_status: string
          restaurant_owner_id: string | null
          status: string | null
          store_id: string | null
          total_amount: number | null
          total_price: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      normalize_access_code: { Args: { p_code: string }; Returns: string }
      normalize_whatsapp_number: { Args: { p_phone: string }; Returns: string }
      order_workflow_category: {
        Args: {
          p_delivery_status: string
          p_payment_status: string
          p_status: string
        }
        Returns: string
      }
      platform_benchmark_hot_queries: {
        Args: { p_owner_id?: string; p_slug?: string; p_warm_cache?: boolean }
        Returns: Json
      }
      platform_data_lifecycle_audit: { Args: never; Returns: Json }
      platform_database_resource_audit: { Args: never; Returns: Json }
      platform_distributed_scaling_audit: { Args: never; Returns: Json }
      platform_drop_partitions_before: {
        Args: { p_before: string; p_parent_table: string }
        Returns: Json
      }
      platform_ensure_monthly_partitions: {
        Args: {
          p_future_months?: number
          p_parent_table: string
          p_past_months?: number
        }
        Returns: Json
      }
      platform_fk_index_audit: { Args: never; Returns: Json }
      platform_health_check: { Args: never; Returns: Json }
      platform_internals_audit: { Args: never; Returns: Json }
      platform_lifecycle_audit: { Args: never; Returns: Json }
      platform_postgresql_internals_audit: { Args: never; Returns: Json }
      platform_run_data_lifecycle: { Args: never; Returns: Json }
      platform_run_internals_maintenance: {
        Args: {
          p_analyze?: boolean
          p_prune_analytics?: boolean
          p_prune_rate_limits?: boolean
        }
        Returns: Json
      }
      platform_scaling_audit: { Args: never; Returns: Json }
      platform_transaction_integrity_audit: { Args: never; Returns: Json }
      platform_verify_partition_pruning: {
        Args: { p_days?: number; p_table?: string }
        Returns: Json
      }
      platform_write_path_audit: { Args: never; Returns: Json }
      process_analytics_event_buffer: {
        Args: { p_limit?: number }
        Returns: Json
      }
      process_order_side_effects_batch: {
        Args: { p_limit?: number }
        Returns: Json
      }
      process_payment_webhook_event: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_payload: Json
          p_provider: string
        }
        Returns: Json
      }
      process_product_import_batch: {
        Args: { p_batch_size?: number; p_job_id: string }
        Returns: Json
      }
      product_checkout_available_qty: {
        Args: {
          p_color: string
          p_size: string
          p_stock: number
          p_variants: Json
        }
        Returns: number
      }
      product_variant_stock_sum: { Args: { p_variants: Json }; Returns: number }
      prune_analytics_event_outbox: {
        Args: { p_keep_days?: number }
        Returns: number
      }
      prune_import_jobs: { Args: { p_keep_days?: number }; Returns: number }
      prune_order_side_effects_outbox: {
        Args: { p_keep_days?: number }
        Returns: number
      }
      prune_order_webhook_outbox: {
        Args: { p_keep_days?: number }
        Returns: number
      }
      prune_rpc_rate_limits: {
        Args: { p_max_age_seconds?: number }
        Returns: number
      }
      prune_store_visits: {
        Args: { p_retention_days?: number }
        Returns: number
      }
      publish_owner_product: { Args: { p_product_id: string }; Returns: Json }
      record_initial_stock_movements: {
        Args: { p_items: Json; p_owner_id: string }
        Returns: Json
      }
      record_order_chargeback: {
        Args: {
          p_amount: number
          p_order_id: string
          p_owner_id: string
          p_provider_dispute_id?: string
          p_reason?: string
        }
        Returns: Json
      }
      record_order_refund:
        | {
            Args: {
              p_amount: number
              p_order_id: string
              p_owner_id: string
              p_reason?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount: number
              p_idempotency_key?: string
              p_order_id: string
              p_owner_id: string
              p_reason?: string
            }
            Returns: Json
          }
      record_product_idempotency: {
        Args: { p_key: string; p_owner_id: string; p_product_id: string }
        Returns: boolean
      }
      record_product_initial_stock: {
        Args: { p_owner_id: string; p_product_id: string; p_quantity: number }
        Returns: Json
      }
      recover_stale_webhook_processing: {
        Args: { p_stale_minutes?: number }
        Returns: number
      }
      resolve_checkout_owner: {
        Args: { p_owner_id: string; p_store_slug: string }
        Returns: string
      }
      resolve_store_owner_by_slug: { Args: { p_slug: string }; Returns: string }
      restore_orders_from_archive: {
        Args: { p_order_ids: string[] }
        Returns: Json
      }
      retry_failed_delivery: {
        Args: { p_note?: string; p_owner_id: string; p_shipment_id: string }
        Returns: Json
      }
      retry_order_webhook_events: {
        Args: { p_event_ids?: string[]; p_owner_id: string }
        Returns: Json
      }
      scale_variants_to_total: {
        Args: { p_new_total: number; p_variants: Json }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sql_generate_access_code: {
        Args: {
          p_agreed_price?: number
          p_lead_id: string
          p_notes?: string
          p_plan_id?: string
          p_store_name?: string
        }
        Returns: Json
      }
      storefront_compact_variants: { Args: { p_variants: Json }; Returns: Json }
      storefront_product_card_json: {
        Args: { p: Database["public"]["Tables"]["products"]["Row"] }
        Returns: Json
      }
      storefront_product_grid_json: {
        Args: { p: Database["public"]["Tables"]["products"]["Row"] }
        Returns: Json
      }
      storefront_product_json: {
        Args: { p: Database["public"]["Tables"]["products"]["Row"] }
        Returns: Json
      }
      storefront_store_shell_json: {
        Args: { p_cache_version?: number; p_owner_id: string }
        Returns: Json
      }
      submit_access_lead: {
        Args: {
          p_expected_monthly_orders?: string
          p_full_name: string
          p_governorate?: string
          p_instagram_url?: string
          p_selected_plan_id?: string
          p_source?: string
          p_whatsapp_number: string
        }
        Returns: Json
      }
      submit_product_review_for_store: {
        Args: {
          p_comment: string
          p_product_id: string
          p_rating: number
          p_reviewer_name: string
          p_slug: string
        }
        Returns: Json
      }
      tenant_row_owned: {
        Args: { p_owner_id: string; p_store_id: string }
        Returns: boolean
      }
      track_product_view_by_slug: {
        Args: { p_page_path?: string; p_product_id: string; p_slug: string }
        Returns: Json
      }
      track_store_visit_by_slug: {
        Args: {
          p_page_path?: string
          p_store_slug: string
          p_user_agent?: string
        }
        Returns: Json
      }
      update_shipment_status: {
        Args: {
          p_carrier?: string
          p_note?: string
          p_owner_id: string
          p_shipment_id: string
          p_status: string
          p_tracking_number?: string
        }
        Returns: Json
      }
      upsert_store_daily_order_stats: {
        Args: {
          p_delta?: number
          p_owner_id: string
          p_stat_date: string
          p_status: string
          p_total: number
        }
        Returns: undefined
      }
      validate_store_coupon: {
        Args: { p_code: string; p_owner_id: string; p_subtotal: number }
        Returns: Json
      }
      validate_store_coupon_by_slug: {
        Args: { p_code: string; p_slug: string; p_subtotal: number }
        Returns: Json
      }
      verify_order_for_meta_conversion: {
        Args: {
          p_expected_total: number
          p_order_id: string
          p_owner_id: string
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
    Enums: {},
  },
} as const

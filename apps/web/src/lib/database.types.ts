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
      account_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          created_at: string | null
          created_by: string | null
          id: string
          pinned: boolean | null
          recipient_id: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          pinned?: boolean | null
          recipient_id?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          pinned?: boolean | null
          recipient_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          checked_in_at: string
          checked_out_at: string | null
          entry_method: string
          id: string
          room_id: string | null
          seat_id: string | null
          student_id: string | null
        }
        Insert: {
          checked_in_at?: string
          checked_out_at?: string | null
          entry_method: string
          id?: string
          room_id?: string | null
          seat_id?: string | null
          student_id?: string | null
        }
        Update: {
          checked_in_at?: string
          checked_out_at?: string | null
          entry_method?: string
          id?: string
          room_id?: string | null
          seat_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_movements: {
        Row: {
          account: string
          amount_dt: number
          created_at: string
          created_by: string | null
          date: string
          id: string
          note: string | null
        }
        Insert: {
          account: string
          amount_dt: number
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          note?: string | null
        }
        Update: {
          account?: string
          amount_dt?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capital_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_transfers: {
        Row: {
          amount_dt: number
          created_at: string
          created_by: string | null
          date: string
          from_account: string
          id: string
          note: string | null
          to_account: string
        }
        Insert: {
          amount_dt: number
          created_at?: string
          created_by?: string | null
          date: string
          from_account: string
          id?: string
          note?: string | null
          to_account: string
        }
        Update: {
          amount_dt?: number
          created_at?: string
          created_by?: string | null
          date?: string
          from_account?: string
          id?: string
          note?: string | null
          to_account?: string
        }
        Relationships: [
          {
            foreignKeyName: "capital_transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          actor_id: string
          amount_dt: number
          created_at: string
          id: string
          reason: string
          session_id: string
          type: string
        }
        Insert: {
          actor_id: string
          amount_dt: number
          created_at?: string
          id?: string
          reason: string
          session_id: string
          type: string
        }
        Update: {
          actor_id?: string
          amount_dt?: number
          created_at?: string
          id?: string
          reason?: string
          session_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_register_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_amount_dt: number | null
          discrepancy_dt: number | null
          expected_amount_dt: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount_dt: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount_dt?: number | null
          discrepancy_dt?: number | null
          expected_amount_dt?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_amount_dt: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount_dt?: number | null
          discrepancy_dt?: number | null
          expected_amount_dt?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount_dt?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      celebration_events: {
        Row: {
          celebrated_at: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          points: number
          student_id: string
        }
        Insert: {
          celebrated_at?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          points?: number
          student_id: string
        }
        Update: {
          celebrated_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          points?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "celebration_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_metrics: {
        Row: {
          created_at: string
          id: string
          is_dashboard_visible: boolean
          name: string
          target_value: number | null
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_dashboard_visible?: boolean
          name: string
          target_value?: number | null
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_dashboard_visible?: boolean
          name?: string
          target_value?: number | null
          unit?: string
        }
        Relationships: []
      }
      employee_attendance: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          employee_id: string
          entry_method: string
          id: string
          updated_at: string
        }
        Insert: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_id: string
          entry_method?: string
          id?: string
          updated_at?: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_id?: string
          entry_method?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          account_category_id: string
          amount_dt: number
          created_at: string
          created_by: string
          date: string
          description: string
          employee_id: string | null
          id: string
        }
        Insert: {
          account_category_id: string
          amount_dt: number
          created_at?: string
          created_by: string
          date?: string
          description?: string
          employee_id?: string | null
          id?: string
        }
        Update: {
          account_category_id?: string
          amount_dt?: number
          created_at?: string
          created_by?: string
          date?: string
          description?: string
          employee_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_category_id_fkey"
            columns: ["account_category_id"]
            isOneToOne: false
            referencedRelation: "account_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_awards: {
        Row: {
          category: string
          created_at: string
          id: string
          month: string
          points: number
          rank: number
          student_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          month: string
          points: number
          rank: number
          student_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          month?: string
          points?: number
          rank?: number
          student_id?: string
        }
        Relationships: []
      }
      leaderboard_config: {
        Row: {
          category: string
          emoji: string
          enabled: boolean
          label: string
          points_1: number
          points_2: number
          points_3: number
          sort_order: number
        }
        Insert: {
          category: string
          emoji: string
          enabled?: boolean
          label: string
          points_1?: number
          points_2?: number
          points_3?: number
          sort_order?: number
        }
        Update: {
          category?: string
          emoji?: string
          enabled?: boolean
          label?: string
          points_1?: number
          points_2?: number
          points_3?: number
          sort_order?: number
        }
        Relationships: []
      }
      locker_payments: {
        Row: {
          amount_dt: number
          created_at: string
          created_by: string
          id: string
          locker_id: string | null
          student_id: string | null
          subscription_id: string | null
        }
        Insert: {
          amount_dt: number
          created_at?: string
          created_by: string
          id?: string
          locker_id?: string | null
          student_id?: string | null
          subscription_id?: string | null
        }
        Update: {
          amount_dt?: number
          created_at?: string
          created_by?: string
          id?: string
          locker_id?: string | null
          student_id?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locker_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_payments_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      lockers: {
        Row: {
          assigned_student_id: string | null
          assigned_subscription_id: string | null
          created_at: string
          id: string
          is_unavailable: boolean
          number: number
          updated_at: string
        }
        Insert: {
          assigned_student_id?: string | null
          assigned_subscription_id?: string | null
          created_at?: string
          id?: string
          is_unavailable?: boolean
          number: number
          updated_at?: string
        }
        Update: {
          assigned_student_id?: string | null
          assigned_subscription_id?: string | null
          created_at?: string
          id?: string
          is_unavailable?: boolean
          number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lockers_assigned_student_id_fkey"
            columns: ["assigned_student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lockers_assigned_subscription_id_fkey"
            columns: ["assigned_subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_ledger: {
        Row: {
          created_at: string
          id: string
          points_delta: number
          reason: string
          ref_id: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_delta: number
          reason: string
          ref_id?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_delta?: number
          reason?: string
          ref_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_ledger_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_redemption_requests: {
        Row: {
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          points_used: number
          rule_id: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          points_used: number
          rule_id: string
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          points_used?: number
          rule_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_redemption_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemption_requests_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemption_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          points_threshold: number
          redemption_cost_dt: number
          reward_type: string
          reward_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          points_threshold: number
          redemption_cost_dt?: number
          reward_type: string
          reward_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          points_threshold?: number
          redemption_cost_dt?: number
          reward_type?: string
          reward_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      notification_channel_config: {
        Row: {
          channel: string
          id: string
          is_enabled: boolean
          notification_type: string
          updated_at: string
        }
        Insert: {
          channel: string
          id?: string
          is_enabled?: boolean
          notification_type: string
          updated_at?: string
        }
        Update: {
          channel?: string
          id?: string
          is_enabled?: boolean
          notification_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          announcement_id: string | null
          created_at: string
          id: string
          important_until: string | null
          is_important: boolean
          is_read: boolean
          link: string | null
          message: string
          student_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          announcement_id?: string | null
          created_at?: string
          id?: string
          important_until?: string | null
          is_important?: boolean
          is_read?: boolean
          link?: string | null
          message: string
          student_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          announcement_id?: string | null
          created_at?: string
          id?: string
          important_until?: string | null
          is_important?: boolean
          is_read?: boolean
          link?: string | null
          message?: string
          student_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_activity_log: {
        Row: {
          action: string
          actor_id: string
          amount_dt: number | null
          created_at: string
          details: Json | null
          id: string
          product_id: string | null
          quantity: number | null
          subscription_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          amount_dt?: number | null
          created_at?: string
          details?: Json | null
          id?: string
          product_id?: string | null
          quantity?: number | null
          subscription_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          amount_dt?: number | null
          created_at?: string
          details?: Json | null
          id?: string
          product_id?: string | null
          quantity?: number | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_activity_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_activity_log_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          account_category_id: string
          barcode: string | null
          category: string
          cost_price: number | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price_dt: number
          sort_order: number
          stock_quantity: number
          supplier: string | null
        }
        Insert: {
          account_category_id?: string
          barcode?: string | null
          category?: string
          cost_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price_dt: number
          sort_order?: number
          stock_quantity?: number
          supplier?: string | null
        }
        Update: {
          account_category_id?: string
          barcode?: string | null
          category?: string
          cost_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price_dt?: number
          sort_order?: number
          stock_quantity?: number
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_account_category_id_fkey"
            columns: ["account_category_id"]
            isOneToOne: false
            referencedRelation: "account_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          credentials_set: boolean
          full_name: string
          id: string
          is_archived: boolean
          leaderboard_opt_out: boolean
          phone: string | null
          qr_token: string | null
          role: string
          student_number: number
          study_level: string | null
          token_version: number
          university: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials_set?: boolean
          full_name?: string
          id: string
          is_archived?: boolean
          leaderboard_opt_out?: boolean
          phone?: string | null
          qr_token?: string | null
          role?: string
          student_number?: never
          study_level?: string | null
          token_version?: number
          university?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials_set?: boolean
          full_name?: string
          id?: string
          is_archived?: boolean
          leaderboard_opt_out?: boolean
          phone?: string | null
          qr_token?: string | null
          role?: string
          student_number?: never
          study_level?: string | null
          token_version?: number
          university?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_id: string
          quantity: number
          unit_price_dt: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_id: string
          quantity: number
          unit_price_dt: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          unit_price_dt?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          discount_dt: number
          id: string
          sold_by: string
          student_id: string | null
          total_dt: number
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          discount_dt?: number
          id?: string
          sold_by: string
          student_id?: string | null
          total_dt: number
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          discount_dt?: number
          id?: string
          sold_by?: string
          student_id?: string | null
          total_dt?: number
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_sold_by_fkey"
            columns: ["sold_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          expires_at: string
          id: string
          is_priority: boolean
          queue_position: number | null
          reserved_at: string
          seat_id: string
          status: string
          student_id: string
        }
        Insert: {
          expires_at: string
          id?: string
          is_priority?: boolean
          queue_position?: number | null
          reserved_at?: string
          seat_id: string
          status?: string
          student_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          is_priority?: boolean
          queue_position?: number | null
          reserved_at?: string
          seat_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          id: string
          name: string
          shape_height: number | null
          shape_width: number | null
          shape_x: number | null
          shape_y: number | null
          status: string
          status_note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          shape_height?: number | null
          shape_width?: number | null
          shape_x?: number | null
          shape_y?: number | null
          status?: string
          status_note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          shape_height?: number | null
          shape_width?: number | null
          shape_x?: number | null
          shape_y?: number | null
          status?: string
          status_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seat_swap_requests: {
        Row: {
          attendance_id: string
          created_at: string
          from_seat_id: string | null
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          student_id: string
          to_seat_id: string
        }
        Insert: {
          attendance_id: string
          created_at?: string
          from_seat_id?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          student_id: string
          to_seat_id: string
        }
        Update: {
          attendance_id?: string
          created_at?: string
          from_seat_id?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          student_id?: string
          to_seat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seat_swap_requests_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_swap_requests_from_seat_id_fkey"
            columns: ["from_seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_swap_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_swap_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_swap_requests_to_seat_id_fkey"
            columns: ["to_seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
        ]
      }
      seats: {
        Row: {
          created_at: string
          id: string
          label: string
          position_x: number
          position_y: number
          room_id: string
          rotation: number
          status: string
          table_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          position_x?: number
          position_y?: number
          room_id: string
          rotation?: number
          status?: string
          table_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          position_x?: number
          position_y?: number
          room_id?: string
          rotation?: number
          status?: string
          table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seats_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seats_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      weekly_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          employee_id: string
          end_time: string
          id: string
          notes: string | null
          role: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          employee_id: string
          end_time: string
          id?: string
          notes?: string | null
          role?: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          employee_id?: string
          end_time?: string
          id?: string
          notes?: string | null
          role?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_activity_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          id: string
          plan_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          id?: string
          plan_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plan_activity_log_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          duration_days: number
          id: string
          is_active: boolean
          name: string
          price_dt: number
          tax_rate_pct: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_days: number
          id?: string
          is_active?: boolean
          name: string
          price_dt: number
          tax_rate_pct?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          price_dt?: number
          tax_rate_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          end_date: string
          id: string
          paid_amount: number
          plan_id: string
          sold_by: string
          start_date: string
          student_id: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string
          id?: string
          paid_amount: number
          plan_id: string
          sold_by: string
          start_date?: string
          student_id: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          paid_amount?: number
          plan_id?: string
          sold_by?: string
          start_date?: string
          student_id?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_sold_by_fkey"
            columns: ["sold_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          created_at: string
          height: number
          id: string
          label: string
          position_x: number
          position_y: number
          room_id: string
          rotation: number
          status: string
          table_type: string | null
          width: number
        }
        Insert: {
          created_at?: string
          height?: number
          id?: string
          label?: string
          position_x?: number
          position_y?: number
          room_id: string
          rotation?: number
          status?: string
          table_type?: string | null
          width?: number
        }
        Update: {
          created_at?: string
          height?: number
          id?: string
          label?: string
          position_x?: number
          position_y?: number
          room_id?: string
          rotation?: number
          status?: string
          table_type?: string | null
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "tables_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      analytics_capital_totals: {
        Args: never
        Returns: {
          subs: number
          pos: number
          lockers: number
          expenses: number
        }[]
      }
      analytics_cogs: {
        Args: { p_from: string; p_to: string }
        Returns: {
          cogs: number
          discounts: number
          missing_cost_products: number
          revenue: number
        }[]
      }
      analytics_plan_popularity: {
        Args: never
        Returns: {
          plan_name: string
          sold: number
          revenue: number
        }[]
      }
      analytics_subscription_status: {
        Args: { p_as_of: string; p_soon_days?: number }
        Returns: {
          active: number
          expiring_soon: number
          expired: number
        }[]
      }
      analytics_peak_hours: {
        Args: { p_from: string; p_to: string }
        Returns: {
          hour: number
          visits: number
          weekday: number
        }[]
      }
      analytics_product_margin: {
        Args: { p_from: string; p_to: string }
        Returns: {
          cogs: number
          cost_missing: boolean
          margin: number
          product_id: string
          product_name: string
          quantity_sold: number
          revenue: number
        }[]
      }
      current_user_role: { Args: never; Returns: string }
      default_sales_account_category_id: { Args: never; Returns: string }
      expire_stale_reservations: { Args: never; Returns: undefined }
      get_leaderboard: {
        Args: { p_month: string }
        Returns: {
          category: string
          emoji: string
          full_name: string | null
          label: string
          rank: number
          student_id: string
          value: number
        }[]
      }
      mark_my_celebrations_seen: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_my_leaderboard_rank: {
        Args: { p_month: string }
        Returns: {
          category: string
          rank: number | null
          value: number
        }[]
      }
      fulfil_redemption: {
        Args: { p_request_id: string }
        Returns: Json
      }
      request_redemption: {
        Args: { p_rule_id: string }
        Returns: Json
      }
      reject_redemption_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      cancel_redemption_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      pos_add_cash_movement: {
        Args: { p_amount: number; p_reason: string; p_session_id: string; p_type: string }
        Returns: {
          actor_id: string
          amount_dt: number
          created_at: string
          id: string
          reason: string
          session_id: string
          type: string
        }[]
      }
      pos_checkout: {
        Args: { p_items: Json; p_student_id: string }
        Returns: Json
      }
      pos_employee_charge: {
        Args: { p_items: Json; p_employee_id: string | null }
        Returns: Json
      }
      pos_close_session: {
        Args: { p_closing_amount: number; p_notes: string | null; p_session_id: string }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          closing_amount_dt: number | null
          discrepancy_dt: number | null
          expected_amount_dt: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount_dt: number
          status: string
        }[]
      }
      pos_open_session: {
        Args: { p_opening_amount: number }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          closing_amount_dt: number | null
          discrepancy_dt: number | null
          expected_amount_dt: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount_dt: number
          status: string
        }[]
      }
      pos_edit_purchase_item: {
        Args: { p_item_id: string; p_product_id: string; p_quantity: number }
        Returns: Json
      }
      pos_edit_subscription: {
        Args: { p_plan_id: string; p_subscription_id: string }
        Returns: Json
      }
      pos_restock: {
        Args: {
          p_cost_price: number
          p_product_id: string
          p_quantity: number
          p_tax_rate_pct?: number
        }
        Returns: Json
      }
      pos_void_charge: {
        Args: { p_activity_log_id: string }
        Returns: Json
      }
      pos_void_purchase: {
        Args: { p_purchase_id: string }
        Returns: Json
      }
      pos_void_subscription: {
        Args: { p_subscription_id: string }
        Returns: Json
      }
      shift_queue_positions_down: {
        Args: { from_position: number }
        Returns: undefined
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

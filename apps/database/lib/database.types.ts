Connecting to db 5432
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      account_categories: {
        Row: {
          cost_behavior: Database["public"]["Enums"]["cost_behavior"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          tax_rate_pct: number
          type: string
        }
        Insert: {
          cost_behavior?: Database["public"]["Enums"]["cost_behavior"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tax_rate_pct?: number
          type: string
        }
        Update: {
          cost_behavior?: Database["public"]["Enums"]["cost_behavior"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tax_rate_pct?: number
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
            foreignKeyName: "attendance_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          account_category_id: string
          amount_dt: number
          created_at: string
          created_by: string
          id: string
          month: string
          note: string | null
          updated_at: string
        }
        Insert: {
          account_category_id: string
          amount_dt: number
          created_at?: string
          created_by: string
          id?: string
          month: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          account_category_id?: string
          amount_dt?: number
          created_at?: string
          created_by?: string
          id?: string
          month?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_account_category_id_fkey"
            columns: ["account_category_id"]
            isOneToOne: false
            referencedRelation: "account_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_movements: {
        Row: {
          account: Database["public"]["Enums"]["capital_account"]
          amount_dt: number
          created_at: string
          created_by: string | null
          date: string
          id: string
          note: string | null
        }
        Insert: {
          account: Database["public"]["Enums"]["capital_account"]
          amount_dt: number
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          note?: string | null
        }
        Update: {
          account?: Database["public"]["Enums"]["capital_account"]
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
          from_account: Database["public"]["Enums"]["capital_account"]
          id: string
          note: string | null
          to_account: Database["public"]["Enums"]["capital_account"]
        }
        Insert: {
          amount_dt: number
          created_at?: string
          created_by?: string | null
          date: string
          from_account: Database["public"]["Enums"]["capital_account"]
          id?: string
          note?: string | null
          to_account: Database["public"]["Enums"]["capital_account"]
        }
        Update: {
          amount_dt?: number
          created_at?: string
          created_by?: string | null
          date?: string
          from_account?: Database["public"]["Enums"]["capital_account"]
          id?: string
          note?: string | null
          to_account?: Database["public"]["Enums"]["capital_account"]
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
          recurring_expense_id: string | null
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
          recurring_expense_id?: string | null
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
          recurring_expense_id?: string | null
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
          {
            foreignKeyName: "expenses_recurring_expense_id_fkey"
            columns: ["recurring_expense_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_audit_log: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          operation: string
          record_id: string
          table_name: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          operation: string
          record_id: string
          table_name: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          operation?: string
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_period_locks: {
        Row: {
          locked_at: string
          locked_by: string
          month: string
          note: string | null
        }
        Insert: {
          locked_at?: string
          locked_by: string
          month: string
          note?: string | null
        }
        Update: {
          locked_at?: string
          locked_by?: string
          month?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_period_locks_locked_by_fkey"
            columns: ["locked_by"]
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
        Relationships: [
          {
            foreignKeyName: "leaderboard_awards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          tax_rate_pct: number
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
          tax_rate_pct?: number
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
          tax_rate_pct?: number
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
          avatar_url: string | null
          created_at: string
          credentials_set: boolean
          full_name: string
          hourly_rate_dt: number | null
          id: string
          is_archived: boolean
          leaderboard_opt_out: boolean
          monthly_salary_dt: number | null
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
          avatar_url?: string | null
          created_at?: string
          credentials_set?: boolean
          full_name?: string
          hourly_rate_dt?: number | null
          id: string
          is_archived?: boolean
          leaderboard_opt_out?: boolean
          monthly_salary_dt?: number | null
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
          avatar_url?: string | null
          created_at?: string
          credentials_set?: boolean
          full_name?: string
          hourly_rate_dt?: number | null
          id?: string
          is_archived?: boolean
          leaderboard_opt_out?: boolean
          monthly_salary_dt?: number | null
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
      recurring_expenses: {
        Row: {
          account_category_id: string
          amount_dt: number
          created_at: string
          created_by: string
          day_of_month: number
          description: string
          ends_on: string | null
          frequency: string
          id: string
          is_active: boolean
          starts_on: string
        }
        Insert: {
          account_category_id: string
          amount_dt: number
          created_at?: string
          created_by: string
          day_of_month?: number
          description: string
          ends_on?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          starts_on: string
        }
        Update: {
          account_category_id?: string
          amount_dt?: number
          created_at?: string
          created_by?: string
          day_of_month?: number
          description?: string
          ends_on?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_account_category_id_fkey"
            columns: ["account_category_id"]
            isOneToOne: false
            referencedRelation: "account_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_dt: number
          created_at: string
          created_by: string
          id: string
          locker_payment_id: string | null
          purchase_id: string | null
          reason: string
          restocked: boolean
          source: Database["public"]["Enums"]["refund_source"]
          subscription_id: string | null
        }
        Insert: {
          amount_dt: number
          created_at?: string
          created_by: string
          id?: string
          locker_payment_id?: string | null
          purchase_id?: string | null
          reason: string
          restocked?: boolean
          source: Database["public"]["Enums"]["refund_source"]
          subscription_id?: string | null
        }
        Update: {
          amount_dt?: number
          created_at?: string
          created_by?: string
          id?: string
          locker_payment_id?: string | null
          purchase_id?: string | null
          reason?: string
          restocked?: boolean
          source?: Database["public"]["Enums"]["refund_source"]
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_locker_payment_id_fkey"
            columns: ["locker_payment_id"]
            isOneToOne: false
            referencedRelation: "locker_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
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
          table_type: string
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
          table_type?: string
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
          table_type?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _leaderboard_metrics: {
        Args: { p_month: string }
        Returns: {
          category: string
          full_name: string
          student_id: string
          value: number
        }[]
      }
      analytics_basket: {
        Args: { p_from: string; p_to: string }
        Returns: {
          attach_rate_pct: number
          avg_basket_dt: number
          avg_items_per_basket: number
          discount_rate_pct: number
          discount_total_dt: number
          discounted_baskets: number
          transactions: number
        }[]
      }
      analytics_breakeven: {
        Args: { p_from: string; p_to: string }
        Returns: {
          breakeven_revenue_dt: number
          contribution_margin_dt: number
          contribution_margin_pct: number
          fixed_cost_dt: number
          margin_of_safety_pct: number
          revenue_dt: number
          variable_cost_dt: number
        }[]
      }
      analytics_budget_variance: {
        Args: { p_month: string }
        Returns: {
          actual_dt: number
          budget_dt: number
          category_id: string
          category_name: string
          consumed_pct: number
          variance_dt: number
        }[]
      }
      analytics_capital_totals: {
        Args: never
        Returns: {
          expenses: number
          lockers: number
          pos: number
          refunds: number
          subs: number
        }[]
      }
      analytics_churn: {
        Args: { p_from: string; p_to: string }
        Returns: {
          avg_lifetime_days: number
          churn_rate_pct: number
          churned: number
          cohort: number
          ltv: number
          renewal_rate_pct: number
          renewed: number
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
      analytics_dead_stock: {
        Args: { p_days?: number }
        Returns: {
          last_sold_at: string
          product_id: string
          product_name: string
          stock_quantity: number
          tied_up_dt: number
        }[]
      }
      analytics_inventory_valuation: {
        Args: never
        Returns: {
          inventory_value_dt: number
          missing_cost_count: number
          retail_value_dt: number
          sku_count: number
          units_on_hand: number
        }[]
      }
      analytics_labor: {
        Args: { p_from: string; p_to: string }
        Returns: {
          hourly_cost_dt: number
          hours_worked: number
          salaried_cost_dt: number
          staff_counted: number
          staff_unrated: number
          total_cost_dt: number
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
      analytics_plan_popularity: {
        Args: never
        Returns: {
          plan_name: string
          revenue: number
          sold: number
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
      analytics_recognized_revenue: {
        Args: { p_from: string; p_to: string }
        Returns: {
          cash_collected: number
          recognized: number
        }[]
      }
      analytics_recurring_revenue: {
        Args: { p_as_of: string }
        Returns: {
          active_members: number
          arpu: number
          arr: number
          deferred_revenue: number
          mrr: number
          revenue_at_risk_30: number
        }[]
      }
      analytics_refunds: {
        Args: { p_from: string; p_to: string }
        Returns: {
          lockers: number
          pos: number
          refund_count: number
          subs: number
          total: number
        }[]
      }
      analytics_runway: {
        Args: { p_months?: number }
        Returns: {
          avg_monthly_inflow: number
          avg_monthly_outflow: number
          net_burn_dt: number
          runway_months: number
        }[]
      }
      analytics_subscription_status: {
        Args: { p_as_of: string; p_soon_days?: number }
        Returns: {
          active: number
          expired: number
          expiring_soon: number
        }[]
      }
      analytics_tva: {
        Args: { p_from: string; p_to: string }
        Returns: {
          revenue_ht: number
          revenue_ttc: number
          tva_collected: number
          tva_deductible: number
          tva_net_payable: number
        }[]
      }
      avg_days_per_month: { Args: never; Returns: number }
      award_monthly_leaderboard: { Args: never; Returns: undefined }
      cancel_redemption_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      current_user_role: { Args: never; Returns: string }
      default_sales_account_category_id: { Args: never; Returns: string }
      expire_stale_reservations: { Args: never; Returns: undefined }
      fulfil_redemption: { Args: { p_request_id: string }; Returns: Json }
      get_leaderboard: {
        Args: { p_month: string }
        Returns: {
          category: string
          emoji: string
          full_name: string
          label: string
          rank: number
          student_id: string
          value: number
        }[]
      }
      get_my_leaderboard_rank: {
        Args: { p_month: string }
        Returns: {
          category: string
          rank: number
          value: number
        }[]
      }
      ht_of_ttc: {
        Args: { p_amount: number; p_rate_pct: number }
        Returns: number
      }
      is_period_locked: { Args: { p_date: string }; Returns: boolean }
      mark_my_celebrations_seen: { Args: never; Returns: undefined }
      materialise_recurring_expenses: {
        Args: { p_through?: string }
        Returns: number
      }
      pos_add_cash_movement: {
        Args: {
          p_amount: number
          p_reason: string
          p_session_id: string
          p_type: string
        }
        Returns: {
          actor_id: string
          amount_dt: number
          created_at: string
          id: string
          reason: string
          session_id: string
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pos_checkout:
        | { Args: { p_items: Json; p_student_id: string }; Returns: Json }
        | {
            Args: {
              p_discount_dt?: number
              p_items: Json
              p_student_id: string
            }
            Returns: Json
          }
      pos_close_session: {
        Args: {
          p_closing_amount: number
          p_notes: string
          p_session_id: string
        }
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
        }
        SetofOptions: {
          from: "*"
          to: "cash_register_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pos_edit_purchase_item: {
        Args: { p_item_id: string; p_product_id: string; p_quantity: number }
        Returns: Json
      }
      pos_edit_subscription: {
        Args: { p_plan_id: string; p_subscription_id: string }
        Returns: Json
      }
      pos_employee_charge: {
        Args: { p_employee_id?: string; p_items: Json }
        Returns: Json
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
        }
        SetofOptions: {
          from: "*"
          to: "cash_register_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
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
      pos_void_charge: { Args: { p_activity_log_id: string }; Returns: Json }
      pos_void_purchase: { Args: { p_purchase_id: string }; Returns: Json }
      pos_void_subscription: {
        Args: { p_subscription_id: string }
        Returns: Json
      }
      refund_locker_payment: {
        Args: {
          p_amount: number
          p_locker_payment_id: string
          p_reason: string
        }
        Returns: {
          amount_dt: number
          created_at: string
          created_by: string
          id: string
          locker_payment_id: string | null
          purchase_id: string | null
          reason: string
          restocked: boolean
          source: Database["public"]["Enums"]["refund_source"]
          subscription_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refund_purchase: {
        Args: {
          p_amount: number
          p_purchase_id: string
          p_reason: string
          p_restock?: boolean
        }
        Returns: {
          amount_dt: number
          created_at: string
          created_by: string
          id: string
          locker_payment_id: string | null
          purchase_id: string | null
          reason: string
          restocked: boolean
          source: Database["public"]["Enums"]["refund_source"]
          subscription_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refund_subscription: {
        Args: {
          p_amount: number
          p_end_now?: boolean
          p_reason: string
          p_subscription_id: string
        }
        Returns: {
          amount_dt: number
          created_at: string
          created_by: string
          id: string
          locker_payment_id: string | null
          purchase_id: string | null
          reason: string
          restocked: boolean
          source: Database["public"]["Enums"]["refund_source"]
          subscription_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "refunds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refunded_total: {
        Args: {
          p_id: string
          p_source: Database["public"]["Enums"]["refund_source"]
        }
        Returns: number
      }
      reject_redemption_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      request_redemption: { Args: { p_rule_id: string }; Returns: Json }
      run_daily_reset: { Args: never; Returns: undefined }
      shift_queue_positions_down: {
        Args: { from_position: number }
        Returns: undefined
      }
      tva_of_ttc: {
        Args: { p_amount: number; p_rate_pct: number }
        Returns: number
      }
    }
    Enums: {
      capital_account: "cash" | "bank"
      cost_behavior: "fixed" | "variable"
      refund_source: "purchase" | "subscription" | "locker_payment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
    Enums: {
      capital_account: ["cash", "bank"],
      cost_behavior: ["fixed", "variable"],
      refund_source: ["purchase", "subscription", "locker_payment"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

<claude-code-hint v="1" type="plugin" value="supabase@claude-plugins-official" />
A new version of Supabase CLI is available: v2.109.1 (currently installed v2.98.2)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admin_audit_events: {
        Row: {
          action: Database["public"]["Enums"]["admin_audit_action"];
          actor_id: string;
          after_state: NonNullable<Json>;
          before_state: NonNullable<Json>;
          created_at: string;
          id: string;
          request_id: string;
          target_user_id: string;
        };
        Insert: {
          action: Database["public"]["Enums"]["admin_audit_action"];
          actor_id: string;
          after_state: NonNullable<Json>;
          before_state?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          request_id: string;
          target_user_id: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["admin_audit_action"];
          actor_id?: string;
          after_state?: NonNullable<Json>;
          before_state?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          request_id?: string;
          target_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_audit_events_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cutting_orders: {
        Row: {
          actual_fabric_yds: number;
          approval_decision:
            Database["public"]["Enums"]["verification_decision"] | null;
          approved_log_id: string | null;
          created_at: string;
          created_by: string;
          current_attempt_id: string | null;
          fabric_roll_id: string;
          first_submitted_at: string | null;
          id: string;
          order_no: string;
          recipe_id: string;
          revision: number;
          sewing_started_at: string | null;
          started_by: string | null;
          status: Database["public"]["Enums"]["production_status"];
          target_qty: number;
          updated_at: string;
        };
        Insert: {
          actual_fabric_yds: number;
          approval_decision?: never;
          approved_log_id?: string | null;
          created_at?: string;
          created_by: string;
          current_attempt_id?: string | null;
          fabric_roll_id: string;
          first_submitted_at?: string | null;
          id?: string;
          order_no?: string;
          recipe_id: string;
          revision?: number;
          sewing_started_at?: string | null;
          started_by?: string | null;
          status?: Database["public"]["Enums"]["production_status"];
          target_qty: number;
          updated_at?: string;
        };
        Update: {
          actual_fabric_yds?: number;
          approval_decision?: never;
          approved_log_id?: string | null;
          created_at?: string;
          created_by?: string;
          current_attempt_id?: string | null;
          fabric_roll_id?: string;
          first_submitted_at?: string | null;
          id?: string;
          order_no?: string;
          recipe_id?: string;
          revision?: number;
          sewing_started_at?: string | null;
          started_by?: string | null;
          status?: Database["public"]["Enums"]["production_status"];
          target_qty?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cutting_orders_approved_log_fk";
            columns: ["approved_log_id", "id", "approval_decision"];
            isOneToOne: false;
            referencedRelation: "verification_evidence";
            referencedColumns: ["id", "order_id", "decision"];
          },
          {
            foreignKeyName: "cutting_orders_approved_log_fk";
            columns: ["approved_log_id", "id", "approval_decision"];
            isOneToOne: false;
            referencedRelation: "verification_logs";
            referencedColumns: ["id", "order_id", "decision"];
          },
          {
            foreignKeyName: "cutting_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cutting_orders_current_attempt_fk";
            columns: ["current_attempt_id", "id"];
            isOneToOne: false;
            referencedRelation: "verification_attempts";
            referencedColumns: ["id", "order_id"];
          },
          {
            foreignKeyName: "cutting_orders_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cutting_orders_started_by_fkey";
            columns: ["started_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_components: {
        Row: {
          component_id: string;
          component_name_snapshot: string;
          created_at: string;
          expected_qty: number;
          id: string;
          order_id: string;
          pieces_per_garment: number;
          recipe_id: string;
          sort_order: number;
        };
        Insert: {
          component_id: string;
          component_name_snapshot: string;
          created_at?: string;
          expected_qty: number;
          id?: string;
          order_id: string;
          pieces_per_garment: number;
          recipe_id: string;
          sort_order: number;
        };
        Update: {
          component_id?: string;
          component_name_snapshot?: string;
          created_at?: string;
          expected_qty?: number;
          id?: string;
          order_id?: string;
          pieces_per_garment?: number;
          recipe_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_components_component_id_recipe_id_fkey";
            columns: ["component_id", "recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipe_components";
            referencedColumns: ["id", "recipe_id"];
          },
          {
            foreignKeyName: "order_components_order_id_recipe_id_fkey";
            columns: ["order_id", "recipe_id"];
            isOneToOne: false;
            referencedRelation: "cutting_orders";
            referencedColumns: ["id", "recipe_id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          revision: number;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          revision?: number;
          role: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          revision?: number;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      recipe_components: {
        Row: {
          component_name: string;
          created_at: string;
          id: string;
          image_url: string | null;
          pieces_per_garment: number;
          recipe_id: string;
          sort_order: number;
        };
        Insert: {
          component_name: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          pieces_per_garment: number;
          recipe_id: string;
          sort_order: number;
        };
        Update: {
          component_name?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          pieces_per_garment?: number;
          recipe_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_components_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          name: string;
          recipe_code: string;
          std_fabric_yards: number;
          wastage_cap_pct: number;
        };
        Insert: {
          category: string;
          created_at?: string;
          id?: string;
          name: string;
          recipe_code: string;
          std_fabric_yards: number;
          wastage_cap_pct: number;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          name?: string;
          recipe_code?: string;
          std_fabric_yards?: number;
          wastage_cap_pct?: number;
        };
        Relationships: [];
      };
      verification_attempts: {
        Row: {
          actual_fabric_yds: number;
          attempt_no: number;
          closed_at: string | null;
          expected_fabric_yds: number;
          fabric_roll_id_snapshot: string;
          id: string;
          order_id: string;
          recipe_id: string;
          revision: number;
          status: Database["public"]["Enums"]["verification_attempt_status"];
          std_fabric_yards_snapshot: number;
          submitted_at: string;
          submitted_by: string;
          target_qty_snapshot: number;
          updated_at: string;
          wastage_cap_pct_snapshot: number;
        };
        Insert: {
          actual_fabric_yds: number;
          attempt_no: number;
          closed_at?: string | null;
          expected_fabric_yds: number;
          fabric_roll_id_snapshot: string;
          id?: string;
          order_id: string;
          recipe_id: string;
          revision?: number;
          status?: Database["public"]["Enums"]["verification_attempt_status"];
          std_fabric_yards_snapshot: number;
          submitted_at?: string;
          submitted_by: string;
          target_qty_snapshot: number;
          updated_at?: string;
          wastage_cap_pct_snapshot: number;
        };
        Update: {
          actual_fabric_yds?: number;
          attempt_no?: number;
          closed_at?: string | null;
          expected_fabric_yds?: number;
          fabric_roll_id_snapshot?: string;
          id?: string;
          order_id?: string;
          recipe_id?: string;
          revision?: number;
          status?: Database["public"]["Enums"]["verification_attempt_status"];
          std_fabric_yards_snapshot?: number;
          submitted_at?: string;
          submitted_by?: string;
          target_qty_snapshot?: number;
          updated_at?: string;
          wastage_cap_pct_snapshot?: number;
        };
        Relationships: [
          {
            foreignKeyName: "verification_attempts_order_id_recipe_id_fkey";
            columns: ["order_id", "recipe_id"];
            isOneToOne: false;
            referencedRelation: "cutting_orders";
            referencedColumns: ["id", "recipe_id"];
          },
          {
            foreignKeyName: "verification_attempts_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_items: {
        Row: {
          actual_qty: number | null;
          attempt_id: string;
          component_id: string;
          created_at: string;
          expected_qty: number;
          id: string;
          order_component_id: string;
          order_id: string;
          status: Database["public"]["Enums"]["component_status"] | null;
          updated_at: string;
          updated_by: string | null;
          variance_qty: number | null;
        };
        Insert: {
          actual_qty?: number | null;
          attempt_id: string;
          component_id: string;
          created_at?: string;
          expected_qty: number;
          id?: string;
          order_component_id: string;
          order_id: string;
          status?: Database["public"]["Enums"]["component_status"] | null;
          updated_at?: string;
          updated_by?: string | null;
          variance_qty?: never;
        };
        Update: {
          actual_qty?: number | null;
          attempt_id?: string;
          component_id?: string;
          created_at?: string;
          expected_qty?: number;
          id?: string;
          order_component_id?: string;
          order_id?: string;
          status?: Database["public"]["Enums"]["component_status"] | null;
          updated_at?: string;
          updated_by?: string | null;
          variance_qty?: never;
        };
        Relationships: [
          {
            foreignKeyName: "verification_items_attempt_id_order_id_fkey";
            columns: ["attempt_id", "order_id"];
            isOneToOne: false;
            referencedRelation: "verification_attempts";
            referencedColumns: ["id", "order_id"];
          },
          {
            foreignKeyName: "verification_items_order_component_id_order_id_component_i_fkey";
            columns: [
              "order_component_id",
              "order_id",
              "component_id",
              "expected_qty",
            ];
            isOneToOne: false;
            referencedRelation: "order_components";
            referencedColumns: [
              "id",
              "order_id",
              "component_id",
              "expected_qty",
            ];
          },
          {
            foreignKeyName: "verification_items_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_log_items: {
        Row: {
          actual_qty: number | null;
          attempt_id: string;
          component_id: string;
          component_name_snapshot: string;
          expected_qty: number;
          log_id: string;
          order_component_id: string;
          order_id: string;
          status: Database["public"]["Enums"]["component_status"] | null;
          variance_qty: number | null;
        };
        Insert: {
          actual_qty?: number | null;
          attempt_id: string;
          component_id: string;
          component_name_snapshot: string;
          expected_qty: number;
          log_id: string;
          order_component_id: string;
          order_id: string;
          status?: Database["public"]["Enums"]["component_status"] | null;
          variance_qty?: never;
        };
        Update: {
          actual_qty?: number | null;
          attempt_id?: string;
          component_id?: string;
          component_name_snapshot?: string;
          expected_qty?: number;
          log_id?: string;
          order_component_id?: string;
          order_id?: string;
          status?: Database["public"]["Enums"]["component_status"] | null;
          variance_qty?: never;
        };
        Relationships: [
          {
            foreignKeyName: "verification_log_items_attempt_id_order_component_id_fkey";
            columns: ["attempt_id", "order_component_id"];
            isOneToOne: false;
            referencedRelation: "verification_items";
            referencedColumns: ["attempt_id", "order_component_id"];
          },
          {
            foreignKeyName: "verification_log_items_log_id_order_id_attempt_id_fkey";
            columns: ["log_id", "order_id", "attempt_id"];
            isOneToOne: false;
            referencedRelation: "verification_evidence";
            referencedColumns: ["id", "order_id", "attempt_id"];
          },
          {
            foreignKeyName: "verification_log_items_log_id_order_id_attempt_id_fkey";
            columns: ["log_id", "order_id", "attempt_id"];
            isOneToOne: false;
            referencedRelation: "verification_logs";
            referencedColumns: ["id", "order_id", "attempt_id"];
          },
          {
            foreignKeyName: "verification_log_items_order_component_id_order_id_compone_fkey";
            columns: [
              "order_component_id",
              "order_id",
              "component_id",
              "expected_qty",
            ];
            isOneToOne: false;
            referencedRelation: "order_components";
            referencedColumns: [
              "id",
              "order_id",
              "component_id",
              "expected_qty",
            ];
          },
        ];
      };
      verification_logs: {
        Row: {
          actual_fabric_yds: number;
          attempt_id: string;
          created_at: string;
          decision: Database["public"]["Enums"]["verification_decision"];
          expected_fabric_yds: number;
          id: string;
          order_id: string;
          rejection_note: string | null;
          verifier_id: string;
          verifier_name_snapshot: string;
          verifier_role_snapshot: Database["public"]["Enums"]["app_role"];
          wastage_pct: number;
        };
        Insert: {
          actual_fabric_yds: number;
          attempt_id: string;
          created_at?: string;
          decision: Database["public"]["Enums"]["verification_decision"];
          expected_fabric_yds: number;
          id?: string;
          order_id: string;
          rejection_note?: string | null;
          verifier_id: string;
          verifier_name_snapshot: string;
          verifier_role_snapshot: Database["public"]["Enums"]["app_role"];
          wastage_pct: number;
        };
        Update: {
          actual_fabric_yds?: number;
          attempt_id?: string;
          created_at?: string;
          decision?: Database["public"]["Enums"]["verification_decision"];
          expected_fabric_yds?: number;
          id?: string;
          order_id?: string;
          rejection_note?: string | null;
          verifier_id?: string;
          verifier_name_snapshot?: string;
          verifier_role_snapshot?: Database["public"]["Enums"]["app_role"];
          wastage_pct?: number;
        };
        Relationships: [
          {
            foreignKeyName: "verification_logs_attempt_id_order_id_fkey";
            columns: ["attempt_id", "order_id"];
            isOneToOne: false;
            referencedRelation: "verification_attempts";
            referencedColumns: ["id", "order_id"];
          },
          {
            foreignKeyName: "verification_logs_verifier_id_fkey";
            columns: ["verifier_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      verification_evidence: {
        Row: {
          actual_fabric_yds: string | null;
          attempt_id: string | null;
          created_at: string | null;
          decision: Database["public"]["Enums"]["verification_decision"] | null;
          expected_fabric_yds: string | null;
          id: string | null;
          order_id: string | null;
          rejection_note: string | null;
          verifier_id: string | null;
          verifier_name_snapshot: string | null;
          wastage_pct: string | null;
        };
        Insert: {
          actual_fabric_yds?: never;
          attempt_id?: string | null;
          created_at?: string | null;
          decision?:
            Database["public"]["Enums"]["verification_decision"] | null;
          expected_fabric_yds?: never;
          id?: string | null;
          order_id?: string | null;
          rejection_note?: string | null;
          verifier_id?: string | null;
          verifier_name_snapshot?: string | null;
          wastage_pct?: never;
        };
        Update: {
          actual_fabric_yds?: never;
          attempt_id?: string | null;
          created_at?: string | null;
          decision?:
            Database["public"]["Enums"]["verification_decision"] | null;
          expected_fabric_yds?: never;
          id?: string | null;
          order_id?: string | null;
          rejection_note?: string | null;
          verifier_id?: string | null;
          verifier_name_snapshot?: string | null;
          wastage_pct?: never;
        };
        Relationships: [
          {
            foreignKeyName: "verification_logs_attempt_id_order_id_fkey";
            columns: ["attempt_id", "order_id"];
            isOneToOne: false;
            referencedRelation: "verification_attempts";
            referencedColumns: ["id", "order_id"];
          },
          {
            foreignKeyName: "verification_logs_verifier_id_fkey";
            columns: ["verifier_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      admin_create_profile: {
        Args: {
          p_actor_id: string;
          p_full_name: string;
          p_request_id: string;
          p_role: Database["public"]["Enums"]["app_role"];
          p_user_id: string;
        };
        Returns: Json;
      };
      admin_list_audit: {
        Args: {
          p_actor_id: string;
          p_cursor_id?: string;
          p_cursor_time?: string;
          p_limit?: number;
        };
        Returns: Json;
      };
      admin_list_users: {
        Args: {
          p_active?: boolean;
          p_actor_id: string;
          p_cursor_id?: string;
          p_cursor_time?: string;
          p_limit?: number;
          p_role?: Database["public"]["Enums"]["app_role"];
          p_search?: string;
        };
        Returns: Json;
      };
      admin_update_profile: {
        Args: {
          p_active?: boolean;
          p_actor_id: string;
          p_expected_revision: number;
          p_request_id?: string;
          p_role?: Database["public"]["Enums"]["app_role"];
          p_user_id: string;
        };
        Returns: Json;
      };
      cutting_create: {
        Args: {
          p_actor_id: string;
          p_actual_fabric: number;
          p_fabric_roll_id: string;
          p_recipe_id: string;
          p_target_qty: number;
        };
        Returns: string;
      };
      cutting_edit: {
        Args: {
          p_actor_id: string;
          p_actual_fabric?: number;
          p_fabric_roll_id?: string;
          p_order_id: string;
          p_recipe_id?: string;
          p_revision: number;
          p_target_qty?: number;
        };
        Returns: string;
      };
      cutting_recut: {
        Args: { p_actor_id: string; p_order_id: string; p_revision: number };
        Returns: string;
      };
      cutting_submit: {
        Args: { p_actor_id: string; p_order_id: string; p_revision: number };
        Returns: string;
      };
      verification_approve: {
        Args: {
          p_actor_id: string;
          p_attempt_id: string;
          p_order_id: string;
          p_revision: number;
        };
        Returns: string;
      };
      verification_reject: {
        Args: {
          p_actor_id: string;
          p_attempt_id: string;
          p_order_id: string;
          p_reason: string;
          p_revision: number;
        };
        Returns: string;
      };
      verification_save: {
        Args: {
          p_actor_id: string;
          p_attempt_id: string;
          p_items: Json;
          p_order_id: string;
          p_revision: number;
        };
        Returns: string;
      };
    };
    Enums: {
      admin_audit_action:
        | "USER_CREATED"
        | "USER_ROLE_CHANGED"
        | "USER_ACTIVATED"
        | "USER_DEACTIVATED";
      app_role:
        | "system_admin"
        | "cutting_supervisor"
        | "cutting_verifier"
        | "sewing_supervisor";
      component_status: "GREEN" | "YELLOW" | "RED";
      production_status:
        | "CUTTING_IN_PROGRESS"
        | "PENDING_VERIFICATION"
        | "REJECTED"
        | "VERIFIED";
      verification_attempt_status: "OPEN" | "APPROVED" | "REJECTED";
      verification_decision: "APPROVED" | "REJECTED";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      admin_audit_action: [
        "USER_CREATED",
        "USER_ROLE_CHANGED",
        "USER_ACTIVATED",
        "USER_DEACTIVATED",
      ],
      app_role: [
        "system_admin",
        "cutting_supervisor",
        "cutting_verifier",
        "sewing_supervisor",
      ],
      component_status: ["GREEN", "YELLOW", "RED"],
      production_status: [
        "CUTTING_IN_PROGRESS",
        "PENDING_VERIFICATION",
        "REJECTED",
        "VERIFIED",
      ],
      verification_attempt_status: ["OPEN", "APPROVED", "REJECTED"],
      verification_decision: ["APPROVED", "REJECTED"],
    },
  },
} as const;

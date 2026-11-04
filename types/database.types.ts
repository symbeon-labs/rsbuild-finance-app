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
      attestations: {
        Row: {
          attested_at: string | null
          contract_version: string
          created_at: string
          event_hash: string
          evidence_record_id: string
          id: string
          issuer: string | null
          organization_id: string
          protocol: string
          registry_reference: string | null
          response_metadata: Json
          signature_reference: string | null
          status: Database["public"]["Enums"]["rsbuild_attestation_status"]
        }
        Insert: {
          attested_at?: string | null
          contract_version: string
          created_at?: string
          event_hash: string
          evidence_record_id: string
          id?: string
          issuer?: string | null
          organization_id: string
          protocol?: string
          registry_reference?: string | null
          response_metadata?: Json
          signature_reference?: string | null
          status?: Database["public"]["Enums"]["rsbuild_attestation_status"]
        }
        Update: {
          attested_at?: string | null
          contract_version?: string
          created_at?: string
          event_hash?: string
          evidence_record_id?: string
          id?: string
          issuer?: string | null
          organization_id?: string
          protocol?: string
          registry_reference?: string | null
          response_metadata?: Json
          signature_reference?: string | null
          status?: Database["public"]["Enums"]["rsbuild_attestation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "attestations_organization_id_evidence_record_id_fkey"
            columns: ["organization_id", "evidence_record_id"]
            isOneToOne: false
            referencedRelation: "evidence_records"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "attestations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_id: string | null
          correlation_id: string | null
          entity_id: string | null
          entity_type: string
          event_type: string
          id: number
          metadata: Json
          occurred_at: string
          organization_id: string
        }
        Insert: {
          actor_id?: string | null
          correlation_id?: string | null
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: never
          metadata?: Json
          occurred_at?: string
          organization_id: string
        }
        Update: {
          actor_id?: string | null
          correlation_id?: string | null
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: never
          metadata?: Json
          occurred_at?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          configuration: Json
          created_at: string
          display_name: string
          id: string
          organization_id: string
          provider: string | null
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          display_name: string
          id?: string
          organization_id: string
          provider?: string | null
          source_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          display_name?: string
          id?: string
          organization_id?: string
          provider?: string | null
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_records: {
        Row: {
          content_sha256: string | null
          created_at: string
          created_by: string | null
          description: string | null
          evidence_type: string
          financial_record_id: string | null
          id: string
          metadata: Json
          organization_id: string
          source_artifact_id: string | null
        }
        Insert: {
          content_sha256?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_type: string
          financial_record_id?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          source_artifact_id?: string | null
        }
        Update: {
          content_sha256?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_type?: string
          financial_record_id?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          source_artifact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_records_organization_id_financial_record_id_fkey"
            columns: ["organization_id", "financial_record_id"]
            isOneToOne: false
            referencedRelation: "financial_records"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "evidence_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_records_organization_id_source_artifact_id_fkey"
            columns: ["organization_id", "source_artifact_id"]
            isOneToOne: false
            referencedRelation: "source_artifacts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_type: string | null
          created_at: string
          currency: string
          external_reference: string | null
          id: string
          institution: string | null
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          created_at?: string
          currency?: string
          external_reference?: string | null
          id?: string
          institution?: string | null
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          created_at?: string
          currency?: string
          external_reference?: string | null
          id?: string
          institution?: string | null
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_records: {
        Row: {
          account_id: string | null
          amount_minor: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          data_source_id: string | null
          deduplication_key: string | null
          description: string
          direction: Database["public"]["Enums"]["rsbuild_record_direction"]
          id: string
          import_batch_id: string | null
          organization_id: string
          raw_payload: Json
          source_record_id: string | null
          status: string
          transaction_date: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount_minor: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          data_source_id?: string | null
          deduplication_key?: string | null
          description: string
          direction: Database["public"]["Enums"]["rsbuild_record_direction"]
          id?: string
          import_batch_id?: string | null
          organization_id: string
          raw_payload?: Json
          source_record_id?: string | null
          status?: string
          transaction_date: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount_minor?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          data_source_id?: string | null
          deduplication_key?: string | null
          description?: string
          direction?: Database["public"]["Enums"]["rsbuild_record_direction"]
          id?: string
          import_batch_id?: string | null
          organization_id?: string
          raw_payload?: Json
          source_record_id?: string | null
          status?: string
          transaction_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_records_organization_id_account_id_fkey"
            columns: ["organization_id", "account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "financial_records_organization_id_data_source_id_fkey"
            columns: ["organization_id", "data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "financial_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_records_organization_id_import_batch_id_fkey"
            columns: ["organization_id", "import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      import_batches: {
        Row: {
          accepted_count: number
          committed_at: string | null
          data_source_id: string | null
          file_sha256: string | null
          file_size_bytes: number | null
          id: string
          metadata: Json
          organization_id: string
          original_filename: string
          received_at: string
          received_by: string | null
          record_count: number
          rejected_count: number
          status: Database["public"]["Enums"]["rsbuild_import_status"]
        }
        Insert: {
          accepted_count?: number
          committed_at?: string | null
          data_source_id?: string | null
          file_sha256?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          organization_id: string
          original_filename: string
          received_at?: string
          received_by?: string | null
          record_count?: number
          rejected_count?: number
          status?: Database["public"]["Enums"]["rsbuild_import_status"]
        }
        Update: {
          accepted_count?: number
          committed_at?: string | null
          data_source_id?: string | null
          file_sha256?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          organization_id?: string
          original_filename?: string
          received_at?: string
          received_by?: string | null
          record_count?: number
          rejected_count?: number
          status?: Database["public"]["Enums"]["rsbuild_import_status"]
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_organization_id_data_source_id_fkey"
            columns: ["organization_id", "data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "import_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_records: {
        Row: {
          created_at: string
          details: Json
          external_record_id: string | null
          financial_record_id: string | null
          id: string
          integration_run_id: string
          organization_id: string
          outcome: string
          payload_hash: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          external_record_id?: string | null
          financial_record_id?: string | null
          id?: string
          integration_run_id: string
          organization_id: string
          outcome: string
          payload_hash?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          external_record_id?: string | null
          financial_record_id?: string | null
          id?: string
          integration_run_id?: string
          organization_id?: string
          outcome?: string
          payload_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_records_organization_id_financial_record_id_fkey"
            columns: ["organization_id", "financial_record_id"]
            isOneToOne: false
            referencedRelation: "financial_records"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "integration_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_records_organization_id_integration_run_id_fkey"
            columns: ["organization_id", "integration_run_id"]
            isOneToOne: false
            referencedRelation: "integration_runs"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      integration_runs: {
        Row: {
          adapter_version: string
          created_at: string
          created_by: string | null
          data_source_id: string | null
          finished_at: string | null
          id: string
          mode: string
          organization_id: string
          started_at: string | null
          status: string
          summary: Json
          target_system: string
        }
        Insert: {
          adapter_version: string
          created_at?: string
          created_by?: string | null
          data_source_id?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          organization_id: string
          started_at?: string | null
          status?: string
          summary?: Json
          target_system: string
        }
        Update: {
          adapter_version?: string
          created_at?: string
          created_by?: string | null
          data_source_id?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          organization_id?: string
          started_at?: string | null
          status?: string
          summary?: Json
          target_system?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_runs_organization_id_data_source_id_fkey"
            columns: ["organization_id", "data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "integration_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          organization_id: string
          role: Database["public"]["Enums"]["rsbuild_member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["rsbuild_member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["rsbuild_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          display_name: string
          id: string
          legal_name: string
          status: string
          tax_identifier: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          legal_name: string
          status?: string
          tax_identifier?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          legal_name?: string
          status?: string
          tax_identifier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      source_artifacts: {
        Row: {
          created_at: string
          created_by: string | null
          file_sha256: string
          file_size_bytes: number
          id: string
          import_batch_id: string | null
          media_type: string | null
          organization_id: string
          storage_bucket: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_sha256: string
          file_size_bytes: number
          id?: string
          import_batch_id?: string | null
          media_type?: string | null
          organization_id: string
          storage_bucket?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_sha256?: string
          file_size_bytes?: number
          id?: string
          import_batch_id?: string | null
          media_type?: string | null
          organization_id?: string
          storage_bucket?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_artifacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_artifacts_organization_id_import_batch_id_fkey"
            columns: ["organization_id", "import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      validation_runs: {
        Row: {
          executed_at: string
          executed_by: string | null
          id: string
          import_batch_id: string | null
          organization_id: string
          outcome: string
          summary: Json
          validator_name: string
          validator_version: string
        }
        Insert: {
          executed_at?: string
          executed_by?: string | null
          id?: string
          import_batch_id?: string | null
          organization_id: string
          outcome: string
          summary?: Json
          validator_name: string
          validator_version: string
        }
        Update: {
          executed_at?: string
          executed_by?: string | null
          id?: string
          import_batch_id?: string | null
          organization_id?: string
          outcome?: string
          summary?: Json
          validator_name?: string
          validator_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_runs_organization_id_import_batch_id_fkey"
            columns: ["organization_id", "import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      commit_financial_import: {
        Args: {
          p_organization_id: string
          p_original_filename: string
          p_file_sha256: string
          p_file_size_bytes: number
          p_storage_path: string
          p_records: Json
        }
        Returns: {
          batch_id: string
          inserted_count: number
          duplicate_count: number
        }[]
      }
    }
    Enums: {
      rsbuild_attestation_status: "pending" | "attested" | "failed"
      rsbuild_import_status:
        | "received"
        | "parsed"
        | "validated"
        | "rejected"
        | "committed"
      rsbuild_member_role: "owner" | "admin" | "operator" | "viewer"
      rsbuild_record_direction: "entrada" | "saída"
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
      rsbuild_attestation_status: ["pending", "attested", "failed"],
      rsbuild_import_status: [
        "received",
        "parsed",
        "validated",
        "rejected",
        "committed",
      ],
      rsbuild_member_role: ["owner", "admin", "operator", "viewer"],
      rsbuild_record_direction: ["entrada", "saída"],
    },
  },
} as const

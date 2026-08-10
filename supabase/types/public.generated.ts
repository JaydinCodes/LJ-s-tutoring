export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      adjustments: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          id: string
          pay_period_id: string
          reason: string
          related_session_id: string | null
          status: Database["public"]["Enums"]["adjustment_status"]
          tutor_id: string
          type: Database["public"]["Enums"]["adjustment_type"]
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          pay_period_id: string
          reason: string
          related_session_id?: string | null
          status?: Database["public"]["Enums"]["adjustment_status"]
          tutor_id: string
          type: Database["public"]["Enums"]["adjustment_type"]
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          pay_period_id?: string
          reason?: string
          related_session_id?: string | null
          status?: Database["public"]["Enums"]["adjustment_status"]
          tutor_id?: string
          type?: Database["public"]["Enums"]["adjustment_type"]
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adjustments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustments_pay_period_id_fkey"
            columns: ["pay_period_id"]
            isOneToOne: false
            referencedRelation: "pay_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustments_related_session_id_fkey"
            columns: ["related_session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustments_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustments_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_class_targets: {
        Row: {
          assignment_id: string
          class_id: string
          created_at: string
        }
        Insert: {
          assignment_id: string
          class_id: string
          created_at?: string
        }
        Update: {
          assignment_id?: string
          class_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_class_targets_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_class_targets_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_student_targets: {
        Row: {
          assignment_id: string
          created_at: string
          student_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          student_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_student_targets_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_student_targets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          ai_confidence: number | null
          ai_feedback: string | null
          ai_graded_at: string | null
          ai_grading_status: string
          ai_job_attempts: number
          ai_job_available_at: string
          ai_job_claim_token: string | null
          ai_job_claimed_at: string | null
          ai_job_last_error: string | null
          ai_job_lease_expires_at: string | null
          ai_marks_awarded: number | null
          ai_rubric_scores_json: Json
          assignment_id: string
          feedback: string | null
          feedback_released: boolean
          file_url: string | null
          id: string
          is_latest: boolean
          marks_awarded: number | null
          marks_released: boolean
          mime_type: string | null
          original_filename: string | null
          released_at: string | null
          rubric_scores_json: Json
          size_bytes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          storage_key: string | null
          student_id: string
          submitted_at: string
          text_answer: string | null
          version_number: number
        }
        Insert: {
          ai_confidence?: number | null
          ai_feedback?: string | null
          ai_graded_at?: string | null
          ai_grading_status?: string
          ai_job_attempts?: number
          ai_job_available_at?: string
          ai_job_claim_token?: string | null
          ai_job_claimed_at?: string | null
          ai_job_last_error?: string | null
          ai_job_lease_expires_at?: string | null
          ai_marks_awarded?: number | null
          ai_rubric_scores_json?: Json
          assignment_id: string
          feedback?: string | null
          feedback_released?: boolean
          file_url?: string | null
          id?: string
          is_latest?: boolean
          marks_awarded?: number | null
          marks_released?: boolean
          mime_type?: string | null
          original_filename?: string | null
          released_at?: string | null
          rubric_scores_json?: Json
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          storage_key?: string | null
          student_id: string
          submitted_at?: string
          text_answer?: string | null
          version_number?: number
        }
        Update: {
          ai_confidence?: number | null
          ai_feedback?: string | null
          ai_graded_at?: string | null
          ai_grading_status?: string
          ai_job_attempts?: number
          ai_job_available_at?: string
          ai_job_claim_token?: string | null
          ai_job_claimed_at?: string | null
          ai_job_last_error?: string | null
          ai_job_lease_expires_at?: string | null
          ai_marks_awarded?: number | null
          ai_rubric_scores_json?: Json
          assignment_id?: string
          feedback?: string | null
          feedback_released?: boolean
          file_url?: string | null
          id?: string
          is_latest?: boolean
          marks_awarded?: number | null
          marks_released?: boolean
          mime_type?: string | null
          original_filename?: string | null
          released_at?: string | null
          rubric_scores_json?: Json
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          storage_key?: string | null
          student_id?: string
          submitted_at?: string
          text_answer?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          attachment_url: string | null
          available_from: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          grade: string | null
          id: string
          memo_url: string | null
          organization_id: string
          rubric_json: Json
          status: Database["public"]["Enums"]["assignment_status"]
          subject_id: string | null
          title: string
        }
        Insert: {
          attachment_url?: string | null
          available_from?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          grade?: string | null
          id?: string
          memo_url?: string | null
          organization_id: string
          rubric_json?: Json
          status?: Database["public"]["Enums"]["assignment_status"]
          subject_id?: string | null
          title: string
        }
        Update: {
          attachment_url?: string | null
          available_from?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          grade?: string | null
          id?: string
          memo_url?: string | null
          organization_id?: string
          rubric_json?: Json
          status?: Database["public"]["Enums"]["assignment_status"]
          subject_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_role: Database["public"]["Enums"]["user_role"] | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      baseline_assessments: {
        Row: {
          cognitive_breakdown_json: Json
          completed_at: string
          created_at: string
          created_by: string | null
          grade: string | null
          id: string
          level_band: string | null
          organization_id: string
          percentage: number
          recommended_next_steps_json: Json
          score: number
          source_type: Database["public"]["Enums"]["baseline_source_type"]
          student_id: string
          subject: string
          topic_breakdown_json: Json
          total: number
        }
        Insert: {
          cognitive_breakdown_json?: Json
          completed_at: string
          created_at?: string
          created_by?: string | null
          grade?: string | null
          id?: string
          level_band?: string | null
          organization_id: string
          percentage: number
          recommended_next_steps_json?: Json
          score: number
          source_type?: Database["public"]["Enums"]["baseline_source_type"]
          student_id: string
          subject: string
          topic_breakdown_json?: Json
          total: number
        }
        Update: {
          cognitive_breakdown_json?: Json
          completed_at?: string
          created_at?: string
          created_by?: string | null
          grade?: string | null
          id?: string
          level_band?: string | null
          organization_id?: string
          percentage?: number
          recommended_next_steps_json?: Json
          score?: number
          source_type?: Database["public"]["Enums"]["baseline_source_type"]
          student_id?: string
          subject?: string
          topic_breakdown_json?: Json
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "baseline_assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baseline_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "baseline_assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      career_progress_snapshots: {
        Row: {
          alignment_score: number
          created_at: string
          goal_id: string
          id: string
          metrics_json: Json
          organization_id: string
          reasons_json: Json
          student_id: string
        }
        Insert: {
          alignment_score: number
          created_at?: string
          goal_id: string
          id?: string
          metrics_json?: Json
          organization_id: string
          reasons_json?: Json
          student_id: string
        }
        Update: {
          alignment_score?: number
          created_at?: string
          goal_id?: string
          id?: string
          metrics_json?: Json
          organization_id?: string
          reasons_json?: Json
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_progress_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_progress_snapshots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_enrollments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["record_status"]
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["record_status"]
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["record_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          day_of_week: string | null
          end_time: string | null
          grade: string | null
          id: string
          location: string | null
          name: string
          ngo_partner_id: string | null
          organization_id: string
          start_time: string | null
          status: Database["public"]["Enums"]["record_status"]
          subject_id: string | null
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week?: string | null
          end_time?: string | null
          grade?: string | null
          id?: string
          location?: string | null
          name?: string
          ngo_partner_id?: string | null
          organization_id: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          subject_id?: string | null
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: string | null
          end_time?: string | null
          grade?: string | null
          id?: string
          location?: string | null
          name?: string
          ngo_partner_id?: string | null
          organization_id?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          subject_id?: string | null
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_ngo_partner_id_fkey"
            columns: ["ngo_partner_id"]
            isOneToOne: false
            referencedRelation: "ngo_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      community_answers: {
        Row: {
          body: string
          created_at: string
          id: string
          is_verified: boolean
          moderation_state: Database["public"]["Enums"]["community_moderation_state"]
          profile_id: string
          question_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_verified?: boolean
          moderation_state?: Database["public"]["Enums"]["community_moderation_state"]
          profile_id: string
          question_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_verified?: boolean
          moderation_state?: Database["public"]["Enums"]["community_moderation_state"]
          profile_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_answers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "community_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_challenge_submissions: {
        Row: {
          challenge_id: string
          content: string
          created_at: string
          id: string
          profile_id: string
        }
        Insert: {
          challenge_id: string
          content: string
          created_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          challenge_id?: string
          content?: string
          created_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_challenge_submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "community_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_challenge_submissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_challenges: {
        Row: {
          created_at: string
          created_by: string | null
          grade: string | null
          id: string
          subject: string
          title: string
          week_end: string
          week_start: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          grade?: string | null
          id?: string
          subject: string
          title: string
          week_end: string
          week_start: string
          xp_reward: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          grade?: string | null
          id?: string
          subject?: string
          title?: string
          week_end?: string
          week_start?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_questions: {
        Row: {
          body: string
          created_at: string
          id: string
          moderation_flags: Json
          moderation_state: Database["public"]["Enums"]["community_moderation_state"]
          profile_id: string
          status: Database["public"]["Enums"]["community_question_status"]
          subject: string
          title: string
          topic: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          moderation_flags?: Json
          moderation_state?: Database["public"]["Enums"]["community_moderation_state"]
          profile_id: string
          status?: Database["public"]["Enums"]["community_question_status"]
          subject: string
          title: string
          topic: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          moderation_flags?: Json
          moderation_state?: Database["public"]["Enums"]["community_moderation_state"]
          profile_id?: string
          status?: Database["public"]["Enums"]["community_question_status"]
          subject?: string
          title?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_questions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_room_members: {
        Row: {
          id: string
          joined_at: string
          profile_id: string
          room_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          profile_id: string
          room_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          profile_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_room_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "community_study_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      community_room_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          moderation_flags: Json
          moderation_state: Database["public"]["Enums"]["community_moderation_state"]
          profile_id: string
          room_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          moderation_flags?: Json
          moderation_state?: Database["public"]["Enums"]["community_moderation_state"]
          profile_id: string
          room_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          moderation_flags?: Json
          moderation_state?: Database["public"]["Enums"]["community_moderation_state"]
          profile_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_room_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "community_study_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      community_study_rooms: {
        Row: {
          created_at: string
          created_by: string | null
          grade: string | null
          id: string
          subject: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          grade?: string | null
          id?: string
          subject: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          grade?: string | null
          id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_study_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_rate_limit_events: {
        Row: {
          created_at: string
          function_name: string
          id: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          subject_id: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          subject_id?: string
        }
        Relationships: []
      }
      guardians: {
        Row: {
          communication_preference: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          profile_id: string | null
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
        }
        Insert: {
          communication_preference?: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Update: {
          communication_preference?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          adjustment_id: string | null
          amount: number
          description: string
          id: string
          invoice_id: string
          line_type: Database["public"]["Enums"]["invoice_line_type"]
          minutes: number
          rate: number
          session_id: string | null
        }
        Insert: {
          adjustment_id?: string | null
          amount: number
          description: string
          id?: string
          invoice_id: string
          line_type?: Database["public"]["Enums"]["invoice_line_type"]
          minutes: number
          rate: number
          session_id?: string | null
        }
        Update: {
          adjustment_id?: string | null
          amount?: number
          description?: string
          id?: string
          invoice_id?: string
          line_type?: Database["public"]["Enums"]["invoice_line_type"]
          minutes?: number
          rate?: number
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          id: string
          invoice_number: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          tutor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_number: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          tutor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_number?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_goals: {
        Row: {
          category: Database["public"]["Enums"]["learning_goal_category"]
          created_at: string
          created_by: string | null
          current_value: number | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["learning_goal_status"]
          student_id: string
          subject: string | null
          target_value: number | null
          title: string
          updated_at: string
          visible_to_student: boolean
          visible_to_tutor: boolean
        }
        Insert: {
          category?: Database["public"]["Enums"]["learning_goal_category"]
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          status?: Database["public"]["Enums"]["learning_goal_status"]
          student_id: string
          subject?: string | null
          target_value?: number | null
          title: string
          updated_at?: string
          visible_to_student?: boolean
          visible_to_tutor?: boolean
        }
        Update: {
          category?: Database["public"]["Enums"]["learning_goal_category"]
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["learning_goal_status"]
          student_id?: string
          subject?: string | null
          target_value?: number | null
          title?: string
          updated_at?: string
          visible_to_student?: boolean
          visible_to_tutor?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "learning_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_goals_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      ngo_partners: {
        Row: {
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          id: string
          location: string | null
          name: string
          notes: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_role: Database["public"]["Enums"]["org_member_role"]
          organization_id: string
          profile_id: string
          status: Database["public"]["Enums"]["record_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          org_role: Database["public"]["Enums"]["org_member_role"]
          organization_id: string
          profile_id: string
          status?: Database["public"]["Enums"]["record_status"]
        }
        Update: {
          created_at?: string
          id?: string
          org_role?: Database["public"]["Enums"]["org_member_role"]
          organization_id?: string
          profile_id?: string
          status?: Database["public"]["Enums"]["record_status"]
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          id: string
          location: string | null
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["record_status"]
          type: Database["public"]["Enums"]["organization_type"]
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          type: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string
        }
        Relationships: []
      }
      pay_periods: {
        Row: {
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          period_end_date: string
          period_start_date: string
          status: Database["public"]["Enums"]["pay_period_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          period_end_date: string
          period_start_date: string
          status?: Database["public"]["Enums"]["pay_period_status"]
        }
        Update: {
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          period_end_date?: string
          period_start_date?: string
          status?: Database["public"]["Enums"]["pay_period_status"]
        }
        Relationships: [
          {
            foreignKeyName: "pay_periods_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          due_date: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_type: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
        }
        Insert: {
          amount: number
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_type: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
        }
        Update: {
          amount?: number
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_type?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_deletion_receipts: {
        Row: {
          auth_account_deleted: boolean
          completed_at: string
          db_erasure_counts: Json
          financial_hold: boolean
          id: string
          manifest_version: string
          request_id: string
          storage_files_removed: number
        }
        Insert: {
          auth_account_deleted: boolean
          completed_at?: string
          db_erasure_counts?: Json
          financial_hold: boolean
          id?: string
          manifest_version: string
          request_id: string
          storage_files_removed?: number
        }
        Update: {
          auth_account_deleted?: boolean
          completed_at?: string
          db_erasure_counts?: Json
          financial_hold?: boolean
          id?: string
          manifest_version?: string
          request_id?: string
          storage_files_removed?: number
        }
        Relationships: [
          {
            foreignKeyName: "privacy_deletion_receipts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "privacy_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          notes: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          processing_state: string
          processing_subject_auth_user_id: string | null
          request_type: Database["public"]["Enums"]["privacy_request_type"]
          requested_by: string | null
          result: Json
          status: Database["public"]["Enums"]["record_status"]
          storage_files_removed: number
          subject_profile_id: string | null
          subject_student_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          notes?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_state?: string
          processing_subject_auth_user_id?: string | null
          request_type: Database["public"]["Enums"]["privacy_request_type"]
          requested_by?: string | null
          result?: Json
          status?: Database["public"]["Enums"]["record_status"]
          storage_files_removed?: number
          subject_profile_id?: string | null
          subject_student_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          notes?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_state?: string
          processing_subject_auth_user_id?: string | null
          request_type?: Database["public"]["Enums"]["privacy_request_type"]
          requested_by?: string | null
          result?: Json
          status?: Database["public"]["Enums"]["record_status"]
          storage_files_removed?: number
          subject_profile_id?: string | null
          subject_student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_requests_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_requests_subject_student_id_fkey"
            columns: ["subject_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_identities: {
        Row: {
          auth_user_id: string
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          auth_user_id: string
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          auth_user_id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profile_identities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      session_history: {
        Row: {
          after_json: Json | null
          before_json: Json | null
          change_type: string
          changed_by_profile_id: string | null
          created_at: string
          id: string
          session_id: string
        }
        Insert: {
          after_json?: Json | null
          before_json?: Json | null
          change_type: string
          changed_by_profile_id?: string | null
          created_at?: string
          id?: string
          session_id: string
        }
        Update: {
          after_json?: Json | null
          before_json?: Json | null
          change_type?: string
          changed_by_profile_id?: string | null
          created_at?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_history_changed_by_profile_id_fkey"
            columns: ["changed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attendance_status: string | null
          created_at: string
          date: string
          duration_minutes: number
          end_time: string
          homework_assigned: string | null
          id: string
          learner_struggles: string | null
          location: string | null
          mode: string
          notes: string | null
          organization_id: string
          payout_override: boolean
          report_review_note: string | null
          start_time: string
          status: Database["public"]["Enums"]["session_status"]
          student_id: string
          student_summary: string | null
          submitted_at: string | null
          sync_key: string | null
          topics_covered: string | null
          tutor_id: string
          tutor_private_notes: string | null
          tutor_student_allocation_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attendance_status?: string | null
          created_at?: string
          date: string
          duration_minutes: number
          end_time: string
          homework_assigned?: string | null
          id?: string
          learner_struggles?: string | null
          location?: string | null
          mode: string
          notes?: string | null
          organization_id: string
          payout_override?: boolean
          report_review_note?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["session_status"]
          student_id: string
          student_summary?: string | null
          submitted_at?: string | null
          sync_key?: string | null
          topics_covered?: string | null
          tutor_id: string
          tutor_private_notes?: string | null
          tutor_student_allocation_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attendance_status?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number
          end_time?: string
          homework_assigned?: string | null
          id?: string
          learner_struggles?: string | null
          location?: string | null
          mode?: string
          notes?: string | null
          organization_id?: string
          payout_override?: boolean
          report_review_note?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["session_status"]
          student_id?: string
          student_summary?: string | null
          submitted_at?: string | null
          sync_key?: string | null
          topics_covered?: string | null
          tutor_id?: string
          tutor_private_notes?: string | null
          tutor_student_allocation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_tutor_student_allocation_id_fkey"
            columns: ["tutor_student_allocation_id"]
            isOneToOne: false
            referencedRelation: "tutor_student_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      student_career_profiles: {
        Row: {
          aps_target: number | null
          created_at: string
          id: string
          interests_json: Json
          preferred_subjects_json: Json
          saved_careers_json: Json
          student_id: string
          target_careers_json: Json
          updated_at: string
        }
        Insert: {
          aps_target?: number | null
          created_at?: string
          id?: string
          interests_json?: Json
          preferred_subjects_json?: Json
          saved_careers_json?: Json
          student_id: string
          target_careers_json?: Json
          updated_at?: string
        }
        Update: {
          aps_target?: number | null
          created_at?: string
          id?: string
          interests_json?: Json
          preferred_subjects_json?: Json
          saved_careers_json?: Json
          student_id?: string
          target_careers_json?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_career_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_exam_events: {
        Row: {
          created_at: string
          created_by: string | null
          exam_date: string
          id: string
          organization_id: string
          student_id: string
          subject: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          exam_date: string
          id?: string
          organization_id: string
          student_id: string
          subject: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          exam_date?: string
          id?: string
          organization_id?: string
          student_id?: string
          subject?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_exam_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_exam_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_exam_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          can_receive_reports: boolean
          created_at: string
          guardian_id: string
          id: string
          is_primary: boolean
          relationship_type: string
          status: Database["public"]["Enums"]["record_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          can_receive_reports?: boolean
          created_at?: string
          guardian_id: string
          id?: string
          is_primary?: boolean
          relationship_type?: string
          status?: Database["public"]["Enums"]["record_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          can_receive_reports?: boolean
          created_at?: string
          guardian_id?: string
          id?: string
          is_primary?: boolean
          relationship_type?: string
          status?: Database["public"]["Enums"]["record_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          link: string | null
          metadata_json: Json
          read_at: string | null
          student_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          metadata_json?: Json
          read_at?: string | null
          student_id: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          metadata_json?: Json
          read_at?: string | null
          student_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_progress: {
        Row: {
          assignment_submission_id: string | null
          cognitive_level: string | null
          id: string
          recorded_at: string
          score: number
          source_submission_id: string | null
          student_id: string
          subject_id: string | null
          topic: string
        }
        Insert: {
          assignment_submission_id?: string | null
          cognitive_level?: string | null
          id?: string
          recorded_at?: string
          score: number
          source_submission_id?: string | null
          student_id: string
          subject_id?: string | null
          topic: string
        }
        Update: {
          assignment_submission_id?: string | null
          cognitive_level?: string | null
          id?: string
          recorded_at?: string
          score?: number
          source_submission_id?: string | null
          student_id?: string
          subject_id?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_assignment_submission_id_fkey"
            columns: ["assignment_submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_source_submission_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_score_snapshots: {
        Row: {
          created_at: string
          id: string
          metrics_json: Json
          momentum_score: number
          organization_id: string
          reasons_json: Json
          recommended_actions_json: Json
          risk_score: number
          score_date: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metrics_json?: Json
          momentum_score: number
          organization_id: string
          reasons_json?: Json
          recommended_actions_json?: Json
          risk_score: number
          score_date: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metrics_json?: Json
          momentum_score?: number
          organization_id?: string
          reasons_json?: Json
          recommended_actions_json?: Json
          risk_score?: number
          score_date?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_score_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_score_snapshots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          grade: string | null
          id: string
          ngo_partner_id: string | null
          organization_id: string
          parent_contact: string | null
          parent_name: string | null
          profile_id: string
          school: string | null
          status: Database["public"]["Enums"]["record_status"]
        }
        Insert: {
          created_at?: string
          grade?: string | null
          id?: string
          ngo_partner_id?: string | null
          organization_id: string
          parent_contact?: string | null
          parent_name?: string | null
          profile_id: string
          school?: string | null
          status?: Database["public"]["Enums"]["record_status"]
        }
        Update: {
          created_at?: string
          grade?: string | null
          id?: string
          ngo_partner_id?: string | null
          organization_id?: string
          parent_contact?: string | null
          parent_name?: string | null
          profile_id?: string
          school?: string | null
          status?: Database["public"]["Enums"]["record_status"]
        }
        Relationships: [
          {
            foreignKeyName: "students_ngo_partner_id_fkey"
            columns: ["ngo_partner_id"]
            isOneToOne: false
            referencedRelation: "ngo_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          curriculum: string | null
          grade: string | null
          id: string
          name: string
        }
        Insert: {
          curriculum?: string | null
          grade?: string | null
          id?: string
          name: string
        }
        Update: {
          curriculum?: string | null
          grade?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      tutor_applications: {
        Row: {
          availability_notes: string | null
          created_at: string
          experience: string | null
          grades_json: Json
          id: string
          personal_details_json: Json
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          subjects_json: Json
          submitted_at: string | null
          teaching_preferences_json: Json
          tutor_id: string
          updated_at: string
        }
        Insert: {
          availability_notes?: string | null
          created_at?: string
          experience?: string | null
          grades_json?: Json
          id?: string
          personal_details_json?: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          subjects_json?: Json
          submitted_at?: string | null
          teaching_preferences_json?: Json
          tutor_id: string
          updated_at?: string
        }
        Update: {
          availability_notes?: string | null
          created_at?: string
          experience?: string | null
          grades_json?: Json
          id?: string
          personal_details_json?: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          subjects_json?: Json
          submitted_at?: string | null
          teaching_preferences_json?: Json
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_applications_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: true
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_availability_slots: {
        Row: {
          active: boolean
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          mode: string
          notes: string | null
          start_time: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          mode?: string
          notes?: string | null
          start_time: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          mode?: string
          notes?: string | null
          start_time?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_availability_slots_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_documents: {
        Row: {
          document_type: string
          file_size_bytes: number
          id: string
          mime_type: string
          notes: string | null
          original_filename: string
          storage_key: string
          tutor_id: string
          uploaded_at: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          document_type: string
          file_size_bytes: number
          id?: string
          mime_type: string
          notes?: string | null
          original_filename: string
          storage_key: string
          tutor_id: string
          uploaded_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          document_type?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string
          notes?: string | null
          original_filename?: string
          storage_key?: string
          tutor_id?: string
          uploaded_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_documents_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_payments: {
        Row: {
          amount: number
          id: string
          notes: string | null
          paid_at: string | null
          payment_period: string
          status: Database["public"]["Enums"]["payment_status"]
          tutor_id: string
        }
        Insert: {
          amount: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_period: string
          status?: Database["public"]["Enums"]["payment_status"]
          tutor_id: string
        }
        Update: {
          amount?: number
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_period?: string
          status?: Database["public"]["Enums"]["payment_status"]
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_payments_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_student_allocations: {
        Row: {
          allowed_days_json: Json | null
          allowed_time_ranges_json: Json | null
          created_at: string
          end_date: string | null
          focus_notes: string | null
          id: string
          rate_override: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["record_status"]
          student_id: string
          subject_id: string | null
          tutor_id: string
          updated_at: string
        }
        Insert: {
          allowed_days_json?: Json | null
          allowed_time_ranges_json?: Json | null
          created_at?: string
          end_date?: string | null
          focus_notes?: string | null
          id?: string
          rate_override?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          student_id: string
          subject_id?: string | null
          tutor_id: string
          updated_at?: string
        }
        Update: {
          allowed_days_json?: Json | null
          allowed_time_ranges_json?: Json | null
          created_at?: string
          end_date?: string | null
          focus_notes?: string | null
          id?: string
          rate_override?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          student_id?: string
          subject_id?: string | null
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_student_allocations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_student_allocations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_student_allocations_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      tutors: {
        Row: {
          approval_note: string | null
          approval_reviewed_at: string | null
          approval_reviewed_by: string | null
          approval_status: string
          created_at: string
          grades: string[]
          hourly_rate: number | null
          id: string
          profile_id: string
          qualification_band: string | null
          qualified_subjects_json: Json | null
          status: Database["public"]["Enums"]["record_status"]
          subjects: string[]
          teaching_preferences_json: Json | null
        }
        Insert: {
          approval_note?: string | null
          approval_reviewed_at?: string | null
          approval_reviewed_by?: string | null
          approval_status?: string
          created_at?: string
          grades?: string[]
          hourly_rate?: number | null
          id?: string
          profile_id: string
          qualification_band?: string | null
          qualified_subjects_json?: Json | null
          status?: Database["public"]["Enums"]["record_status"]
          subjects?: string[]
          teaching_preferences_json?: Json | null
        }
        Update: {
          approval_note?: string | null
          approval_reviewed_at?: string | null
          approval_reviewed_by?: string | null
          approval_status?: string
          created_at?: string
          grades?: string[]
          hourly_rate?: number | null
          id?: string
          profile_id?: string
          qualification_band?: string | null
          qualified_subjects_json?: Json | null
          status?: Database["public"]["Enums"]["record_status"]
          subjects?: string[]
          teaching_preferences_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tutors_approval_reviewed_by_fkey"
            columns: ["approval_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          event_date: string | null
          id: string
          location: string | null
          mode: string
          start_time: string | null
          status: Database["public"]["Enums"]["volunteer_event_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          id?: string
          location?: string | null
          mode?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["volunteer_event_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string | null
          id?: string
          location?: string | null
          mode?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["volunteer_event_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_logs: {
        Row: {
          admin_note: string | null
          created_at: string
          event_id: string | null
          evidence_document_id: string | null
          hours: number | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["volunteer_log_status"]
          submitted_at: string | null
          tutor_id: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          volunteered_on: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          event_id?: string | null
          evidence_document_id?: string | null
          hours?: number | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["volunteer_log_status"]
          submitted_at?: string | null
          tutor_id: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          volunteered_on?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          event_id?: string | null
          evidence_document_id?: string | null
          hours?: number | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["volunteer_log_status"]
          submitted_at?: string | null
          tutor_id?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          volunteered_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "volunteer_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_logs_evidence_document_id_fkey"
            columns: ["evidence_document_id"]
            isOneToOne: false
            referencedRelation: "tutor_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_logs_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_logs_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          payload_json: Json
          student_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          payload_json: Json
          student_id: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          payload_json?: Json
          student_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anonymize_student: { Args: { p_student_id: string }; Returns: Json }
      approve_session: {
        Args: { p_session_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attendance_status: string | null
          created_at: string
          date: string
          duration_minutes: number
          end_time: string
          homework_assigned: string | null
          id: string
          learner_struggles: string | null
          location: string | null
          mode: string
          notes: string | null
          organization_id: string
          payout_override: boolean
          report_review_note: string | null
          start_time: string
          status: Database["public"]["Enums"]["session_status"]
          student_id: string
          student_summary: string | null
          submitted_at: string | null
          sync_key: string | null
          topics_covered: string | null
          tutor_id: string
          tutor_private_notes: string | null
          tutor_student_allocation_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      begin_student_privacy_deletion: {
        Args: { p_request_id: string }
        Returns: Json
      }
      can_mark_submission: {
        Args: { p_submission_id: string }
        Returns: boolean
      }
      can_student_access_assignment: {
        Args: {
          p_assignment_id: string
          p_student_id?: string
          p_submission_id?: string
        }
        Returns: boolean
      }
      can_write_uncommitted_assignment_submission_storage: {
        Args: { p_storage_key: string }
        Returns: boolean
      }
      check_and_record_edge_function_rate_limit: {
        Args: {
          p_function_name: string
          p_limit: number
          p_subject_id: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      claim_ai_grading_job: {
        Args: { p_submission_id: string }
        Returns: {
          ai_confidence: number | null
          ai_feedback: string | null
          ai_graded_at: string | null
          ai_grading_status: string
          ai_job_attempts: number
          ai_job_available_at: string
          ai_job_claim_token: string | null
          ai_job_claimed_at: string | null
          ai_job_last_error: string | null
          ai_job_lease_expires_at: string | null
          ai_marks_awarded: number | null
          ai_rubric_scores_json: Json
          assignment_id: string
          feedback: string | null
          feedback_released: boolean
          file_url: string | null
          id: string
          is_latest: boolean
          marks_awarded: number | null
          marks_released: boolean
          mime_type: string | null
          original_filename: string | null
          released_at: string | null
          rubric_scores_json: Json
          size_bytes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          storage_key: string | null
          student_id: string
          submitted_at: string
          text_answer: string | null
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "assignment_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_next_ai_grading_job: {
        Args: never
        Returns: {
          ai_confidence: number | null
          ai_feedback: string | null
          ai_graded_at: string | null
          ai_grading_status: string
          ai_job_attempts: number
          ai_job_available_at: string
          ai_job_claim_token: string | null
          ai_job_claimed_at: string | null
          ai_job_last_error: string | null
          ai_job_lease_expires_at: string | null
          ai_marks_awarded: number | null
          ai_rubric_scores_json: Json
          assignment_id: string
          feedback: string | null
          feedback_released: boolean
          file_url: string | null
          id: string
          is_latest: boolean
          marks_awarded: number | null
          marks_released: boolean
          mime_type: string | null
          original_filename: string | null
          released_at: string | null
          rubric_scores_json: Json
          size_bytes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          storage_key: string | null
          student_id: string
          submitted_at: string
          text_answer: string | null
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "assignment_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cleanup_orphaned_assignment_assets: { Args: never; Returns: number }
      complete_ai_grading_job: {
        Args: {
          p_ai_confidence: number
          p_ai_feedback: string
          p_ai_graded_at?: string
          p_ai_marks_awarded: number
          p_ai_rubric_scores_json: Json
          p_claim_token: string
          p_submission_id: string
        }
        Returns: boolean
      }
      confirm_assignment_submission_attempt: {
        Args: {
          p_assignment_id: string
          p_file_url: string
          p_mime_type: string
          p_original_filename: string
          p_size_bytes: number
          p_storage_key: string
          p_submission_id: string
          p_text_answer: string
        }
        Returns: {
          submission_id: string
        }[]
      }
      create_adjustment: {
        Args: {
          p_amount: number
          p_reason: string
          p_related_session_id: string
          p_tutor_id: string
          p_type: Database["public"]["Enums"]["adjustment_type"]
          p_week_start: string
        }
        Returns: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          id: string
          pay_period_id: string
          reason: string
          related_session_id: string | null
          status: Database["public"]["Enums"]["adjustment_status"]
          tutor_id: string
          type: Database["public"]["Enums"]["adjustment_type"]
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "adjustments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_assignment: {
        Args: {
          p_attachment_url?: string
          p_description: string
          p_due_date: string
          p_grade: string
          p_memo_url?: string
          p_organization_id: string
          p_rubric_json?: Json
          p_status: Database["public"]["Enums"]["assignment_status"]
          p_subject_id: string
          p_title: string
        }
        Returns: {
          attachment_url: string | null
          available_from: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          grade: string | null
          id: string
          memo_url: string | null
          organization_id: string
          rubric_json: Json
          status: Database["public"]["Enums"]["assignment_status"]
          subject_id: string | null
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_assignment_draft: {
        Args: {
          p_description: string
          p_due_date: string
          p_grade: string
          p_organization_id: string
          p_rubric_json?: Json
          p_subject_id: string
          p_title: string
        }
        Returns: {
          attachment_url: string | null
          available_from: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          grade: string | null
          id: string
          memo_url: string | null
          organization_id: string
          rubric_json: Json
          status: Database["public"]["Enums"]["assignment_status"]
          subject_id: string | null
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_exam_event: {
        Args: {
          p_exam_date: string
          p_student_id: string
          p_subject: string
          p_title: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          exam_date: string
          id: string
          organization_id: string
          student_id: string
          subject: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "student_exam_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_learning_goal: {
        Args: {
          p_category?: Database["public"]["Enums"]["learning_goal_category"]
          p_current_value?: number
          p_description?: string
          p_due_date?: string
          p_status?: Database["public"]["Enums"]["learning_goal_status"]
          p_student_id: string
          p_subject?: string
          p_target_value?: number
          p_title: string
          p_visible_to_student?: boolean
          p_visible_to_tutor?: boolean
        }
        Returns: {
          category: Database["public"]["Enums"]["learning_goal_category"]
          created_at: string
          created_by: string | null
          current_value: number | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["learning_goal_status"]
          student_id: string
          subject: string | null
          target_value: number | null
          title: string
          updated_at: string
          visible_to_student: boolean
          visible_to_tutor: boolean
        }
        SetofOptions: {
          from: "*"
          to: "learning_goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_session: {
        Args: {
          p_date: string
          p_end_time: string
          p_idempotency_key: string
          p_location: string
          p_mode: string
          p_notes: string
          p_start_time: string
          p_student_id: string
          p_tutor_student_allocation_id: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attendance_status: string | null
          created_at: string
          date: string
          duration_minutes: number
          end_time: string
          homework_assigned: string | null
          id: string
          learner_struggles: string | null
          location: string | null
          mode: string
          notes: string | null
          organization_id: string
          payout_override: boolean
          report_review_note: string | null
          start_time: string
          status: Database["public"]["Enums"]["session_status"]
          student_id: string
          student_summary: string | null
          submitted_at: string | null
          sync_key: string | null
          topics_covered: string | null
          tutor_id: string
          tutor_private_notes: string | null
          tutor_student_allocation_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_student_notification: {
        Args: {
          p_body: string
          p_entity_id: string
          p_entity_type: string
          p_link: string
          p_metadata: Json
          p_student_id: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      create_study_room: {
        Args: { p_grade?: string; p_subject: string }
        Returns: {
          created_at: string
          created_by: string | null
          grade: string | null
          id: string
          subject: string
        }
        SetofOptions: {
          from: "*"
          to: "community_study_rooms"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_volunteer_event: {
        Args: {
          p_description?: string
          p_end_time?: string
          p_event_date?: string
          p_location?: string
          p_mode?: string
          p_start_time?: string
          p_status?: Database["public"]["Enums"]["volunteer_event_status"]
          p_title: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          event_date: string | null
          id: string
          location: string | null
          mode: string
          start_time: string | null
          status: Database["public"]["Enums"]["volunteer_event_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "volunteer_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_volunteer_log: {
        Args: {
          p_event_id?: string
          p_evidence_document_id?: string
          p_hours?: number
          p_notes?: string
          p_volunteered_on?: string
        }
        Returns: {
          admin_note: string | null
          created_at: string
          event_id: string | null
          evidence_document_id: string | null
          hours: number | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["volunteer_log_status"]
          submitted_at: string | null
          tutor_id: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          volunteered_on: string | null
        }
        SetofOptions: {
          from: "*"
          to: "volunteer_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_active_student_id: { Args: never; Returns: string }
      current_approved_active_tutor_id: { Args: never; Returns: string }
      current_org_ids: { Args: never; Returns: string[] }
      current_org_role: {
        Args: { org: string }
        Returns: Database["public"]["Enums"]["org_member_role"]
      }
      current_profile_id: { Args: never; Returns: string }
      current_profile_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      current_student_class_ids: { Args: never; Returns: string[] }
      current_student_id: { Args: never; Returns: string }
      current_student_identity_id: { Args: never; Returns: string }
      current_student_org_id: { Args: never; Returns: string }
      current_tutor_class_ids: { Args: never; Returns: string[] }
      current_tutor_id: { Args: never; Returns: string }
      current_tutor_identity_id: { Args: never; Returns: string }
      current_tutor_onboarding_id: { Args: never; Returns: string }
      decide_tutor_application: {
        Args: { p_application_id: string; p_note: string; p_status: string }
        Returns: {
          availability_notes: string | null
          created_at: string
          experience: string | null
          grades_json: Json
          id: string
          personal_details_json: Json
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          subjects_json: Json
          submitted_at: string | null
          teaching_preferences_json: Json
          tutor_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tutor_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      discard_assignment_staged_assets: {
        Args: {
          p_assignment_id: string
          p_attachment_url?: string
          p_memo_url?: string
        }
        Returns: number
      }
      enqueue_ai_grading: {
        Args: { p_submission_id: string }
        Returns: boolean
      }
      erase_student_privacy_data: {
        Args: { p_request_id: string }
        Returns: Json
      }
      export_student_data: { Args: { p_student_id: string }; Returns: Json }
      fail_ai_grading_job: {
        Args: {
          p_claim_token: string
          p_error: string
          p_retry_after_minutes?: number
          p_submission_id: string
        }
        Returns: boolean
      }
      finalize_assignment_publication: {
        Args: {
          p_assignment_id: string
          p_attachment_url: string
          p_description: string
          p_due_date: string
          p_grade: string
          p_memo_url: string
          p_rubric_json?: Json
          p_status: Database["public"]["Enums"]["assignment_status"]
          p_subject_id: string
          p_title: string
        }
        Returns: {
          attachment_url: string | null
          available_from: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          grade: string | null
          id: string
          memo_url: string | null
          organization_id: string
          rubric_json: Json
          status: Database["public"]["Enums"]["assignment_status"]
          subject_id: string | null
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_student_privacy_deletion: {
        Args: { p_request_id: string }
        Returns: Json
      }
      generate_payroll_week: {
        Args: { p_week_start: string }
        Returns: {
          created_at: string
          id: string
          invoice_number: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
          tutor_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_weekly_report: {
        Args: { p_student_id: string; p_week_start: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          payload_json: Json
          student_id: string
          week_end: string
          week_start: string
        }
        SetofOptions: {
          from: "*"
          to: "weekly_reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_admin_payroll_view: { Args: { p_week_start: string }; Returns: Json }
      get_admin_progress_reports: { Args: never; Returns: Json }
      get_community_challenges: {
        Args: never
        Returns: {
          created_at: string
          created_by: string
          grade: string
          has_submitted: boolean
          id: string
          subject: string
          title: string
          week_end: string
          week_start: string
          xp_reward: number
        }[]
      }
      get_community_questions: {
        Args: never
        Returns: {
          answer_count: number
          asker_name: string
          body: string
          created_at: string
          id: string
          moderation_state: Database["public"]["Enums"]["community_moderation_state"]
          profile_id: string
          status: Database["public"]["Enums"]["community_question_status"]
          subject: string
          title: string
          topic: string
          verified_answer_id: string
        }[]
      }
      get_community_rooms: {
        Args: never
        Returns: {
          created_at: string
          created_by: string
          grade: string
          id: string
          is_member: boolean
          member_count: number
          subject: string
        }[]
      }
      get_or_create_pay_period: {
        Args: { p_period_start_date: string }
        Returns: {
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          period_end_date: string
          period_start_date: string
          status: Database["public"]["Enums"]["pay_period_status"]
        }
        SetofOptions: {
          from: "*"
          to: "pay_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_org_cohort_report: { Args: { p_org_id: string }; Returns: Json }
      get_orphaned_assignment_submission_objects: {
        Args: { p_limit?: number }
        Returns: {
          bucket_id: string
          object_name: string
        }[]
      }
      get_parent_progress_reports: {
        Args: never
        Returns: {
          assignment_title: string
          feedback: string
          grade: string
          marks_awarded: number
          released_at: string
          school: string
          student_id: string
          student_name: string
          topic: string
          topic_score: number
        }[]
      }
      get_pay_period_integrity: {
        Args: { p_week_start: string }
        Returns: Json
      }
      get_room_messages: {
        Args: { p_room_id: string }
        Returns: {
          content: string
          created_at: string
          id: string
          moderation_state: Database["public"]["Enums"]["community_moderation_state"]
          profile_id: string
          room_id: string
          sender_name: string
        }[]
      }
      get_student_accessible_assignments: {
        Args: never
        Returns: {
          attachment_url: string
          created_at: string
          description: string
          due_date: string
          grade: string
          id: string
          status: Database["public"]["Enums"]["assignment_status"]
          subject_id: string
          title: string
        }[]
      }
      get_student_assigned_tutors: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      get_student_assignment_submissions: {
        Args: never
        Returns: {
          assignment_id: string
          feedback: string
          feedback_released: boolean
          file_url: string
          id: string
          is_latest: boolean
          marks_awarded: number
          marks_released: boolean
          mime_type: string
          original_filename: string
          released_at: string
          rubric_scores_json: Json
          size_bytes: number
          status: Database["public"]["Enums"]["submission_status"]
          storage_key: string
          student_id: string
          submitted_at: string
          text_answer: string
          version_number: number
        }[]
      }
      get_student_dashboard_metrics: { Args: never; Returns: Json }
      get_student_privacy_storage_manifest: {
        Args: { p_request_id: string }
        Returns: {
          bucket_id: string
          object_name: string
        }[]
      }
      get_student_sessions: {
        Args: never
        Returns: {
          attendance_status: string
          date: string
          end_time: string
          homework_assigned: string
          id: string
          location: string
          mode: string
          start_time: string
          status: Database["public"]["Enums"]["session_status"]
          student_summary: string
          topics_covered: string
        }[]
      }
      get_tutor_allocated_students: {
        Args: never
        Returns: {
          email: string
          full_name: string
          grade: string
          school: string
          status: Database["public"]["Enums"]["record_status"]
          student_id: string
        }[]
      }
      insert_session_history: {
        Args: {
          p_after_json: Json
          p_before_json: Json
          p_change_type: string
          p_session_id: string
        }
        Returns: string
      }
      is_platform_admin: { Args: never; Returns: boolean }
      join_study_room: { Args: { p_room_id: string }; Returns: undefined }
      lock_pay_period: {
        Args: { p_week_start: string }
        Returns: {
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          period_end_date: string
          period_start_date: string
          status: Database["public"]["Enums"]["pay_period_status"]
        }
        SetofOptions: {
          from: "*"
          to: "pay_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lock_payroll_week_mutation: {
        Args: { p_week_start: string }
        Returns: undefined
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: string
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_assignment_submission: {
        Args: {
          p_feedback: string
          p_feedback_released?: boolean
          p_marks_awarded: number
          p_marks_released?: boolean
          p_rubric_scores?: Json
          p_status: Database["public"]["Enums"]["submission_status"]
          p_submission_id: string
        }
        Returns: {
          ai_confidence: number | null
          ai_feedback: string | null
          ai_graded_at: string | null
          ai_grading_status: string
          ai_job_attempts: number
          ai_job_available_at: string
          ai_job_claim_token: string | null
          ai_job_claimed_at: string | null
          ai_job_last_error: string | null
          ai_job_lease_expires_at: string | null
          ai_marks_awarded: number | null
          ai_rubric_scores_json: Json
          assignment_id: string
          feedback: string | null
          feedback_released: boolean
          file_url: string | null
          id: string
          is_latest: boolean
          marks_awarded: number | null
          marks_released: boolean
          mime_type: string | null
          original_filename: string | null
          released_at: string | null
          rubric_scores_json: Json
          size_bytes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          storage_key: string | null
          student_id: string
          submitted_at: string
          text_answer: string | null
          version_number: number
        }[]
        SetofOptions: {
          from: "*"
          to: "assignment_submissions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: {
          body: string
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          link: string | null
          metadata_json: Json
          read_at: string | null
          student_id: string
          title: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "student_notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_student_privacy_auth_banned: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      mark_student_privacy_auth_deleted: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      mark_student_privacy_storage_deleted: {
        Args: { p_files_removed: number; p_request_id: string }
        Returns: undefined
      }
      moderate_community_text: {
        Args: { p_content: string }
        Returns: {
          flags: Json
          state: Database["public"]["Enums"]["community_moderation_state"]
        }[]
      }
      onboard_current_user: {
        Args: {
          p_full_name: string
          p_grade?: string
          p_grades?: string[]
          p_parent_contact?: string
          p_parent_name?: string
          p_phone?: string
          p_role: string
          p_school?: string
          p_subjects?: string[]
        }
        Returns: Json
      }
      payroll_week_start: { Args: { p_date: string }; Returns: string }
      post_room_message: {
        Args: { p_content: string; p_room_id: string }
        Returns: {
          content: string
          created_at: string
          id: string
          moderation_flags: Json
          moderation_state: Database["public"]["Enums"]["community_moderation_state"]
          profile_id: string
          room_id: string
        }
        SetofOptions: {
          from: "*"
          to: "community_room_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      process_privacy_request: { Args: { p_request_id: string }; Returns: Json }
      recompute_career_progress_snapshot: {
        Args: {
          p_goal_id: string
          p_recommended_subjects: string[]
          p_student_id: string
        }
        Returns: {
          alignment_score: number
          created_at: string
          goal_id: string
          id: string
          metrics_json: Json
          organization_id: string
          reasons_json: Json
          student_id: string
        }
        SetofOptions: {
          from: "*"
          to: "career_progress_snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recompute_student_risk_snapshot: {
        Args: { p_score_date?: string; p_student_id: string }
        Returns: {
          created_at: string
          id: string
          metrics_json: Json
          momentum_score: number
          organization_id: string
          reasons_json: Json
          recommended_actions_json: Json
          risk_score: number
          score_date: string
          student_id: string
        }
        SetofOptions: {
          from: "*"
          to: "student_score_snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_audit_event: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: string
      }
      record_baseline_assessment: {
        Args: {
          p_cognitive_breakdown?: Json
          p_completed_at?: string
          p_grade?: string
          p_level_band?: string
          p_recommended_next_steps?: Json
          p_score: number
          p_source_type?: Database["public"]["Enums"]["baseline_source_type"]
          p_student_id: string
          p_subject: string
          p_topic_breakdown?: Json
          p_total: number
        }
        Returns: {
          cognitive_breakdown_json: Json
          completed_at: string
          created_at: string
          created_by: string | null
          grade: string | null
          id: string
          level_band: string | null
          organization_id: string
          percentage: number
          recommended_next_steps_json: Json
          score: number
          source_type: Database["public"]["Enums"]["baseline_source_type"]
          student_id: string
          subject: string
          topic_breakdown_json: Json
          total: number
        }
        SetofOptions: {
          from: "*"
          to: "baseline_assessments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_orphaned_assignment_submission_cleanup: {
        Args: { p_removed_count: number }
        Returns: undefined
      }
      record_student_privacy_deletion_error: {
        Args: { p_error: string; p_request_id: string; p_stage: string }
        Returns: undefined
      }
      record_tutor_document: {
        Args: {
          p_document_type: string
          p_file_size_bytes: number
          p_mime_type: string
          p_original_filename: string
          p_storage_key: string
        }
        Returns: {
          document_type: string
          file_size_bytes: number
          id: string
          mime_type: string
          notes: string | null
          original_filename: string
          storage_key: string
          tutor_id: string
          uploaded_at: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tutor_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_session: {
        Args: { p_reason: string; p_session_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attendance_status: string | null
          created_at: string
          date: string
          duration_minutes: number
          end_time: string
          homework_assigned: string | null
          id: string
          learner_struggles: string | null
          location: string | null
          mode: string
          notes: string | null
          organization_id: string
          payout_override: boolean
          report_review_note: string | null
          start_time: string
          status: Database["public"]["Enums"]["session_status"]
          student_id: string
          student_summary: string | null
          submitted_at: string | null
          sync_key: string | null
          topics_covered: string | null
          tutor_id: string
          tutor_private_notes: string | null
          tutor_student_allocation_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_tutor_availability: {
        Args: { p_slots: Json }
        Returns: {
          active: boolean
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          mode: string
          notes: string | null
          start_time: string
          tutor_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tutor_availability_slots"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      run_retention_cleanup: { Args: { p_apply?: boolean }; Returns: Json }
      run_retention_cleanup_scheduled: { Args: never; Returns: Json }
      session_date_pay_period_locked: {
        Args: { p_date: string }
        Returns: boolean
      }
      session_within_allocation_window: {
        Args: {
          p_allowed_days: Json
          p_allowed_time_ranges: Json
          p_date: string
          p_end_date: string
          p_end_time: string
          p_start_date: string
          p_start_time: string
        }
        Returns: boolean
      }
      set_assignment_targets: {
        Args: {
          p_assignment_id: string
          p_class_ids?: string[]
          p_student_ids?: string[]
        }
        Returns: undefined
      }
      submit_assignment_submission: {
        Args: {
          p_assignment_id: string
          p_file_url: string
          p_mime_type: string
          p_original_filename: string
          p_size_bytes: number
          p_storage_key: string
          p_submission_id: string
          p_text_answer: string
        }
        Returns: {
          submission_id: string
        }[]
      }
      submit_session: {
        Args: { p_session_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attendance_status: string | null
          created_at: string
          date: string
          duration_minutes: number
          end_time: string
          homework_assigned: string | null
          id: string
          learner_struggles: string | null
          location: string | null
          mode: string
          notes: string | null
          organization_id: string
          payout_override: boolean
          report_review_note: string | null
          start_time: string
          status: Database["public"]["Enums"]["session_status"]
          student_id: string
          student_summary: string | null
          submitted_at: string | null
          sync_key: string | null
          topics_covered: string | null
          tutor_id: string
          tutor_private_notes: string | null
          tutor_student_allocation_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_session_report: {
        Args: {
          p_attendance_status: string
          p_homework_assigned: string
          p_learner_struggles: string
          p_session_id: string
          p_student_summary: string
          p_topics_covered: string
          p_tutor_private_notes: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attendance_status: string | null
          created_at: string
          date: string
          duration_minutes: number
          end_time: string
          homework_assigned: string | null
          id: string
          learner_struggles: string | null
          location: string | null
          mode: string
          notes: string | null
          organization_id: string
          payout_override: boolean
          report_review_note: string | null
          start_time: string
          status: Database["public"]["Enums"]["session_status"]
          student_id: string
          student_summary: string | null
          submitted_at: string | null
          sync_key: string | null
          topics_covered: string | null
          tutor_id: string
          tutor_private_notes: string | null
          tutor_student_allocation_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_tutor_application: {
        Args: never
        Returns: {
          availability_notes: string | null
          created_at: string
          experience: string | null
          grades_json: Json
          id: string
          personal_details_json: Json
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          subjects_json: Json
          submitted_at: string | null
          teaching_preferences_json: Json
          tutor_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tutor_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_assignment: {
        Args: {
          p_assignment_id: string
          p_attachment_url: string
          p_description: string
          p_due_date: string
          p_grade: string
          p_memo_url: string
          p_rubric_json: Json
          p_status: Database["public"]["Enums"]["assignment_status"]
          p_subject_id: string
          p_title: string
        }
        Returns: {
          attachment_url: string | null
          available_from: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          grade: string | null
          id: string
          memo_url: string | null
          organization_id: string
          rubric_json: Json
          status: Database["public"]["Enums"]["assignment_status"]
          subject_id: string | null
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_learning_goal: {
        Args: {
          p_category?: Database["public"]["Enums"]["learning_goal_category"]
          p_current_value?: number
          p_description?: string
          p_due_date?: string
          p_goal_id: string
          p_status?: Database["public"]["Enums"]["learning_goal_status"]
          p_subject?: string
          p_target_value?: number
          p_title?: string
          p_visible_to_student?: boolean
          p_visible_to_tutor?: boolean
        }
        Returns: {
          category: Database["public"]["Enums"]["learning_goal_category"]
          created_at: string
          created_by: string | null
          current_value: number | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["learning_goal_status"]
          student_id: string
          subject: string | null
          target_value: number | null
          title: string
          updated_at: string
          visible_to_student: boolean
          visible_to_tutor: boolean
        }
        SetofOptions: {
          from: "*"
          to: "learning_goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_session: {
        Args: {
          p_date: string
          p_end_time: string
          p_location: string
          p_mode: string
          p_notes: string
          p_session_id: string
          p_start_time: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attendance_status: string | null
          created_at: string
          date: string
          duration_minutes: number
          end_time: string
          homework_assigned: string | null
          id: string
          learner_struggles: string | null
          location: string | null
          mode: string
          notes: string | null
          organization_id: string
          payout_override: boolean
          report_review_note: string | null
          start_time: string
          status: Database["public"]["Enums"]["session_status"]
          student_id: string
          student_summary: string | null
          submitted_at: string | null
          sync_key: string | null
          topics_covered: string | null
          tutor_id: string
          tutor_private_notes: string | null
          tutor_student_allocation_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_tutor_application: {
        Args: {
          p_availability_notes: string
          p_experience: string
          p_grades: Json
          p_personal_details: Json
          p_subjects: Json
          p_teaching_preferences: Json
        }
        Returns: {
          availability_notes: string | null
          created_at: string
          experience: string | null
          grades_json: Json
          id: string
          personal_details_json: Json
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          subjects_json: Json
          submitted_at: string | null
          teaching_preferences_json: Json
          tutor_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tutor_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_tutor_document: {
        Args: { p_document_id: string; p_notes: string; p_status: string }
        Returns: {
          document_type: string
          file_size_bytes: number
          id: string
          mime_type: string
          notes: string | null
          original_filename: string
          storage_key: string
          tutor_id: string
          uploaded_at: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tutor_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_volunteer_log: {
        Args: {
          p_admin_note?: string
          p_log_id: string
          p_status: Database["public"]["Enums"]["volunteer_log_status"]
        }
        Returns: {
          admin_note: string | null
          created_at: string
          event_id: string | null
          evidence_document_id: string | null
          hours: number | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["volunteer_log_status"]
          submitted_at: string | null
          tutor_id: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          volunteered_on: string | null
        }
        SetofOptions: {
          from: "*"
          to: "volunteer_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_adjustment: {
        Args: { p_adjustment_id: string; p_reason: string }
        Returns: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          id: string
          pay_period_id: string
          reason: string
          related_session_id: string | null
          status: Database["public"]["Enums"]["adjustment_status"]
          tutor_id: string
          type: Database["public"]["Enums"]["adjustment_type"]
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "adjustments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      adjustment_status: "draft" | "approved"
      adjustment_type: "bonus" | "correction" | "penalty"
      assignment_status: "draft" | "published" | "closed" | "archived"
      baseline_source_type: "manual" | "uploaded" | "generated" | "diagnostic"
      community_moderation_state: "visible" | "flagged"
      community_question_status: "open" | "resolved" | "closed"
      invoice_line_type: "session" | "adjustment"
      invoice_status: "draft" | "issued" | "paid"
      learning_goal_category:
        | "academic"
        | "attendance"
        | "assignment"
        | "career"
        | "intervention"
      learning_goal_status: "active" | "completed" | "paused" | "cancelled"
      org_member_role:
        | "coordinator"
        | "tutor"
        | "student"
        | "parent"
        | "partner_viewer"
      organization_type: "direct" | "ngo" | "school" | "community"
      pay_period_status: "open" | "locked"
      payment_status: "pending" | "paid" | "overdue" | "voided"
      privacy_request_type: "access" | "correction" | "deletion"
      record_status:
        | "active"
        | "inactive"
        | "pending"
        | "approved"
        | "suspended"
      session_status: "draft" | "submitted" | "approved" | "rejected"
      submission_status: "not_submitted" | "submitted" | "marked" | "returned"
      user_role: "student" | "tutor" | "admin" | "parent" | "ngo_partner"
      volunteer_event_status: "planned" | "cancelled" | "completed"
      volunteer_log_status: "signed_up" | "submitted" | "verified" | "rejected"
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
    Enums: {
      adjustment_status: ["draft", "approved"],
      adjustment_type: ["bonus", "correction", "penalty"],
      assignment_status: ["draft", "published", "closed", "archived"],
      baseline_source_type: ["manual", "uploaded", "generated", "diagnostic"],
      community_moderation_state: ["visible", "flagged"],
      community_question_status: ["open", "resolved", "closed"],
      invoice_line_type: ["session", "adjustment"],
      invoice_status: ["draft", "issued", "paid"],
      learning_goal_category: [
        "academic",
        "attendance",
        "assignment",
        "career",
        "intervention",
      ],
      learning_goal_status: ["active", "completed", "paused", "cancelled"],
      org_member_role: [
        "coordinator",
        "tutor",
        "student",
        "parent",
        "partner_viewer",
      ],
      organization_type: ["direct", "ngo", "school", "community"],
      pay_period_status: ["open", "locked"],
      payment_status: ["pending", "paid", "overdue", "voided"],
      privacy_request_type: ["access", "correction", "deletion"],
      record_status: ["active", "inactive", "pending", "approved", "suspended"],
      session_status: ["draft", "submitted", "approved", "rejected"],
      submission_status: ["not_submitted", "submitted", "marked", "returned"],
      user_role: ["student", "tutor", "admin", "parent", "ngo_partner"],
      volunteer_event_status: ["planned", "cancelled", "completed"],
      volunteer_log_status: ["signed_up", "submitted", "verified", "rejected"],
    },
  },
} as const

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
      activity_skill_targets: {
        Row: {
          activity_id: string
          cognitive_level: string | null
          evidence_weight: number
          skill_id: string
          target_role: string
        }
        Insert: {
          activity_id: string
          cognitive_level?: string | null
          evidence_weight?: number
          skill_id: string
          target_role?: string
        }
        Update: {
          activity_id?: string
          cognitive_level?: string | null
          evidence_weight?: number
          skill_id?: string
          target_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_skill_targets_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "learning_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_skill_targets_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
        ]
      }
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
      assignment_submission_attempts: {
        Row: {
          assignment_id: string
          committed_at: string | null
          content_sha256: string | null
          created_at: string
          id: string
          mime_type: string | null
          original_filename: string | null
          size_bytes: number | null
          storage_key: string | null
          student_id: string
          text_answer_sha256: string | null
        }
        Insert: {
          assignment_id: string
          committed_at?: string | null
          content_sha256?: string | null
          created_at?: string
          id: string
          mime_type?: string | null
          original_filename?: string | null
          size_bytes?: number | null
          storage_key?: string | null
          student_id: string
          text_answer_sha256?: string | null
        }
        Update: {
          assignment_id?: string
          committed_at?: string | null
          content_sha256?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          size_bytes?: number | null
          storage_key?: string | null
          student_id?: string
          text_answer_sha256?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submission_attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submission_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          ai_assignment_snapshot_json: Json
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
          content_sha256: string | null
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
          revision: number
          rubric_scores_json: Json
          size_bytes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          storage_key: string | null
          student_id: string
          submitted_at: string
          text_answer: string | null
          text_answer_sha256: string | null
          version_number: number
        }
        Insert: {
          ai_assignment_snapshot_json?: Json
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
          content_sha256?: string | null
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
          revision?: number
          rubric_scores_json?: Json
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          storage_key?: string | null
          student_id: string
          submitted_at?: string
          text_answer?: string | null
          text_answer_sha256?: string | null
          version_number?: number
        }
        Update: {
          ai_assignment_snapshot_json?: Json
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
          content_sha256?: string | null
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
          revision?: number
          rubric_scores_json?: Json
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          storage_key?: string | null
          student_id?: string
          submitted_at?: string
          text_answer?: string | null
          text_answer_sha256?: string | null
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
          client_request_id: string | null
          create_request_fingerprint: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          grade: string | null
          id: string
          memo_url: string | null
          organization_id: string
          revision: number
          rubric_json: Json
          status: Database["public"]["Enums"]["assignment_status"]
          subject_id: string | null
          title: string
        }
        Insert: {
          attachment_url?: string | null
          available_from?: string | null
          client_request_id?: string | null
          create_request_fingerprint?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          grade?: string | null
          id?: string
          memo_url?: string | null
          organization_id: string
          revision?: number
          rubric_json?: Json
          status?: Database["public"]["Enums"]["assignment_status"]
          subject_id?: string | null
          title: string
        }
        Update: {
          attachment_url?: string | null
          available_from?: string | null
          client_request_id?: string | null
          create_request_fingerprint?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          grade?: string | null
          id?: string
          memo_url?: string | null
          organization_id?: string
          revision?: number
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
      competency_evidence: {
        Row: {
          cognitive_level: string | null
          competency: string
          id: string
          recorded_at: string
          rubric_criterion_id: string
          score: number
          source_submission_id: string
          student_id: string
          subject_id: string | null
        }
        Insert: {
          cognitive_level?: string | null
          competency: string
          id?: string
          recorded_at?: string
          rubric_criterion_id: string
          score: number
          source_submission_id: string
          student_id: string
          subject_id?: string | null
        }
        Update: {
          cognitive_level?: string | null
          competency?: string
          id?: string
          recorded_at?: string
          rubric_criterion_id?: string
          score?: number
          source_submission_id?: string
          student_id?: string
          subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competency_evidence_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_evidence_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_evidence_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_areas: {
        Row: {
          code: string
          created_at: string
          curriculum_version_id: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          curriculum_version_id: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          curriculum_version_id?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_areas_curriculum_version_id_fkey"
            columns: ["curriculum_version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_question_types: {
        Row: {
          cognitive_demand: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          question_type_code: string
          representation: string
          review_status: string
          skill_id: string
          source_reference: string
          title: string
          updated_at: string
        }
        Insert: {
          cognitive_demand: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          question_type_code: string
          representation: string
          review_status?: string
          skill_id: string
          source_reference: string
          title: string
          updated_at?: string
        }
        Update: {
          cognitive_demand?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          question_type_code?: string
          representation?: string
          review_status?: string
          skill_id?: string
          source_reference?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_question_types_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_skills: {
        Row: {
          cognitive_level: string | null
          created_at: string
          curriculum: string
          description: string | null
          grade: string
          id: string
          is_active: boolean
          review_status: string
          reviewed_at: string | null
          reviewed_by_profile_id: string | null
          skill_code: string
          strand: string
          subject_id: string
          title: string
          topic: string
          updated_at: string
        }
        Insert: {
          cognitive_level?: string | null
          created_at?: string
          curriculum?: string
          description?: string | null
          grade: string
          id?: string
          is_active?: boolean
          review_status?: string
          reviewed_at?: string | null
          reviewed_by_profile_id?: string | null
          skill_code: string
          strand: string
          subject_id: string
          title: string
          topic: string
          updated_at?: string
        }
        Update: {
          cognitive_level?: string | null
          created_at?: string
          curriculum?: string
          description?: string | null
          grade?: string
          id?: string
          is_active?: boolean
          review_status?: string
          reviewed_at?: string | null
          reviewed_by_profile_id?: string | null
          skill_code?: string
          strand?: string
          subject_id?: string
          title?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_skills_reviewed_by_profile_id_fkey"
            columns: ["reviewed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_skills_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_sources: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          curriculum_version_id: string
          id: string
          notes: string | null
          reference_uri: string | null
          source_tier: Database["public"]["Enums"]["curriculum_source_tier"]
          source_version: string | null
          title: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          curriculum_version_id: string
          id?: string
          notes?: string | null
          reference_uri?: string | null
          source_tier: Database["public"]["Enums"]["curriculum_source_tier"]
          source_version?: string | null
          title: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          curriculum_version_id?: string
          id?: string
          notes?: string | null
          reference_uri?: string | null
          source_tier?: Database["public"]["Enums"]["curriculum_source_tier"]
          source_version?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_sources_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_sources_curriculum_version_id_fkey"
            columns: ["curriculum_version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_topics: {
        Row: {
          code: string
          created_at: string
          curriculum_area_id: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          term: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          curriculum_area_id: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          term?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          curriculum_area_id?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          term?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_topics_curriculum_area_id_fkey"
            columns: ["curriculum_area_id"]
            isOneToOne: false
            referencedRelation: "curriculum_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_versions: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          grade: string
          id: string
          is_active: boolean
          name: string
          subject_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          grade: string
          id?: string
          is_active?: boolean
          name: string
          subject_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          grade?: string
          id?: string
          is_active?: boolean
          name?: string
          subject_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_versions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_blueprint_questions: {
        Row: {
          diagnostic_blueprint_id: string
          purpose: string
          question_version_id: string
          sequence_number: number
        }
        Insert: {
          diagnostic_blueprint_id: string
          purpose: string
          question_version_id: string
          sequence_number: number
        }
        Update: {
          diagnostic_blueprint_id?: string
          purpose?: string
          question_version_id?: string
          sequence_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_blueprint_questions_diagnostic_blueprint_id_fkey"
            columns: ["diagnostic_blueprint_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_blueprint_questions_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_blueprints: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          curriculum_version_id: string
          description: string
          id: string
          maximum_item_count: number
          minimum_item_count: number
          name: string
          review_notes: string | null
          review_status: Database["public"]["Enums"]["question_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          curriculum_version_id: string
          description: string
          id?: string
          maximum_item_count: number
          minimum_item_count: number
          name: string
          review_notes?: string | null
          review_status?: Database["public"]["Enums"]["question_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          curriculum_version_id?: string
          description?: string
          id?: string
          maximum_item_count?: number
          minimum_item_count?: number
          name?: string
          review_notes?: string | null
          review_status?: Database["public"]["Enums"]["question_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_blueprints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_blueprints_curriculum_version_id_fkey"
            columns: ["curriculum_version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_blueprints_reviewed_by_fkey"
            columns: ["reviewed_by"]
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
      grade9_learning_recommendations: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          mastery_evaluation_id: string | null
          reason: string
          recommendation_type: Database["public"]["Enums"]["intervention_type"]
          recommended_sequence: string[]
          rule_set_id: string
          skill_id: string
          status: Database["public"]["Enums"]["recommendation_status"]
          student_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          mastery_evaluation_id?: string | null
          reason: string
          recommendation_type: Database["public"]["Enums"]["intervention_type"]
          recommended_sequence?: string[]
          rule_set_id: string
          skill_id: string
          status?: Database["public"]["Enums"]["recommendation_status"]
          student_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          mastery_evaluation_id?: string | null
          reason?: string
          recommendation_type?: Database["public"]["Enums"]["intervention_type"]
          recommended_sequence?: string[]
          rule_set_id?: string
          skill_id?: string
          status?: Database["public"]["Enums"]["recommendation_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade9_learning_recommendations_mastery_evaluation_id_fkey"
            columns: ["mastery_evaluation_id"]
            isOneToOne: false
            referencedRelation: "skill_mastery_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade9_learning_recommendations_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "recommendation_rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade9_learning_recommendations_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade9_learning_recommendations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      grade9_skill_metadata: {
        Row: {
          curriculum_skill_id: string
          curriculum_topic_id: string
          curriculum_version_id: string
          display_order: number
          parent_curriculum_skill_id: string | null
          term: number | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          curriculum_skill_id: string
          curriculum_topic_id: string
          curriculum_version_id: string
          display_order?: number
          parent_curriculum_skill_id?: string | null
          term?: number | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          curriculum_skill_id?: string
          curriculum_topic_id?: string
          curriculum_version_id?: string
          display_order?: number
          parent_curriculum_skill_id?: string | null
          term?: number | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grade9_skill_metadata_curriculum_skill_id_fkey"
            columns: ["curriculum_skill_id"]
            isOneToOne: true
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade9_skill_metadata_curriculum_topic_id_fkey"
            columns: ["curriculum_topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade9_skill_metadata_curriculum_version_id_fkey"
            columns: ["curriculum_version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade9_skill_metadata_parent_curriculum_skill_id_fkey"
            columns: ["parent_curriculum_skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
        ]
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
      intervention_catalogue: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          intervention_type: Database["public"]["Enums"]["intervention_type"]
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          intervention_type: Database["public"]["Enums"]["intervention_type"]
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          intervention_type?: Database["public"]["Enums"]["intervention_type"]
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      intervention_outcomes: {
        Row: {
          id: string
          learning_attempt_skill_evidence_id: string | null
          mastery_evaluation_id: string | null
          outcome_note: string | null
          outcome_stage: string
          recorded_at: string
          tutor_intervention_id: string
        }
        Insert: {
          id?: string
          learning_attempt_skill_evidence_id?: string | null
          mastery_evaluation_id?: string | null
          outcome_note?: string | null
          outcome_stage: string
          recorded_at?: string
          tutor_intervention_id: string
        }
        Update: {
          id?: string
          learning_attempt_skill_evidence_id?: string | null
          mastery_evaluation_id?: string | null
          outcome_note?: string | null
          outcome_stage?: string
          recorded_at?: string
          tutor_intervention_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_outcomes_learning_attempt_skill_evidence_id_fkey"
            columns: ["learning_attempt_skill_evidence_id"]
            isOneToOne: false
            referencedRelation: "learning_attempt_skill_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_outcomes_mastery_evaluation_id_fkey"
            columns: ["mastery_evaluation_id"]
            isOneToOne: false
            referencedRelation: "skill_mastery_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_outcomes_tutor_intervention_id_fkey"
            columns: ["tutor_intervention_id"]
            isOneToOne: false
            referencedRelation: "tutor_interventions"
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
      learner_misconception_evidence: {
        Row: {
          created_at: string
          id: string
          learner_misconception_id: string
          learning_attempt_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          learner_misconception_id: string
          learning_attempt_id: string
        }
        Update: {
          created_at?: string
          id?: string
          learner_misconception_id?: string
          learning_attempt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_misconception_evidence_learner_misconception_id_fkey"
            columns: ["learner_misconception_id"]
            isOneToOne: false
            referencedRelation: "learner_misconceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_misconception_evidence_learning_attempt_id_fkey"
            columns: ["learning_attempt_id"]
            isOneToOne: false
            referencedRelation: "learning_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_misconceptions: {
        Row: {
          created_at: string
          determined_at: string
          determined_by: string | null
          id: string
          misconception_id: string
          reason: string | null
          state: Database["public"]["Enums"]["misconception_state"]
          student_id: string
        }
        Insert: {
          created_at?: string
          determined_at?: string
          determined_by?: string | null
          id?: string
          misconception_id: string
          reason?: string | null
          state: Database["public"]["Enums"]["misconception_state"]
          student_id: string
        }
        Update: {
          created_at?: string
          determined_at?: string
          determined_by?: string | null
          id?: string
          misconception_id?: string
          reason?: string | null
          state?: Database["public"]["Enums"]["misconception_state"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_misconceptions_determined_by_fkey"
            columns: ["determined_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_misconceptions_misconception_id_fkey"
            columns: ["misconception_id"]
            isOneToOne: false
            referencedRelation: "misconceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_misconceptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_question_type_state: {
        Row: {
          calculation_version: string
          computed_at: string
          confidence: number
          evidence_count: number
          instructional_state: string
          internal_score: number | null
          question_type_id: string
          recent_trend: number | null
          student_id: string
        }
        Insert: {
          calculation_version?: string
          computed_at?: string
          confidence: number
          evidence_count: number
          instructional_state: string
          internal_score?: number | null
          question_type_id: string
          recent_trend?: number | null
          student_id: string
        }
        Update: {
          calculation_version?: string
          computed_at?: string
          confidence?: number
          evidence_count?: number
          instructional_state?: string
          internal_score?: number | null
          question_type_id?: string
          recent_trend?: number | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_question_type_state_question_type_id_fkey"
            columns: ["question_type_id"]
            isOneToOne: false
            referencedRelation: "curriculum_question_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_question_type_state_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_skill_state: {
        Row: {
          calculation_version: string
          computed_at: string
          confidence: number
          evidence_count: number
          evidence_window_end: string | null
          evidence_window_start: string | null
          instructional_state: string
          internal_score: number | null
          recent_trend: number | null
          skill_id: string
          student_id: string
        }
        Insert: {
          calculation_version?: string
          computed_at?: string
          confidence: number
          evidence_count: number
          evidence_window_end?: string | null
          evidence_window_start?: string | null
          instructional_state: string
          internal_score?: number | null
          recent_trend?: number | null
          skill_id: string
          student_id: string
        }
        Update: {
          calculation_version?: string
          computed_at?: string
          confidence?: number
          evidence_count?: number
          evidence_window_end?: string | null
          evidence_window_start?: string | null
          instructional_state?: string
          internal_score?: number | null
          recent_trend?: number | null
          skill_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_skill_state_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_skill_state_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_activities: {
        Row: {
          accessibility_notes: string | null
          activity_type: string
          content_reference: string
          created_at: string
          estimated_minutes: number
          grade: string
          id: string
          is_active: boolean
          review_status: string
          reviewed_at: string | null
          reviewed_by_profile_id: string | null
          subject_id: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          accessibility_notes?: string | null
          activity_type: string
          content_reference: string
          created_at?: string
          estimated_minutes: number
          grade: string
          id?: string
          is_active?: boolean
          review_status?: string
          reviewed_at?: string | null
          reviewed_by_profile_id?: string | null
          subject_id: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          accessibility_notes?: string | null
          activity_type?: string
          content_reference?: string
          created_at?: string
          estimated_minutes?: number
          grade?: string
          id?: string
          is_active?: boolean
          review_status?: string
          reviewed_at?: string | null
          reviewed_by_profile_id?: string | null
          subject_id?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_activities_reviewed_by_profile_id_fkey"
            columns: ["reviewed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_activities_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_activity_stage_questions: {
        Row: {
          display_order: number
          learning_activity_stage_id: string
          question_version_id: string
        }
        Insert: {
          display_order?: number
          learning_activity_stage_id: string
          question_version_id: string
        }
        Update: {
          display_order?: number
          learning_activity_stage_id?: string
          question_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_activity_stage_questio_learning_activity_stage_id_fkey"
            columns: ["learning_activity_stage_id"]
            isOneToOne: false
            referencedRelation: "learning_activity_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_activity_stage_questions_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_activity_stages: {
        Row: {
          created_at: string
          id: string
          learner_instruction: string
          learning_activity_template_id: string
          sequence_number: number
          stage_type: Database["public"]["Enums"]["learning_activity_stage_type"]
          tutor_instruction: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          learner_instruction: string
          learning_activity_template_id: string
          sequence_number: number
          stage_type: Database["public"]["Enums"]["learning_activity_stage_type"]
          tutor_instruction?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          learner_instruction?: string
          learning_activity_template_id?: string
          sequence_number?: number
          stage_type?: Database["public"]["Enums"]["learning_activity_stage_type"]
          tutor_instruction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_activity_stages_learning_activity_template_id_fkey"
            columns: ["learning_activity_template_id"]
            isOneToOne: false
            referencedRelation: "learning_activity_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_activity_templates: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          curriculum_version_id: string
          description: string
          id: string
          review_notes: string | null
          review_status: Database["public"]["Enums"]["question_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          source_tier: Database["public"]["Enums"]["curriculum_source_tier"]
          target_skill_id: string
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          curriculum_version_id: string
          description: string
          id?: string
          review_notes?: string | null
          review_status?: Database["public"]["Enums"]["question_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_tier?: Database["public"]["Enums"]["curriculum_source_tier"]
          target_skill_id: string
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          curriculum_version_id?: string
          description?: string
          id?: string
          review_notes?: string | null
          review_status?: Database["public"]["Enums"]["question_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_tier?: Database["public"]["Enums"]["curriculum_source_tier"]
          target_skill_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_activity_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_activity_templates_curriculum_version_id_fkey"
            columns: ["curriculum_version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_activity_templates_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_activity_templates_target_skill_id_fkey"
            columns: ["target_skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_attempt_hint_events: {
        Row: {
          id: string
          learning_attempt_id: string
          opened_at: string
          opened_order: number
          question_hint_id: string
        }
        Insert: {
          id?: string
          learning_attempt_id: string
          opened_at?: string
          opened_order: number
          question_hint_id: string
        }
        Update: {
          id?: string
          learning_attempt_id?: string
          opened_at?: string
          opened_order?: number
          question_hint_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_attempt_hint_events_learning_attempt_id_fkey"
            columns: ["learning_attempt_id"]
            isOneToOne: false
            referencedRelation: "learning_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_attempt_hint_events_question_hint_id_fkey"
            columns: ["question_hint_id"]
            isOneToOne: false
            referencedRelation: "question_hints"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_attempt_skill_evidence: {
        Row: {
          cognitive_level: Database["public"]["Enums"]["caps_cognitive_level"]
          correct: boolean
          id: string
          independence: Database["public"]["Enums"]["attempt_independence"]
          is_target_skill: boolean
          learning_attempt_id: string
          marks_awarded: number | null
          marks_possible: number | null
          recorded_at: string
          skill_id: string
        }
        Insert: {
          cognitive_level: Database["public"]["Enums"]["caps_cognitive_level"]
          correct: boolean
          id?: string
          independence: Database["public"]["Enums"]["attempt_independence"]
          is_target_skill: boolean
          learning_attempt_id: string
          marks_awarded?: number | null
          marks_possible?: number | null
          recorded_at?: string
          skill_id: string
        }
        Update: {
          cognitive_level?: Database["public"]["Enums"]["caps_cognitive_level"]
          correct?: boolean
          id?: string
          independence?: Database["public"]["Enums"]["attempt_independence"]
          is_target_skill?: boolean
          learning_attempt_id?: string
          marks_awarded?: number | null
          marks_possible?: number | null
          recorded_at?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_attempt_skill_evidence_learning_attempt_id_fkey"
            columns: ["learning_attempt_id"]
            isOneToOne: false
            referencedRelation: "learning_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_attempt_skill_evidence_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_attempts: {
        Row: {
          attempt_number: number
          confidence: number | null
          created_at: string
          evaluated_at: string | null
          evaluated_by: string | null
          evidence_context: Database["public"]["Enums"]["evidence_context"]
          id: string
          idempotency_key: string | null
          is_correct: boolean | null
          marks_awarded: number | null
          occurred_at: string
          question_version_id: string
          response: Json
          session_id: string | null
          source_submission_id: string | null
          status: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          time_spent_seconds: number | null
          tutor_observation: string | null
        }
        Insert: {
          attempt_number: number
          confidence?: number | null
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          evidence_context?: Database["public"]["Enums"]["evidence_context"]
          id?: string
          idempotency_key?: string | null
          is_correct?: boolean | null
          marks_awarded?: number | null
          occurred_at?: string
          question_version_id: string
          response?: Json
          session_id?: string | null
          source_submission_id?: string | null
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          time_spent_seconds?: number | null
          tutor_observation?: string | null
        }
        Update: {
          attempt_number?: number
          confidence?: number | null
          created_at?: string
          evaluated_at?: string | null
          evaluated_by?: string | null
          evidence_context?: Database["public"]["Enums"]["evidence_context"]
          id?: string
          idempotency_key?: string | null
          is_correct?: boolean | null
          marks_awarded?: number | null
          occurred_at?: string
          question_version_id?: string
          response?: Json
          session_id?: string | null
          source_submission_id?: string | null
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id?: string
          time_spent_seconds?: number | null
          tutor_observation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_attempts_evaluated_by_fkey"
            columns: ["evaluated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_attempts_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_attempts_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_evidence: {
        Row: {
          created_at: string
          created_by_profile_id: string | null
          evidence_type: string
          id: string
          learner_visible: boolean
          observed_at: string
          question_type_id: string | null
          reviewed_at: string
          score: number
          skill_id: string
          source_reference: string
          source_submission_id: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id?: string | null
          evidence_type: string
          id?: string
          learner_visible?: boolean
          observed_at?: string
          question_type_id?: string | null
          reviewed_at?: string
          score: number
          skill_id: string
          source_reference: string
          source_submission_id?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string | null
          evidence_type?: string
          id?: string
          learner_visible?: boolean
          observed_at?: string
          question_type_id?: string | null
          reviewed_at?: string
          score?: number
          skill_id?: string
          source_reference?: string
          source_submission_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_evidence_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_evidence_question_type_id_fkey"
            columns: ["question_type_id"]
            isOneToOne: false
            referencedRelation: "curriculum_question_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_evidence_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_evidence_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_evidence_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
      learning_recommendation_reasons: {
        Row: {
          reason_code: string
          recommendation_id: string
        }
        Insert: {
          reason_code: string
          recommendation_id: string
        }
        Update: {
          reason_code?: string
          recommendation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_recommendation_reasons_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "grade9_learning_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_recommendations: {
        Row: {
          activity_id: string
          calculation_version: string
          decided_at: string | null
          decided_by_profile_id: string | null
          decision_note: string | null
          expires_at: string
          id: string
          learner_copy: string
          proposed_at: string
          rationale_json: Json
          skill_id: string
          status: string
          student_id: string
        }
        Insert: {
          activity_id: string
          calculation_version?: string
          decided_at?: string | null
          decided_by_profile_id?: string | null
          decision_note?: string | null
          expires_at?: string
          id?: string
          learner_copy: string
          proposed_at?: string
          rationale_json?: Json
          skill_id: string
          status?: string
          student_id: string
        }
        Update: {
          activity_id?: string
          calculation_version?: string
          decided_at?: string | null
          decided_by_profile_id?: string | null
          decision_note?: string | null
          expires_at?: string
          id?: string
          learner_copy?: string
          proposed_at?: string
          rationale_json?: Json
          skill_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_recommendations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "learning_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_recommendations_decided_by_profile_id_fkey"
            columns: ["decided_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_recommendations_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_recommendations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      mastery_rule_sets: {
        Row: {
          code: string
          configuration: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          code: string
          configuration: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          valid_from?: string
          valid_until?: string | null
          version: number
        }
        Update: {
          code?: string
          configuration?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "mastery_rule_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      misconceptions: {
        Row: {
          code: string
          created_at: string
          default_intervention_type:
            | Database["public"]["Enums"]["intervention_type"]
            | null
          description: string
          diagnostic_notes: string | null
          id: string
          is_active: boolean
          name: string
          skill_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_intervention_type?:
            | Database["public"]["Enums"]["intervention_type"]
            | null
          description: string
          diagnostic_notes?: string | null
          id?: string
          is_active?: boolean
          name: string
          skill_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_intervention_type?:
            | Database["public"]["Enums"]["intervention_type"]
            | null
          description?: string
          diagnostic_notes?: string | null
          id?: string
          is_active?: boolean
          name?: string
          skill_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "misconceptions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
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
      notification_outbox_events: {
        Row: {
          attempt_count: number
          available_at: string
          claim_token: string | null
          created_at: string
          dispatched_at: string | null
          event_key: string
          id: string
          last_error: string | null
          lease_expires_at: string | null
          payload_json: Json
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          claim_token?: string | null
          created_at?: string
          dispatched_at?: string | null
          event_key: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          payload_json: Json
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          claim_token?: string | null
          created_at?: string
          dispatched_at?: string | null
          event_key?: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          payload_json?: Json
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
          processing_claim_token: string | null
          processing_completed_at: string | null
          processing_lease_expires_at: string | null
          processing_started_at: string | null
          processing_state: string
          processing_subject_auth_user_id: string | null
          request_type: Database["public"]["Enums"]["privacy_request_type"]
          requested_by: string | null
          result: Json
          status: Database["public"]["Enums"]["record_status"]
          storage_files_expected: number
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
          processing_claim_token?: string | null
          processing_completed_at?: string | null
          processing_lease_expires_at?: string | null
          processing_started_at?: string | null
          processing_state?: string
          processing_subject_auth_user_id?: string | null
          request_type: Database["public"]["Enums"]["privacy_request_type"]
          requested_by?: string | null
          result?: Json
          status?: Database["public"]["Enums"]["record_status"]
          storage_files_expected?: number
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
          processing_claim_token?: string | null
          processing_completed_at?: string | null
          processing_lease_expires_at?: string | null
          processing_started_at?: string | null
          processing_state?: string
          processing_subject_auth_user_id?: string | null
          request_type?: Database["public"]["Enums"]["privacy_request_type"]
          requested_by?: string | null
          result?: Json
          status?: Database["public"]["Enums"]["record_status"]
          storage_files_expected?: number
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
      question_hints: {
        Row: {
          created_at: string
          hint_level: number
          id: string
          prompt: string
          question_version_id: string
        }
        Insert: {
          created_at?: string
          hint_level: number
          id?: string
          prompt: string
          question_version_id: string
        }
        Update: {
          created_at?: string
          hint_level?: number
          id?: string
          prompt?: string
          question_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_hints_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_items: {
        Row: {
          created_at: string
          created_by: string | null
          curriculum_version_id: string
          id: string
          item_code: string
          retired_at: string | null
          retired_by: string | null
          source_tier: Database["public"]["Enums"]["curriculum_source_tier"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          curriculum_version_id: string
          id?: string
          item_code: string
          retired_at?: string | null
          retired_by?: string | null
          source_tier?: Database["public"]["Enums"]["curriculum_source_tier"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          curriculum_version_id?: string
          id?: string
          item_code?: string
          retired_at?: string | null
          retired_by?: string | null
          source_tier?: Database["public"]["Enums"]["curriculum_source_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "question_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_items_curriculum_version_id_fkey"
            columns: ["curriculum_version_id"]
            isOneToOne: false
            referencedRelation: "curriculum_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_items_retired_by_fkey"
            columns: ["retired_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      question_review_events: {
        Row: {
          action: string
          created_at: string
          from_status: Database["public"]["Enums"]["question_review_status"]
          id: string
          question_version_id: string
          review_notes: string | null
          reviewer_id: string | null
          to_status: Database["public"]["Enums"]["question_review_status"]
        }
        Insert: {
          action: string
          created_at?: string
          from_status: Database["public"]["Enums"]["question_review_status"]
          id?: string
          question_version_id: string
          review_notes?: string | null
          reviewer_id?: string | null
          to_status: Database["public"]["Enums"]["question_review_status"]
        }
        Update: {
          action?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["question_review_status"]
          id?: string
          question_version_id?: string
          review_notes?: string | null
          reviewer_id?: string | null
          to_status?: Database["public"]["Enums"]["question_review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "question_review_events_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_review_events_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      question_version_misconceptions: {
        Row: {
          misconception_id: string
          question_version_id: string
        }
        Insert: {
          misconception_id: string
          question_version_id: string
        }
        Update: {
          misconception_id?: string
          question_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_version_misconceptions_misconception_id_fkey"
            columns: ["misconception_id"]
            isOneToOne: false
            referencedRelation: "misconceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_version_misconceptions_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_version_skill_links: {
        Row: {
          question_version_id: string
          relationship_type: string
          skill_id: string
        }
        Insert: {
          question_version_id: string
          relationship_type: string
          skill_id: string
        }
        Update: {
          question_version_id?: string
          relationship_type?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_version_skill_links_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_version_skill_links_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      question_versions: {
        Row: {
          activity_type: Database["public"]["Enums"]["question_activity_type"]
          answer_config: Json
          calculator_policy: Database["public"]["Enums"]["calculator_policy"]
          cognitive_level: Database["public"]["Enums"]["caps_cognitive_level"]
          created_at: string
          created_by: string | null
          difficulty: number | null
          id: string
          marks: number
          material_change_note: string | null
          prompt: string
          question_item_id: string
          representation: Database["public"]["Enums"]["math_representation"]
          review_notes: string | null
          review_status: Database["public"]["Enums"]["question_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          solution: string | null
          version_number: number
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["question_activity_type"]
          answer_config?: Json
          calculator_policy?: Database["public"]["Enums"]["calculator_policy"]
          cognitive_level: Database["public"]["Enums"]["caps_cognitive_level"]
          created_at?: string
          created_by?: string | null
          difficulty?: number | null
          id?: string
          marks: number
          material_change_note?: string | null
          prompt: string
          question_item_id: string
          representation: Database["public"]["Enums"]["math_representation"]
          review_notes?: string | null
          review_status?: Database["public"]["Enums"]["question_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          solution?: string | null
          version_number: number
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["question_activity_type"]
          answer_config?: Json
          calculator_policy?: Database["public"]["Enums"]["calculator_policy"]
          cognitive_level?: Database["public"]["Enums"]["caps_cognitive_level"]
          created_at?: string
          created_by?: string | null
          difficulty?: number | null
          id?: string
          marks?: number
          material_change_note?: string | null
          prompt?: string
          question_item_id?: string
          representation?: Database["public"]["Enums"]["math_representation"]
          review_notes?: string | null
          review_status?: Database["public"]["Enums"]["question_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          solution?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_versions_question_item_id_fkey"
            columns: ["question_item_id"]
            isOneToOne: false
            referencedRelation: "question_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_versions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_decisions: {
        Row: {
          activity_id: string | null
          decided_at: string
          decided_by_profile_id: string
          decision: string
          id: string
          note: string | null
          recommendation_id: string
        }
        Insert: {
          activity_id?: string | null
          decided_at?: string
          decided_by_profile_id: string
          decision: string
          id?: string
          note?: string | null
          recommendation_id: string
        }
        Update: {
          activity_id?: string | null
          decided_at?: string
          decided_by_profile_id?: string
          decision?: string
          id?: string
          note?: string | null
          recommendation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_decisions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "learning_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_decisions_decided_by_profile_id_fkey"
            columns: ["decided_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_decisions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "learning_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_rule_sets: {
        Row: {
          code: string
          configuration: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          version: number
        }
        Insert: {
          code: string
          configuration: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          version: number
        }
        Update: {
          code?: string
          configuration?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_rule_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      skill_cognitive_levels: {
        Row: {
          cognitive_level: Database["public"]["Enums"]["caps_cognitive_level"]
          skill_id: string
        }
        Insert: {
          cognitive_level: Database["public"]["Enums"]["caps_cognitive_level"]
          skill_id: string
        }
        Update: {
          cognitive_level?: Database["public"]["Enums"]["caps_cognitive_level"]
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_cognitive_levels_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_mastery_evaluation_evidence: {
        Row: {
          id: string
          learner_misconception_id: string | null
          learning_attempt_skill_evidence_id: string | null
          mastery_evaluation_id: string
        }
        Insert: {
          id?: string
          learner_misconception_id?: string | null
          learning_attempt_skill_evidence_id?: string | null
          mastery_evaluation_id: string
        }
        Update: {
          id?: string
          learner_misconception_id?: string | null
          learning_attempt_skill_evidence_id?: string | null
          mastery_evaluation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_mastery_evaluation_evid_learning_attempt_skill_evide_fkey"
            columns: ["learning_attempt_skill_evidence_id"]
            isOneToOne: false
            referencedRelation: "learning_attempt_skill_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_mastery_evaluation_evidence_learner_misconception_id_fkey"
            columns: ["learner_misconception_id"]
            isOneToOne: false
            referencedRelation: "learner_misconceptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_mastery_evaluation_evidence_mastery_evaluation_id_fkey"
            columns: ["mastery_evaluation_id"]
            isOneToOne: false
            referencedRelation: "skill_mastery_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_mastery_evaluations: {
        Row: {
          created_at: string
          determined_at: string
          determined_by: string | null
          id: string
          reason: string
          reason_codes: string[]
          rule_set_id: string
          skill_id: string
          state: Database["public"]["Enums"]["mastery_state"]
          student_id: string
        }
        Insert: {
          created_at?: string
          determined_at?: string
          determined_by?: string | null
          id?: string
          reason: string
          reason_codes?: string[]
          rule_set_id: string
          skill_id: string
          state: Database["public"]["Enums"]["mastery_state"]
          student_id: string
        }
        Update: {
          created_at?: string
          determined_at?: string
          determined_by?: string | null
          id?: string
          reason?: string
          reason_codes?: string[]
          rule_set_id?: string
          skill_id?: string
          state?: Database["public"]["Enums"]["mastery_state"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_mastery_evaluations_determined_by_fkey"
            columns: ["determined_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_mastery_evaluations_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "mastery_rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_mastery_evaluations_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_mastery_evaluations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_prerequisites: {
        Row: {
          created_at: string
          prerequisite_skill_id: string
          skill_id: string
          strength: number
        }
        Insert: {
          created_at?: string
          prerequisite_skill_id: string
          skill_id: string
          strength?: number
        }
        Update: {
          created_at?: string
          prerequisite_skill_id?: string
          skill_id?: string
          strength?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_prerequisites_prerequisite_skill_id_fkey"
            columns: ["prerequisite_skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_prerequisites_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_representations: {
        Row: {
          representation: Database["public"]["Enums"]["math_representation"]
          skill_id: string
        }
        Insert: {
          representation: Database["public"]["Enums"]["math_representation"]
          skill_id: string
        }
        Update: {
          representation?: Database["public"]["Enums"]["math_representation"]
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_representations_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
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
          dedupe_key: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          link: string | null
          metadata_json: Json
          outbox_event_id: string | null
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
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          metadata_json?: Json
          outbox_event_id?: string | null
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
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          metadata_json?: Json
          outbox_event_id?: string | null
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
      tutor_deletion_receipts: {
        Row: {
          auth_account_deleted: boolean
          completed_at: string
          db_erasure_counts: Json
          id: string
          manifest_version: string
          request_id: string
          storage_files_removed: number
        }
        Insert: {
          auth_account_deleted: boolean
          completed_at?: string
          db_erasure_counts?: Json
          id?: string
          manifest_version: string
          request_id: string
          storage_files_removed?: number
        }
        Update: {
          auth_account_deleted?: boolean
          completed_at?: string
          db_erasure_counts?: Json
          id?: string
          manifest_version?: string
          request_id?: string
          storage_files_removed?: number
        }
        Relationships: [
          {
            foreignKeyName: "tutor_deletion_receipts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "tutor_deletion_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_deletion_requests: {
        Row: {
          auth_user_id: string | null
          created_at: string
          db_erasure_counts: Json
          id: string
          last_error: string | null
          processing_claim_token: string | null
          processing_completed_at: string | null
          processing_lease_expires_at: string | null
          processing_started_at: string | null
          processing_state: string
          processing_subject_auth_user_id: string | null
          reason: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          storage_files_expected: number
          storage_files_removed: number
          tutor_id: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          db_erasure_counts?: Json
          id?: string
          last_error?: string | null
          processing_claim_token?: string | null
          processing_completed_at?: string | null
          processing_lease_expires_at?: string | null
          processing_started_at?: string | null
          processing_state?: string
          processing_subject_auth_user_id?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          storage_files_expected?: number
          storage_files_removed?: number
          tutor_id: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          db_erasure_counts?: Json
          id?: string
          last_error?: string | null
          processing_claim_token?: string | null
          processing_completed_at?: string | null
          processing_lease_expires_at?: string | null
          processing_started_at?: string | null
          processing_state?: string
          processing_subject_auth_user_id?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          storage_files_expected?: number
          storage_files_removed?: number
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_deletion_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_deletion_requests_tutor_id_fkey"
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
      tutor_interventions: {
        Row: {
          created_at: string
          delivered_at: string | null
          follow_up_action: string | null
          id: string
          intervention_catalogue_id: string
          learner_response: string | null
          planned_at: string | null
          recommendation_id: string | null
          session_id: string | null
          skill_id: string
          structured_observation: Json
          student_id: string
          tutor_id: string
          tutor_notes: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          follow_up_action?: string | null
          id?: string
          intervention_catalogue_id: string
          learner_response?: string | null
          planned_at?: string | null
          recommendation_id?: string | null
          session_id?: string | null
          skill_id: string
          structured_observation?: Json
          student_id: string
          tutor_id: string
          tutor_notes?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          follow_up_action?: string | null
          id?: string
          intervention_catalogue_id?: string
          learner_response?: string | null
          planned_at?: string | null
          recommendation_id?: string | null
          session_id?: string | null
          skill_id?: string
          structured_observation?: Json
          student_id?: string
          tutor_id?: string
          tutor_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutor_interventions_intervention_catalogue_id_fkey"
            columns: ["intervention_catalogue_id"]
            isOneToOne: false
            referencedRelation: "intervention_catalogue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_interventions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "grade9_learning_recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_interventions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_interventions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "curriculum_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_interventions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_interventions_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
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
      tutor_recommendation_decisions: {
        Row: {
          created_at: string
          decided_at: string
          decision: Database["public"]["Enums"]["recommendation_decision"]
          id: string
          modified_sequence: string[] | null
          reason: string
          recommendation_id: string
          tutor_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string
          decision: Database["public"]["Enums"]["recommendation_decision"]
          id?: string
          modified_sequence?: string[] | null
          reason: string
          recommendation_id: string
          tutor_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string
          decision?: Database["public"]["Enums"]["recommendation_decision"]
          id?: string
          modified_sequence?: string[] | null
          reason?: string
          recommendation_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_recommendation_decisions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "learning_recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_recommendation_decisions_tutor_id_fkey"
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
      tutor_vetting_records: {
        Row: {
          created_at: string
          evidence_reference: string | null
          expires_at: string | null
          id: string
          reviewed_at: string | null
          reviewed_by_profile_id: string | null
          status: string
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence_reference?: string | null
          expires_at?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by_profile_id?: string | null
          status?: string
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence_reference?: string | null
          expires_at?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by_profile_id?: string | null
          status?: string
          tutor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_vetting_records_reviewed_by_profile_id_fkey"
            columns: ["reviewed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_vetting_records_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: true
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
          is_stale: boolean
          payload_json: Json
          source_watermark: string
          stale_since: string | null
          student_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_stale?: boolean
          payload_json: Json
          source_watermark?: string
          stale_since?: string | null
          student_id: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_stale?: boolean
          payload_json?: Json
          source_watermark?: string
          stale_since?: string | null
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
      begin_assignment_submission_attempt: {
        Args: {
          p_assignment_id: string
          p_content_sha256: string
          p_mime_type: string
          p_original_filename: string
          p_size_bytes: number
          p_storage_key: string
          p_submission_id: string
          p_text_answer: string
          p_text_answer_sha256: string
        }
        Returns: {
          submission_id: string
        }[]
      }
      begin_student_privacy_deletion: {
        Args: { p_request_id: string }
        Returns: Json
      }
      begin_tutor_deletion: { Args: { p_request_id: string }; Returns: Json }
      can_access_learning_student: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      can_manage_learning_for_student: {
        Args: { p_student_id: string }
        Returns: boolean
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
          ai_assignment_snapshot_json: Json
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
          content_sha256: string | null
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
          revision: number
          rubric_scores_json: Json
          size_bytes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          storage_key: string | null
          student_id: string
          submitted_at: string
          text_answer: string | null
          text_answer_sha256: string | null
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
          ai_assignment_snapshot_json: Json
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
          content_sha256: string | null
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
          revision: number
          rubric_scores_json: Json
          size_bytes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          storage_key: string | null
          student_id: string
          submitted_at: string
          text_answer: string | null
          text_answer_sha256: string | null
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "assignment_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_next_notification_outbox_event: {
        Args: never
        Returns: {
          claim_token: string
          id: string
          payload_json: Json
        }[]
      }
      claim_next_student_privacy_deletion: {
        Args: { p_claim_token: string }
        Returns: string
      }
      claim_student_privacy_deletion: {
        Args: { p_claim_token: string; p_request_id: string }
        Returns: Json
      }
      claim_tutor_deletion: {
        Args: { p_claim_token: string; p_request_id: string }
        Returns: Json
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
      confirm_assignment_submission_attempt_digest: {
        Args: {
          p_assignment_id: string
          p_content_sha256: string
          p_submission_id: string
          p_text_answer_sha256: string
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
          client_request_id: string | null
          create_request_fingerprint: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          grade: string | null
          id: string
          memo_url: string | null
          organization_id: string
          revision: number
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
          p_client_request_id: string
          p_description: string
          p_due_date: string
          p_grade: string
          p_organization_id: string
          p_rubric_json: Json
          p_subject_id: string
          p_title: string
        }
        Returns: {
          attachment_url: string | null
          available_from: string | null
          client_request_id: string | null
          create_request_fingerprint: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          grade: string | null
          id: string
          memo_url: string | null
          organization_id: string
          revision: number
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
      create_learning_recommendation: {
        Args: {
          p_mastery_evaluation_id: string
          p_reason: string
          p_reason_codes: string[]
          p_recommendation_type: Database["public"]["Enums"]["intervention_type"]
          p_recommended_sequence: string[]
          p_rule_set_id: string
          p_skill_id: string
          p_student_id: string
        }
        Returns: string
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
      decide_learning_recommendation:
        | {
            Args: {
              p_decision: Database["public"]["Enums"]["recommendation_decision"]
              p_modified_sequence?: string[]
              p_reason: string
              p_recommendation_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_activity_id?: string
              p_decision: string
              p_note?: string
              p_recommendation_id: string
            }
            Returns: {
              activity_id: string
              calculation_version: string
              decided_at: string | null
              decided_by_profile_id: string | null
              decision_note: string | null
              expires_at: string
              id: string
              learner_copy: string
              proposed_at: string
              rationale_json: Json
              skill_id: string
              status: string
              student_id: string
            }
            SetofOptions: {
              from: "*"
              to: "learning_recommendations"
              isOneToOne: true
              isSetofReturn: false
            }
          }
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
      dispatch_notification_outbox_event: {
        Args: { p_claim_token: string; p_event_id: string }
        Returns: string
      }
      enqueue_ai_grading: {
        Args: { p_submission_id: string }
        Returns: boolean
      }
      erase_student_privacy_data: {
        Args: { p_request_id: string }
        Returns: Json
      }
      erase_tutor_data:
        | { Args: { p_request_id: string }; Returns: Json }
        | {
            Args: { p_request_id: string; p_storage_files_removed: number }
            Returns: undefined
          }
      evaluate_learning_attempt: {
        Args: {
          p_is_correct: boolean
          p_learning_attempt_id: string
          p_marks_awarded: number
          p_tutor_observation?: string
        }
        Returns: undefined
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
      fail_notification_outbox_event: {
        Args: {
          p_claim_token: string
          p_error_code: string
          p_event_id: string
        }
        Returns: undefined
      }
      finalize_assignment_publication: {
        Args: {
          p_assignment_id: string
          p_attachment_url: string
          p_description: string
          p_due_date: string
          p_expected_revision?: number
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
          client_request_id: string | null
          create_request_fingerprint: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          grade: string | null
          id: string
          memo_url: string | null
          organization_id: string
          revision: number
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
      finalize_tutor_deletion: { Args: { p_request_id: string }; Returns: Json }
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
          is_stale: boolean
          payload_json: Json
          source_watermark: string
          stale_since: string | null
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
      get_admin_ai_grading_queue: {
        Args: { p_limit?: number }
        Returns: {
          assignment_id: string
          attempts: number
          available_at: string
          last_error: string
          lease_expires_at: string
          status: string
          submission_id: string
        }[]
      }
      get_admin_payroll_view: { Args: { p_week_start: string }; Returns: Json }
      get_admin_progress_reports: { Args: never; Returns: Json }
      get_ai_grading_queue_metrics: {
        Args: never
        Returns: {
          job_count: number
          oldest_available_at: string
          ready_count: number
          status: string
        }[]
      }
      get_approved_diagnostic_blueprint: {
        Args: { p_code: string }
        Returns: {
          purpose: string
          question_version_id: string
          sequence_number: number
        }[]
      }
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
      get_grade9_gold_standard_review_set: { Args: never; Returns: Json }
      get_grade9_learning_pilot_report: { Args: never; Returns: Json }
      get_learning_question: {
        Args: { p_question_version_id: string }
        Returns: {
          activity_type: Database["public"]["Enums"]["question_activity_type"]
          calculator_policy: Database["public"]["Enums"]["calculator_policy"]
          cognitive_level: Database["public"]["Enums"]["caps_cognitive_level"]
          hints: Json
          marks: number
          prompt: string
          question_version_id: string
          representation: Database["public"]["Enums"]["math_representation"]
        }[]
      }
      get_my_learning_recommendations: {
        Args: never
        Returns: {
          activity_reference: string
          activity_summary: string
          activity_title: string
          estimated_minutes: number
          expires_at: string
          learner_copy: string
          recommendation_id: string
          skill_title: string
          skill_topic: string
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
      get_parent_learning_updates: {
        Args: never
        Returns: {
          attendance_rate: number
          completed_work_count: number
          latest_student_summary: string
          next_session_date: string
          session_count: number
          student_id: string
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
      get_question_version_review_bundle: {
        Args: { p_question_version_id: string }
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
      get_tutor_deletion_storage_manifest: {
        Args: { p_request_id: string }
        Returns: Json
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
          p_expected_revision?: number
          p_feedback: string
          p_feedback_released?: boolean
          p_marks_awarded: number
          p_marks_released?: boolean
          p_rubric_scores?: Json
          p_status: Database["public"]["Enums"]["submission_status"]
          p_submission_id: string
        }
        Returns: {
          ai_assignment_snapshot_json: Json
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
          content_sha256: string | null
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
          revision: number
          rubric_scores_json: Json
          size_bytes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          storage_key: string | null
          student_id: string
          submitted_at: string
          text_answer: string | null
          text_answer_sha256: string | null
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
          dedupe_key: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          link: string | null
          metadata_json: Json
          outbox_event_id: string | null
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
      mark_tutor_deletion_auth_banned: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      mark_tutor_deletion_auth_deleted: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      mark_tutor_deletion_storage_deleted: {
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
      monitoring_health_probe: {
        Args: never
        Returns: {
          status: string
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
      recompute_learner_question_type_state: {
        Args: { p_question_type_id: string; p_student_id: string }
        Returns: {
          calculation_version: string
          computed_at: string
          confidence: number
          evidence_count: number
          instructional_state: string
          internal_score: number | null
          question_type_id: string
          recent_trend: number | null
          student_id: string
        }
        SetofOptions: {
          from: "*"
          to: "learner_question_type_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recompute_learner_skill_state: {
        Args: { p_skill_id: string; p_student_id: string }
        Returns: {
          calculation_version: string
          computed_at: string
          confidence: number
          evidence_count: number
          evidence_window_end: string | null
          evidence_window_start: string | null
          instructional_state: string
          internal_score: number | null
          recent_trend: number | null
          skill_id: string
          student_id: string
        }
        SetofOptions: {
          from: "*"
          to: "learner_skill_state"
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
      record_intervention_outcome: {
        Args: {
          p_learning_attempt_skill_evidence_id?: string
          p_mastery_evaluation_id?: string
          p_outcome_note?: string
          p_outcome_stage: string
          p_tutor_intervention_id: string
        }
        Returns: string
      }
      record_learner_misconception: {
        Args: {
          p_learning_attempt_ids?: string[]
          p_misconception_id: string
          p_reason: string
          p_state: Database["public"]["Enums"]["misconception_state"]
          p_student_id: string
        }
        Returns: string
      }
      record_learning_attempt: {
        Args: {
          p_confidence?: number
          p_evidence_context?: Database["public"]["Enums"]["evidence_context"]
          p_idempotency_key?: string
          p_question_version_id: string
          p_response: Json
          p_session_id?: string
          p_source_submission_id?: string
          p_student_id: string
          p_time_spent_seconds?: number
        }
        Returns: string
      }
      record_learning_attempt_hint_open: {
        Args: { p_learning_attempt_id: string; p_question_hint_id: string }
        Returns: undefined
      }
      record_learning_evidence: {
        Args: {
          p_evidence_type: string
          p_learner_visible?: boolean
          p_observed_at?: string
          p_question_type_id?: string
          p_score: number
          p_skill_id: string
          p_source_reference: string
          p_source_submission_id?: string
          p_student_id: string
        }
        Returns: {
          created_at: string
          created_by_profile_id: string | null
          evidence_type: string
          id: string
          learner_visible: boolean
          observed_at: string
          question_type_id: string | null
          reviewed_at: string
          score: number
          skill_id: string
          source_reference: string
          source_submission_id: string | null
          student_id: string
        }
        SetofOptions: {
          from: "*"
          to: "learning_evidence"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_orphaned_assignment_submission_cleanup: {
        Args: { p_removed_count: number }
        Returns: undefined
      }
      record_skill_mastery_evaluation: {
        Args: {
          p_attempt_evidence_ids?: string[]
          p_misconception_ids?: string[]
          p_reason: string
          p_reason_codes: string[]
          p_rule_set_id: string
          p_skill_id: string
          p_state: Database["public"]["Enums"]["mastery_state"]
          p_student_id: string
        }
        Returns: string
      }
      record_student_privacy_deletion_error: {
        Args: { p_error: string; p_request_id: string; p_stage: string }
        Returns: undefined
      }
      record_student_privacy_storage_manifest: {
        Args: { p_files_expected: number; p_request_id: string }
        Returns: undefined
      }
      record_tutor_deletion_error: {
        Args: { p_error: string; p_request_id: string; p_stage: string }
        Returns: undefined
      }
      record_tutor_deletion_storage_manifest: {
        Args: { p_files_expected: number; p_request_id: string }
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
      record_tutor_intervention: {
        Args: {
          p_delivered_at?: string
          p_follow_up_action?: string
          p_intervention_catalogue_id: string
          p_learner_response?: string
          p_recommendation_id?: string
          p_session_id?: string
          p_skill_id: string
          p_structured_observation?: Json
          p_student_id: string
          p_tutor_notes?: string
        }
        Returns: string
      }
      record_tutor_vetting: {
        Args: {
          p_evidence_reference?: string
          p_expires_at?: string
          p_reviewed_at: string
          p_status: string
          p_tutor_id: string
        }
        Returns: {
          created_at: string
          evidence_reference: string | null
          expires_at: string | null
          id: string
          reviewed_at: string | null
          reviewed_by_profile_id: string | null
          status: string
          tutor_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tutor_vetting_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_learning_recommendation: {
        Args: { p_skill_id: string; p_student_id: string }
        Returns: {
          activity_id: string
          calculation_version: string
          decided_at: string | null
          decided_by_profile_id: string | null
          decision_note: string | null
          expires_at: string
          id: string
          learner_copy: string
          proposed_at: string
          rationale_json: Json
          skill_id: string
          status: string
          student_id: string
        }
        SetofOptions: {
          from: "*"
          to: "learning_recommendations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refresh_stale_weekly_reports: {
        Args: { p_limit?: number }
        Returns: number
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
      renew_student_privacy_deletion_lease: {
        Args: { p_claim_token: string; p_request_id: string }
        Returns: boolean
      }
      renew_tutor_deletion_lease: {
        Args: { p_claim_token: string; p_request_id: string }
        Returns: boolean
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
      request_tutor_deletion: {
        Args: { p_reason?: string; p_tutor_id: string }
        Returns: string
      }
      requeue_admin_ai_grading_job: {
        Args: { p_reason: string; p_submission_id: string }
        Returns: boolean
      }
      requeue_ai_grading_job: {
        Args: { p_reason?: string; p_submission_id: string }
        Returns: boolean
      }
      review_question_version: {
        Args: {
          p_question_version_id: string
          p_review_notes?: string
          p_status: Database["public"]["Enums"]["question_review_status"]
        }
        Returns: undefined
      }
      review_question_version_action: {
        Args: {
          p_action: string
          p_question_version_id: string
          p_review_notes?: string
        }
        Returns: undefined
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
          client_request_id: string | null
          create_request_fingerprint: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          grade: string | null
          id: string
          memo_url: string | null
          organization_id: string
          revision: number
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
      validate_question_version_for_approval: {
        Args: { p_question_version_id: string }
        Returns: string[]
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
      attempt_independence: "independent" | "assisted"
      attempt_status: "submitted" | "evaluated" | "voided"
      baseline_source_type: "manual" | "uploaded" | "generated" | "diagnostic"
      calculator_policy:
        | "not_applicable"
        | "not_allowed"
        | "allowed"
        | "required"
      caps_cognitive_level:
        | "knowledge"
        | "routine"
        | "complex"
        | "problem_solving"
      community_moderation_state: "visible" | "flagged"
      community_question_status: "open" | "resolved" | "closed"
      curriculum_source_tier:
        | "DBE"
        | "approved_external"
        | "Odysseus_authored"
        | "AI_draft"
      evidence_context: "formative" | "formal_caps_assessment"
      intervention_type:
        | "worked_example"
        | "faded_example"
        | "contrasting_examples"
        | "guided_practice"
        | "error_analysis"
        | "prerequisite_remediation"
        | "interleaved_practice"
        | "retrieval_practice"
        | "representation_translation"
      invoice_line_type: "session" | "adjustment"
      invoice_status: "draft" | "issued" | "paid"
      learning_activity_stage_type:
        | "retrieval_warm_up"
        | "entry_probe"
        | "prerequisite_check"
        | "worked_example"
        | "faded_example"
        | "guided_practice"
        | "independent_practice"
        | "error_analysis"
        | "interleaved_review"
        | "exit_check"
        | "delayed_retrieval"
      learning_goal_category:
        | "academic"
        | "attendance"
        | "assignment"
        | "career"
        | "intervention"
      learning_goal_status: "active" | "completed" | "paused" | "cancelled"
      mastery_state:
        | "unassessed"
        | "emerging"
        | "developing"
        | "secure"
        | "retained"
      math_representation:
        | "symbolic"
        | "graphical"
        | "tabular"
        | "verbal"
        | "diagrammatic"
      misconception_state: "suspected" | "confirmed" | "resolved"
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
      question_activity_type:
        | "retrieval"
        | "diagnostic"
        | "worked_example"
        | "faded_example"
        | "guided_practice"
        | "independent_practice"
        | "error_analysis"
        | "representation_translation"
        | "interleaved_review"
        | "investigation"
        | "caps_assessment"
        | "delayed_retention"
      question_review_status:
        | "draft"
        | "in_review"
        | "approved"
        | "rejected"
        | "retired"
      recommendation_decision: "accepted" | "modified" | "rejected"
      recommendation_status:
        | "open"
        | "accepted"
        | "modified"
        | "rejected"
        | "completed"
        | "cancelled"
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
      attempt_independence: ["independent", "assisted"],
      attempt_status: ["submitted", "evaluated", "voided"],
      baseline_source_type: ["manual", "uploaded", "generated", "diagnostic"],
      calculator_policy: [
        "not_applicable",
        "not_allowed",
        "allowed",
        "required",
      ],
      caps_cognitive_level: [
        "knowledge",
        "routine",
        "complex",
        "problem_solving",
      ],
      community_moderation_state: ["visible", "flagged"],
      community_question_status: ["open", "resolved", "closed"],
      curriculum_source_tier: [
        "DBE",
        "approved_external",
        "Odysseus_authored",
        "AI_draft",
      ],
      evidence_context: ["formative", "formal_caps_assessment"],
      intervention_type: [
        "worked_example",
        "faded_example",
        "contrasting_examples",
        "guided_practice",
        "error_analysis",
        "prerequisite_remediation",
        "interleaved_practice",
        "retrieval_practice",
        "representation_translation",
      ],
      invoice_line_type: ["session", "adjustment"],
      invoice_status: ["draft", "issued", "paid"],
      learning_activity_stage_type: [
        "retrieval_warm_up",
        "entry_probe",
        "prerequisite_check",
        "worked_example",
        "faded_example",
        "guided_practice",
        "independent_practice",
        "error_analysis",
        "interleaved_review",
        "exit_check",
        "delayed_retrieval",
      ],
      learning_goal_category: [
        "academic",
        "attendance",
        "assignment",
        "career",
        "intervention",
      ],
      learning_goal_status: ["active", "completed", "paused", "cancelled"],
      mastery_state: [
        "unassessed",
        "emerging",
        "developing",
        "secure",
        "retained",
      ],
      math_representation: [
        "symbolic",
        "graphical",
        "tabular",
        "verbal",
        "diagrammatic",
      ],
      misconception_state: ["suspected", "confirmed", "resolved"],
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
      question_activity_type: [
        "retrieval",
        "diagnostic",
        "worked_example",
        "faded_example",
        "guided_practice",
        "independent_practice",
        "error_analysis",
        "representation_translation",
        "interleaved_review",
        "investigation",
        "caps_assessment",
        "delayed_retention",
      ],
      question_review_status: [
        "draft",
        "in_review",
        "approved",
        "rejected",
        "retired",
      ],
      recommendation_decision: ["accepted", "modified", "rejected"],
      recommendation_status: [
        "open",
        "accepted",
        "modified",
        "rejected",
        "completed",
        "cancelled",
      ],
      record_status: ["active", "inactive", "pending", "approved", "suspended"],
      session_status: ["draft", "submitted", "approved", "rejected"],
      submission_status: ["not_submitted", "submitted", "marked", "returned"],
      user_role: ["student", "tutor", "admin", "parent", "ngo_partner"],
      volunteer_event_status: ["planned", "cancelled", "completed"],
      volunteer_log_status: ["signed_up", "submitted", "verified", "rejected"],
    },
  },
} as const

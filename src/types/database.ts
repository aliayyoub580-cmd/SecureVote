export type UserRole = 'super_admin' | 'election_creator' | 'voter'

export type CreatorApplicationStatus = 'none' | 'pending' | 'approved' | 'rejected'

export type ElectionStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'closed'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          phone: string | null
          organization: string | null
          role: UserRole
          creator_application_status: CreatorApplicationStatus
          creator_application_rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          organization?: string | null
          role?: UserRole
          creator_application_status?: CreatorApplicationStatus
          creator_application_rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string | null
          email?: string | null
          phone?: string | null
          organization?: string | null
          role?: UserRole
          creator_application_status?: CreatorApplicationStatus
          creator_application_rejection_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      elections: {
        Row: {
          id: string
          title: string
          description: string | null
          description_html: string | null
          category: string | null
          organization: string | null
          max_voters: number | null
          status: ElectionStatus
          starts_at: string
          ends_at: string
          registration_opens_at: string | null
          registration_closes_at: string | null
          created_by: string
          approved_by: string | null
          approved_at: string | null
          rejection_reason: string | null
          suspended: boolean
          registrant_count: number
          waitlist_count: number
          votes_version: number
          visibility: 'public' | 'private'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          description_html?: string | null
          category?: string | null
          organization?: string | null
          max_voters?: number | null
          status?: ElectionStatus
          starts_at: string
          ends_at: string
          registration_opens_at?: string | null
          registration_closes_at?: string | null
          created_by: string
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          suspended?: boolean
          registrant_count?: number
          waitlist_count?: number
          votes_version?: number
          visibility?: 'public' | 'private'
        }
        Update: {
          title?: string
          description?: string | null
          description_html?: string | null
          category?: string | null
          organization?: string | null
          max_voters?: number | null
          status?: ElectionStatus
          starts_at?: string
          ends_at?: string
          registration_opens_at?: string | null
          registration_closes_at?: string | null
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          suspended?: boolean
          registrant_count?: number
          waitlist_count?: number
          votes_version?: number
          visibility?: 'public' | 'private'
        }
        Relationships: []
      }
      election_polls: {
        Row: {
          id: string
          election_id: string
          title: string
          description: string | null
          display_order: number
          allow_comments: boolean
          created_at: string
        }
        Insert: {
          id?: string
          election_id: string
          title: string
          description?: string | null
          display_order?: number
          allow_comments?: boolean
        }
        Update: {
          title?: string
          description?: string | null
          display_order?: number
          allow_comments?: boolean
        }
        Relationships: []
      }
      election_candidates: {
        Row: {
          id: string
          election_id: string
          poll_id: string
          name: string
          designation: string | null
          bio: string | null
          manifesto: string | null
          image_path: string | null
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          election_id: string
          poll_id: string
          name: string
          designation?: string | null
          bio?: string | null
          manifesto?: string | null
          image_path?: string | null
          display_order?: number
        }
        Update: {
          poll_id?: string
          name?: string
          designation?: string | null
          bio?: string | null
          manifesto?: string | null
          image_path?: string | null
          display_order?: number
        }
        Relationships: []
      }
      election_waitlist: {
        Row: {
          id: string
          election_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          election_id: string
          user_id: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      election_voter_id_seq: {
        Row: {
          election_id: string
          n: number
        }
        Insert: {
          election_id: string
          n?: number
        }
        Update: {
          n?: number
        }
        Relationships: []
      }
      voter_public_ids: {
        Row: {
          id: string
          election_id: string
          user_id: string
          ballot_token_id: string
          public_id: string
          sequence_num: number
          revoked_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          election_id: string
          user_id: string
          ballot_token_id: string
          public_id: string
          sequence_num: number
          revoked_at?: string | null
        }
        Update: {
          revoked_at?: string | null
        }
        Relationships: []
      }
      ballot_tokens: {
        Row: {
          id: string
          election_id: string
          user_id: string
          token_hash: string
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          election_id: string
          user_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          used_at?: string | null
        }
        Relationships: []
      }
      votes: {
        Row: {
          id: string
          election_id: string
          candidate_id: string
          ballot_token_id: string
          poll_id: string
          comment: string | null
          cast_at: string
        }
        Insert: {
          id?: string
          election_id: string
          candidate_id: string
          ballot_token_id: string
          poll_id: string
          comment?: string | null
        }
        Update: Record<string, never>
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          metadata: Json
          created_at: string
          ip_address: string | null
          user_agent: string | null
          device_label: string | null
          category: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          resource_type: string
          resource_id?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          device_label?: string | null
          category?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          body: string | null
          type: string
          link_path: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          body?: string | null
          type?: string
          link_path?: string | null
        }
        Update: {
          read_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      record_audit_event: {
        Args: {
          p_action: string
          p_resource_type: string
          p_resource_id: string | null
          p_metadata: Json
          p_ip: string
          p_user_agent: string
          p_device_label: string
          p_category: string
        }
        Returns: string
      }
      admin_list_audit_logs: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_category?: string | null
          p_action_prefix?: string | null
          p_actor_id?: string | null
          p_resource_type?: string | null
          p_search?: string | null
          p_from?: string | null
          p_to?: string | null
        }
        Returns: Json
      }
      register_for_election: { Args: { p_election_id: string; p_accept_terms: boolean }; Returns: Json }
      get_registration_status_for_user: { Args: { p_election_id: string }; Returns: Json }
      list_election_waitlist: {
        Args: { p_election_id: string }
        Returns: { user_id: string; created_at: string; queue_position: number }[]
      }
      get_my_voter_public_id: { Args: { p_election_id: string }; Returns: Json }
      regenerate_my_voter_public_id: { Args: { p_election_id: string }; Returns: Json }
      validate_voter_public_id: { Args: { p_election_id: string; p_code: string }; Returns: Json }
      get_election_live_stats: { Args: { p_election_id: string }; Returns: Json }
      autoclose_expired_elections: { Args: Record<string, never>; Returns: number }
      cast_vote: {
        Args: {
          p_election_id: string
          p_candidate_id: string
          p_secret_token: string
        }
        Returns: Json
      }
      submit_ballot: {
        Args: { p_election_id: string; p_secret_token: string; p_selections: Json }
        Returns: Json
      }
      get_election_results: { Args: { p_election_id: string }; Returns: Json }
      get_landing_vote_totals: {
        Args: Record<string, never>
        Returns: { election_id: string; vote_count: number }[]
      }
      list_election_registrants: {
        Args: { p_election_id: string }
        Returns: {
          user_id: string
          registered_at: string
          has_voted: boolean
        }[]
      }
      admin_overview_stats: { Args: Record<string, never>; Returns: Json }
      admin_vote_trend: { Args: Record<string, never>; Returns: Json }
      admin_notify_user: {
        Args: { p_user_id: string; p_title: string; p_body: string; p_link_path?: string | null }
        Returns: null
      }
      admin_reset_ballot_lock: {
        Args: { p_election_id: string; p_user_id: string }
        Returns: Json
      }
      creator_start_voting_now: { Args: { p_election_id: string }; Returns: Json }
      creator_close_voting_now: { Args: { p_election_id: string }; Returns: Json }
    }
    Enums: {
      user_role: UserRole
      election_status: ElectionStatus
      creator_application_status: CreatorApplicationStatus
    }
    CompositeTypes: Record<string, never>
  }
}

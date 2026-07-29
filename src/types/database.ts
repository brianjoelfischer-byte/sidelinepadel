// GENERADO POR scripts/db-types.mjs — NO EDITAR A MANO.
// Regenerar con `npm run db:types` después de cambiar el esquema.
//
// Se deriva del esquema real de la base. Escribir estos tipos a mano
// garantizaría que en algún momento mientan sobre lo que hay en Postgres.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  // supabase-js lo usa para elegir su motor de inferencia de tipos.
  __InternalSupabase: { PostgrestVersion: '13.0.5' };
  public: {
    Tables: {
      abuse_reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          target_type: 'profile' | 'session' | 'offer' | 'venue';
          target_id: string;
          reason: string;
          state: 'open' | 'reviewing' | 'resolved' | 'dismissed';
          resolved_by: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          reporter_id?: string | null;
          target_type: 'profile' | 'session' | 'offer' | 'venue';
          target_id: string;
          reason: string;
          state?: 'open' | 'reviewing' | 'resolved' | 'dismissed';
          resolved_by?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['abuse_reports']['Insert']>;
        Relationships: [];
      };
      achievements: {
        Row: {
          code: string;
          name_key: string;
          description_key: string;
          icon: string;
          criteria: Json;
          sort_order: number;
        };
        Insert: {
          code: string;
          name_key: string;
          description_key: string;
          icon: string;
          criteria?: Json;
          sort_order?: number;
        };
        Update: Partial<Database['public']['Tables']['achievements']['Insert']>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          metadata: Json;
          ip_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          metadata?: Json;
          ip_hash?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
        Relationships: [];
      };
      blocks: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['blocks']['Insert']>;
        Relationships: [];
      };
      follows: {
        Row: {
          follower_id: string;
          followee_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          followee_id: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['follows']['Insert']>;
        Relationships: [];
      };
      invite_suppressions: {
        Row: {
          email_hash: string;
          reason: 'unsubscribed' | 'reported' | 'bounced';
          created_at: string;
        };
        Insert: {
          email_hash: string;
          reason: 'unsubscribed' | 'reported' | 'bounced';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['invite_suppressions']['Insert']>;
        Relationships: [];
      };
      level_history: {
        Row: {
          id: string;
          profile_id: string;
          field: 'declared' | 'effective';
          from_value: number | null;
          to_value: number;
          reason: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          field: 'declared' | 'effective';
          from_value?: number | null;
          to_value: number;
          reason?: string | null;
          changed_at?: string;
        };
        Update: Partial<Database['public']['Tables']['level_history']['Insert']>;
        Relationships: [];
      };
      level_ratings: {
        Row: {
          id: string;
          session_id: string;
          rater_id: string;
          subject_id: string;
          value: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          rater_id: string;
          subject_id: string;
          value: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['level_ratings']['Insert']>;
        Relationships: [];
      };
      match_invitations: {
        Row: {
          id: string;
          offer_id: string;
          inviter_id: string;
          invitee_id: string | null;
          invitee_email: string | null;
          token_hash: string | null;
          state: 'sent' | 'accepted' | 'declined' | 'expired' | 'revoked';
          holds_spot: boolean;
          expires_at: string;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          offer_id: string;
          inviter_id: string;
          invitee_id?: string | null;
          invitee_email?: string | null;
          token_hash?: string | null;
          state?: 'sent' | 'accepted' | 'declined' | 'expired' | 'revoked';
          holds_spot?: boolean;
          expires_at: string;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['match_invitations']['Insert']>;
        Relationships: [];
      };
      match_offers: {
        Row: {
          id: string;
          creator_id: string;
          venue_id: string | null;
          venue_freetext: string | null;
          court_label: string | null;
          starts_at: string;
          duration_min: number;
          timezone: string;
          level_min: number;
          level_max: number;
          spots_open: number;
          guests_count: number;
          visibility: 'public' | 'followers' | 'invite_only';
          court_status: 'pending' | 'secured' | 'lost';
          court_secured_at: string | null;
          court_lost_reason: string | null;
          roster_status: 'open' | 'full' | 'cancelled' | 'completed';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          venue_id?: string | null;
          venue_freetext?: string | null;
          court_label?: string | null;
          starts_at: string;
          duration_min?: number;
          timezone: string;
          level_min: number;
          level_max: number;
          spots_open: number;
          guests_count?: number;
          visibility?: 'public' | 'followers' | 'invite_only';
          court_status?: 'pending' | 'secured' | 'lost';
          court_secured_at?: string | null;
          court_lost_reason?: string | null;
          roster_status?: 'open' | 'full' | 'cancelled' | 'completed';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['match_offers']['Insert']>;
        Relationships: [];
      };
      match_participants: {
        Row: {
          id: string;
          offer_id: string;
          profile_id: string;
          state: 'requested' | 'accepted' | 'declined' | 'withdrawn';
          attendance: 'pending' | 'tentative' | 'going' | 'not_going';
          attendance_at: string | null;
          tentative_until: string | null;
          origin: 'request' | 'invitation' | 'creator';
          requested_at: string;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          offer_id: string;
          profile_id: string;
          state?: 'requested' | 'accepted' | 'declined' | 'withdrawn';
          attendance?: 'pending' | 'tentative' | 'going' | 'not_going';
          attendance_at?: string | null;
          tentative_until?: string | null;
          origin?: 'request' | 'invitation' | 'creator';
          requested_at?: string;
          decided_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['match_participants']['Insert']>;
        Relationships: [];
      };
      profile_achievements: {
        Row: {
          profile_id: string;
          achievement_code: string;
          unlocked_at: string;
        };
        Insert: {
          profile_id: string;
          achievement_code: string;
          unlocked_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profile_achievements']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          slug: string;
          avatar_path: string | null;
          country_code: string;
          locale: string;
          timezone: string;
          declared_level: number;
          perceived_level: number | null;
          effective_level: number;
          rater_count: number;
          level_locked_until: string | null;
          level_updated_at: string;
          preferred_side: 'drive' | 'reves' | 'indistinto' | null;
          preferred_hand: 'left' | 'right' | null;
          racket: string | null;
          birth_date: string;
          is_public: boolean;
          role: 'player' | 'moderator' | 'admin';
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          display_name: string;
          slug: string;
          avatar_path?: string | null;
          country_code: string;
          locale?: string;
          timezone: string;
          declared_level: number;
          perceived_level?: number | null;
          effective_level: number;
          rater_count?: number;
          level_locked_until?: string | null;
          level_updated_at?: string;
          preferred_side?: 'drive' | 'reves' | 'indistinto' | null;
          preferred_hand?: 'left' | 'right' | null;
          racket?: string | null;
          birth_date: string;
          is_public?: boolean;
          role?: 'player' | 'moderator' | 'admin';
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          user_agent: string | null;
          created_at: string;
          last_ok_at: string | null;
          failure_count: number;
        };
        Insert: {
          id?: string;
          profile_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          user_agent?: string | null;
          created_at?: string;
          last_ok_at?: string | null;
          failure_count?: number;
        };
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Insert']>;
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          offer_id: string;
          profile_id: string;
          kind: 'confirm_request' | 'court_nudge' | 'tentative_expiry' | 'match_reminder';
          channel: 'push' | 'email';
          fire_at: string;
          state: 'pending' | 'sent' | 'failed' | 'cancelled';
          attempts: number;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          offer_id: string;
          profile_id: string;
          kind: 'confirm_request' | 'court_nudge' | 'tentative_expiry' | 'match_reminder';
          channel: 'push' | 'email';
          fire_at: string;
          state?: 'pending' | 'sent' | 'failed' | 'cancelled';
          attempts?: number;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['reminders']['Insert']>;
        Relationships: [];
      };
      session_participants: {
        Row: {
          id: string;
          session_id: string;
          profile_id: string | null;
          guest_name: string | null;
          team: 'mine' | 'opponent';
          perceived_level: number | null;
          confirmed_at: string | null;
          rejected_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          profile_id?: string | null;
          guest_name?: string | null;
          team: 'mine' | 'opponent';
          perceived_level?: number | null;
          confirmed_at?: string | null;
          rejected_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['session_participants']['Insert']>;
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          owner_id: string;
          kind: 'match' | 'training' | 'quick_match';
          played_on: string;
          venue_id: string | null;
          venue_freetext: string | null;
          result: 'win' | 'loss' | 'draw' | null;
          sets: Json | null;
          side_played: 'drive' | 'reves' | null;
          self_rating: number | null;
          opponents_avg_level: number | null;
          notes: string | null;
          tournament_match_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          kind: 'match' | 'training' | 'quick_match';
          played_on: string;
          venue_id?: string | null;
          venue_freetext?: string | null;
          result?: 'win' | 'loss' | 'draw' | null;
          sets?: Json | null;
          side_played?: 'drive' | 'reves' | null;
          self_rating?: number | null;
          opponents_avg_level?: number | null;
          notes?: string | null;
          tournament_match_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['sessions']['Insert']>;
        Relationships: [];
      };
      venues: {
        Row: {
          id: string;
          name: string;
          country_code: string;
          admin_area: string | null;
          city: string | null;
          address: string | null;
          location: unknown;
          timezone: string;
          courts_count: number | null;
          surface_notes: string | null;
          source: 'osm' | 'user' | 'import';
          osm_type: 'node' | 'way' | 'relation' | null;
          osm_id: number | null;
          status: 'pending' | 'approved' | 'rejected' | 'duplicate';
          submitted_by: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          country_code: string;
          admin_area?: string | null;
          city?: string | null;
          address?: string | null;
          location: unknown;
          timezone: string;
          courts_count?: number | null;
          surface_notes?: string | null;
          source: 'osm' | 'user' | 'import';
          osm_type?: 'node' | 'way' | 'relation' | null;
          osm_id?: number | null;
          status?: 'pending' | 'approved' | 'rejected' | 'duplicate';
          submitted_by?: string | null;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['venues']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

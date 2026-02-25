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
      activity_log: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          points: number | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          points?: number | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          points?: number | null
          user_id?: string
        }
        Relationships: []
      }
      habit_completions: {
        Row: {
          completed_at: string | null
          count: number | null
          date: string | null
          habit_id: string
          id: string
        }
        Insert: {
          completed_at?: string | null
          count?: number | null
          date?: string | null
          habit_id: string
          id?: string
        }
        Update: {
          completed_at?: string | null
          count?: number | null
          date?: string | null
          habit_id?: string
          id?: string
        }
        Relationships: []
      }
      habits: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          frequency_days: number[] | null
          frequency_type: string | null
          icon: string | null
          id: string
          is_archived: boolean | null
          nag_enabled: boolean | null
          name: string
          position: number | null
          reminder_time: string | null
          target_count: number | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          frequency_days?: number[] | null
          frequency_type?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          nag_enabled?: boolean | null
          name: string
          position?: number | null
          reminder_time?: string | null
          target_count?: number | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          frequency_days?: number[] | null
          frequency_type?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          nag_enabled?: boolean | null
          name?: string
          position?: number | null
          reminder_time?: string | null
          target_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          position: number | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          position?: number | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          position?: number | null
          user_id?: string
        }
        Relationships: []
      }
      pomodoro_sessions: {
        Row: {
          actual: number | null
          completed: boolean | null
          duration: number
          ended_at: string | null
          id: string
          started_at: string | null
          task_id: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          actual?: number | null
          completed?: boolean | null
          duration: number
          ended_at?: string | null
          id?: string
          started_at?: string | null
          task_id?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          actual?: number | null
          completed?: boolean | null
          duration?: number
          ended_at?: string | null
          id?: string
          started_at?: string | null
          task_id?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          settings: Json | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          settings?: Json | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          settings?: Json | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean | null
          is_favorite: boolean | null
          name: string
          parent_id: string | null
          position: number | null
          updated_at: string | null
          user_id: string
          view_type: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          name: string
          parent_id?: string | null
          position?: number | null
          updated_at?: string | null
          user_id: string
          view_type?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          name?: string
          parent_id?: string | null
          position?: number | null
          updated_at?: string | null
          user_id?: string
          view_type?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          device_name: string | null
          id: string
          is_active: boolean | null
          subscription: Json
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_name?: string | null
          id?: string
          is_active?: boolean | null
          subscription: Json
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_name?: string | null
          id?: string
          is_active?: boolean | null
          subscription?: Json
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string | null
          id: string
          is_sent: boolean | null
          relative_minutes: number | null
          remind_at: string | null
          task_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_sent?: boolean | null
          relative_minutes?: number | null
          remind_at?: string | null
          task_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_sent?: boolean | null
          relative_minutes?: number | null
          remind_at?: string | null
          task_id?: string
        }
        Relationships: []
      }
      sections: {
        Row: {
          created_at: string | null
          id: string
          is_collapsed: boolean | null
          name: string
          position: number | null
          project_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_collapsed?: boolean | null
          name: string
          position?: number | null
          project_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_collapsed?: boolean | null
          name?: string
          position?: number | null
          project_id?: string
        }
        Relationships: []
      }
      task_labels: {
        Row: {
          label_id: string
          task_id: string
        }
        Insert: {
          label_id: string
          task_id: string
        }
        Update: {
          label_id?: string
          task_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          duration_minutes: number | null
          id: string
          is_completed: boolean | null
          is_deleted: boolean | null
          last_nag_at: string | null
          nag_enabled: boolean | null
          nag_interval: number | null
          parent_id: string | null
          position: number | null
          priority: number | null
          project_id: string | null
          recurrence_rule: string | null
          recurrence_type: string | null
          reminder_enabled: boolean | null
          section_id: string | null
          snooze_until: string | null
          start_date: string | null
          start_time: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean | null
          is_deleted?: boolean | null
          last_nag_at?: string | null
          nag_enabled?: boolean | null
          nag_interval?: number | null
          parent_id?: string | null
          position?: number | null
          priority?: number | null
          project_id?: string | null
          recurrence_rule?: string | null
          recurrence_type?: string | null
          reminder_enabled?: boolean | null
          section_id?: string | null
          snooze_until?: string | null
          start_date?: string | null
          start_time?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean | null
          is_deleted?: boolean | null
          last_nag_at?: string | null
          nag_enabled?: boolean | null
          nag_interval?: number | null
          parent_id?: string | null
          position?: number | null
          priority?: number | null
          project_id?: string | null
          recurrence_rule?: string | null
          recurrence_type?: string | null
          reminder_enabled?: boolean | null
          section_id?: string | null
          snooze_until?: string | null
          start_date?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience types
export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']
export type TaskUpdate = Database['public']['Tables']['tasks']['Update']
export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type Section = Database['public']['Tables']['sections']['Row']
export type SectionInsert = Database['public']['Tables']['sections']['Insert']
export type Label = Database['public']['Tables']['labels']['Row']
export type LabelInsert = Database['public']['Tables']['labels']['Insert']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Reminder = Database['public']['Tables']['reminders']['Row']
export type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row']
export type Habit = Database['public']['Tables']['habits']['Row']
export type HabitCompletion = Database['public']['Tables']['habit_completions']['Row']
export type PomodoroSession = Database['public']['Tables']['pomodoro_sessions']['Row']
export type ActivityLog = Database['public']['Tables']['activity_log']['Row']

// Task with relations
export type TaskWithRelations = Task & {
  project?: Project | null
  section?: Section | null
  labels?: Label[]
  subtasks?: Task[]
  parent?: Task | null
}

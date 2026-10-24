export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json | undefined };
export type ProfileRow = {
  user_id: string;
  name: string;
  location: string;
  target_role: string;
  language: string;
  experience: string;
  skills: string;
  availability: string;
  updated_at: string;
};
export type JobRow = {
  id: string;
  owner_id: string;
  title: string;
  company: string;
  location: string;
  category: string;
  type: string;
  salary_min: number | null;
  salary_max: number | null;
  description: string;
  requirements: string;
  shift: string;
  deadline: string | null;
  status: string;
  version: number;
  embedding: Json | null;
  embedding_model: string | null;
  created_at: string;
  updated_at: string;
};
export type ApplicationRow = {
  id: string;
  job_id: string;
  candidate_id: string;
  snapshot: Json;
  job_version: number;
  status: string;
  created_at: string;
  updated_at: string;
};
type ReadOnlyTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};
export type Database = {
  public: {
    Tables: {
      profiles: ReadOnlyTable<ProfileRow>;
      jobs: ReadOnlyTable<JobRow>;
      applications: Omit<ReadOnlyTable<ApplicationRow>, "Relationships"> & {
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      save_profile: {
        Args: { p_profile: Json; p_confirmed: boolean };
        Returns: Json;
      };
      create_job: { Args: { p_job: Json }; Returns: Json };
      set_job_status: {
        Args: { p_job_id: string; p_status: string };
        Returns: Json;
      };
      submit_application: {
        Args: { p_job_id: string; p_version: number; p_confirmed: boolean };
        Returns: Json;
      };
      set_application_status: {
        Args: { p_application_id: string; p_status: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

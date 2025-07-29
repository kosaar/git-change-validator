export type ValidationStatus = 'PENDING_VALIDATION' | 'INTEGRATION_IN_PROGRESS' | 'INTEGRATED' | 'ERROR';
export type IntegrationResult = 'SUCCESS' | 'FAILURE';

export interface ValidationTask {
  id: string;
  status: ValidationStatus;
  git_branch: string;
  reference_commit_hash?: string;
  current_commit_hash: string;
  diff_file_name: string;
  diff_file_path?: string;
  diff_file_generated_at: string;
  generation_job_id: string;
  validator_user_id?: string;
  validated_file_path?: string;
  validated_file_uploaded_at?: string;
  integration_result?: IntegrationResult;
  error_message?: string;
  error_file_link?: string;
  integration_completed_at?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface LdapUser {
  supabase_user_id: string;
  ldap_username: string;
  ldap_email: string;
  ldap_display_name: string;
  ldap_groups: string[];
  last_login?: string;
}

export interface Database {
  public: {
    Tables: {
      validation_tasks: {
        Row: ValidationTask;
        Insert: Omit<ValidationTask, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ValidationTask, 'id' | 'created_at'>>;
      };
      ldap_users: {
        Row: LdapUser;
        Insert: Omit<LdapUser, 'last_login'>;
        Update: Partial<LdapUser>;
      };
    };
  };
}
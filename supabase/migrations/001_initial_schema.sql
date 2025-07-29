-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE validation_status AS ENUM (
  'PENDING_VALIDATION',
  'INTEGRATION_IN_PROGRESS', 
  'INTEGRATED',
  'ERROR'
);

CREATE TYPE integration_result_type AS ENUM ('SUCCESS', 'FAILURE');

-- Create LDAP users mapping table
CREATE TABLE ldap_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  ldap_username TEXT UNIQUE NOT NULL,
  ldap_email TEXT NOT NULL,
  ldap_display_name TEXT NOT NULL,
  ldap_groups TEXT[] DEFAULT '{}',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create validation tasks table
CREATE TABLE validation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status validation_status NOT NULL DEFAULT 'PENDING_VALIDATION',
  git_branch TEXT NOT NULL,
  reference_commit_hash TEXT,
  current_commit_hash TEXT NOT NULL,
  diff_file_name TEXT NOT NULL,
  diff_file_path TEXT,
  diff_file_generated_at TIMESTAMPTZ NOT NULL,
  generation_job_id TEXT NOT NULL,
  validator_user_id UUID REFERENCES auth.users(id),
  validated_file_path TEXT,
  validated_file_uploaded_at TIMESTAMPTZ,
  integration_result integration_result_type,
  error_message TEXT,
  error_file_link TEXT,
  integration_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_validation_tasks_status ON validation_tasks(status);
CREATE INDEX idx_validation_tasks_git_branch ON validation_tasks(git_branch);
CREATE INDEX idx_validation_tasks_created_at ON validation_tasks(created_at DESC);
CREATE INDEX idx_validation_tasks_validator ON validation_tasks(validator_user_id);
CREATE INDEX idx_ldap_users_username ON ldap_users(ldap_username);
CREATE INDEX idx_ldap_users_supabase_id ON ldap_users(supabase_user_id);

-- Enable Row Level Security
ALTER TABLE validation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ldap_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for validation_tasks
-- Policy: Users can view all validation tasks
CREATE POLICY "Users can view all validation tasks" ON validation_tasks
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Policy: Users can create validation tasks
CREATE POLICY "Users can create validation tasks" ON validation_tasks
  FOR INSERT 
  WITH CHECK (auth.uid() = created_by);

-- Policy: Users can update validation tasks (validators can assign themselves)
CREATE POLICY "Users can update validation tasks" ON validation_tasks
  FOR UPDATE 
  USING (auth.role() = 'authenticated');

-- RLS Policies for ldap_users
-- Policy: Users can view their own LDAP info
CREATE POLICY "Users can view their own LDAP info" ON ldap_users
  FOR SELECT 
  USING (auth.uid() = supabase_user_id);

-- Policy: Service role can manage LDAP users
CREATE POLICY "Service role can manage LDAP users" ON ldap_users
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_validation_tasks_updated_at 
  BEFORE UPDATE ON validation_tasks 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ldap_users_updated_at 
  BEFORE UPDATE ON ldap_users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES 
  ('diff-files', 'diff-files', false, 52428800, ARRAY['text/csv', 'application/csv']),
  ('validated-files', 'validated-files', false, 52428800, ARRAY['text/csv', 'application/csv']);

-- Storage policies for diff-files bucket
CREATE POLICY "Authenticated users can upload diff files" ON storage.objects
  FOR INSERT 
  WITH CHECK (bucket_id = 'diff-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view diff files" ON storage.objects
  FOR SELECT 
  USING (bucket_id = 'diff-files' AND auth.role() = 'authenticated');

CREATE POLICY "Service role can manage diff files" ON storage.objects
  FOR ALL 
  USING (bucket_id = 'diff-files' AND auth.role() = 'service_role');

-- Storage policies for validated-files bucket
CREATE POLICY "Authenticated users can upload validated files" ON storage.objects
  FOR INSERT 
  WITH CHECK (bucket_id = 'validated-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view validated files" ON storage.objects
  FOR SELECT 
  USING (bucket_id = 'validated-files' AND auth.role() = 'authenticated');

CREATE POLICY "Service role can manage validated files" ON storage.objects
  FOR ALL 
  USING (bucket_id = 'validated-files' AND auth.role() = 'service_role');

-- Function to check if user is in specific LDAP group
CREATE OR REPLACE FUNCTION check_ldap_group(user_id UUID, group_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_groups TEXT[];
BEGIN
  SELECT ldap_groups INTO user_groups 
  FROM ldap_users 
  WHERE supabase_user_id = user_id;
  
  RETURN group_name = ANY(user_groups);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's LDAP info
CREATE OR REPLACE FUNCTION get_user_ldap_info(user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  username TEXT,
  email TEXT,
  display_name TEXT,
  groups TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.ldap_username,
    l.ldap_email,
    l.ldap_display_name,
    l.ldap_groups
  FROM ldap_users l
  WHERE l.supabase_user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for enhanced validation tasks with LDAP info
CREATE VIEW validation_tasks_with_ldap AS
SELECT 
  vt.*,
  creator.ldap_username as created_by_username,
  creator.ldap_display_name as created_by_display_name,
  validator.ldap_username as validator_username,
  validator.ldap_display_name as validator_display_name
FROM validation_tasks vt
LEFT JOIN ldap_users creator ON vt.created_by = creator.supabase_user_id
LEFT JOIN ldap_users validator ON vt.validator_user_id = validator.supabase_user_id;
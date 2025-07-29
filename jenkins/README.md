# Jenkins Configuration for Git Change Validator

This directory contains Jenkins job configurations and setup scripts for the Git Change Validator application.

## Jobs Overview

### 1. generate-diff
- **Purpose**: Generates diff files between git branches for validation
- **Triggers**: Called by Supabase Edge Function when a new validation task is created
- **Parameters**:
  - `GIT_BRANCH`: The git branch to generate diff for
  - `REFERENCE_COMMIT_HASH`: Optional reference commit (defaults to origin/main)
- **Artifacts**: 
  - `diff.csv`: CSV file containing the changes
  - `metadata.json`: Build metadata
  - `changed_files.txt`: List of changed files

### 2. integrate-changes
- **Purpose**: Integrates validated CSV changes into the main repository
- **Triggers**: Called by Supabase Edge Function when a validation is approved
- **Parameters**:
  - `TASK_ID`: Validation task ID from Supabase
  - `validated.csv`: The validated CSV file to integrate
- **Artifacts**: 
  - `integration_report.json`: Integration results
  - `validated.csv`: Copy of the validated file

## Setup Instructions

### Prerequisites
- Jenkins server running with admin access
- Git repository with appropriate credentials configured
- Supabase instance running and accessible
- Required environment variables configured

### Environment Variables
```bash
export JENKINS_URL="http://your-jenkins-server:8080"
export JENKINS_USER="admin"
export JENKINS_TOKEN="your-jenkins-api-token"
export GIT_REPOSITORY_URL="https://github.com/company/main-data-repo.git"
export GIT_CREDENTIALS_ID="git-credentials"
export SUPABASE_URL="http://localhost:8000"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export SUPABASE_ANON_KEY="your-anon-key"
```

### Run Setup Script
```bash
cd jenkins
./setup-jenkins.sh
```

### Manual Configuration Steps

1. **Configure Git Credentials**:
   - Go to Jenkins → Manage Jenkins → Manage Credentials
   - Add new credentials with ID `git-credentials` (or update GIT_CREDENTIALS_ID)
   - Type: Username with password or SSH Username with private key

2. **Install Required Plugins**:
   - Git Plugin
   - Pipeline Plugin
   - Post Build Script Plugin
   - Build Timeout Plugin
   - Workspace Cleanup Plugin

3. **Test Jobs**:
   - Run `generate-diff` job with test parameters
   - Verify webhook notifications are sent to Supabase
   - Check artifacts are generated correctly

## Job Configuration Details

### Webhook Integration
Both jobs send webhook notifications to Supabase Edge Functions:
- **Endpoint**: `${SUPABASE_URL}/functions/v1/jenkins-webhook`
- **Authentication**: Bearer token using `SUPABASE_SERVICE_ROLE_KEY`
- **Payload**: Job status, artifacts URLs, and metadata

### Security Considerations
- Jenkins API tokens should be stored securely
- Supabase service role keys should be protected
- Git credentials should use SSH keys or personal access tokens
- Consider IP whitelisting for webhook endpoints

### Error Handling
- Jobs will fail if required parameters are missing
- Webhook failures are logged but don't fail the job
- Build artifacts are preserved for troubleshooting
- Error logs are sent to Supabase for user visibility

## Troubleshooting

### Common Issues
1. **Git authentication failures**: Check credentials configuration
2. **Webhook timeouts**: Verify Supabase URL and network connectivity
3. **Missing artifacts**: Check workspace cleanup settings
4. **Permission errors**: Verify Jenkins user has necessary permissions

### Debug Mode
Add `set -x` to shell scripts for verbose debugging output.

### Logs Location
- Jenkins console output: `${JENKINS_URL}/job/{job-name}/{build-number}/console`
- Workspace files: `${JENKINS_URL}/job/{job-name}/ws/`
- Archived artifacts: `${JENKINS_URL}/job/{job-name}/{build-number}/artifact/`

## Monitoring
- Monitor job success/failure rates
- Check webhook delivery status
- Review build duration trends
- Monitor artifact sizes and storage usage
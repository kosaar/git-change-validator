#!/bin/bash

# Jenkins Setup Script for Git Change Validator
# This script sets up Jenkins jobs and configuration

set -e

echo "=== Jenkins Setup for Git Change Validator ==="

# Configuration variables - update these for your environment
JENKINS_URL="${JENKINS_URL:-http://localhost:8080}"
JENKINS_USER="${JENKINS_USER:-admin}"
JENKINS_TOKEN="${JENKINS_TOKEN}"
GIT_REPOSITORY_URL="${GIT_REPOSITORY_URL:-https://github.com/company/main-data-repo.git}"
GIT_CREDENTIALS_ID="${GIT_CREDENTIALS_ID:-git-credentials}"
SUPABASE_URL="${SUPABASE_URL:-http://localhost:8000}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"

# Validate required environment variables
if [ -z "$JENKINS_TOKEN" ]; then
    echo "ERROR: JENKINS_TOKEN environment variable is required"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is required"
    exit 1
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "ERROR: SUPABASE_ANON_KEY environment variable is required"
    exit 1
fi

echo "Jenkins URL: $JENKINS_URL"
echo "Git Repository: $GIT_REPOSITORY_URL"
echo "Supabase URL: $SUPABASE_URL"

# Function to create/update Jenkins job
create_jenkins_job() {
    local job_name="$1"
    local config_file="$2"
    
    echo "Creating/updating Jenkins job: $job_name"
    
    # Substitute environment variables in the job configuration
    envsubst < "$config_file" > "/tmp/${job_name}-config.xml"
    
    # Check if job exists
    if curl -s -u "${JENKINS_USER}:${JENKINS_TOKEN}" \
        "${JENKINS_URL}/job/${job_name}/config.xml" >/dev/null 2>&1; then
        echo "Job $job_name exists, updating..."
        curl -X POST -u "${JENKINS_USER}:${JENKINS_TOKEN}" \
            "${JENKINS_URL}/job/${job_name}/config.xml" \
            --data-binary "@/tmp/${job_name}-config.xml" \
            -H "Content-Type: application/xml"
    else
        echo "Job $job_name does not exist, creating..."
        curl -X POST -u "${JENKINS_USER}:${JENKINS_TOKEN}" \
            "${JENKINS_URL}/createItem?name=${job_name}" \
            --data-binary "@/tmp/${job_name}-config.xml" \
            -H "Content-Type: application/xml"
    fi
    
    if [ $? -eq 0 ]; then
        echo "✓ Job $job_name created/updated successfully"
    else
        echo "✗ Failed to create/update job $job_name"
        exit 1
    fi
}

# Install required Jenkins plugins
echo "Installing required Jenkins plugins..."
PLUGINS=(
    "git"
    "workflow-aggregator"
    "postbuildscript"
    "build-timeout"
    "ws-cleanup"
)

for plugin in "${PLUGINS[@]}"; do
    echo "Installing plugin: $plugin"
    curl -X POST -u "${JENKINS_USER}:${JENKINS_TOKEN}" \
        "${JENKINS_URL}/pluginManager/installNecessaryPlugins" \
        -d "<jenkins><install plugin='${plugin}@latest' /></jenkins>" \
        -H "Content-Type: application/xml"
done

echo "Waiting for Jenkins to restart after plugin installation..."
sleep 30

# Create Jenkins jobs
echo "Creating Jenkins jobs..."
create_jenkins_job "generate-diff" "jobs/generate-diff.xml"
create_jenkins_job "integrate-changes" "jobs/integrate-changes.xml"

# Configure global environment variables
echo "Configuring global environment variables..."
cat > /tmp/global-env.xml << EOF
<?xml version='1.1' encoding='UTF-8'?>
<hudson.slaves.EnvironmentVariablesNodeProperty>
  <envVars serialization="custom">
    <unserializable-parents/>
    <tree-map>
      <default>
        <comparator class="hudson.util.CaseInsensitiveComparator"/>
      </default>
      <int>6</int>
      <string>GIT_REPOSITORY_URL</string>
      <string>${GIT_REPOSITORY_URL}</string>
      <string>GIT_CREDENTIALS_ID</string>
      <string>${GIT_CREDENTIALS_ID}</string>
      <string>SUPABASE_URL</string>
      <string>${SUPABASE_URL}</string>
      <string>SUPABASE_SERVICE_ROLE_KEY</string>
      <string>${SUPABASE_SERVICE_ROLE_KEY}</string>
      <string>SUPABASE_ANON_KEY</string>
      <string>${SUPABASE_ANON_KEY}</string>
    </tree-map>
  </envVars>
</hudson.slaves.EnvironmentVariablesNodeProperty>
EOF

curl -X POST -u "${JENKINS_USER}:${JENKINS_TOKEN}" \
    "${JENKINS_URL}/configureTools/configure" \
    --data-binary "@/tmp/global-env.xml" \
    -H "Content-Type: application/xml"

# Test webhook endpoint
echo "Testing webhook endpoint..."
WEBHOOK_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${SUPABASE_URL}/functions/v1/jenkins-webhook" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -d '{"jobId":"test","status":"SUCCESS","artifacts":{}}')

if [ "$WEBHOOK_RESPONSE" = "200" ]; then
    echo "✓ Webhook endpoint is accessible"
else
    echo "⚠ Webhook endpoint returned status: $WEBHOOK_RESPONSE"
fi

echo ""
echo "=== Jenkins Setup Complete ==="
echo "Jobs created:"
echo "  1. generate-diff - Generates diff files for validation"
echo "  2. integrate-changes - Integrates validated changes"
echo ""
echo "Next steps:"
echo "  1. Configure Git credentials in Jenkins (ID: ${GIT_CREDENTIALS_ID})"
echo "  2. Test the jobs manually"
echo "  3. Verify webhook notifications are working"
echo ""
echo "Job URLs:"
echo "  - ${JENKINS_URL}/job/generate-diff/"
echo "  - ${JENKINS_URL}/job/integrate-changes/"
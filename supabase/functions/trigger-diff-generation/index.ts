import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface DiffGenerationRequest {
  gitBranch: string
  referenceCommitHash?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { gitBranch, referenceCommitHash }: DiffGenerationRequest = await req.json()

    if (!gitBranch) {
      return new Response(
        JSON.stringify({ success: false, error: 'Git branch is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get LDAP user info
    const { data: ldapUser } = await supabase
      .from('ldap_users')
      .select('ldap_username, ldap_groups')
      .eq('supabase_user_id', user.id)
      .single()

    if (!ldapUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found in LDAP mapping' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has permission to create validation tasks
    const canCreateTasks = ldapUser.ldap_groups.includes('creators') || 
                          ldapUser.ldap_groups.includes('admins')

    if (!canCreateTasks) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions to create validation tasks' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Trigger Jenkins job for diff generation
    const jenkinsJobId = await triggerJenkinsJob(gitBranch, referenceCommitHash)

    if (!jenkinsJobId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to trigger Jenkins job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create validation task in database
    const { data: task, error: insertError } = await supabase
      .from('validation_tasks')
      .insert({
        git_branch: gitBranch,
        reference_commit_hash: referenceCommitHash,
        current_commit_hash: 'pending', // Will be updated by Jenkins webhook
        diff_file_name: `${gitBranch}-diff.csv`,
        diff_file_generated_at: new Date().toISOString(),
        generation_job_id: jenkinsJobId,
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating validation task:', insertError)
      throw insertError
    }

    return new Response(
      JSON.stringify({
        success: true,
        task: task,
        jobId: jenkinsJobId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Diff generation error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to trigger diff generation'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function triggerJenkinsJob(gitBranch: string, referenceCommitHash?: string): Promise<string | null> {
  try {
    const jenkinsUrl = Deno.env.get('JENKINS_BASE_URL')
    const jenkinsToken = Deno.env.get('JENKINS_API_TOKEN')

    if (!jenkinsUrl || !jenkinsToken) {
      console.error('Jenkins configuration missing')
      return null
    }

    const params = new URLSearchParams({
      GIT_BRANCH: gitBranch,
      ...(referenceCommitHash && { REFERENCE_COMMIT_HASH: referenceCommitHash })
    })

    const response = await fetch(`${jenkinsUrl}/job/generate-diff/buildWithParameters`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jenkinsToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      console.error('Jenkins job trigger failed:', response.status, response.statusText)
      return null
    }

    // Extract job ID from Location header
    const location = response.headers.get('location')
    const jobId = location?.split('/').pop() || crypto.randomUUID()

    return jobId

  } catch (error) {
    console.error('Error triggering Jenkins job:', error)
    return null
  }
}

console.log('Trigger diff generation function started')
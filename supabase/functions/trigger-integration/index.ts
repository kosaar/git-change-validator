import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface IntegrationRequest {
  taskId: string
  validatedFilePath: string
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
    const { taskId, validatedFilePath }: IntegrationRequest = await req.json()

    if (!taskId || !validatedFilePath) {
      return new Response(
        JSON.stringify({ success: false, error: 'Task ID and validated file path are required' }),
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

    // Check if user has permission to validate tasks
    const canValidate = ldapUser.ldap_groups.includes('validators') || 
                       ldapUser.ldap_groups.includes('admins')

    if (!canValidate) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions to validate tasks' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the validation task
    const { data: task, error: taskError } = await supabase
      .from('validation_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (taskError || !task) {
      return new Response(
        JSON.stringify({ success: false, error: 'Validation task not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (task.status !== 'PENDING_VALIDATION') {
      return new Response(
        JSON.stringify({ success: false, error: 'Task is not in pending validation status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the validated file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('validated-files')
      .download(validatedFilePath)

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to retrieve validated file' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Trigger Jenkins integration job
    const integrationJobId = await triggerIntegrationJob(taskId, fileData)

    if (!integrationJobId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to trigger integration job' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update task status to integration in progress
    const { error: updateError } = await supabase
      .from('validation_tasks')
      .update({
        status: 'INTEGRATION_IN_PROGRESS',
        validator_user_id: user.id,
        validated_file_uploaded_at: new Date().toISOString()
      })
      .eq('id', taskId)

    if (updateError) {
      console.error('Error updating validation task:', updateError)
      throw updateError
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Integration job triggered successfully',
        jobId: integrationJobId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Integration trigger error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to trigger integration'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function triggerIntegrationJob(taskId: string, validatedFile: Blob): Promise<string | null> {
  try {
    const jenkinsUrl = Deno.env.get('JENKINS_BASE_URL')
    const jenkinsToken = Deno.env.get('JENKINS_API_TOKEN')

    if (!jenkinsUrl || !jenkinsToken) {
      console.error('Jenkins configuration missing')
      return null
    }

    // Create form data for file upload
    const formData = new FormData()
    formData.append('TASK_ID', taskId)
    formData.append('validated.csv', validatedFile, 'validated.csv')

    const response = await fetch(`${jenkinsUrl}/job/integrate-changes/buildWithParameters`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jenkinsToken}`
      },
      body: formData
    })

    if (!response.ok) {
      console.error('Jenkins integration job trigger failed:', response.status, response.statusText)
      return null
    }

    // Extract job ID from Location header
    const location = response.headers.get('location')
    const jobId = location?.split('/').pop() || crypto.randomUUID()

    return jobId

  } catch (error) {
    console.error('Error triggering Jenkins integration job:', error)
    return null
  }
}

console.log('Trigger integration function started')
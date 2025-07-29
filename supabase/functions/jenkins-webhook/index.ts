import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface JenkinsWebhookPayload {
  jobId: string
  status: 'SUCCESS' | 'FAILURE' | 'IN_PROGRESS'
  artifacts?: {
    diffUrl?: string
    currentCommitHash?: string
    errorMessage?: string
    errorFileUrl?: string
  }
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
    const payload: JenkinsWebhookPayload = await req.json()

    if (!payload.jobId || !payload.status) {
      return new Response(
        JSON.stringify({ success: false, error: 'Job ID and status are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find the validation task by job ID
    const { data: task, error: findError } = await supabase
      .from('validation_tasks')
      .select('*')
      .eq('generation_job_id', payload.jobId)
      .single()

    if (findError || !task) {
      console.error('Task not found for job ID:', payload.jobId)
      return new Response(
        JSON.stringify({ success: false, error: 'Validation task not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let updateData: any = {}

    switch (payload.status) {
      case 'SUCCESS':
        if (payload.artifacts?.diffUrl && payload.artifacts?.currentCommitHash) {
          // Download and store the diff file
          const fileName = await downloadAndStoreDiffFile(payload.artifacts.diffUrl, payload.jobId)
          
          updateData = {
            status: 'PENDING_VALIDATION',
            current_commit_hash: payload.artifacts.currentCommitHash,
            diff_file_path: fileName
          }
        } else {
          updateData = {
            status: 'ERROR',
            error_message: 'Missing artifacts from successful job'
          }
        }
        break

      case 'FAILURE':
        updateData = {
          status: 'ERROR',
          error_message: payload.artifacts?.errorMessage || 'Jenkins job failed',
          error_file_link: payload.artifacts?.errorFileUrl
        }
        break

      case 'IN_PROGRESS':
        updateData = {
          status: 'INTEGRATION_IN_PROGRESS'
        }
        break

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid status' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Update the validation task
    const { error: updateError } = await supabase
      .from('validation_tasks')
      .update(updateData)
      .eq('id', task.id)

    if (updateError) {
      console.error('Error updating validation task:', updateError)
      throw updateError
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Jenkins webhook error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to process webhook'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function downloadAndStoreDiffFile(diffUrl: string, jobId: string): Promise<string | null> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Download the diff file from Jenkins
    const response = await fetch(diffUrl)
    if (!response.ok) {
      throw new Error(`Failed to download diff file: ${response.statusText}`)
    }

    const fileContent = await response.arrayBuffer()
    const fileName = `${jobId}/diff.csv`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('diff-files')
      .upload(fileName, fileContent, {
        contentType: 'text/csv',
        upsert: true
      })

    if (error) {
      console.error('Error uploading diff file:', error)
      throw error
    }

    return data.path

  } catch (error) {
    console.error('Error downloading and storing diff file:', error)
    return null
  }
}

console.log('Jenkins webhook function started')
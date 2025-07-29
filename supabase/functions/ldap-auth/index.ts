import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface LdapAuthRequest {
  username: string
  password: string
}

interface LdapUserInfo {
  email: string
  displayName: string
  groups: string[]
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
    const { username, password }: LdapAuthRequest = await req.json()

    if (!username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Username and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Authenticate with LDAP
    const userInfo = await authenticateWithLDAP(username, password)
    
    if (!userInfo) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid LDAP credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user exists in ldap_users table
    const { data: existingUser } = await supabase
      .from('ldap_users')
      .select('supabase_user_id')
      .eq('ldap_username', username)
      .single()

    let supabaseUserId: string

    if (!existingUser) {
      // Create new Supabase user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: userInfo.email,
        password: crypto.randomUUID(), // Random password (not used for LDAP auth)
        email_confirm: true,
        user_metadata: {
          ldap_username: username,
          display_name: userInfo.displayName
        }
      })

      if (authError) {
        console.error('Error creating auth user:', authError)
        throw authError
      }

      supabaseUserId = authUser.user.id

      // Store LDAP user mapping
      const { error: insertError } = await supabase.from('ldap_users').insert({
        supabase_user_id: supabaseUserId,
        ldap_username: username,
        ldap_email: userInfo.email,
        ldap_display_name: userInfo.displayName,
        ldap_groups: userInfo.groups
      })

      if (insertError) {
        console.error('Error inserting LDAP user:', insertError)
        throw insertError
      }
    } else {
      supabaseUserId = existingUser.supabase_user_id

      // Update LDAP user info
      const { error: updateError } = await supabase.from('ldap_users').update({
        ldap_email: userInfo.email,
        ldap_display_name: userInfo.displayName,
        ldap_groups: userInfo.groups,
        last_login: new Date().toISOString()
      }).eq('ldap_username', username)

      if (updateError) {
        console.error('Error updating LDAP user:', updateError)
        throw updateError
      }
    }

    // Generate session for the user
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userInfo.email,
      options: {
        redirectTo: Deno.env.get('SITE_URL') ?? 'http://localhost:3000'
      }
    })

    if (sessionError) {
      console.error('Error generating session:', sessionError)
      throw sessionError
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: supabaseUserId,
          username: username,
          email: userInfo.email,
          displayName: userInfo.displayName,
          groups: userInfo.groups
        },
        session: sessionData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('LDAP Auth Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Authentication failed'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function authenticateWithLDAP(username: string, password: string): Promise<LdapUserInfo | null> {
  try {
    // This is a simplified LDAP authentication
    // In a real implementation, you would use an LDAP library like 'ldapjs' equivalent for Deno
    
    const ldapUrl = Deno.env.get('LDAP_URL')
    const userBase = Deno.env.get('LDAP_USER_BASE')
    
    if (!ldapUrl || !userBase) {
      throw new Error('LDAP configuration missing')
    }

    // For demonstration purposes, we'll simulate LDAP authentication
    // In production, replace this with actual LDAP binding and search
    
    // Simulated LDAP authentication - replace with real LDAP client
    if (username === 'testuser' && password === 'testpass') {
      return {
        email: `${username}@company.com`,
        displayName: `Test User (${username})`,
        groups: ['validators', 'users']
      }
    }
    
    // For other users, you would implement actual LDAP authentication here
    // Example pseudo-code:
    // 1. Connect to LDAP server
    // 2. Bind with service account
    // 3. Search for user by username
    // 4. Attempt to bind with user credentials
    // 5. If successful, retrieve user attributes and groups
    // 6. Return user info or null if authentication fails
    
    return null
    
  } catch (error) {
    console.error('LDAP authentication error:', error)
    return null
  }
}

// Deno configuration
console.log('LDAP Auth function started')
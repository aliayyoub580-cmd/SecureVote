/**
 * Sends the voter's active public ID to their profile email (Resend).
 * Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM (optional)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: 'supabase_env_missing' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'missing_authorization' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const body = (await req.json().catch(() => ({}))) as { election_id?: string }
  if (!body.election_id) {
    return new Response(JSON.stringify({ error: 'election_id_required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const scoped = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const jwt = authHeader.replace('Bearer ', '')
  const { data: userData, error: userErr } = await scoped.auth.getUser(jwt)
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'invalid_session' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { data: idJson, error: idErr } = await scoped.rpc('get_my_voter_public_id', {
    p_election_id: body.election_id,
  })
  if (idErr) {
    return new Response(JSON.stringify({ error: idErr.message }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const row = idJson as { public_id?: string | null; has_active?: boolean }
  if (!row?.has_active || !row.public_id) {
    return new Response(JSON.stringify({ error: 'no_active_voter_public_id' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profile } = await admin.from('profiles').select('email, full_name').eq('id', userData.user.id).maybeSingle()

  const to = profile?.email ?? userData.user.email
  if (!to) {
    return new Response(JSON.stringify({ error: 'no_email_on_file' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM') ?? 'SecureVote <onboarding@resend.dev>'

  if (!resendKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        skipped: true,
        message: 'Set RESEND_API_KEY in Edge Function secrets to enable delivery.',
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }

  const { data: election } = await admin.from('elections').select('title').eq('id', body.election_id).maybeSingle()
  const title = (election as { title?: string } | null)?.title ?? 'Election'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Your voter ID for ${title}`,
      text: `Hello${profile?.full_name ? ` ${profile.full_name}` : ''},\n\nYour secret voter display ID for "${title}" is:\n\n  ${row.public_id}\n\nThis ID is separate from your ballot token. Do not share your ballot token by email.\n\n— SecureVote`,
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    return new Response(JSON.stringify({ error: 'resend_failed', detail: t }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
})

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function getEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const envFile = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf8');
      for (const line of content.split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && k.trim() === key) return v.join('=').trim();
      }
    }
  } catch {}
  return undefined;
}

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL') || 'https://qiwjfxlpxrevadflbsxr.supabase.co';
const SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

export default async function handler(req, res) {
  // Ensure Express-like methods exist on res in any environment
  if (!res.status) {
    res.status = function (code) {
      this.statusCode = code;
      return this;
    };
  }
  if (!res.json) {
    res.json = function (data) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(data));
      return this;
    };
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }

    const { email, password, fullName, phone, organization, accountType } = body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    if (!SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Server configuration error: missing service role key' });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Create the user pre-confirmed (email_confirm: true)
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: {
        full_name: fullName || '',
        phone: phone || '',
        organization: organization || '',
        account_type: accountType || 'voter',
      },
    });

    if (adminError) {
      const msg = adminError.message ?? '';
      const code = adminError.code ?? '';
      if (
        code === 'unexpected_failure' ||
        msg.toLowerCase().includes('already registered') ||
        msg.toLowerCase().includes('already exists') ||
        msg.toLowerCase().includes('database error saving new user')
      ) {
        return res.status(400).json({
          error: 'This email is already registered. Please sign in or use "Forgot Password" to reset your password.',
        });
      }
      return res.status(400).json({ error: msg || 'Registration failed' });
    }

    const userId = adminData.user?.id;

    // 2. Ensure profile exists in public.profiles
    if (userId) {
      try {
        // Never grant election_creator immediately; user stays voter until super admin reviews and approves
        const role = 'voter';
        const creatorStatus = accountType === 'request_creator' ? 'pending' : 'none';
        await supabaseAdmin.from('profiles').upsert(
          {
            id: userId,
            email: cleanEmail,
            full_name: fullName || '',
            phone: phone ? String(phone).trim() : null,
            organization: organization ? String(organization).trim() : null,
            role,
            creator_application_status: creatorStatus,
          },
          { onConflict: 'id' }
        );
      } catch (profileErr) {
        console.warn('Profile upsert warning:', profileErr);
      }
    }

    return res.status(200).json({
      success: true,
      user: adminData.user,
    });
  } catch (err) {
    console.error('Registration handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

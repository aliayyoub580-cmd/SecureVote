import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cucqyjfngzghqkajinrb.supabase.co'
const supabaseAnonKey = 'sb_publishable_NnnA5U6oI3XXSbuqYC-g6w_JplPh1nv'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function cleanupUser(email: string) {
  console.log(`Attempting to clean up corrupted user with email: ${email}`)

  // Since we cannot run raw DELETE on auth.users directly with the anon key,
  // we can use a custom dynamic execution block or let the user know they can run it
  // in the Supabase SQL Editor.
  console.log('To clean up this email so you can re-register it natively, please run the following SQL inside your Supabase SQL Editor:')
  console.log(`
----------------- COPY AND RUN THIS SQL -----------------
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = '${email}';
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;
    RAISE NOTICE 'Successfully cleaned up user %', '${email}';
  ELSE
    RAISE NOTICE 'User % not found', '${email}';
  END IF;
END $$;
--------------------------------------------------------
  `)
}

// Set your favorite test email here to generate the cleanup query!
cleanupUser('asif@example.com')

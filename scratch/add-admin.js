import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qiwjfxlpxrevadflbsxr.supabase.co';
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const email = 'admin@gmail.com';
  const password = 'admin123';

  console.log(`Ensuring admin user ${email} exists in Supabase...`);

  // 1. Check if user exists in auth admin
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  let user = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    console.log(`Creating user ${email}...`);
    const { data: createUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'System Admin' }
    });

    if (createError) {
      console.error('Error creating auth user:', createError);
      return;
    }
    user = createUser.user;
    console.log(`Created user with ID: ${user.id}`);
  } else {
    console.log(`User ${email} found (ID: ${user.id}). Updating password and email verification...`);
    const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(user.id, {
      password: password,
      email_confirm: true
    });
    if (updateAuthErr) {
      console.error('Error updating password:', updateAuthErr);
    }
  }

  // 2. Ensure profile exists and has role 'super_admin'
  console.log(`Upserting profile for ID ${user.id} with role 'super_admin'...`);
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: email,
      full_name: 'System Admin',
      role: 'super_admin',
      creator_application_status: 'approved',
      updated_at: new Date().toISOString()
    })
    .select();

  if (profileErr) {
    console.error('Error upserting profile:', profileErr);
  } else {
    console.log('Successfully configured admin profile:', profile);
  }
}

main().catch(console.error);

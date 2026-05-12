import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    // Verify caller is admin via their JWT
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser();
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check admin
    const ADMIN_EMAILS = ['dgmukhin@gmail.com'];
    const isOwner = ADMIN_EMAILS.includes(callerUser.email?.toLowerCase() ?? '');
    if (!isOwner) {
      const { data: profile } = await adminClient
        .from('profiles').select('role').eq('id', callerUser.id).single();
      if (!profile || !['admin', 'curator'].includes(profile.role)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
      }
    }

    const body = await req.json();
    const { email, password, full_name, amount, plan_months, subscription_start, subscription_end } = body;

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: 'email, password и full_name обязательны' }),
        { status: 400 }
      );
    }

    // 1. Create auth user (email already confirmed — no verification email)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError || !newUser.user) {
      return new Response(
        JSON.stringify({ error: createError?.message || 'Ошибка создания пользователя' }),
        { status: 400 }
      );
    }

    const userId = newUser.user.id;

    // 2. Upsert profile
    await adminClient.from('profiles').upsert({
      id: userId,
      email,
      full_name,
      role: 'user',
      is_blocked: false,
      subscription_status: subscription_end ? 'active' : 'inactive',
      subscription_end_date: subscription_end || null,
      questionnaire_completed: false,
    });

    // 3. Create confirmed payment record
    if (amount && Number(amount) > 0) {
      await adminClient.from('payments').insert({
        user_id: userId,
        amount: Number(amount),
        currency: 'RUB',
        status: 'confirmed',
        payment_method: 'manual',
        plan_months: plan_months ? Number(plan_months) : null,
        confirmed_by: callerUser.id,
        confirmed_at: new Date().toISOString(),
        cohort_start: subscription_start || null,
        base_amount: Number(amount),
        nutrition_amount: 0,
      });
    }

    return new Response(JSON.stringify({ success: true, userId, email }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    console.error('[create-client]', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});

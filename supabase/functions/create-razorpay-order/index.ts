import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401);
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return json({ error: 'Not authenticated' }, 401);
    }

    const { registration_id } = await req.json();
    if (!registration_id) {
      return json({ error: 'registration_id is required' }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: registration, error: regError } = await supabaseAdmin
      .from('registrations')
      .select('id, player_id, status, tournament_id, tournaments!inner(entry_fee)')
      .eq('id', registration_id)
      .single();

    if (regError || !registration) {
      return json({ error: 'Registration not found' }, 404);
    }
    if (registration.player_id !== user.id) {
      return json({ error: 'Not your registration' }, 403);
    }
    if (registration.status !== 'pending') {
      return json({ error: 'Registration is not pending payment' }, 400);
    }

    const entryFee = (registration.tournaments as any)?.entry_fee ?? 0;
    if (!entryFee || entryFee <= 0) {
      return json({ error: 'This tournament has no entry fee' }, 400);
    }

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')!;
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const amountPaise = Math.round(entryFee * 100);

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${keyId}:${keySecret}`),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: registration_id,
        notes: { registration_id },
      }),
    });

    const order = await orderRes.json();
    if (!orderRes.ok) {
      console.error('Razorpay order creation failed:', order);
      return json({ error: 'Failed to create payment order' }, 502);
    }

    await supabaseAdmin
      .from('registrations')
      .update({ razorpay_order_id: order.id })
      .eq('id', registration_id);

    return json({ order_id: order.id, amount: amountPaise, key_id: keyId });
  } catch (err) {
    console.error(err);
    return json({ error: 'Internal error' }, 500);
  }
});

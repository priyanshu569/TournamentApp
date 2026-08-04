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

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Plain `===` on a secret comparison leaks timing info (bails on the first
// mismatched character) -- constant-time by always comparing every byte,
// standard practice for verifying HMACs regardless of how practical the
// attack is over a real network.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
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

    const { registration_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!registration_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: registration, error: regError } = await supabaseAdmin
      .from('registrations')
      .select('id, player_id, status, razorpay_order_id, tournament_id, tournaments!inner(entry_fee)')
      .eq('id', registration_id)
      .single();

    if (regError || !registration) {
      return json({ error: 'Registration not found' }, 404);
    }
    if (registration.player_id !== user.id) {
      return json({ error: 'Not your registration' }, 403);
    }
    if (registration.status === 'confirmed') {
      return json({ success: true, already_confirmed: true });
    }
    if (registration.razorpay_order_id !== razorpay_order_id) {
      return json({ error: 'Order mismatch' }, 400);
    }

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
    const expectedSignature = await hmacSha256Hex(keySecret, `${razorpay_order_id}|${razorpay_payment_id}`);

    if (!timingSafeEqual(expectedSignature, razorpay_signature)) {
      console.error('Razorpay signature mismatch for registration', registration_id);
      return json({ error: 'Payment verification failed' }, 400);
    }

    const entryFee = (registration.tournaments as any)?.entry_fee ?? 0;

    const { error: confirmError } = await supabaseAdmin.rpc('confirm_paid_registration', {
      p_registration_id: registration_id,
      p_amount_paid: entryFee,
      p_razorpay_payment_id: razorpay_payment_id,
    });

    if (confirmError) {
      console.error('confirm_paid_registration failed:', confirmError);
      return json({ error: confirmError.message }, 400);
    }

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Internal error' }, 500);
  }
});

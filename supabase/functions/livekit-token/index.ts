import { createClient } from 'jsr:@supabase/supabase-js@2';
import { AccessToken } from 'npm:livekit-server-sdk@2';

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

    const { conversation_id } = await req.json();
    if (!conversation_id) {
      return json({ error: 'conversation_id is required' }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: participant } = await supabaseAdmin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversation_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!participant) {
      return json({ error: 'Not a participant of this conversation' }, 403);
    }

    const apiKey = Deno.env.get('LIVEKIT_API_KEY')!;
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')!;
    const serverUrl = Deno.env.get('LIVEKIT_URL')!;

    // Identity = our own user_id directly -- no separate numeric-id
    // mapping needed to tell participants apart client-side.
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      ttl: '1h',
    });
    at.addGrant({
      roomJoin: true,
      room: conversation_id,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return json({ token, url: serverUrl });
  } catch (err) {
    console.error(err);
    return json({ error: 'Internal error' }, 500);
  }
});

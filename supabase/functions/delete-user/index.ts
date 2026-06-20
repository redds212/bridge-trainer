// Edge Function: delete-user
// Permanently deletes a user account (auth user + cascaded profile/progress/history).
// Only callable by an admin (verified against profiles.is_admin).
//
// Deploy:  npx supabase functions deploy delete-user
// Supabase auto-injects SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json(500, { error: 'Brak konfiguracji środowiska' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'Brak autoryzacji' });

  // Identify the caller from their JWT.
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await caller.auth.getUser();
  if (userErr || !user) return json(401, { error: 'Nieprawidłowa sesja' });

  // Privileged client (service role) — used for the admin check and the deletion.
  const admin = createClient(url, serviceKey);
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return json(403, { error: 'Wymagane uprawnienia administratora' });

  let body: { targetUserId?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Nieprawidłowe dane wejściowe' });
  }
  const targetUserId = body.targetUserId;
  if (!targetUserId) return json(400, { error: 'Brak targetUserId' });
  if (targetUserId === user.id) return json(400, { error: 'Nie można usunąć własnego konta' });

  // Deleting the auth user cascades to profile, srs_progress and attempts (FK on delete cascade).
  const { error: delErr } = await admin.auth.admin.deleteUser(targetUserId);
  if (delErr) return json(500, { error: delErr.message });

  return json(200, { ok: true });
});

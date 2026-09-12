// Deno 런타임 진입점 공통 — service role 클라이언트 · 호출자 인증
// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';
export const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
export async function caller(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer /i, '');
  if (!token) return null;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data } = await client.auth.getUser(token);
  return data.user?.id ?? null;
}
export const isCron = (req: Request) => (req.headers.get('authorization') ?? '').includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '∅');
export const cors = (req: Request) => (req.method === 'OPTIONS' ? new Response('ok', { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type' } }) : null);

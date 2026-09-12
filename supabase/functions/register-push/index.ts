// @ts-nocheck
import { admin, caller, cors } from '../_shared/deno.ts';
import { fail, json } from '../_shared/core.ts';
Deno.serve(async (req) => {
  const pre = cors(req); if (pre) return pre;
  const uid = await caller(req); if (!uid) return fail('unauthenticated', 401);
  const { token, quietFrom, quietTo, notifyPassby } = await req.json();
  if (typeof token !== 'string' || !token.startsWith('ExponentPushToken')) return fail('token');
  await admin().from('users_private').upsert({ user_id: uid, push_token: token, ...(quietFrom != null ? { notify_quiet_from: quietFrom } : {}), ...(quietTo != null ? { notify_quiet_to: quietTo } : {}), ...(notifyPassby != null ? { notify_passby: notifyPassby } : {}) });
  return json({ ok: true });
});

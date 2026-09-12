// @ts-nocheck
import { admin, caller, cors } from '../_shared/deno.ts';
import { fail, json } from '../_shared/core.ts';
Deno.serve(async (req) => {
  const pre = cors(req); if (pre) return pre;
  const uid = await caller(req); if (!uid) return fail('unauthenticated', 401);
  const db = admin(); const { letterId, shareToStory } = await req.json();
  const { data: l } = await db.from('letters').select('*').eq('id', letterId).eq('sender_id', uid).single();
  if (!l || l.kind !== 'letter' || l.direct) return fail('letter');
  const { data: dup } = await db.from('posts').select('id').eq('letter_id', letterId).maybeSingle();
  if (dup) { await db.from('posts').update({ share_to_story: !!shareToStory }).eq('id', dup.id); return json({ id: dup.id }); }
  const { data: u } = await db.from('users').select('city,country').eq('id', uid).single();
  const { data: post } = await db.from('posts').insert({ letter_id: letterId, author_id: uid, text: l.text, image_url: l.image_url, city: u.city, country: u.country, stamp: l.stamp, lat: l.origin.lat, lng: l.origin.lng, vehicle: l.vehicle, share_to_story: !!shareToStory }).select('id').single();
  await db.from('letters').update({ is_public: true }).eq('id', letterId);
  return json({ id: post.id });
});

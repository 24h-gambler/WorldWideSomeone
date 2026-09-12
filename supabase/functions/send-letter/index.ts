// @ts-nocheck
import { admin, caller, cors } from '../_shared/deno.ts';
import { RULES, coinDelta, discounted, earn, fail, getUser, json, matchesTarget, rentalCoins, cells4 } from '../_shared/core.ts';
import { PLAN_LIMITS, VEHICLES, buildRoute, durationMs, upcomingPoints } from '../_shared/sim.ts';

Deno.serve(async (req) => {
  const pre = cors(req); if (pre) return pre;
  const uid = await caller(req); if (!uid) return fail('unauthenticated', 401);
  const db = admin();
  const body = await req.json();
  const { text, destination, waypoints = [], vehicle, target = {}, useShield, isPublic, shareToStory, replyToId, recipientId, direct, rent, imageUrl } = body;
  if (typeof text !== 'string' || text.trim().length < 1 || text.length > 500) return fail('text');
  if (!VEHICLES[vehicle]) return fail('vehicle');
  let u = await getUser(db, uid);
  const limits = PLAN_LIMITS[u.plan];
  const kind = replyToId ? 'reply' : 'letter';
  const today = new Date().toISOString().slice(0, 10);
  if (kind === 'letter' && !direct) {
    const { count } = await db.from('letters').select('id', { count: 'exact', head: true }).eq('sender_id', uid).eq('kind', 'letter').gte('departed_at', `${today}T00:00:00Z`);
    if ((count ?? 0) >= limits.dailyLetters) return fail('daily_limit');
  }
  const { data: priv } = await db.from('users_private').select('lat,lng').eq('user_id', uid).single();
  if (!priv?.lat) return fail('location_required');
  const origin = { lat: priv.lat, lng: priv.lng, city: u.city, country: u.country };
  const spec = VEHICLES[vehicle];
  // 배달원 권한: 해금 · 프리미엄 아이템 · 대여
  const boost = limits.unlockBoost;
  let inventory = { ...u.inventory }; let rented = false;
  const unlocked = spec.premium ? (spec.premium === 'ufo' ? inventory.ufo > 0 : spec.premium === 'orbit' ? inventory.orbit > 0 : spec.premium === 'dragon' ? u.plan === 'pro' || u.friend_ids.length >= 80 : false) : u.friend_ids.length + boost >= (spec.unlockFriends ?? 1e9);
  if (!unlocked) {
    if (!rent || spec.premium) return fail('locked');
    u = await coinDelta(db, u, -discounted(rentalCoins(spec.speedKmh), u.plan), 'rental', vehicle); rented = true;
  } else if (spec.premium === 'ufo') inventory.ufo -= 1; else if (spec.premium === 'orbit') inventory.orbit -= 1;
  // 직행: 월 한도 → 보유권 → 코인
  let quota = { ...u.quota };
  let dest = destination;
  if (direct) {
    if (!recipientId) return fail('recipient');
    const month = new Date().toISOString().slice(0, 7);
    if (quota.month !== month) quota = { ...quota, month, direct: 0 };
    if (quota.direct < limits.monthlyDirect) quota.direct += 1;
    else if (inventory.direct > 0) inventory.direct -= 1;
    else u = await coinDelta(db, u, -RULES.ITEMS.direct1.coins, 'direct', recipientId);
    const { data: rp } = await db.from('users_private').select('lat,lng').eq('user_id', recipientId).single();
    const { data: ru } = await db.from('users').select('city,country').eq('id', recipientId).single();
    if (!rp?.lat) return fail('recipient_location');
    dest = { lat: rp.lat, lng: rp.lng, city: ru?.city ?? '', country: ru?.country ?? '' };
  }
  if (!dest?.lat) return fail('destination');
  const shield = spec.builtInShield || !!direct || (useShield && inventory.shield > 0);
  if (shield && !spec.builtInShield && !direct) inventory.shield -= 1;
  const wps = direct ? [] : waypoints.slice(0, limits.maxWaypoints);
  const route = buildRoute(origin, dest, wps, vehicle);
  const now = Date.now();
  const dur = durationMs(route.totalKm, vehicle, RULES.TIME_SCALE);
  const flight = { origin, destination: dest, waypoints: wps, vehicle, departedAt: now, arrivesAt: now + dur, status: 'flying' };
  const row = {
    kind, sender_id: uid, recipient_id: recipientId ?? null, reply_to_id: replyToId ?? null, direct: !!direct, rented, text: text.trim(), image_url: imageUrl ?? null,
    origin, destination: dest, random_destination: !destination && !direct, waypoints: wps, vehicle, shield, target: direct ? {} : target, is_public: !!isPublic && kind === 'letter' && !direct,
    status: 'flying', departed_at: new Date(now).toISOString(), arrives_at: new Date(now + dur).toISOString(), distance_km: route.totalKm, stamp: u.city,
    participants: [uid, ...(recipientId ? [recipientId] : [])], cells4: cells4(upcomingPoints(flight, now, 90_000)),
    events: [{ type: 'departed', at: now, place: u.city }, ...(rented ? [{ type: 'rented', at: now }] : [])],
  };
  const { data: letter, error } = await db.from('letters').insert(row).select('id').single();
  if (error) return fail(error.message, 500);
  u = await earn(db, u, RULES.COIN_REWARDS.send, 'send');
  await db.from('users').update({ inventory, quota, stats: { ...u.stats, sent: (u.stats.sent ?? 0) + 1, distanceKm: (u.stats.distanceKm ?? 0) + Math.round(route.totalKm) } }).eq('id', uid);
  if (row.is_public) await db.from('posts').insert({ letter_id: letter.id, author_id: uid, text: row.text, image_url: row.image_url, city: u.city, country: u.country, stamp: u.city, lat: origin.lat, lng: origin.lng, vehicle, share_to_story: !!shareToStory });
  return json({ id: letter.id, arrivesAt: now + dur, distanceKm: route.totalKm, rented });
});

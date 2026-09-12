/**
 * WorldWideSomeone Cloud Functions (Firebase, region asia-northeast3)
 *  - tickWorld      : 매 분, 비행 편지 착륙/배달/만료 + 통과(머리 위) 판정 + 푸시
 *  - sendLetter     : 편지 발송 (플랜·해금·재고 검증, 경로 계산)
 *  - catchLetter    : 잡기
 *  - redirectLetter : 되돌리기/바다/우주/달팽이/경로 변경 (방어권 처리)
 *  - approveReply   : 답장 승인 → 친구 + 채팅방 + 마일스톤 방어권
 *  - likePost       : 엽서 좋아요
 *  - onMessageCreate: 채팅 푸시
 *  - revenuecatWebhook: 구독/소모품 지급
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';

import { LatLng, distanceKm, fuzzToGrid } from './geo';
import { FlightDoc, LANDED_WINDOW_MS, OCEAN_SINK_MS, PASSBY_RADIUS_KM, PLAN_LIMITS, VEHICLES, VehicleId, applySnail, buildRoute, catchWindowMs, durationMs, minDistanceBetween, positionOf, pullTo, rerouteThrough, resurface } from './sim';

initializeApp();
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 20 });
const db = getFirestore();
const expo = new Expo();
const RC_SECRET = defineSecret('REVENUECAT_WEBHOOK_SECRET');

/** 실서비스 시간 배속: 걷기 5km/h × 60 = 실제 300km/h → 서울→도쿄 약 4시간, 지구 반대편 약 2.5일 */
const TIME_SCALE = 60;
const SHIELD_PER_FRIENDS = 5;
const COINS = { catch: 10, friend: 25, caughtByOther: 5, send: 2, mischief: 1, like: 1, comment: 1 };
const OCEAN_RESCUE_COINS = 50;
const todayKey = () => new Date().toISOString().slice(0, 10);

type Plan = 'free' | 'plus' | 'pro';
type UserDoc = { nickname: string; avatar: string; field: string; gender: string; job: string; hobbies: string[]; city: string; country: string; plan: Plan; coins: number; inventory: { shield: number; ufo: number; orbit: number; peek: number; pull: number; instant: number; carpet: number }; quota: { date: string; peeks: number; pulls: number }; friendIds: string[]; stamps: string[]; shieldMilestone: number; stats: { sent: number; caught: number; distanceKm: number } };

async function ensureUser(uid: string): Promise<UserDoc> {
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  const base: UserDoc = { nickname: '', avatar: '🙂', field: '', gender: 'private', job: '', hobbies: [], city: '', country: '', plan: 'free', coins: 100, inventory: { shield: 1, ufo: 0, orbit: 0, peek: 1, pull: 0, instant: 0, carpet: 0 }, quota: { date: '', peeks: 0, pulls: 0 }, friendIds: [], stamps: [], shieldMilestone: 0, stats: { sent: 0, caught: 0, distanceKm: 0 } };
  if (!snap.exists) { await ref.set({ ...base, createdAt: Timestamp.now() }); return base; }
  return { ...base, ...(snap.data() as Partial<UserDoc>) };
}

async function privateLoc(uid: string): Promise<LatLng | null> {
  const s = await db.doc(`users_private/${uid}`).get();
  const d = s.data();
  return d && typeof d.lat === 'number' ? { lat: d.lat, lng: d.lng } : null;
}

async function push(uid: string, title: string, body: string, data: Record<string, string> = {}, channelId = 'default') {
  const s = await db.doc(`users_private/${uid}`).get();
  const token = s.data()?.pushToken as string | undefined;
  await db.collection(`users/${uid}/notifications`).add({ title, body, data, at: Date.now(), read: false });
  if (!token || !Expo.isExpoPushToken(token)) return;
  const msg: ExpoPushMessage = { to: token, title, body, data, sound: 'default', channelId, priority: 'high' };
  try { await expo.sendPushNotificationsAsync([msg]); } catch (e) { console.warn('push failed', e); }
}

function matchesTarget(u: UserDoc, t: any): boolean {
  if (!t) return true;
  if (t.field && u.field !== t.field) return false;
  if (t.gender && u.gender !== t.gender) return false;
  if (t.job && u.job !== t.job) return false;
  if (t.hobby && !(u.hobbies ?? []).includes(t.hobby)) return false;
  return true;
}

function vehicleAllowed(v: VehicleId, u: UserDoc): boolean {
  const spec = VEHICLES[v];
  if (spec.premiumItem === 'ufo') return u.inventory.ufo > 0;
  if (spec.premiumItem === 'orbit') return u.inventory.orbit > 0;
  if (spec.premiumItem === 'carpet') return u.plan === 'pro' || (u.inventory.carpet ?? 0) > 0;
  if (spec.premiumItem === 'event') return false;
  if (spec.premiumItem === 'dragon') return u.plan === 'pro' || u.friendIds.length >= (spec.unlockFriends ?? Infinity);
  return u.friendIds.length + PLAN_LIMITS[u.plan].unlockBoost >= (spec.unlockFriends ?? 0);
}

// ---------------- sendLetter ----------------
export const sendLetter = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');
  const { text, imageUrl, destination, waypoints = [], vehicle, target = {}, useShield, isPublic, replyToId, recipientId, friendRequest } = req.data ?? {};
  if (typeof text !== 'string' || text.trim().length < 2 || text.length > 500) throw new HttpsError('invalid-argument', 'text');
  if (!VEHICLES[vehicle as VehicleId]) throw new HttpsError('invalid-argument', 'vehicle');
  const u = await ensureUser(uid);
  const origin = await privateLoc(uid);
  if (!origin) throw new HttpsError('failed-precondition', 'location required');
  if (!vehicleAllowed(vehicle, u)) throw new HttpsError('permission-denied', 'vehicle locked');
  const limits = PLAN_LIMITS[u.plan];
  if ((waypoints as LatLng[]).length > limits.maxWaypoints) throw new HttpsError('permission-denied', 'waypoints limit');
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const sentToday = await db.collection('letters').where('senderId', '==', uid).where('departedAt', '>=', dayStart.getTime()).count().get();
  if (sentToday.data().count >= limits.dailyLetters) throw new HttpsError('resource-exhausted', 'daily limit');

  let dest: LatLng;
  let random = false;
  if (recipientId) {
    const loc = await privateLoc(recipientId);
    if (!loc) throw new HttpsError('not-found', 'recipient');
    dest = fuzzToGrid(loc, 10);
  } else if (destination && typeof destination.lat === 'number') dest = { lat: destination.lat, lng: destination.lng };
  else { random = true; dest = { lat: (Math.random() * 120 - 50), lng: Math.random() * 360 - 180 }; }

  const route = buildRoute(origin, dest, waypoints, vehicle);
  const now = Date.now();
  const dur = durationMs(route.totalKm, vehicle, TIME_SCALE);
  const inv = { ...u.inventory };
  const shield = !!useShield && inv.shield > 0;
  if (shield) inv.shield -= 1;
  if (VEHICLES[vehicle as VehicleId].premiumItem === 'ufo') inv.ufo -= 1;
  if (VEHICLES[vehicle as VehicleId].premiumItem === 'orbit') inv.orbit -= 1;

  const letter = {
    senderId: uid, recipientId: recipientId ?? null, replyToId: replyToId ?? null, friendRequest: !!friendRequest, text, imageUrl: imageUrl ?? null,
    origin: { ...origin, city: u.city, country: u.country }, destination: { ...dest, city: '', country: '' }, randomDestination: random, waypoints, vehicle, shield, target, isPublic: !!isPublic,
    status: 'flying', departedAt: now, arrivesAt: now + dur, distanceKm: route.totalKm, redirects: 0, penalty: null, stamp: u.city,
    participants: recipientId ? [uid, recipientId] : [uid], events: [{ type: 'departed', at: now, place: u.city }], lastTickAt: now,
  };
  const ref = await db.collection('letters').add(letter);
  await db.doc(`letters_public/${ref.id}`).set({ origin: letter.origin, destination: letter.destination, waypoints, vehicle, departedAt: now, arrivesAt: now + dur, status: 'flying', shield, penalty: null, isReply: !!recipientId });
  await db.doc(`users/${uid}`).update({ inventory: inv, coins: FieldValue.increment(COINS.send), 'stats.sent': FieldValue.increment(1), 'stats.distanceKm': FieldValue.increment(Math.round(route.totalKm)) });
  if (isPublic && !recipientId) await db.collection('posts').add({ letterId: ref.id, authorId: uid, text, imageUrl: imageUrl ?? null, city: u.city, country: u.country, stamp: u.city, vehicle, at: now, likes: 0, likedBy: [] });
  return { id: ref.id, arrivesAt: now + dur, distanceKm: route.totalKm };
});

// ---------------- catchLetter ----------------
export const catchLetter = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');
  const { letterId } = req.data ?? {};
  const pbRef = db.doc(`users/${uid}/passbys/${letterId}`);
  const pb = (await pbRef.get()).data();
  if (!pb || pb.resolved || pb.expiresAt < Date.now() || !pb.canCatch) throw new HttpsError('failed-precondition', 'no active passby');
  const u = await ensureUser(uid);
  const ref = db.doc(`letters/${letterId}`);
  await db.runTransaction(async (tx) => {
    const l = (await tx.get(ref)).data();
    if (!l || !['flying', 'landed'].includes(l.status)) throw new HttpsError('failed-precondition', 'not catchable');
    const now = Date.now();
    tx.update(ref, { status: 'caught', caughtBy: uid, caughtAt: now, catchPlace: u.city, participants: FieldValue.arrayUnion(uid), events: FieldValue.arrayUnion({ type: 'caught', at: now, by: uid, place: u.city }) });
    tx.update(db.doc(`letters_public/${letterId}`), { status: 'caught' });
    tx.update(pbRef, { resolved: 'caught' });
    tx.update(db.doc(`users/${uid}`), { coins: FieldValue.increment(COINS.catch), 'stats.caught': FieldValue.increment(1), stamps: FieldValue.arrayUnion(l.stamp) });
    tx.update(db.doc(`users/${l.senderId}`), { coins: FieldValue.increment(COINS.caughtByOther) });
  });
  const l = (await ref.get()).data()!;
  await push(l.senderId, `🎉 ${u.city}에서 누군가 내 편지를 잡았어요`, '답장이 오면 승인해서 친구가 되어보세요', { route: `/letter/${letterId}` });
  return { ok: true };
});

// ---------------- redirectLetter ----------------
export const redirectLetter = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');
  const { letterId, action, waypoints = [] } = req.data ?? {};
  if (!['returned', 'sunk', 'space', 'snail', 'reroute', 'pull', 'peek'].includes(action)) throw new HttpsError('invalid-argument', 'action');
  const pbRef = db.doc(`users/${uid}/passbys/${letterId}`);
  const pb = (await pbRef.get()).data();
  if (!pb || pb.resolved || pb.expiresAt < Date.now()) throw new HttpsError('failed-precondition', 'no active passby');
  const u = await ensureUser(uid);
  if (action === 'reroute' && (waypoints.length < 1 || waypoints.length > PLAN_LIMITS[u.plan].maxWaypoints)) throw new HttpsError('permission-denied', 'waypoint limit');
  // 엿보기 / 끌어오기 한도 (플랜 일일 한도 → 소모품)
  const quota = u.quota?.date === todayKey() ? u.quota : { date: todayKey(), peeks: 0, pulls: 0 };
  const limits = PLAN_LIMITS[u.plan];
  const consume = async (kind: 'peek' | 'pull') => {
    const daily = kind === 'peek' ? limits.dailyPeeks : limits.dailyPulls;
    const used = kind === 'peek' ? quota.peeks : quota.pulls;
    if (used < daily) await db.doc(`users/${uid}`).set({ quota: { ...quota, [kind === 'peek' ? 'peeks' : 'pulls']: used + 1 } }, { merge: true });
    else if ((u.inventory[kind] ?? 0) > 0) await db.doc(`users/${uid}`).update({ [`inventory.${kind}`]: FieldValue.increment(-1) });
    else throw new HttpsError('resource-exhausted', `${kind} quota`);
  };
  if (action === 'peek') {
    const l0 = (await db.doc(`letters/${letterId}`).get()).data() as any;
    if (!l0) throw new HttpsError('not-found', 'letter');
    if (VEHICLES[l0.vehicle as VehicleId].immunePeek) return { outcome: 'immune' };
    if (!pb.peeked) await consume('peek');
    await pbRef.update({ peeked: true });
    await db.doc(`letters/${letterId}`).update({ peekedBy: FieldValue.arrayUnion(uid), events: FieldValue.arrayUnion({ type: 'peeked', at: Date.now(), by: uid, place: u.city }) });
    return { outcome: 'done', text: l0.text, imageUrl: l0.imageUrl ?? null };
  }
  if (action === 'pull') {
    const l0 = (await db.doc(`letters/${letterId}`).get()).data() as any;
    if (!l0 || l0.status !== 'flying') throw new HttpsError('failed-precondition', 'not flying');
    if (l0.pulls > 0) throw new HttpsError('failed-precondition', 'already pulled');
    await consume('pull');
  }
  const ref = db.doc(`letters/${letterId}`);
  const now = Date.now();
  const res = { outcome: 'done' as 'defended' | 'immune' | 'done' };
  await db.runTransaction(async (tx) => {
    const l = (await tx.get(ref)).data() as any;
    if (!l || l.status !== 'flying') throw new HttpsError('failed-precondition', 'not flying');
    if (VEHICLES[l.vehicle as VehicleId].immune) { res.outcome = 'immune'; tx.update(pbRef, { resolved: 'defended' }); return; }
    if (l.shield) { res.outcome = 'defended'; tx.update(ref, { shield: false, events: FieldValue.arrayUnion({ type: 'defended', at: now, by: uid, place: u.city }) }); tx.update(db.doc(`letters_public/${letterId}`), { shield: false }); tx.update(pbRef, { resolved: 'defended' }); return; }
    const flight: FlightDoc = l;
    if (action === 'pull') {
      const target = fuzzToGrid((await privateLoc(uid))!, 10);
      const patch = pullTo(flight, now, target, TIME_SCALE);
      tx.update(ref, { ...patch, destination: { ...target, city: u.city, country: u.country }, pulls: FieldValue.increment(1), pulledBy: uid, target: {}, events: FieldValue.arrayUnion({ type: 'pulled', at: now, by: uid, place: u.city }) });
      tx.update(db.doc(`letters_public/${letterId}`), { waypoints: patch.waypoints, departedAt: patch.departedAt, arrivesAt: patch.arrivesAt, destination: { ...target, city: '', country: '' }, penalty: null });
      tx.update(pbRef, { resolved: 'pulled' });
    } else if (action === 'sunk') {
      const spec = VEHICLES[l.vehicle as VehicleId];
      if (spec.immuneOcean) { res.outcome = 'immune'; tx.update(pbRef, { resolved: 'defended' }); return; }
      const ms = l.vehicle === 'camel' || l.vehicle === 'sail' ? OCEAN_SINK_MS / 3 : OCEAN_SINK_MS;
      tx.update(ref, { status: 'sunk', sunkAt: now, sunkUntil: now + ms, events: FieldValue.arrayUnion({ type: 'sunk', at: now, by: uid, place: u.city }) });
      tx.update(db.doc(`letters_public/${letterId}`), { status: 'sunk' });
      tx.update(pbRef, { resolved: 'sunk' });
    } else if (action === 'reroute') {
      const patch = rerouteThrough(flight, now, waypoints, TIME_SCALE);
      tx.update(ref, { ...patch, redirects: FieldValue.increment(1), events: FieldValue.arrayUnion({ type: 'rerouted', at: now, by: uid, place: u.city }) });
      tx.update(db.doc(`letters_public/${letterId}`), { waypoints: patch.waypoints, departedAt: patch.departedAt, arrivesAt: patch.arrivesAt, penalty: null });
      tx.update(pbRef, { resolved: 'rerouted' });
    } else if (action === 'snail') {
      if (VEHICLES[l.vehicle as VehicleId].immuneSnail) { res.outcome = 'immune'; tx.update(pbRef, { resolved: 'defended' }); return; }
      const patch = applySnail(flight, now);
      tx.update(ref, { ...patch, events: FieldValue.arrayUnion({ type: 'snail', at: now, by: uid, place: u.city }) });
      tx.update(db.doc(`letters_public/${letterId}`), { penalty: patch.penalty, arrivesAt: patch.arrivesAt });
      tx.update(pbRef, { resolved: 'snail' });
    } else {
      tx.update(ref, { status: action, events: FieldValue.arrayUnion({ type: action, at: now, by: uid, place: u.city }) });
      tx.update(db.doc(`letters_public/${letterId}`), { status: action });
      tx.update(pbRef, { resolved: action });
    }
    tx.update(db.doc(`users/${uid}`), { coins: FieldValue.increment(COINS.mischief) });
  });
  const l = (await ref.get()).data()!;
  if (res.outcome === 'defended') await push(l.senderId, '🛡️ 방어권이 장난을 막았어요', `${u.city}에서 누군가 편지를 건드렸지만 튕겨냈어요`, { route: `/letter/${letterId}` });
  else if (res.outcome === 'done') await push(l.senderId, action === 'reroute' ? '🧭 누군가 내 편지의 경로를 바꿨어요' : action === 'pull' ? '🧲 누군가 내 편지를 끌어갔어요' : action === 'sunk' ? '🌊 내 편지가 바다에 빠졌어요 · 3시간 뒤 떠오르거나 지금 건져낼 수 있어요' : action === 'snail' ? '🐌 내 편지에 달팽이가 붙었어요' : '😈 누군가 내 편지에 장난을 쳤어요', '방어권으로 막을 수 있어요', { route: `/letter/${letterId}` });
  return { outcome: res.outcome };
});

// ---------------- rescueLetter (바다에서 건지기) ----------------
export const rescueLetter = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');
  const ref = db.doc(`letters/${req.data?.letterId}`);
  await db.runTransaction(async (tx) => {
    const l = (await tx.get(ref)).data() as any;
    if (!l || l.senderId !== uid || l.status !== 'sunk') throw new HttpsError('failed-precondition', 'not sunk');
    const u = (await tx.get(db.doc(`users/${uid}`))).data() as UserDoc;
    if ((u.coins ?? 0) < OCEAN_RESCUE_COINS) throw new HttpsError('resource-exhausted', 'coins');
    const now = Date.now();
    tx.update(db.doc(`users/${uid}`), { coins: FieldValue.increment(-OCEAN_RESCUE_COINS) });
    tx.update(ref, { ...resurface(l, now), events: FieldValue.arrayUnion({ type: 'rescued', at: now, by: uid }) });
    tx.update(db.doc(`letters_public/${ref.id}`), { status: 'flying' });
  });
  return { ok: true };
});

// ---------------- approveReply: 답장 수락(수락 편지 출발) / 수락 편지 확정(친구) ----------------
export const approveReply = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');
  const { letterId, approve } = req.data ?? {};
  const ref = db.doc(`letters/${letterId}`);
  const l = (await ref.get()).data() as any;
  if (!l || l.recipientId !== uid || l.status !== 'delivered') throw new HttpsError('failed-precondition', 'not approvable');
  const now = Date.now();
  if (!approve) { await ref.update({ status: 'declined', events: FieldValue.arrayUnion({ type: 'declined', at: now, by: uid }) }); return { ok: true }; }
  const other = l.senderId as string;
  if (l.kind === 'reply') {
    // 수락 → 수락 편지(kind accept)가 상대에게 출발. 프로는 즉시, 플러스는 가장 빠른 배달원, 무료는 걷기
    const u = await ensureUser(uid);
    const myLoc = await privateLoc(uid);
    const otherLoc = await privateLoc(other);
    if (!myLoc || !otherLoc) throw new HttpsError('failed-precondition', 'location');
    const mode = PLAN_LIMITS[u.plan].acceptDelivery;
    const owned = (Object.keys(VEHICLES) as VehicleId[]).filter((v) => VEHICLES[v].motion !== 'orbit' && vehicleAllowed(v, u)).sort((a, b) => VEHICLES[a].speedKmh - VEHICLES[b].speedKmh);
    const vehicle: VehicleId = mode === 'normal' ? 'walk' : owned[owned.length - 1] ?? 'walk';
    const route = buildRoute(myLoc, otherLoc, [], vehicle);
    const dur = mode === 'instant' ? 1000 : durationMs(route.totalKm, vehicle, TIME_SCALE);
    const k = { kind: 'accept', senderId: uid, recipientId: other, replyToId: letterId, friendRequest: true, text: '답장 잘 읽었어요. 친구가 되고 싶어요 — 이 편지가 도착하면 확정해주세요.', imageUrl: null, origin: { ...myLoc, city: u.city, country: u.country }, destination: { ...fuzzToGrid(otherLoc, 10), city: '', country: '' }, randomDestination: false, waypoints: [], vehicle, shield: true, target: {}, isPublic: false, status: 'flying', departedAt: now, arrivesAt: now + dur, distanceKm: route.totalKm, redirects: 0, pulls: 0, peekedBy: [], penalty: null, stamp: u.city, participants: [uid, other], events: [{ type: 'departed', at: now, place: u.city }], lastTickAt: now };
    const kref = await db.collection('letters').add(k);
    await db.doc(`letters_public/${kref.id}`).set({ origin: k.origin, destination: k.destination, waypoints: [], vehicle, departedAt: now, arrivesAt: now + dur, status: 'flying', shield: true, penalty: null, isReply: true });
    await ref.update({ status: 'approved', events: FieldValue.arrayUnion({ type: 'approved', at: now, by: uid }) });
    await push(other, '✅ 상대가 답장을 수락했어요', '수락 편지가 오는 중 · 도착하면 확정해서 친구가 되세요', { route: `/letter/${kref.id}` });
    return { ok: true, acceptLetterId: kref.id };
  }
  if (l.kind !== 'accept') throw new HttpsError('failed-precondition', 'not accept letter');
  const chatId = [uid, other].sort().join('_');
  await db.runTransaction(async (tx) => {
    const meRef = db.doc(`users/${uid}`), otherRef = db.doc(`users/${other}`);
    const me = (await tx.get(meRef)).data() as UserDoc; const ot = (await tx.get(otherRef)).data() as UserDoc;
    const grant = (u: UserDoc, newCount: number) => { const target = Math.floor(newCount / SHIELD_PER_FRIENDS); return { granted: Math.max(0, target - (u.shieldMilestone ?? 0)), target }; };
    const gMe = grant(me, (me.friendIds?.length ?? 0) + 1), gOt = grant(ot, (ot.friendIds?.length ?? 0) + 1);
    tx.update(meRef, { friendIds: FieldValue.arrayUnion(other), coins: FieldValue.increment(COINS.friend), shieldMilestone: gMe.target, 'inventory.shield': FieldValue.increment(gMe.granted) });
    tx.update(otherRef, { friendIds: FieldValue.arrayUnion(uid), coins: FieldValue.increment(COINS.friend), shieldMilestone: gOt.target, 'inventory.shield': FieldValue.increment(gOt.granted) });
    tx.update(ref, { status: 'approved', events: FieldValue.arrayUnion({ type: 'approved', at: now, by: uid }) });
    if (l.replyToId) tx.update(db.doc(`letters/${l.replyToId}`), { status: 'approved' });
    tx.set(db.doc(`chats/${chatId}`), { members: [uid, other], since: now, lastMessageAt: now }, { merge: true });
  });
  await push(other, '🤝 왕복 완료 · 친구가 됐어요', '이제 실시간 채팅이 열렸어요', { route: `/chat/${uid}` });
  return { ok: true, chatId };
});

export const likePost = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');
  const ref = db.doc(`posts/${req.data?.postId}`);
  await db.runTransaction(async (tx) => {
    const p = (await tx.get(ref)).data();
    if (!p) throw new HttpsError('not-found', 'post');
    const liked = (p.likedBy ?? []).includes(uid);
    tx.update(ref, { likes: FieldValue.increment(liked ? -1 : 1), likedBy: liked ? FieldValue.arrayRemove(uid) : FieldValue.arrayUnion(uid) });
    if (!liked && p.authorId !== uid) tx.update(db.doc(`users/${p.authorId}`), { coins: FieldValue.increment(COINS.like), 'stats.likes': FieldValue.increment(1) });
  });
  return { ok: true };
});

// ---------------- tickWorld (매 분) ----------------
export const tickWorld = onSchedule({ schedule: 'every 1 minutes', timeoutSeconds: 120, memory: '512MiB' }, async () => {
  const now = Date.now();
  // 1) 도착
  const arrived = await db.collection('letters').where('status', '==', 'flying').where('arrivesAt', '<=', now).limit(300).get();
  for (const d of arrived.docs) {
    const l = d.data() as any;
    if (l.recipientId) {
      await d.ref.update({ status: 'delivered', landedAt: now, events: FieldValue.arrayUnion({ type: 'delivered', at: now }) });
      await db.doc(`letters_public/${d.id}`).update({ status: 'delivered' });
      await push(l.recipientId, '📬 답장이 도착했어요', `${l.origin.city}에서 온 답장. 승인하면 실시간 채팅이 시작돼요`, { route: `/letter/${d.id}` });
    } else {
      await d.ref.update({ status: 'landed', landedAt: now, events: FieldValue.arrayUnion({ type: 'landed', at: now }) });
      await db.doc(`letters_public/${d.id}`).update({ status: 'landed' });
      await push(l.senderId, '📍 편지가 착륙했어요', '누군가 집어갈 때까지 기다려요', { route: `/letter/${d.id}` });
      await notifyNearby(d.id, l, l.destination, now, LANDED_WINDOW_MS, '📍 근처에 편지가 착륙했어요', '집어가 볼까요?');
    }
  }
  // 1b) 침수 복귀
  const sunk = await db.collection('letters').where('status', '==', 'sunk').where('sunkUntil', '<=', now).limit(200).get();
  for (const d of sunk.docs) { const l = d.data() as any; await d.ref.update({ ...resurface(l, now), events: FieldValue.arrayUnion({ type: 'resurfaced', at: now }) }); await db.doc(`letters_public/${d.id}`).update({ status: 'flying' }); await push(l.senderId, '🌊 편지가 다시 떠올랐어요', '이어서 목적지로 갑니다', { route: `/letter/${d.id}` }); }
  // 2) 만료
  const stale = await db.collection('letters').where('status', '==', 'landed').where('landedAt', '<=', now - LANDED_WINDOW_MS).limit(200).get();
  for (const d of stale.docs) { await d.ref.update({ status: 'expired', events: FieldValue.arrayUnion({ type: 'expired', at: now }) }); await db.doc(`letters_public/${d.id}`).update({ status: 'expired' }); }
  // 3) 통과 판정
  const flying = await db.collection('letters').where('status', '==', 'flying').limit(500).get();
  for (const d of flying.docs) {
    const l = d.data() as any as FlightDoc & { lastTickAt?: number; senderId: string; recipientId?: string; target?: any; vehicle: VehicleId };
    if (l.recipientId) { await d.ref.update({ lastTickAt: now }); continue; }
    const t0 = l.lastTickAt ?? now - 60_000;
    await notifyNearby(d.id, l, null, now, catchWindowMs(l.vehicle), `${l.vehicle} 편지가 머리 위를 지나가요!`, '잡거나 경로를 바꿔보세요', t0);
    await d.ref.update({ lastTickAt: now });
  }
});

/** 편지 현재 위치(또는 착륙 지점) 주변 150km 사용자에게 passby 생성 + 푸시 */
async function notifyNearby(letterId: string, l: any, point: LatLng | null, now: number, windowMs: number, title: string, body: string, t0?: number) {
  const center = point ?? positionOf(l, now);
  const bounds = geohashQueryBounds([center.lat, center.lng], PASSBY_RADIUS_KM * 1000);
  const seen = new Set<string>();
  for (const b of bounds) {
    const snap = await db.collection('users_private').orderBy('geohash').startAt(b[0]).endAt(b[1]).limit(200).get();
    for (const u of snap.docs) {
      if (u.id === l.senderId || seen.has(u.id)) continue;
      const ud = u.data();
      const uLoc = { lat: ud.lat, lng: ud.lng };
      const dist = point ? distanceBetween([center.lat, center.lng], [uLoc.lat, uLoc.lng]) : minDistanceBetween(l, t0 ?? now - 60_000, now, uLoc);
      if (dist > PASSBY_RADIUS_KM) continue;
      seen.add(u.id);
      const pbRef = db.doc(`users/${u.id}/passbys/${letterId}`);
      if ((await pbRef.get()).exists) continue;
      const profile = (await db.doc(`users/${u.id}`).get()).data() as UserDoc | undefined;
      const canCatch = profile ? matchesTarget(profile, l.target) : true;
      await pbRef.set({ letterId, at: now, expiresAt: now + windowMs, canCatch, vehicle: l.vehicle, originCity: l.origin?.city ?? '' });
      await push(u.id, title, body, { route: `/catch/${letterId}` }, 'passby');
    }
  }
  void distanceKm;
}

// ---------------- 즉시 친구 (결제) ----------------
export const requestInstantFriend = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');
  const toId = String(req.data?.toId ?? '');
  if (!toId || toId === uid) throw new HttpsError('invalid-argument', 'toId');
  const u = await ensureUser(uid);
  const month = new Date().toISOString().slice(0, 7);
  const used = await db.collection('instant_requests').where('fromId', '==', uid).where('month', '==', month).where('status', 'in', ['pending', 'accepted']).count().get();
  if (used.data().count >= PLAN_LIMITS[u.plan].monthlyInstant) {
    if ((u.inventory.instant ?? 0) <= 0) throw new HttpsError('resource-exhausted', 'instant quota');
    await db.doc(`users/${uid}`).update({ 'inventory.instant': FieldValue.increment(-1) });
  }
  const ref = await db.collection('instant_requests').add({ fromId: uid, toId, status: 'pending', at: Date.now(), month, expiresAt: Date.now() + 86_400_000 });
  await push(toId, '⚡ 누군가 즉시 친구를 요청했어요', '프로필을 보고 수락하거나 거절하세요', { route: `/user/${uid}` });
  return { id: ref.id };
});
export const answerInstantFriend = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');
  const ref = db.doc(`instant_requests/${req.data?.id}`);
  const r = (await ref.get()).data();
  if (!r || r.toId !== uid || r.status !== 'pending') throw new HttpsError('failed-precondition', 'no request');
  if (!req.data?.accept) { await ref.update({ status: 'declined' }); await db.doc(`users/${r.fromId}`).update({ 'inventory.instant': FieldValue.increment(1) }); return { ok: true }; }
  const chatId = [uid, r.fromId].sort().join('_');
  await db.runTransaction(async (tx) => {
    tx.update(ref, { status: 'accepted' });
    tx.update(db.doc(`users/${uid}`), { friendIds: FieldValue.arrayUnion(r.fromId), coins: FieldValue.increment(COINS.friend) });
    tx.update(db.doc(`users/${r.fromId}`), { friendIds: FieldValue.arrayUnion(uid), coins: FieldValue.increment(COINS.friend) });
    tx.set(db.doc(`chats/${chatId}`), { members: [uid, r.fromId], since: Date.now(), lastMessageAt: Date.now() }, { merge: true });
  });
  await push(r.fromId, '⚡ 즉시 친구가 수락됐어요', '실시간 채팅이 열렸어요', { route: `/chat/${uid}` });
  return { ok: true, chatId };
});
export const commentPost = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'login required');
  const text = String(req.data?.text ?? '').trim();
  if (!text || text.length > 300) throw new HttpsError('invalid-argument', 'text');
  const ref = db.doc(`posts/${req.data?.postId}`);
  const p = (await ref.get()).data();
  if (!p) throw new HttpsError('not-found', 'post');
  await ref.collection('comments').add({ authorId: uid, text, at: Date.now() });
  await ref.update({ commentCount: FieldValue.increment(1) });
  if (p.authorId !== uid) { await db.doc(`users/${uid}`).update({ coins: FieldValue.increment(COINS.comment) }); await push(p.authorId, '💬 내 엽서에 댓글이 달렸어요', text.slice(0, 80), { route: `/post/${ref.id}` }); }
  return { ok: true };
});

// ---------------- 채팅 푸시 ----------------
export const onMessageCreate = onDocumentCreated('chats/{chatId}/messages/{mid}', async (event) => {
  const m = event.data?.data();
  if (!m) return;
  const chat = (await db.doc(`chats/${event.params.chatId}`).get()).data();
  const other = (chat?.members ?? []).find((x: string) => x !== m.senderId);
  await db.doc(`chats/${event.params.chatId}`).update({ lastMessageAt: m.at, lastText: m.text });
  if (other) {
    const sender = (await db.doc(`users/${m.senderId}`).get()).data();
    await push(other, sender?.nickname ?? '새 메시지', String(m.text).slice(0, 120), { route: `/chat/${m.senderId}` });
  }
});

// ---------------- RevenueCat 웹훅 ----------------
const PRODUCT_GRANTS: Record<string, Partial<{ shield: number; ufo: number; orbit: number; peek: number; pull: number; instant: number; coins: number }>> = {
  wws_shield_5: { shield: 5 }, wws_peek_5: { peek: 5 }, wws_pull_1: { pull: 1 }, wws_instant_1: { instant: 1 }, wws_ufo_1: { ufo: 1 }, wws_orbit_1: { orbit: 1 }, wws_coins_300: { coins: 300 }, wws_coins_1000: { coins: 1000 },
};
const PLAN_GRANTS: Record<string, { plan: Plan; shield: number; ufo: number; orbit: number }> = {
  wws_plus_monthly: { plan: 'plus', shield: 5, ufo: 0, orbit: 0 }, wws_pro_monthly: { plan: 'pro', shield: 15, ufo: 3, orbit: 1 },
};
export const revenuecatWebhook = onRequest({ secrets: [RC_SECRET] }, async (req, res) => {
  if (req.headers.authorization !== `Bearer ${RC_SECRET.value()}`) { res.status(401).send('unauthorized'); return; }
  const ev = req.body?.event;
  if (!ev) { res.status(400).send('no event'); return; }
  const uid = ev.app_user_id as string;
  const product = ev.product_id as string;
  const ref = db.doc(`users/${uid}`);
  if (['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'].includes(ev.type) && PLAN_GRANTS[product]) {
    const g = PLAN_GRANTS[product];
    await ref.set({ plan: g.plan, planExpiresAt: ev.expiration_at_ms ?? null, inventory: { shield: FieldValue.increment(g.shield), ufo: FieldValue.increment(g.ufo), orbit: FieldValue.increment(g.orbit) } }, { merge: true });
  } else if (['EXPIRATION', 'CANCELLATION', 'BILLING_ISSUE'].includes(ev.type) && PLAN_GRANTS[product]) {
    if (ev.type === 'EXPIRATION') await ref.set({ plan: 'free', planExpiresAt: null }, { merge: true });
  } else if (ev.type === 'NON_RENEWING_PURCHASE' && PRODUCT_GRANTS[product]) {
    const g = PRODUCT_GRANTS[product];
    await ref.set({ coins: FieldValue.increment(g.coins ?? 0), inventory: { shield: FieldValue.increment(g.shield ?? 0), ufo: FieldValue.increment(g.ufo ?? 0), orbit: FieldValue.increment(g.orbit ?? 0), peek: FieldValue.increment(g.peek ?? 0), pull: FieldValue.increment(g.pull ?? 0), instant: FieldValue.increment(g.instant ?? 0) } }, { merge: true });
  }
  res.status(200).send('ok');
});

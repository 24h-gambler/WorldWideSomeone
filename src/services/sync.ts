/**
 * Supabase 동기화 — 내 편지/답장·통과·알림·채팅을 구독하고, 게임 액션은 Edge Function 을 호출한다.
 * 환경변수가 없으면 아무것도 하지 않는다(로컬 봇 시뮬).
 */
import { AppState, type NativeEventSubscription } from 'react-native';
import { supabase, supabaseEnabled } from './supabase';
import { registerRemote, useStore } from '@/store';
import type { Letter, Post } from '@/types';
import type { ReportInput } from '@/store';
import { configureAnalytics, flush, type AnalyticsEvent } from './analytics';
import type { LatLng } from '@/types';

/** 실시간 대체: 앱이 앞에 있을 때 몇 초마다 서버 inbox 를 읽는다 (Cloudflare 서버 · postgres_changes 없음) */
const POLL_MS = 6000;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: NativeEventSubscription | null = null;
let pollSince: string | null = null;
let polling = false;

export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

const call = async <T = any>(fn: string, body: Record<string, unknown>): Promise<T> => {
  if (!supabase) throw new Error('supabase disabled');
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw error;
  return data as T;
};

/** 서버 행(snake_case) → 앱 모델 */
const toLetter = (r: any): Letter => ({
  id: r.id, kind: r.kind, senderId: r.sender_id, recipientId: r.recipient_id ?? undefined, replyToId: r.reply_to_id ?? undefined, friendRequest: true, direct: r.direct || undefined, rented: r.rented || undefined, boost: r.boost ?? undefined,
  text: r.text ?? '', imageUri: r.image_url ?? undefined, origin: r.origin, destination: r.destination, randomDestination: !!r.random_destination, waypoints: r.waypoints ?? [], vehicle: r.vehicle, shield: !!r.shield, target: r.target ?? {}, isPublic: !!r.is_public,
  status: r.status, departedAt: new Date(r.departed_at).getTime(), arrivesAt: new Date(r.arrives_at).getTime(), distanceKm: r.distance_km, penalty: r.penalty ?? undefined, sunkAt: r.sunk_at ? new Date(r.sunk_at).getTime() : undefined, sunkUntil: r.sunk_until ? new Date(r.sunk_until).getTime() : undefined,
  redirects: r.redirects ?? 0, pulls: r.pulls ?? 0, pulledBy: r.pulled_by ?? undefined, peekedBy: r.peeked_by ?? [], trail: r.trail ?? [], landedAt: r.landed_at ? new Date(r.landed_at).getTime() : undefined, caughtBy: r.caught_by ?? undefined, caughtAt: r.caught_at ? new Date(r.caught_at).getTime() : undefined, catchPlace: r.catch_place ?? undefined,
  events: r.events ?? [], stamp: r.stamp ?? '',
});
const toPost = (r: any, meLoc: { lat: number; lng: number }): Post => ({ id: r.id, letterId: r.letter_id ?? undefined, authorId: r.author_id, text: r.text, imageUri: r.image_url ?? undefined, city: '', country: r.country ?? '', stamp: r.stamp ?? '', vehicle: r.vehicle, at: new Date(r.at).getTime(), likes: r.likes ?? 0, likedByMe: false, distanceKm: r.distance_km ?? 0, comments: [], shareToStory: !!r.share_to_story });

/** 내 데이터 초기 적재: 프로필 · 내 편지 · 하늘 위 · 알림 · 통과 · 채팅 */
export async function loadMine(uid: string) {
  if (!supabase) return;
  const st = useStore.getState();
  const [{ data: u }, { data: mine }, { data: sky }, { data: noti }, { data: pbs }, { data: chats }] = await Promise.all([
    supabase.from('users').select('*').eq('id', uid).maybeSingle(),
    supabase.from('letters').select('*').contains('participants', [uid]).order('departed_at', { ascending: false }).limit(200),
    supabase.from('letters_public').select('*').limit(200),
    supabase.from('notifications').select('*').eq('user_id', uid).order('at', { ascending: false }).limit(80),
    supabase.from('passbys').select('*').eq('user_id', uid).is('resolved', null),
    supabase.from('chats').select('id,members,since').contains('members', [uid]),
  ]);
  const letters = [...(mine ?? []).map(toLetter), ...(sky ?? []).filter((r: any) => !(mine ?? []).some((m: any) => m.id === r.id)).map((r: any) => toLetter({ ...r, text: '', participants: [] }))];
  const patch: Record<string, unknown> = { letters };
  if (u) patch.me = { ...st.me, id: uid, nickname: u.nickname, avatar: u.avatar, bio: u.bio, field: u.field, gender: u.gender, job: u.job, hobbies: u.hobbies, plan: u.plan, coins: u.coins, inventory: u.inventory, quota: u.quota, stats: u.stats, stamps: u.stamps, shieldMilestone: u.shield_milestone };
  if (u) { patch.friendIds = u.friend_ids ?? []; patch.revealedIds = u.revealed_ids ?? []; }
  if (noti) patch.notifications = noti.map((n: any) => ({ id: n.id, type: n.type, title: n.title, body: n.body, at: new Date(n.at).getTime(), read: n.read, route: n.route ?? undefined }));
  if (pbs) patch.passbys = pbs.map((b: any) => ({ id: b.id, letterId: b.letter_id, at: new Date(b.at).getTime(), expiresAt: new Date(b.expires_at).getTime(), canCatch: b.can_catch, peeked: b.peeked }));
  if (chats) {
    const rooms = await Promise.all(chats.map(async (c: any) => { const other = c.members.find((m: string) => m !== uid); const { data: msgs } = await supabase!.from('messages').select('*').eq('chat_id', c.id).order('at').limit(200); return { id: other, otherId: other, since: new Date(c.since).getTime(), lastReadAt: Date.now(), messages: (msgs ?? []).map((m: any) => ({ id: m.id, senderId: m.sender_id === uid ? 'me' : m.sender_id, text: m.text, at: new Date(m.at).getTime() })) }; }));
    patch.chats = rooms;
  }
  const { data: blocks } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', uid);
  const blocked: string[] = blocks ? blocks.map((b: any) => b.blocked_id) : st.blockedIds ?? [];
  patch.blockedIds = blocked;
  const { data: posts } = await supabase.from('posts_public').select('*').order('at', { ascending: false }).limit(90);
  if (posts) patch.posts = posts.filter((p: any) => !blocked.includes(p.author_id)).map((p: any) => toPost(p, st.me.location));
  if (Array.isArray(patch.chats)) patch.chats = (patch.chats as any[]).filter((c) => !blocked.includes(c.otherId));
  useStore.setState(patch as any);
}

export async function startSync(): Promise<void> {
  if (!supabaseEnabled || !supabase) return;
  const uid = await ensureSession();
  const st = useStore.getState();
  st.setBackend('supabase');
  registerRemote({
    sendLetter: (input) => { void remote.sendLetter({ text: input.text, destination: input.destination, waypoints: input.waypoints, vehicle: input.vehicle, target: input.target, useShield: input.useShield, isPublic: input.isPublic, shareToStory: input.shareToStory, replyToId: input.replyToId, recipientId: input.recipientId, direct: input.direct, rent: input.rent, imageUrl: input.imageUri }).then(() => { if (uid) void loadMine(uid); }).catch(() => {}); },
    catchLetter: (id) => { void remote.catchLetter(id).catch(() => {}); },
    redirect: (id, action, wps) => { void remote.redirect(id, action, wps).catch(() => {}); },
    rescue: (id) => { void remote.rescue(id).catch(() => {}); },
    approveReply: (id, accept) => { void remote.approveReply(id, accept).then(() => { if (uid) void loadMine(uid); }).catch(() => {}); },
    boostReply: (id, tier) => { void remote.boostReply(id, tier).catch(() => {}); },
    publishPost: (id, story) => { void remote.publishPost(id, story).catch(() => {}); },
    likePost: (id, on) => { void remote.likePost(id, on).catch(() => {}); },
    comment: (id, text) => { void remote.comment(id, text).catch(() => {}); },
    setLocation: (p) => { void syncMyLocation(p); },
    block: (userId, on) => { void remote.block(userId, on).catch(() => {}); },
    report: (r) => { void remote.report(r).catch(() => {}); },
  });
  // 트래킹 싱크: 배치를 track-events 로
  configureAnalytics({ deviceId: st.deviceId, userId: uid ?? undefined, guest: !uid, sink: async (events: AnalyticsEvent[]) => { try { await call('track-events', { events }); return true; } catch { return false; } } });
  if (!uid) return; // 비회원: 읽기만(공개 뷰) — 구독 없음
  await pushProfile();
  useStore.setState({ remoteLoading: true });
  await loadMine(uid).catch(() => {});
  useStore.setState({ remoteLoading: false });
  stopPolling();
  pollSince = new Date().toISOString();
  const tick = async () => {
    pollTimer = null;
    if (AppState.currentState === 'active') await pollInbox(uid).catch(() => {});
    if (appStateSub && !pollTimer) pollTimer = setTimeout(tick, POLL_MS);
  };
  appStateSub = AppState.addEventListener('change', (st) => { if (st === 'active' && appStateSub && pollTimer) { clearTimeout(pollTimer); pollTimer = null; void tick(); } });
  pollTimer = setTimeout(tick, POLL_MS);
}
function stopPolling() { if (pollTimer) clearTimeout(pollTimer); pollTimer = null; appStateSub?.remove(); appStateSub = null; }
export function stopSync() { stopPolling(); void flush(); }

/** 새 알림 · 통과 · 채팅 메시지를 받아 store 에 합친다 (id 로 중복 제거 — 서버는 겹쳐서 돌려준다) */
async function pollInbox(uid: string) {
  if (!supabase || polling) return;
  polling = true;
  try {
    const r = await call<{ now: string; notifications: any[]; passbys: any[]; letters: any[]; messages: any[] }>('inbox', { since: pollSince });
    pollSince = r.now;
    const blocked = useStore.getState().blockedIds ?? [];
    useStore.setState((s) => {
      const notiIds = new Set(s.notifications.map((n) => n.id));
      const newNoti = r.notifications.filter((n) => !notiIds.has(n.id)).reverse().map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, at: new Date(n.at).getTime(), read: !!n.read, route: n.route ?? undefined }));
      const letterIds = new Set(s.letters.map((l) => l.id));
      const newLetters = r.letters.filter((l) => !letterIds.has(l.id)).map((l) => toLetter({ ...l, text: '', participants: [] }));
      const pbIds = new Set(s.passbys.map((b) => b.id));
      const newPb = r.passbys.filter((b) => !pbIds.has(b.id)).reverse().map((b) => ({ id: b.id, letterId: b.letter_id, at: new Date(b.at).getTime(), expiresAt: new Date(b.expires_at).getTime(), canCatch: !!b.can_catch }));
      let chats = s.chats;
      for (const m of r.messages) {
        const other = m.sender_id;
        if (other === uid || blocked.includes(other)) continue;
        const msg = { id: m.id, senderId: other, text: m.text, at: new Date(m.at).getTime() };
        const room = chats.find((c) => c.otherId === other);
        if (room && room.messages.some((x) => x.id === m.id)) continue;
        chats = room ? chats.map((c) => (c.otherId === other ? { ...c, messages: [...c.messages, msg] } : c)) : [{ id: other, otherId: other, messages: [msg], lastReadAt: 0, since: Date.now() }, ...chats];
      }
      if (!newNoti.length && !newLetters.length && !newPb.length && chats === s.chats) return {};
      return { notifications: [...newNoti, ...s.notifications], letters: [...newLetters, ...s.letters], passbys: [...newPb, ...s.passbys], chats };
    });
  } finally { polling = false; }
}

export async function pushProfile() {
  if (!supabase) return;
  const uid = await ensureSession(); if (!uid) return;
  const me = useStore.getState().me;
  await supabase.from('users').upsert({ id: uid, nickname: me.nickname, avatar: me.avatar, bio: me.bio, field: me.field, gender: me.gender, job: me.job, hobbies: me.hobbies, city: me.location.city, country: me.location.country, auth_provider: me.auth?.provider ?? 'guest', last_active_at: new Date().toISOString() });
}
export async function syncMyLocation(p: LatLng & { city?: string; country?: string }) {
  if (!supabase) return;
  try { await call('set-location', { lat: p.lat, lng: p.lng, city: p.city, country: p.country, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }); } catch { /* 분당 1회 제한 등은 조용히 무시 */ }
}
export async function registerPushToken(token: string) { if (!supabase) return; try { await call('register-push', { token }); } catch { /* ignore */ } }

/** 게임 액션 (서버 검증). 로컬 모드에서는 store 가 직접 처리하므로 호출하지 않는다. */
export const remote = {
  enabled: supabaseEnabled,
  sendLetter: (body: Record<string, unknown>) => call<{ id: string }>('send-letter', body),
  catchLetter: (letterId: string) => call('catch-letter', { letterId }),
  redirect: (letterId: string, action: 'peek' | 'pull' | 'reroute' | 'snail' | 'sunk' | 'space', waypoints?: LatLng[]) => call<{ outcome: string; text?: string }>('redirect-letter', { letterId, action, waypoints }),
  rescue: (letterId: string) => call<{ outcome: string }>('rescue-letter', { letterId }),
  approveReply: (letterId: string, accept = true) => call('approve-reply', { letterId, accept }),
  boostReply: (letterId: string, tier: 'fast' | 'instant') => call<{ outcome: string }>('boost-reply', { letterId, tier }),
  publishPost: (letterId: string, shareToStory: boolean) => call<{ id: string }>('publish-post', { letterId, shareToStory }),
  sendMessage: async (otherId: string, text: string) => { if (!supabase) return; const uid = await ensureSession(); if (!uid) return; const id = uid < otherId ? `${uid}_${otherId}` : `${otherId}_${uid}`; await supabase.from('messages').insert({ chat_id: id, sender_id: uid, text }); },
  likePost: async (postId: string, on: boolean) => { if (!supabase) return; const uid = await ensureSession(); if (!uid) return; if (on) await supabase.from('post_likes').upsert({ post_id: postId, user_id: uid }); else await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', uid); },
  comment: async (postId: string, text: string) => { if (!supabase) return; const uid = await ensureSession(); if (!uid) return; await supabase.from('comments').insert({ post_id: postId, author_id: uid, text }); },
  /** 차단 — 서버 blocks 에 기록(상대 메시지 차단은 RLS 가 강제) */
  block: async (userId: string, on: boolean) => { if (!supabase) return; const uid = await ensureSession(); if (!uid) return; if (on) await supabase.from('blocks').upsert({ blocker_id: uid, blocked_id: userId }); else await supabase.from('blocks').delete().eq('blocker_id', uid).eq('blocked_id', userId); },
  /** 신고 — reports 에 쌓이고 운영자가 24시간 안에 검토 */
  report: async (r: ReportInput) => { if (!supabase) return; const uid = await ensureSession(); if (!uid) return; await supabase.from('reports').insert({ reporter_id: uid, target_user_id: isUuid(r.targetUserId) ? r.targetUserId : null, target_ref: r.targetUserId, kind: r.kind, target_id: r.targetId ?? null, reason: r.reason, note: r.note ?? null }); },
};
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** 계정 삭제 — 서버 RPC delete_my_account 가 내 계정과 콘텐츠를 지운다(결제 기록만 법정 보관). 로컬 모드·비회원은 곧바로 true. */
export async function deleteAccount(): Promise<boolean> {
  if (!supabase) return true;
  const uid = await ensureSession(); if (!uid) return true;
  const { error } = await supabase.rpc('delete_my_account');
  return !error;
}

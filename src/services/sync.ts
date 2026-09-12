/**
 * Supabase 동기화 — 내 편지/답장·통과·알림·채팅을 구독하고, 게임 액션은 Edge Function 을 호출한다.
 * 환경변수가 없으면 아무것도 하지 않는다(로컬 봇 시뮬).
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, supabaseEnabled } from './supabase';
import { useStore } from '@/store';
import { configureAnalytics, flush, type AnalyticsEvent } from './analytics';
import type { LatLng } from '@/types';

let channel: RealtimeChannel | null = null;

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

export async function startSync(): Promise<void> {
  if (!supabaseEnabled || !supabase) return;
  const uid = await ensureSession();
  const st = useStore.getState();
  st.setBackend('supabase');
  // 트래킹 싱크: 배치를 track-events 로
  configureAnalytics({ deviceId: st.deviceId, userId: uid ?? undefined, guest: !uid, sink: async (events: AnalyticsEvent[]) => { try { await call('track-events', { events }); return true; } catch { return false; } } });
  if (!uid) return; // 비회원: 읽기만(공개 뷰) — 구독 없음
  await pushProfile();
  channel?.unsubscribe();
  channel = supabase.channel(`user:${uid}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (p) => { const n = p.new as any; useStore.setState((s) => ({ notifications: [{ id: n.id, type: n.type, title: n.title, body: n.body, at: new Date(n.at).getTime(), read: false, route: n.route ?? undefined }, ...s.notifications] })); })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'passbys', filter: `user_id=eq.${uid}` }, (p) => { const b = p.new as any; useStore.setState((s) => ({ passbys: [{ id: b.id, letterId: b.letter_id, at: new Date(b.at).getTime(), expiresAt: new Date(b.expires_at).getTime(), canCatch: b.can_catch }, ...s.passbys] })); })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => { const m = p.new as any; const other = m.sender_id; if (other === uid) return; useStore.setState((s) => ({ chats: s.chats.some((c) => c.otherId === other) ? s.chats.map((c) => (c.otherId === other ? { ...c, messages: [...c.messages, { id: m.id, senderId: other, text: m.text, at: new Date(m.at).getTime() }] } : c)) : [{ id: other, otherId: other, messages: [{ id: m.id, senderId: other, text: m.text, at: new Date(m.at).getTime() }], lastReadAt: 0, since: Date.now() }, ...s.chats] })); })
    .subscribe();
}
export function stopSync() { channel?.unsubscribe(); channel = null; void flush(); }

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
};

/**
 * 행동 트래킹 — 모든 화면 진입/체류, 버튼 탭, 스크롤 깊이, 앱 포그라운드/백그라운드. 비회원(deviceId)도 전부 기록.
 * 이벤트는 메모리 큐 → AsyncStorage 버퍼 → Supabase `events` 테이블(설정 시)로 10초/20건마다 flush.
 * 이벤트 명세는 docs/DESIGN.md §10 (taxonomy).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

export type AnalyticsEvent = { name: string; props?: Record<string, unknown>; at: number; screen?: string; session: string; device: string; user?: string; guest: boolean };

const KEY = 'wws-events';
const FLUSH_EVERY_MS = 10_000;
const FLUSH_AT = 20;
let queue: AnalyticsEvent[] = [];
let session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
let device = '';
let user: string | undefined;
let guest = true;
let currentScreen = '';
let screenEnteredAt = 0;
let sink: ((events: AnalyticsEvent[]) => Promise<boolean>) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let listeners: ((e: AnalyticsEvent) => void)[] = [];

export function configureAnalytics(opts: { deviceId: string; userId?: string; guest: boolean; sink?: typeof sink }) {
  device = opts.deviceId; user = opts.userId; guest = opts.guest; if (opts.sink !== undefined) sink = opts.sink;
  if (!timer) {
    timer = setInterval(() => void flush(), FLUSH_EVERY_MS);
    AppState.addEventListener('change', (st) => { if (st === 'active') { session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; track('app_foreground'); } else if (st === 'background') { track('app_background', { screen: currentScreen, dwellMs: Date.now() - screenEnteredAt }); void flush(); } });
    void AsyncStorage.getItem(KEY).then((raw) => { if (raw) { try { queue = [...JSON.parse(raw), ...queue]; } catch {} } });
  }
}
export const setAnalyticsUser = (userId?: string, isGuest = !userId) => { user = userId; guest = isGuest; };
export const onEvent = (fn: (e: AnalyticsEvent) => void) => { listeners.push(fn); return () => { listeners = listeners.filter((f) => f !== fn); }; };

export function track(name: string, props?: Record<string, unknown>) {
  const e: AnalyticsEvent = { name, props, at: Date.now(), screen: currentScreen || undefined, session, device, user, guest };
  queue.push(e);
  for (const l of listeners) l(e);
  if (__DEV__ && Platform.OS === 'web' && typeof console !== 'undefined') console.debug('[track]', name, props ?? '');
  if (queue.length >= FLUSH_AT) void flush();
  else void AsyncStorage.setItem(KEY, JSON.stringify(queue.slice(-200))).catch(() => {});
}

/** 화면 진입: 이전 화면의 체류 시간을 함께 남긴다 */
export function trackScreen(path: string) {
  const now = Date.now();
  if (currentScreen && currentScreen !== path) track('screen_end', { screen: currentScreen, dwellMs: now - screenEnteredAt });
  currentScreen = path; screenEnteredAt = now;
  track('screen_view', { path });
}
export const trackTap = (id: string, props?: Record<string, unknown>) => track('tap', { id, ...props });
export const trackScroll = (id: string, depth: number) => track('scroll', { id, depth });
export const currentScreenName = () => currentScreen;

export async function flush(): Promise<void> {
  if (!queue.length) return;
  if (!sink) { // 로컬 모드: 서버가 없으니 버리지 않고 최근 500건을 보관한다
    queue = queue.slice(-500);
    await AsyncStorage.setItem(KEY, JSON.stringify(queue.slice(-200))).catch(() => {});
    return;
  }
  const batch = queue.splice(0, 100);
  try {
    if (sink) { const ok = await sink(batch); if (!ok) queue = [...batch, ...queue].slice(-500); }
    await AsyncStorage.setItem(KEY, JSON.stringify(queue.slice(-200)));
  } catch { queue = [...batch, ...queue].slice(-500); }
}
export const pendingEvents = () => queue.length;
export const _debugQueue = () => queue;

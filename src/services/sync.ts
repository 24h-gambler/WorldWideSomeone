/**
 * Firebase 동기화 레이어. 로컬 스토어(zustand)를 캐시로 쓰고, 서버가 세계(비행·통과·봇 없음)를 돌린다.
 *  - 프로필/위치/푸시토큰 → users/{uid}, users_private/{uid}
 *  - 편지 발송/잡기/경로변경/승인 → callable functions (서버 검증)
 *  - 편지·통과·채팅 → Firestore 실시간 구독 → 스토어에 반영
 * Firebase 비활성이면 모든 함수는 no-op 이고 로컬 봇 시뮬이 동작한다.
 */
import { collection, doc, httpsCallable, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, addDoc, limit } from './firestore-shim';
import { ensureSignedIn, fb, firebaseEnabled } from './firebase';
import { useStore, ME_ID } from '@/store';
import type { LatLng, Letter, Passby } from '@/types';

let uid: string | null = null;
const unsubs: (() => void)[] = [];

export async function startSync(): Promise<void> {
  if (!firebaseEnabled) return;
  uid = await ensureSignedIn();
  const { db } = fb();
  const st = useStore.getState();
  st.setBackend('firebase');
  await pushProfile();

  // 내 편지 + 내게 온 답장
  unsubs.push(onSnapshot(query(collection(db, 'letters'), where('participants', 'array-contains', uid), orderBy('departedAt', 'desc'), limit(100)), (snap: any) => {
    const mine: Letter[] = snap.docs.map((d: any) => fromServerLetter(d.id, d.data()));
    const s = useStore.getState();
    const others = s.letters.filter((l) => !mine.some((m) => m.id === l.id) && l.senderId !== ME_ID && l.recipientId !== ME_ID);
    useStore.setState({ letters: [...mine, ...others] });
  }));
  // 하늘 위 편지 (전 세계, 최근 40개) — 구경용
  unsubs.push(onSnapshot(query(collection(db, 'letters'), where('status', '==', 'flying'), orderBy('departedAt', 'desc'), limit(40)), (snap: any) => {
    const flying: Letter[] = snap.docs.map((d: any) => fromServerLetter(d.id, d.data())).filter((l: Letter) => l.senderId !== ME_ID && l.recipientId !== ME_ID);
    const s = useStore.getState();
    const mine = s.letters.filter((l) => l.senderId === ME_ID || l.recipientId === ME_ID);
    useStore.setState({ letters: [...mine, ...flying] });
  }));
  // 통과 이벤트
  unsubs.push(onSnapshot(query(collection(db, 'users', uid, 'passbys'), orderBy('at', 'desc'), limit(30)), (snap: any) => {
    const passbys: Passby[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    useStore.setState({ passbys });
  }));
  // 친구/채팅
  unsubs.push(onSnapshot(doc(db, 'users', uid), (d: any) => {
    const data = d.data();
    if (!data) return;
    useStore.setState((s) => ({ friendIds: data.friendIds ?? s.friendIds, me: { ...s.me, coins: data.coins ?? s.me.coins, inventory: data.inventory ?? s.me.inventory, plan: data.plan ?? s.me.plan, stamps: data.stamps ?? s.me.stamps } }));
  }));
}

export function stopSync() {
  unsubs.splice(0).forEach((u) => u());
}

function fromServerLetter(id: string, d: any): Letter {
  const me = uid;
  return { ...d, id, senderId: d.senderId === me ? ME_ID : d.senderId, recipientId: d.recipientId === me ? ME_ID : d.recipientId, caughtBy: d.caughtBy === me ? ME_ID : d.caughtBy };
}

export async function pushProfile() {
  if (!firebaseEnabled || !uid) return;
  const { db } = fb();
  const me = useStore.getState().me;
  await setDoc(doc(db, 'users', uid), { nickname: me.nickname, avatar: me.avatar, bio: me.bio, field: me.field, gender: me.gender, job: me.job, hobbies: me.hobbies, city: me.location.city, country: me.location.country, plan: me.plan, updatedAt: serverTimestamp() }, { merge: true });
  await syncMyLocation(me.location);
}

/** 정확 위치는 users_private 에만 (통과 판정용, 10km 격자). 친구에게는 서버가 50km 격자로 내려줌. */
export async function syncMyLocation(p: LatLng) {
  if (!firebaseEnabled) return;
  const id = uid ?? (await ensureSignedIn());
  const { db } = fb();
  const { geohashForLocation } = await import('geofire-common');
  await setDoc(doc(db, 'users_private', id), { lat: p.lat, lng: p.lng, geohash: geohashForLocation([p.lat, p.lng]), updatedAt: serverTimestamp() }, { merge: true });
}

export async function registerPushToken(token: string) {
  if (!firebaseEnabled || !uid) return;
  const { db } = fb();
  await setDoc(doc(db, 'users_private', uid), { pushToken: token, platform: process.env.EXPO_OS ?? 'unknown' }, { merge: true });
}

export const remote = {
  enabled: () => firebaseEnabled,
  sendLetter: (input: any) => httpsCallable(fb().fns, 'sendLetter')(input),
  catchLetter: (letterId: string) => httpsCallable(fb().fns, 'catchLetter')({ letterId }),
  redirectLetter: (letterId: string, action: string, waypoints?: LatLng[]) => httpsCallable(fb().fns, 'redirectLetter')({ letterId, action, waypoints }),
  approveReply: (letterId: string, approve: boolean) => httpsCallable(fb().fns, 'approveReply')({ letterId, approve }),
  sendMessage: async (otherId: string, text: string) => {
    const { db } = fb();
    const chatId = [uid!, otherId].sort().join('_');
    await addDoc(collection(db, 'chats', chatId, 'messages'), { senderId: uid, text, at: Date.now() });
  },
};

/**
 * 푸시 알림: 권한 상태, Expo Push Token 등록(서버가 통과 알림을 보낼 때 사용), 알림 탭 → 화면 이동.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { PermissionState } from '@/types';

let Notifications: typeof import('expo-notifications') | null = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
  } catch { Notifications = null; }
}

export async function getNotificationPermission(): Promise<PermissionState> {
  if (!Notifications) return Platform.OS === 'web' ? 'unavailable' : 'unavailable';
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'granted';
    if (p.status === 'denied' && !p.canAskAgain) return 'denied';
    return p.status === 'undetermined' ? 'undetermined' : 'denied';
  } catch { return 'unavailable'; }
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!Notifications) return 'unavailable';
  try {
    const p = await Notifications.requestPermissionsAsync();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('passby', { name: '머리 위 통과', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: '#0095F6' }).catch(() => {});
      await Notifications.setNotificationChannelAsync('default', { name: '일반', importance: Notifications.AndroidImportance.DEFAULT }).catch(() => {});
    }
    return p.granted ? 'granted' : 'denied';
  } catch { return 'unavailable'; }
}

/** Expo Push Token — EAS projectId 필요 (app.json extra.eas.projectId). Expo Go(Android)는 원격 푸시 미지원 → null */
export async function getPushToken(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    if (!projectId) return null;
    const t = await Notifications.getExpoPushTokenAsync({ projectId });
    return t.data;
  } catch { return null; }
}

/** 알림 탭 시 route 로 이동 */
export function subscribeNotificationTaps(onRoute: (route: string) => void): () => void {
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((res) => {
    const route = (res.notification.request.content.data as any)?.route;
    if (typeof route === 'string') onRoute(route);
  });
  Notifications.getLastNotificationResponseAsync?.().then((res) => {
    const route = (res?.notification.request.content.data as any)?.route;
    if (typeof route === 'string') onRoute(route);
  }).catch(() => {});
  return () => sub.remove();
}

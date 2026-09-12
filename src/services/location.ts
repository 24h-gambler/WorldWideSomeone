/**
 * 실제 기기 위치: 권한 상태 조회, 현재 위치, 백그라운드 위치 업데이트(통과 판정을 서버가 하려면 필요).
 * 웹은 브라우저 geolocation, 네이티브는 expo-location.
 */
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { PermissionState, Place } from '@/types';
import { describePlace } from '@/engine/geo';

export const BG_LOCATION_TASK = 'wws-background-location';

function toState(p: Location.PermissionResponse | null): PermissionState {
  if (!p) return 'unavailable';
  if (p.granted) return 'granted';
  if (p.status === 'denied' && !p.canAskAgain) return 'denied';
  if (p.status === 'denied') return 'denied';
  return 'undetermined';
}

export async function getLocationPermission(): Promise<{ foreground: PermissionState; background: PermissionState }> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    let bg: PermissionState = 'unavailable';
    if (Platform.OS !== 'web') {
      try { bg = toState(await Location.getBackgroundPermissionsAsync()); } catch { bg = 'unavailable'; }
    }
    return { foreground: toState(fg), background: bg };
  } catch {
    return { foreground: 'unavailable', background: 'unavailable' };
  }
}

export async function requestForegroundLocation(): Promise<PermissionState> {
  try { return toState(await Location.requestForegroundPermissionsAsync()); } catch { return 'unavailable'; }
}

export async function requestBackgroundLocation(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  try { return toState(await Location.requestBackgroundPermissionsAsync()); } catch { return 'unavailable'; }
}

export async function getCurrentPlace(prompt = true): Promise<Place> {
  const perm = prompt ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
  if (!perm.granted) throw new Error('위치 권한이 꺼져 있어요. 설정에서 허용하거나 도시를 직접 선택하세요.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return describePlace({ lat: pos.coords.latitude, lng: pos.coords.longitude });
}

/** 백그라운드 위치 업데이트 시작 (dev build 필요, Expo Go 미지원). 태스크 정의는 src/services/background.ts */
export async function startBackgroundLocation(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const bg = await Location.getBackgroundPermissionsAsync();
    if (!bg.granted) return false;
    const started = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
    if (started) return true;
    await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 2000, // 2km 이동마다
      deferredUpdatesInterval: 5 * 60_000,
      showsBackgroundLocationIndicator: false,
      pausesUpdatesAutomatically: true,
      foregroundService: { notificationTitle: 'WorldWideSomeone', notificationBody: '머리 위를 지나는 편지를 감지 중', notificationColor: '#0095F6' },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundLocation() {
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK)) await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
  } catch { /* ignore */ }
}

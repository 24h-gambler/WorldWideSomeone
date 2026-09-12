/** 백그라운드 위치 태스크 — 앱이 닫혀 있어도 위치를 서버에 보내 통과 알림을 받게 한다. (앱 진입점에서 import) */
import { Platform } from 'react-native';
import { BG_LOCATION_TASK } from './location';
import { fuzzToGrid } from '@/engine/geo';
import { syncMyLocation } from './sync';

if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
  TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }: any) => {
    if (error || !data?.locations?.length) return;
    const loc = data.locations[data.locations.length - 1];
    const p = fuzzToGrid({ lat: loc.coords.latitude, lng: loc.coords.longitude }, 10);
    await syncMyLocation(p).catch(() => {});
  });
}

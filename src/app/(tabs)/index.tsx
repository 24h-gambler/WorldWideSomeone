import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Globe } from '@/components/globe/Globe';
import { Coin, IconButton, ProgressBar, Row, T } from '@/components/ui';
import { VEHICLE_MAP } from '@/data/vehicles';
import { formatDuration, formatKm, fuzz50km } from '@/engine/geo';
import { useNow } from '@/hooks/use-now';
import { ME_ID, displayName, getUser, progressOf, selectUnread, useStore } from '@/store';
import { colors, radius, spacing, TAB_BAR_HEIGHT } from '@/theme';
import { tap } from '@/engine/haptics';
import { VehicleIcon } from '@/components/vehicle-icon';

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const now = useNow(2);

  const me = useStore((s) => s.me);
  const letters = useStore((s) => s.letters);
  const friendIds = useStore((s) => s.friendIds);
  const focusLetterId = useStore((s) => s.focusLetterId);
  const setFocus = useStore((s) => s.setFocusLetter);
  const unread = useStore(selectUnread);
  const allPassbys = useStore((s) => s.passbys);
  const passbys = useMemo(() => allPassbys.filter((p) => !p.resolved && p.expiresAt > now), [allPassbys, now]);

  const flying = useMemo(() => letters.filter((l) => l.status === 'flying' || l.status === 'landed'), [letters]);
  const flyingCount = flying.filter((l) => l.status === 'flying').length;
  const friends = useMemo(
    () => friendIds.map((id) => getUser({ me }, id)).filter(Boolean).map((u) => ({ id: u!.id, avatar: u!.avatar, location: fuzz50km(u!.location) })),
    [friendIds, me],
  );
  const focus = flying.find((l) => l.id === focusLetterId) ?? null;
  const passby = passbys[0];
  const passbyLetter = passby ? letters.find((l) => l.id === passby.letterId) : null;

  const globeSize = Math.min(width * 1.02, height - 360);

  return (
    <View style={styles.root}>
      {/* 지구 */}
      <View style={[styles.globeWrap, { top: insets.top + 64, bottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, 10) + 140 }]}>
        <Globe
          size={globeSize}
          letters={flying}
          me={me.location}
          friends={friends}
          focusLetterId={focusLetterId}
          onSelectLetter={(id) => setFocus(id)}
          fps={30}
        />
      </View>

      {/* 상단 바 */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View>
          <T t="h2">안녕, {me.nickname} {me.avatar}</T>
          <T t="small" color={colors.textDim}>지금 하늘에 {flyingCount}개의 편지 · 내 위치 {me.location.city}</T>
        </View>
        <Row>
          <Coin amount={me.coins} />
          <IconButton icon="🔔" badge={unread} onPress={() => router.push('/notifications')} />
        </Row>
      </View>

      {/* 머리 위 통과 배너 */}
      {passby && passbyLetter ? (
        <Pressable onPress={() => { tap(); router.push(`/catch/${passbyLetter.id}`); }} style={[styles.banner, { top: insets.top + 70 }]}>
          <LinearGradient colors={['#FF5C8A', '#FF9A5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bannerInner}>
            <VehicleIcon id={passbyLetter.vehicle} size={30} />
            <View style={{ flex: 1 }}>
              <T t="bodyStrong" color="#fff">{VEHICLE_MAP[passbyLetter.vehicle].name}가 머리 위를 지나가요!</T>
              <T t="small" color="rgba(255,255,255,0.9)">{passbyLetter.origin.city}에서 출발 · {formatDuration(passby.expiresAt - now)} 남음</T>
            </View>
            <View style={styles.bannerBtn}><T t="small" style={{ fontWeight: '800', color: '#FF5C8A' }}>잡기</T></View>
          </LinearGradient>
        </Pressable>
      ) : null}

      {/* 하단 */}
      <View style={[styles.bottom, { paddingBottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, 10) + 12 }]}>
        {focus ? <FocusCard letter={focus} now={now} onClose={() => setFocus(null)} onOpen={() => router.push(`/letter/${focus.id}`)} /> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }} style={{ marginTop: spacing.sm }}>
          {flying
            .slice()
            .sort((a, b) => (a.senderId === ME_ID ? -1 : 1) - (b.senderId === ME_ID ? -1 : 1))
            .slice(0, 12)
            .map((l) => {
              const v = VEHICLE_MAP[l.vehicle];
              const on = l.id === focusLetterId;
              const mine = l.senderId === ME_ID;
              return (
                <Pressable key={l.id} onPress={() => { tap(); setFocus(on ? null : l.id); }} style={[styles.flightChip, on && { borderColor: mine ? colors.accent : v.color, backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                  <VehicleIcon id={l.vehicle} size={18} />
                  <T t="caption" color={on ? colors.text : colors.textDim}>{mine ? '내 편지' : '???'} · {l.destination.city}</T>
                </Pressable>
              );
            })}
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <Pressable onPress={() => { tap(); router.push('/compose'); }} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
            <LinearGradient colors={['#FF5C8A', '#FF9A5C', '#7C5CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
              <T style={{ fontSize: 20 }}>✍️</T>
              <T t="bodyStrong" color="#fff">편지 쓰기</T>
              <T t="small" color="rgba(255,255,255,0.85)">·</T>
              <VehicleIcon id={bestVehicle(friendIds.length, me.inventory)} size={20} />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function bestVehicle(friends: number, inv: { ufo: number; orbit: number }) {
  if (inv.orbit > 0) return 'satellite' as const;
  if (inv.ufo > 0) return 'ufo' as const;
  if (friends >= 60) return 'dragon' as const;
  if (friends >= 35) return 'rocket' as const;
  if (friends >= 20) return 'jet' as const;
  if (friends >= 10) return 'prop' as const;
  if (friends >= 5) return 'balloon' as const;
  if (friends >= 2) return 'pigeon' as const;
  return 'paper' as const;
}

function FocusCard({ letter, now, onClose, onOpen }: { letter: any; now: number; onClose: () => void; onOpen: () => void }) {
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const v = VEHICLE_MAP[letter.vehicle as keyof typeof VEHICLE_MAP];
  const p = progressOf(letter, now);
  const mine = letter.senderId === ME_ID;
  return (
    <View style={styles.focusCard}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <VehicleIcon id={letter.vehicle} size={30} />
          <View>
            <T t="bodyStrong">{letter.origin.city} → {letter.destination.city}</T>
            <T t="small" color={colors.textDim}>{mine ? '내 편지' : displayName({ me, friendIds }, letter.senderId)} · {v.name} · {formatKm(letter.distanceKm)}{letter.shield ? ' · 🛡️' : ''}</T>
          </View>
        </Row>
        <Pressable hitSlop={10} onPress={() => { tap(); onClose(); }}><T color={colors.textDim}>✕</T></Pressable>
      </Row>
      <View style={{ marginTop: spacing.md, gap: 6 }}>
        <ProgressBar value={p} color={mine ? colors.accent : v.color} />
        <Row style={{ justifyContent: 'space-between' }}>
          <T t="caption" color={colors.textFaint}>{letter.status === 'landed' ? '착륙 · 누군가 집어가길 기다려요' : `${Math.round(p * 100)}% · ${formatDuration(letter.arrivesAt - now)} 후 도착`}</T>
          <Pressable onPress={() => { tap(); onOpen(); }}><T t="caption" color={colors.sky}>상세 보기 ›</T></Pressable>
        </Row>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  globeWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  banner: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  bannerInner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg },
  bannerBtn: { backgroundColor: '#fff', paddingHorizontal: 14, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  flightChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: 'rgba(13,19,48,0.85)', borderWidth: 1, borderColor: colors.border },
  fab: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  focusCard: { marginHorizontal: spacing.lg, backgroundColor: 'rgba(13,19,48,0.92)', borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
});

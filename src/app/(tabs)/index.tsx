import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { Globe } from '@/components/globe/Globe';
import { Avatar, Button, Coin, HScroll, Header, Icon, IconButton, Pill, ProgressBar, Row, Screen, StoryItem, T } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { VEHICLE_MAP, bestVehicle } from '@/data/vehicles';
import { formatDuration, formatKm, fuzz50km } from '@/engine/geo';
import { useNow } from '@/hooks/use-now';
import { ME_ID, displayName, getUser, progressOf, selectUnread, useStore } from '@/store';
import { colors, radius, shadow, spacing } from '@/theme';
import { tap } from '@/engine/haptics';

export default function Home() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const now = useNow(2);
  const me = useStore((s) => s.me);
  const letters = useStore((s) => s.letters);
  const friendIds = useStore((s) => s.friendIds);
  const focusLetterId = useStore((s) => s.focusLetterId);
  const focusPoint = useStore((s) => s.focusPoint);
  const setFocus = useStore((s) => s.setFocusLetter);
  const setFocusPoint = useStore((s) => s.setFocusPoint);
  const unread = useStore(selectUnread);
  const allPassbys = useStore((s) => s.passbys);
  const passbys = useMemo(() => allPassbys.filter((p) => !p.resolved && p.expiresAt > now), [allPassbys, now]);

  const shown = useMemo(() => letters.filter((l) => l.status === 'flying' || l.status === 'landed'), [letters]);
  const flyingCount = shown.filter((l) => l.status === 'flying').length;
  const friends = useMemo(() => friendIds.map((id) => getUser({ me }, id)).filter(Boolean).map((u) => ({ id: u!.id, avatar: u!.avatar, location: fuzz50km(u!.location), nickname: u!.nickname })), [friendIds, me]);
  const focus = shown.find((l) => l.id === focusLetterId) ?? null;
  const passby = passbys[0];
  const passbyLetter = passby ? letters.find((l) => l.id === passby.letterId) : null;
  const best = bestVehicle(friendIds.length, me.inventory, me.plan);
  const globeSize = Math.min(width, height - 400);

  return (
    <Screen>
      <Header back={false} wordmark divider={false} right={<><Coin amount={me.coins} onPress={() => router.push('/store')} /><IconButton name="heart" badge={unread} onPress={() => router.push('/notifications')} /></>} />

      {/* 스토리 행: 내 편지 + 친구(젠리 버블) + 하늘 위 편지 */}
      <HScroll style={{ paddingVertical: 6 }}>
        <StoryItem label="편지 쓰기" onPress={() => router.push('/compose')}>
          <View>
            <Avatar emoji={me.avatar} size={56} ring="gray" />
            <View style={styles.plus}><Icon name="plus" size={12} color="#fff" /></View>
          </View>
        </StoryItem>
        {friends.map((f) => (
          <StoryItem key={f.id} label={f.nickname} onPress={() => setFocusPoint(f.location)}>
            <Avatar emoji={f.avatar} size={56} ring="ig" />
          </StoryItem>
        ))}
        {shown.filter((l) => l.status === 'flying').slice(0, 10).map((l) => {
          const mine = l.senderId === ME_ID || l.recipientId === ME_ID;
          return (
            <StoryItem key={l.id} label={mine ? '내 편지' : '???'} sub={l.destination.city} onPress={() => setFocus(focusLetterId === l.id ? null : l.id)}>
              <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
                <VehicleIcon id={l.vehicle} size={52} bubble snail={!!l.penalty && now < l.penalty.until} ring={focusLetterId === l.id ? colors.blue : mine ? colors.pink : '#fff'} />
              </View>
            </StoryItem>
          );
        })}
      </HScroll>

      {/* 지구 (젠리) */}
      <View style={{ flex: 1 }}>
        <LinearGradient colors={['#F4FAFF', '#DDEEFF']} style={styles.sky}>
          <Globe size={globeSize} letters={shown} me={me.location} meAvatar={me.avatar} friends={friends} focusLetterId={focusLetterId} focusPoint={focusPoint} onSelectLetter={(id) => setFocus(id)} fps={30} />
          <View style={styles.skyTopLeft}><Pill label={`하늘 위 ${flyingCount}`} icon="✈️" color="rgba(255,255,255,0.9)" /><Pill label={me.location.city} icon="📍" color="rgba(255,255,255,0.9)" /></View>
        </LinearGradient>

        {/* 머리 위 통과 배너 */}
        {passby && passbyLetter ? (
          <Pressable onPress={() => { tap(); router.push(`/catch/${passbyLetter.id}`); }} style={[styles.banner, shadow.float]}>
            <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: colors.pink, borderRadius: 2 }} />
            <VehicleIcon id={passbyLetter.vehicle} size={40} bubble />
            <View style={{ flex: 1 }}>
              <T t="bodyStrong">{VEHICLE_MAP[passbyLetter.vehicle].name}이(가) 머리 위를 지나가요!</T>
              <T t="small" color={colors.text2}>{passbyLetter.origin.city}에서 출발 · {formatDuration(passby.expiresAt - now)} 남음</T>
            </View>
            <Button title="잡기" size="sm" onPress={() => router.push(`/catch/${passbyLetter.id}`)} />
          </Pressable>
        ) : null}

        {/* 선택한 편지 카드 */}
        {focus ? (
          <View style={[styles.focusCard, shadow.float]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={10}>
                <VehicleIcon id={focus.vehicle} size={40} bubble snail={!!focus.penalty && now < focus.penalty.until} />
                <View>
                  <T t="bodyStrong">{focus.origin.city} <Icon name="arrow-right" size={12} color={colors.text3} /> {focus.destination.city}</T>
                  <T t="small" color={colors.text2}>{focus.senderId === ME_ID ? '내 편지' : focus.recipientId === ME_ID ? '내게 오는 답장' : displayName({ me, friendIds }, focus.senderId)} · {VEHICLE_MAP[focus.vehicle].name} · {formatKm(focus.distanceKm)}{focus.shield ? ' · 🛡️' : ''}</T>
                </View>
              </Row>
              <IconButton name="x" size={18} color={colors.text2} onPress={() => setFocus(null)} />
            </Row>
            <View style={{ marginTop: 10, gap: 4 }}>
              <ProgressBar value={progressOf(focus, now)} color={focus.senderId === ME_ID || focus.recipientId === ME_ID ? colors.pink : VEHICLE_MAP[focus.vehicle].color} />
              <Row style={{ justifyContent: 'space-between' }}>
                <T t="caption" color={colors.text3}>{focus.status === 'landed' ? '착륙 · 집어갈 사람을 기다려요' : `${Math.round(progressOf(focus, now) * 100)}% · ${formatDuration(focus.arrivesAt - now)} 후 도착`}</T>
                <Pressable onPress={() => { tap(); router.push(`/letter/${focus.id}`); }}><T t="smallStrong" color={colors.blue}>자세히</T></Pressable>
              </Row>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.cta}>
        <Button title="편지 쓰기" size="lg" full icon={VEHICLE_MAP[best].emoji} onPress={() => router.push('/compose')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  plus: { position: 'absolute', right: 0, bottom: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.blue, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sky: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  skyTopLeft: { position: 'absolute', top: 10, left: 12, flexDirection: 'row', gap: 6 },
  banner: { position: 'absolute', top: 10, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.lg, backgroundColor: '#fff' },
  focusCard: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: 10, backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.md },
  cta: { paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});

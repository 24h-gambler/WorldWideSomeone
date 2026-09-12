import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { Globe } from '@/components/globe/Globe';
import { Avatar, Button, Coin, HScroll, Header, Icon, IconButton, Pill, ProgressBar, Row, Screen, StoryItem, T } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { PostcardThumb } from '@/components/postcard-thumb';
import { VEHICLE_MAP, bestVehicle } from '@/data/vehicles';
import { OCEAN_RESCUE_COINS } from '@/data/plans';
import { formatDuration, formatKm, fuzz50km } from '@/engine/geo';
import { useNow } from '@/hooks/use-now';
import { ME_ID, displayName, getUser, progressOf, selectUnread, useStore } from '@/store';
import { radius, shadow, spacing, useColors } from '@/theme';
import { tap } from '@/engine/haptics';

export default function Home() {
  const router = useRouter();
  const c = useColors();
  const { width, height } = useWindowDimensions();
  const now = useNow(2);
  const me = useStore((s) => s.me);
  const letters = useStore((s) => s.letters);
  const posts = useStore((s) => s.posts);
  const friendIds = useStore((s) => s.friendIds);
  const revealedIds = useStore((s) => s.revealedIds);
  const focusLetterId = useStore((s) => s.focusLetterId);
  const focusPoint = useStore((s) => s.focusPoint);
  const setFocus = useStore((s) => s.setFocusLetter);
  const rescue = useStore((s) => s.rescueLetter);
  const unread = useStore(selectUnread);
  const allPassbys = useStore((s) => s.passbys);
  const passbys = useMemo(() => allPassbys.filter((p) => !p.resolved && p.expiresAt > now), [allPassbys, now]);

  const shown = useMemo(() => letters.filter((l) => l.status === 'flying' || l.status === 'landed' || l.status === 'sunk'), [letters]);
  const flyingCount = shown.filter((l) => l.status === 'flying').length;
  const friends = useMemo(() => friendIds.map((id) => getUser({ me }, id)).filter(Boolean).map((u) => ({ id: u!.id, avatar: u!.avatar, location: fuzz50km(u!.location), nickname: u!.nickname })), [friendIds, me]);
  // 국가별 스토리: 스토리 공유를 켠 엽서를 국가 단위로 묶고, 국가는 숨긴 채 거리만 보여준다 (누르면 엽서에서 공개)
  const stories = useMemo(() => {
    const m = new Map<string, typeof posts>();
    for (const p of posts.filter((x) => x.shareToStory)) { const arr = m.get(p.country) ?? []; arr.push(p); m.set(p.country, arr); }
    return [...m.entries()].map(([country, ps]) => ({ country, latest: ps.sort((a, b) => b.at - a.at)[0], count: ps.length })).sort((a, b) => b.latest.at - a.latest.at).slice(0, 20);
  }, [posts]);
  const focus = shown.find((l) => l.id === focusLetterId) ?? null;
  const passby = passbys[0];
  const passbyLetter = passby ? letters.find((l) => l.id === passby.letterId) : null;
  const best = bestVehicle(friendIds.length, me.inventory, me.plan);
  const globeSize = Math.min(width, height - 400);

  return (
    <Screen>
      <Header back={false} wordmark divider={false} right={<><Coin amount={me.coins} onPress={() => router.push('/store')} /><IconButton name="heart" badge={unread} onPress={() => router.push('/notifications')} /></>} />
      {/* 스토리: 각 국가의 유저가 올린 엽서 사진. 국가는 눌러야 알 수 있다 */}
      <HScroll style={{ paddingVertical: 6 }}>
        <StoryItem label="내 엽서" onPress={() => router.push('/compose')}>
          <View><Avatar emoji={me.avatar} size={56} ring="gray" /><View style={[styles.plus, { backgroundColor: c.blue, borderColor: c.bg }]}><Icon name="plus" size={12} color="#fff" /></View></View>
        </StoryItem>
        {stories.map((s) => {
          const seen = s.latest.authorId === ME_ID;
          return (
            <StoryItem key={s.country} label={seen ? '내 나라' : '어딘가'} sub={`${formatKm(s.latest.distanceKm)}${s.count > 1 ? ` · ${s.count}` : ''}`} onPress={() => router.push(`/post/${s.latest.id}`)}>
              <LinearGradient colors={['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ width: 65, height: 65, borderRadius: 33, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 59, height: 59, borderRadius: 30, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {s.latest.imageUri ? <Image source={{ uri: s.latest.imageUri }} style={{ width: 55, height: 55, borderRadius: 28 }} /> : <PostcardThumb seed={s.latest.id} width={55} height={55} radius={28} />}
                </View>
              </LinearGradient>
            </StoryItem>
          );
        })}
      </HScroll>

      <View style={{ flex: 1 }}>
        <LinearGradient colors={[...c.sky] as any} style={styles.sky}>
          <Globe size={globeSize} letters={shown} me={me.location} meAvatar={me.avatar} friends={friends} focusLetterId={focusLetterId} focusPoint={focusPoint} onSelectLetter={(id) => setFocus(id)} fps={30} showRoutes="focus" />
          <View style={styles.skyTopLeft}><Pill label={`하늘 위 ${flyingCount}`} icon="✈️" color={c.bubble} /><Pill label={me.location.city} icon="📍" color={c.bubble} /></View>
          {!focus ? <View style={styles.hint}><T t="caption" color={c.text2}>배달원을 탭하면 지나온 길과 남은 길이 보여요</T></View> : null}
        </LinearGradient>

        {passby && passbyLetter ? (
          <Pressable onPress={() => { tap(); router.push(`/catch/${passbyLetter.id}`); }} style={[styles.banner, shadow.float, { backgroundColor: c.bg }]}>
            <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: c.pink, borderRadius: 2 }} />
            <VehicleIcon id={passbyLetter.vehicle} size={42} bubble />
            <View style={{ flex: 1 }}>
              <T t="bodyStrong">{VEHICLE_MAP[passbyLetter.vehicle].name}이(가) 머리 위를 지나가요!</T>
              <T t="small" color={c.text2}>{passbyLetter.origin.city}에서 출발 · {formatDuration(passby.expiresAt - now)} 남음 · 잡기 · 엿보기 · 끌어오기</T>
            </View>
            <Button title="보기" size="sm" onPress={() => router.push(`/catch/${passbyLetter.id}`)} />
          </Pressable>
        ) : null}

        {focus ? (
          <View style={[styles.focusCard, shadow.float, { backgroundColor: c.bg }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={10}>
                <VehicleIcon id={focus.vehicle} size={42} bubble snail={!!focus.penalty && now < focus.penalty.until} sunk={focus.status === 'sunk'} />
                <View>
                  <T t="bodyStrong">{focus.origin.city} <Icon name="arrow-right" size={12} color={c.text3} /> {focus.senderId === ME_ID || focus.recipientId === ME_ID || focus.pulledBy === ME_ID ? focus.destination.city : '어딘가'}</T>
                  <T t="small" color={c.text2}>{focus.senderId === ME_ID ? '내 편지' : focus.recipientId === ME_ID ? '내게 오는 편지' : focus.pulledBy === ME_ID ? '내게 오는 편지 · 끌어옴' : displayName({ me, friendIds, revealedIds }, focus.senderId)} · {VEHICLE_MAP[focus.vehicle].name} · {formatKm(focus.distanceKm)}{focus.shield ? ' · 🛡️' : ''}{focus.redirects ? ` · 경로변경 ${focus.redirects}` : ''}{focus.pulls ? ' · 🧲' : ''}</T>
                </View>
              </Row>
              <IconButton name="x" size={18} color={c.text2} onPress={() => setFocus(null)} />
            </Row>
            <View style={{ marginTop: 10, gap: 4 }}>
              <ProgressBar value={progressOf(focus, now)} color={focus.status === 'sunk' ? c.red : focus.senderId === ME_ID || focus.recipientId === ME_ID ? c.pink : VEHICLE_MAP[focus.vehicle].color} />
              <Row style={{ justifyContent: 'space-between' }}>
                <T t="caption" color={c.text3}>{focus.status === 'sunk' ? `🌊 바다에 빠짐 · ${formatDuration((focus.sunkUntil ?? now) - now)} 뒤 떠오름` : focus.status === 'landed' ? '착륙 · 집어갈 사람을 기다려요' : `${Math.round(progressOf(focus, now) * 100)}% · ${formatDuration(focus.arrivesAt - now)} 후 도착`}</T>
                <Row gap={12}>
                  {focus.status === 'sunk' && focus.senderId === ME_ID ? <Pressable onPress={() => { tap(); rescue(focus.id); }}><T t="smallStrong" color={c.blue}>🛟 건져내기 {OCEAN_RESCUE_COINS}🪙</T></Pressable> : null}
                  <Pressable onPress={() => { tap(); router.push(`/letter/${focus.id}`); }}><T t="smallStrong" color={c.blue}>자세히</T></Pressable>
                </Row>
              </Row>
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.cta, { backgroundColor: c.bg, borderTopColor: c.line }]}>
        <Row gap={10}>
          <VehicleIcon id={best} size={44} bubble />
          <View style={{ flex: 1 }}><Button title="편지 쓰기" size="lg" full onPress={() => router.push('/compose')} /></View>
        </Row>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  plus: { position: 'absolute', right: 0, bottom: 0, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  sky: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  skyTopLeft: { position: 'absolute', top: 10, left: 12, flexDirection: 'row', gap: 6 },
  hint: { position: 'absolute', bottom: 10, alignSelf: 'center' },
  banner: { position: 'absolute', top: 10, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.lg },
  focusCard: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: 10, borderRadius: radius.lg, padding: spacing.md },
  cta: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});

/**
 * 친구 탭 — 해금 진행 · 내 차례(도착한 답장) · 왕복 진행 중 · 직행 편지 · 메시지
 */
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar, Button, Empty, Header, ListRow, ProgressBar, Row, Screen, Section, T, TrackedScrollView } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { VEHICLE_MAP, nextUnlock } from '@/data/vehicles';
import { formatKm, timeAgo } from '@/engine/geo';
import { ME_ID, displayName, getUser, useStore } from '@/store';
import { spacing, useColors } from '@/theme';

export default function Friends() {
  const router = useRouter();
  const c = useColors();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const revealedIds = useStore((s) => s.revealedIds);
  const chats = useStore((s) => s.chats);
  const letters = useStore((s) => s.letters);
  const next = nextUnlock(friendIds.length, me.plan);
  const prevReq = next ? Math.max(0, (next.unlockFriends ?? 0) - 6) : 0;
  const prog = next ? Math.min(1, Math.max(0, (friendIds.length - prevReq) / Math.max(1, (next.unlockFriends ?? 1) - prevReq))) : 1;

  const myTurn = useMemo(() => letters.filter((l) => l.recipientId === ME_ID && l.kind === 'reply' && l.status === 'delivered'), [letters]);
  const inFlight = useMemo(() => letters.filter((l) => l.senderId === ME_ID && l.kind === 'reply' && (l.status === 'flying' || l.status === 'delivered')), [letters]);
  const directs = useMemo(() => letters.filter((l) => l.senderId === ME_ID && l.direct && (l.status === 'flying' || l.status === 'delivered')), [letters]);
  const incoming = useMemo(() => letters.filter((l) => l.recipientId === ME_ID && l.status === 'flying'), [letters]);
  const rev = { me, friendIds, revealedIds };

  return (
    <Screen>
      <Header back={false} title={me.nickname || '친구'} subtitle={`친구 ${friendIds.length}명 · 50km 반경으로 위치 공유`} divider={false} right={<Button title="새 편지" size="sm" variant="ghost" icon="edit-2" onPress={() => router.push('/compose')} track="friends:compose" />} />
      <TrackedScrollView id="friends" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ margin: spacing.lg, padding: spacing.md, borderRadius: 14, backgroundColor: c.bg2, gap: 6 }}>
          {next ? (<>
            <Row style={{ justifyContent: 'space-between' }}><T t="bodyStrong">다음 배달원: {next.name}</T><T t="small" color={c.text2}>{friendIds.length}/{next.unlockFriends}</T></Row>
            <ProgressBar value={prog} />
            <T t="small" color={c.text2}>친구 {Math.max(0, (next.unlockFriends ?? 0) - friendIds.length)}명 더 · {next.speedKmh.toLocaleString()}km/h · 지금 바로 쓰려면 편지 쓰기에서 대여(SC)</T>
          </>) : <T t="bodyStrong">모든 배달원을 해금했어요 🎉</T>}
        </View>

        {myTurn.length ? (
          <Section title="내 차례 · 도착한 답장">
            {myTurn.map((l) => { const u = getUser({ me }, l.senderId); return (
              <ListRow key={l.id} left={<Avatar emoji={u?.avatar} size={48} ring="ig" />} title={`${u?.nickname ?? '???'} · ${l.origin.city}`} subtitle="답장 도착 · 수락하면 친구 + 실시간 채팅" right={<Button title="보기" size="sm" onPress={() => router.push(`/letter/${l.id}`)} track="friends:myturn" />} onPress={() => router.push(`/letter/${l.id}`)} track="friends:myturn-row" />
            ); })}
          </Section>
        ) : null}
        {incoming.length ? (
          <Section title="오는 중">
            {incoming.map((l) => { const u = getUser({ me }, l.senderId); return (
              <ListRow key={l.id} left={<VehicleIcon id={l.vehicle} size={44} bubble />} title={`${u?.nickname ?? '???'} · ${VEHICLE_MAP[l.vehicle].name}`} subtitle={`${l.kind === 'reply' ? '답장' : '직행 편지'}가 오는 중 · 편지 탭에서 가속 가능`} onPress={() => router.push('/letters')} track="friends:incoming" />
            ); })}
          </Section>
        ) : null}
        {inFlight.length || directs.length ? (
          <Section title="왕복 진행 중">
            {inFlight.map((l) => { const other = l.recipientId ?? ''; const u = getUser({ me }, other); return (
              <ListRow key={l.id} left={<Avatar emoji={u?.avatar} size={44} anonymous={!revealedIds.includes(other) && !friendIds.includes(other)} />} title={`${displayName(rev, other)} · 내 답장`} subtitle={l.status === 'flying' ? `${VEHICLE_MAP[l.vehicle].name}로 가는 중 · 상대가 수락하면 친구` : '도착 · 상대가 수락하면 친구'} onPress={() => router.push(`/letter/${l.id}`)} track="friends:inflight" />
            ); })}
            {directs.map((l) => { const other = l.recipientId ?? ''; const u = getUser({ me }, other); return (
              <ListRow key={l.id} left={<Avatar emoji={u?.avatar} size={44} ring="ig" />} title={`${displayName(rev, other)} · ⚡ 직행 편지`} subtitle={l.status === 'flying' ? '무조건 도착해요 · 답장은 상대의 마음' : '도착 · 답장을 기다리는 중'} onPress={() => router.push(`/letter/${l.id}`)} track="friends:direct" />
            ); })}
          </Section>
        ) : null}

        <Section title="메시지">
          {friendIds.length === 0 ? <Empty icon="message-circle" title="아직 친구가 없어요" body="편지가 한 번 왕복하면 친구. 그때부터 지연 없는 채팅." action={<Button title="편지 쓰기" onPress={() => router.push('/compose')} track="friends:empty:compose" />} /> : null}
          {friendIds.map((id) => {
            const u = getUser({ me }, id); if (!u) return null;
            const chat = chats.find((x) => x.otherId === id);
            const last = chat?.messages[chat.messages.length - 1];
            const unread = !!chat && chat.messages.some((m) => m.senderId !== ME_ID && m.at > chat.lastReadAt);
            return (
              <ListRow key={id} left={<Avatar emoji={u.avatar} size={52} ring={unread ? 'ig' : 'none'} />}
                title={<Row style={{ justifyContent: 'space-between' }}><T t={unread ? 'bodyStrong' : 'body'}>{u.nickname}</T><T t="caption" color={c.text3}>{last ? timeAgo(last.at) : ''}</T></Row>}
                subtitle={<Row style={{ justifyContent: 'space-between' }}><T t="small" color={unread ? c.text : c.text2} numberOfLines={1} style={{ flex: 1 }}>{last ? `${last.senderId === ME_ID ? '나: ' : ''}${last.text}` : `${u.location.city} 근처 · ${formatKm(0)}~50km`}</T>{unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.blue, marginLeft: 8 }} /> : null}</Row>}
                onPress={() => router.push(`/chat/${id}`)} track="friends:chat" />
            );
          })}
        </Section>
      </TrackedScrollView>
    </Screen>
  );
}

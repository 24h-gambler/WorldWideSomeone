import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar, Button, Empty, Header, ListRow, ProgressBar, Row, Screen, Section, T } from '@/components/ui';
import { VEHICLES, nextUnlock } from '@/data/vehicles';
import { PLAN_MAP } from '@/data/plans';
import { distanceKm, formatKm, timeAgo } from '@/engine/geo';
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
  const instant = useStore((s) => s.instantRequests);
  const answerInstant = useStore((s) => s.answerInstant);
  const next = nextUnlock(friendIds.length, me.plan);
  const boost = PLAN_MAP[me.plan].unlockBoost;
  const prev = VEHICLES.filter((v) => v.unlockFriends !== null && !v.premiumItem && v.unlockFriends <= friendIds.length + boost).sort((a, b) => (a.unlockFriends ?? 0) - (b.unlockFriends ?? 0)).pop();
  const pendingIn = letters.filter((l) => l.recipientId === ME_ID && l.status === 'delivered');
  const inFlight = letters.filter((l) => (l.kind === 'reply' || l.kind === 'accept') && (l.senderId === ME_ID || l.recipientId === ME_ID) && (l.status === 'flying' || (l.status === 'delivered' && l.senderId === ME_ID)));
  const instantIn = instant.filter((r) => r.toId === ME_ID && r.status === 'pending');

  return (
    <Screen>
      <Header back={false} title={me.nickname} subtitle={`친구 ${friendIds.length}명 · 50km 반경으로 위치 공유`} divider={false} right={<Button title="새 편지" size="sm" variant="ghost" icon="edit-3" onPress={() => router.push('/compose')} />} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: spacing.lg, marginTop: 4, padding: spacing.lg, borderRadius: 16, backgroundColor: c.bg2, borderWidth: 1, borderColor: c.lineSoft }}>
          {next ? (<>
            <Row style={{ justifyContent: 'space-between' }}><T t="bodyStrong">다음 배달원: {next.name}</T><T t="small" color={c.text2}>{friendIds.length + boost}/{next.unlockFriends}</T></Row>
            <View style={{ marginVertical: 8 }}><ProgressBar value={(friendIds.length + boost - (prev?.unlockFriends ?? 0)) / Math.max(1, (next.unlockFriends ?? 1) - (prev?.unlockFriends ?? 0))} /></View>
            <T t="small" color={c.text2}>친구 {Math.max(0, (next.unlockFriends ?? 0) - friendIds.length - boost)}명 더 · {next.speedKmh}km/h{boost ? ` · ${PLAN_MAP[me.plan].name} 보너스 −${boost}명` : ' · 플러스/프로는 더 빨리 해금'}</T>
          </>) : <T t="bodyStrong">모든 배달원을 해금했어요 🎉</T>}
        </View>

        {instantIn.length > 0 ? (
          <Section title="⚡ 즉시 친구 요청">
            {instantIn.map((r) => { const u = getUser({ me }, r.fromId); return (
              <ListRow key={r.id} left={<Avatar emoji={u?.avatar} size={48} ring="ig" />} title={`${u?.nickname ?? '???'} · ${formatKm(distanceKm(me.location, u?.location ?? me.location))}`} subtitle="결제로 왕복 없이 친구를 요청했어요" right={<Row><Button title="수락" size="sm" onPress={() => answerInstant(r.id, true)} /><Button title="거절" size="sm" variant="ghost" onPress={() => answerInstant(r.id, false)} /></Row>} />
            ); })}
          </Section>
        ) : null}

        {pendingIn.length > 0 ? (
          <Section title={`내 차례 ${pendingIn.length}`} action={{ label: '우편함', onPress: () => router.push('/letters') }}>
            {pendingIn.map((l) => { const u = getUser({ me }, l.senderId); return (
              <ListRow key={l.id} left={<Avatar emoji={u?.avatar} size={48} ring="ig" />} title={`${u?.nickname ?? '???'} · ${l.origin.city}`} subtitle={l.kind === 'accept' ? '수락 편지 도착 · 확정하면 친구' : '답장 도착 · 수락하면 수락 편지 출발'} right={<Button title="보기" size="sm" onPress={() => router.push(`/letter/${l.id}`)} />} onPress={() => router.push(`/letter/${l.id}`)} />
            ); })}
          </Section>
        ) : null}

        <Section title="메시지">
          {friendIds.length === 0 ? (
            <Empty icon="users" title="아직 친구가 없어요" body="편지를 잡고 답장 → 상대 수락 → 수락 편지 확정, 이렇게 한 번 왕복하면 친구가 돼요. 그때부터 실시간 채팅." action={<Button title="편지 쓰기" onPress={() => router.push('/compose')} />} />
          ) : friendIds.map((id) => {
            const u = getUser({ me }, id); if (!u) return null;
            const chat = chats.find((x) => x.otherId === id); const last = chat?.messages[chat.messages.length - 1];
            const unread = chat ? chat.messages.some((m) => m.senderId !== ME_ID && m.at > chat.lastReadAt) : false;
            return (
              <ListRow key={id} left={<Avatar emoji={u.avatar} size={52} ring={unread ? 'ig' : 'none'} />}
                title={<Row style={{ justifyContent: 'space-between' }}><T t={unread ? 'bodyStrong' : 'body'}>{u.nickname}</T><T t="caption" color={c.text3}>{last ? timeAgo(last.at) : ''}</T></Row>}
                subtitle={<Row><T t="small" color={unread ? c.text : c.text2} numberOfLines={1} style={{ flex: 1 }}>{last ? `${last.senderId === ME_ID ? '나: ' : ''}${last.text}` : `${u.location.city} · ${formatKm(distanceKm(me.location, u.location))}`}</T>{unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.blue }} /> : null}</Row>}
                onPress={() => router.push(`/chat/${id}`)} />
            );
          })}
        </Section>

        {inFlight.length > 0 ? (
          <Section title="왕복 진행 중">
            {inFlight.map((l) => { const other = l.senderId === ME_ID ? l.recipientId! : l.senderId; const u = getUser({ me }, other); return (
              <ListRow key={l.id} left={<Avatar emoji={u?.avatar} size={44} anonymous={!revealedIds.includes(other) && !friendIds.includes(other)} />} title={`${displayName({ me, friendIds, revealedIds }, other)} · ${l.kind === 'accept' ? '수락 편지' : '답장'}`} subtitle={l.senderId === ME_ID ? (l.status === 'flying' ? '내가 보냄 · 가는 중' : '도착 · 상대 차례') : '내게 오는 중'} onPress={() => router.push(`/letter/${l.id}`)} />
            ); })}
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

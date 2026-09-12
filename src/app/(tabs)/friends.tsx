import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar, Button, Empty, Header, ListRow, ProgressBar, Row, Screen, Section, T } from '@/components/ui';
import { VEHICLES, nextUnlock } from '@/data/vehicles';
import { PLAN_MAP } from '@/data/plans';
import { distanceKm, formatKm, timeAgo } from '@/engine/geo';
import { ME_ID, getUser, useStore } from '@/store';
import { colors, spacing } from '@/theme';

/** Instagram DM 받은편지함 느낌의 친구 탭 */
export default function Friends() {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const chats = useStore((s) => s.chats);
  const letters = useStore((s) => s.letters);
  const next = nextUnlock(friendIds.length, me.plan);
  const boost = PLAN_MAP[me.plan].unlockBoost;
  const prev = VEHICLES.filter((v) => v.unlockFriends !== null && !v.premiumItem && v.unlockFriends <= friendIds.length + boost).pop();
  const pendingOut = letters.filter((l) => l.senderId === ME_ID && l.friendRequest && (l.status === 'flying' || l.status === 'delivered'));
  const pendingIn = letters.filter((l) => l.recipientId === ME_ID && l.status === 'delivered');

  return (
    <Screen>
      <Header back={false} title={me.nickname} subtitle={`친구 ${friendIds.length}명 · 50km 반경으로 위치 공유`} divider={false} right={<Button title="새 편지" size="sm" variant="ghost" icon="edit-3" onPress={() => router.push('/compose')} />} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* 해금 진행 */}
        <View style={{ marginHorizontal: spacing.lg, marginTop: 4, padding: spacing.lg, borderRadius: 16, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.lineSoft }}>
          {next ? (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <T t="bodyStrong">다음 배달원: {next.emoji} {next.name}</T>
                <T t="small" color={colors.text2}>{friendIds.length + boost}/{next.unlockFriends}</T>
              </Row>
              <View style={{ marginVertical: 8 }}><ProgressBar value={(friendIds.length + boost - (prev?.unlockFriends ?? 0)) / ((next.unlockFriends ?? 1) - (prev?.unlockFriends ?? 0))} color={colors.blue} /></View>
              <T t="small" color={colors.text2}>친구 {Math.max(0, (next.unlockFriends ?? 0) - friendIds.length - boost)}명 더 · {next.speedKmh}km/h{boost ? ` · ${PLAN_MAP[me.plan].name} 보너스 −${boost}명` : ' · 플러스/프로는 더 빨리 해금'}</T>
            </>
          ) : <T t="bodyStrong">모든 배달원을 해금했어요 🎉</T>}
        </View>

        {pendingIn.length > 0 ? (
          <Section title={`승인 대기 ${pendingIn.length}`} action={{ label: '모두 보기', onPress: () => router.push('/letters') }}>
            {pendingIn.map((l) => (
              <ListRow key={l.id} left={<Avatar anonymous size={48} ring="ig" />} title={`??? · ${l.origin.city}`} subtitle={`답장이 도착했어요 · 승인하면 실시간 채팅`} right={<Button title="보기" size="sm" onPress={() => router.push(`/letter/${l.id}`)} />} onPress={() => router.push(`/letter/${l.id}`)} />
            ))}
          </Section>
        ) : null}

        <Section title="메시지">
          {friendIds.length === 0 ? (
            <Empty icon="users" title="아직 친구가 없어요" body="편지를 잡고 답장을 보내거나, 내 편지에 온 답장을 승인하면 친구가 돼요. 친구가 되면 실시간 채팅이 열려요." action={<Button title="편지 쓰기" onPress={() => router.push('/compose')} />} />
          ) : (
            friendIds.map((id) => {
              const u = getUser({ me }, id);
              if (!u) return null;
              const chat = chats.find((c) => c.otherId === id);
              const last = chat?.messages[chat.messages.length - 1];
              const unread = chat ? chat.messages.some((m) => m.senderId !== ME_ID && m.at > chat.lastReadAt) : false;
              return (
                <ListRow
                  key={id}
                  left={<Avatar emoji={u.avatar} size={52} ring={unread ? 'ig' : 'none'} />}
                  title={<Row style={{ justifyContent: 'space-between' }}><T t={unread ? 'bodyStrong' : 'body'}>{u.nickname}</T><T t="caption" color={colors.text3}>{last ? timeAgo(last.at) : ''}</T></Row>}
                  subtitle={<Row><T t="small" color={unread ? colors.text : colors.text2} numberOfLines={1} style={{ flex: 1 }}>{last ? `${last.senderId === ME_ID ? '나: ' : ''}${last.text}` : `${u.location.city} · ${formatKm(distanceKm(me.location, u.location))}`}</T>{unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue }} /> : null}</Row>}
                  onPress={() => router.push(`/chat/${id}`)}
                />
              );
            })
          )}
        </Section>

        {pendingOut.length > 0 ? (
          <Section title="보낸 답장 (승인 대기)">
            {pendingOut.map((l) => (
              <ListRow key={l.id} left={<Avatar anonymous size={44} />} title={`??? · ${l.destination.city}`} subtitle={l.status === 'flying' ? '답장이 가는 중' : '도착 · 상대 승인 대기'} onPress={() => router.push(`/letter/${l.id}`)} />
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

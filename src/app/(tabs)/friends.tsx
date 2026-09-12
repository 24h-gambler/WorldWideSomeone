import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar, Button, Card, Empty, Header, ProgressBar, Row, Section, T } from '@/components/ui';
import { VEHICLES, nextUnlock } from '@/data/vehicles';
import { distanceKm, formatKm, timeAgo } from '@/engine/geo';
import { ME_ID, getUser, useStore } from '@/store';
import { colors, radius, spacing, TAB_BAR_HEIGHT } from '@/theme';

export default function Friends() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const requests = useStore((s) => s.requests);
  const chats = useStore((s) => s.chats);
  const accept = useStore((s) => s.acceptRequest);
  const decline = useStore((s) => s.declineRequest);
  const incoming = requests.filter((r) => r.toId === ME_ID && r.status === 'pending');
  const outgoing = requests.filter((r) => r.fromId === ME_ID && r.status === 'pending');
  const next = nextUnlock(friendIds.length);
  const prevUnlock = VEHICLES.filter((v) => v.unlockFriends !== null && v.unlockFriends <= friendIds.length).pop();

  return (
    <Screen>
      <Header back={false} title="친구" subtitle={`${friendIds.length}명 · 50km 반경으로 위치 공유`} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}>
        {/* 해금 진행 */}
        <LinearGradient colors={['rgba(124,92,255,0.35)', 'rgba(255,92,138,0.2)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
          {next ? (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <T t="bodyStrong">다음 해금: {next.emoji} {next.name}</T>
                <T t="small" color={colors.textDim}>{friendIds.length}/{next.unlockFriends}</T>
              </Row>
              <View style={{ marginTop: spacing.md }}>
                <ProgressBar value={(friendIds.length - (prevUnlock?.unlockFriends ?? 0)) / ((next.unlockFriends ?? 1) - (prevUnlock?.unlockFriends ?? 0))} color={colors.gold} track="rgba(0,0,0,0.25)" />
              </View>
              <T t="small" color={colors.textDim} style={{ marginTop: spacing.sm }}>친구 {(next.unlockFriends ?? 0) - friendIds.length}명 더 모으면 {next.desc}</T>
            </>
          ) : (
            <T t="bodyStrong">모든 운송수단을 해금했어요 🎉</T>
          )}
        </LinearGradient>

        {incoming.length > 0 && (
          <Section title={`친구 요청 ${incoming.length}`}>
            {incoming.map((r) => {
              const u = getUser({ me }, r.fromId);
              return (
                <Card key={r.id} style={{ marginBottom: spacing.md }} glow={colors.accent}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row>
                      <Avatar anonymous size={46} />
                      <View>
                        <T t="bodyStrong">??? <T t="small" color={colors.textDim}>· {u?.location.city}</T></T>
                        <T t="small" color={colors.textDim}>{u?.field} · {u?.job} · {u?.hobbies.slice(0, 2).join(', ')}</T>
                      </View>
                    </Row>
                    <T t="caption" color={colors.textFaint}>{timeAgo(r.createdAt)}</T>
                  </Row>
                  <T t="small" color={colors.textDim} style={{ marginTop: spacing.sm }}>내 편지를 잡고 친구가 되고 싶어해요</T>
                  <Row style={{ marginTop: spacing.md }}>
                    <Button title="수락" size="sm" onPress={() => accept(r.id)} style={{ flex: 1 }} />
                    <Button title="거절" size="sm" variant="ghost" onPress={() => decline(r.id)} />
                    <Button title="채팅" size="sm" variant="secondary" onPress={() => router.push(`/chat/${r.fromId}`)} />
                  </Row>
                </Card>
              );
            })}
          </Section>
        )}

        <Section title="내 친구">
          {friendIds.length === 0 ? (
            <Empty emoji="🤝" title="아직 친구가 없어요" body="편지를 잡거나, 내 편지를 잡은 사람에게 친구 요청을 보내보세요" />
          ) : (
            friendIds.map((id) => {
              const u = getUser({ me }, id);
              if (!u) return null;
              const chat = chats.find((c) => c.otherId === id);
              const last = chat?.messages[chat.messages.length - 1];
              const unread = chat ? chat.messages.some((m) => m.senderId !== ME_ID && m.at > chat.lastReadAt) : false;
              return (
                <Card key={id} onPress={() => router.push(`/chat/${id}`)} style={{ marginBottom: spacing.md }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row>
                      <Avatar emoji={u.avatar} size={46} />
                      <View style={{ flex: 1 }}>
                        <T t="bodyStrong">{u.nickname} <T t="small" color={colors.textDim}>· {u.location.city} · {formatKm(distanceKm(me.location, u.location))}</T></T>
                        <T t="small" color={unread ? colors.text : colors.textDim} numberOfLines={1}>{last ? last.text : `${u.field} · ${u.hobbies.slice(0, 2).join(', ')}`}</T>
                      </View>
                    </Row>
                    {unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /> : null}
                  </Row>
                </Card>
              );
            })
          )}
        </Section>

        {outgoing.length > 0 && (
          <Section title="보낸 요청">
            {outgoing.map((r) => {
              const u = getUser({ me }, r.toId);
              return (
                <Card key={r.id} style={{ marginBottom: spacing.md }} onPress={() => router.push(`/chat/${r.toId}`)}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row>
                      <Avatar anonymous size={40} />
                      <T t="body">??? · {u?.location.city}</T>
                    </Row>
                    <T t="caption" color={colors.textFaint}>수락 대기 중</T>
                  </Row>
                </Card>
              );
            })}
          </Section>
        )}
      </ScrollView>
    </Screen>
  );
}

import { Screen } from '@/components/ui';

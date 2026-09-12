import React from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar, Button, Header, Pill, Row, Screen, T } from '@/components/ui';
import { PLAN_MAP } from '@/data/plans';
import { botFriendCount } from '@/data/bots';
import { genderLabel } from '@/data/profile';
import { distanceKm, formatKm, timeAgo } from '@/engine/geo';
import { displayName, getUser, useStore } from '@/store';
import { colors, spacing } from '@/theme';
import { contactPct } from './../(tabs)/community';

export default function UserScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const posts = useStore((s) => s.posts);
  const u = id ? getUser({ me }, id) : undefined;
  if (!u) return <Screen><Header title="사용자" /><T style={{ padding: spacing.lg }}>찾을 수 없어요</T></Screen>;
  const isFriend = friendIds.includes(u.id);
  const pct = contactPct(u, me.location);
  const myPosts = posts.filter((p) => p.authorId === u.id);
  return (
    <Screen>
      <Header title={displayName({ me, friendIds }, u.id)} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Row style={{ padding: spacing.lg, gap: 20 }}>
          <Avatar anonymous={!isFriend} emoji={u.avatar} size={84} ring="ig" />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
            {[['편지', u.stats.sent], ['친구', botFriendCount(u)], ['잡음', u.stats.caught]].map(([k, v]) => (
              <View key={String(k)} style={{ alignItems: 'center' }}><T t="h2">{String(v)}</T><T t="small">{String(k)}</T></View>
            ))}
          </View>
        </Row>
        <View style={{ paddingHorizontal: spacing.lg, gap: 6 }}>
          <T t="bodyStrong">{isFriend ? u.nickname : '???'} {PLAN_MAP[u.plan].badge ?? ''} <T t="small" color={colors.text2}>· {u.location.city}, {u.location.country} · {formatKm(distanceKm(me.location, u.location))}</T></T>
          <T t="body">{isFriend ? u.bio : '친구가 되면 닉네임과 소개가 보여요'}</T>
          <Row style={{ flexWrap: 'wrap' }} gap={4}>
            <Pill label={u.field} /><Pill label={genderLabel(u.gender)} /><Pill label={u.job} />
            {u.hobbies.map((h) => <Pill key={h} label={h} color={colors.blueSoft} textColor={colors.blue} />)}
          </Row>
          <Row style={{ marginTop: 6 }}>
            <Pill label={`컨택 가능성 ${pct}%`} color={pct >= 60 ? colors.greenSoft : colors.yellowSoft} textColor={pct >= 60 ? colors.green : '#8A6D00'} icon="📡" />
            <T t="caption" color={colors.text3}>{timeAgo(u.lastActiveAt)} 활동</T>
          </Row>
        </View>
        <Row style={{ paddingHorizontal: spacing.lg, marginTop: 14 }}>
          {isFriend ? <Button title="채팅" style={{ flex: 1 }} icon="message-circle" onPress={() => router.push(`/chat/${u.id}`)} /> : null}
          <Button title="편지 보내기" variant={isFriend ? 'secondary' : 'primary'} style={{ flex: 1 }} icon="send" onPress={() => router.push({ pathname: '/compose', params: { toId: u.id, field: u.field, job: u.job } } as any)} />
        </Row>
        <View style={{ padding: spacing.lg, gap: 8 }}>
          <T t="h2">엽서 {myPosts.length}</T>
          {myPosts.length === 0 ? <T t="small" color={colors.text2}>아직 공개한 엽서가 없어요</T> : myPosts.map((p) => (
            <View key={p.id} style={{ backgroundColor: '#FBF4E4', borderRadius: 12, padding: 12 }}><T>{p.text}</T><T t="caption" color="#8A7A5A">❤️ {p.likes} · {timeAgo(p.at)}</T></View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

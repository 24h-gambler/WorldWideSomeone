/**
 * 사용자 — 커뮤니티에서는 ???(태그·거리·컨택%), 편지를 주고받으면 실명. ⚡ 직행 편지(SC)로 무조건 도착.
 */
import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar, Button, Header, Pill, Row, Screen, T, TrackedScrollView } from '@/components/ui';
import { ItemIcon } from '@/components/item-art';
import { ITEM_MAP, PLAN_MAP } from '@/data/plans';
import { botFriendCount } from '@/data/bots';
import { distanceKm, formatKm, timeAgo } from '@/engine/geo';
import { contactPct } from '@/app/(tabs)/community';
import { useGate } from '@/hooks/use-gate';
import { displayName, getUser, isRevealed, useStore } from '@/store';
import { spacing, useColors } from '@/theme';

export default function UserScreen() {
  const router = useRouter();
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const revealedIds = useStore((s) => s.revealedIds);
  const posts = useStore((s) => s.posts);
  const letters = useStore((s) => s.letters);
  const gate = useGate();
  const u = getUser({ me }, id ?? '');
  if (!u) return <Screen><Header title="사용자" /><T style={{ padding: spacing.lg }}>사용자를 찾을 수 없어요</T></Screen>;
  const rev = { me, friendIds, revealedIds };
  const shown = isRevealed(rev, u.id);
  const isFriend = friendIds.includes(u.id);
  const pct = contactPct(u, me.location);
  const plan = PLAN_MAP[me.plan];
  const monthLeft = Math.max(0, plan.monthlyDirect - (me.quota.month === new Date().toISOString().slice(0, 7) ? me.quota.direct : 0));
  const pendingDirect = letters.find((l) => l.senderId === 'me' && l.direct && l.recipientId === u.id && (l.status === 'flying' || l.status === 'delivered'));
  const myPosts = posts.filter((p) => p.authorId === u.id);
  const direct = ITEM_MAP.direct1;
  const canDirect = monthLeft > 0 || me.inventory.direct > 0 || me.coins >= direct.coins;
  const priceLabel = monthLeft > 0 ? `월 ${monthLeft}회 남음` : me.inventory.direct > 0 ? `보유 ${me.inventory.direct}` : `${direct.coins} SC`;

  return (
    <Screen>
      <Header title={displayName(rev, u.id)} />
      <TrackedScrollView id="user" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Row style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: 20 }}>
          <Avatar anonymous={!shown} emoji={u.avatar} size={84} ring="ig" />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
            {[['받은 편지', u.stats.received], ['친구', botFriendCount(u)], ['잡음', u.stats.caught]].map(([k, v]) => <View key={String(k)} style={{ alignItems: 'center' }}><T t="h2">{String(v)}</T><T t="small">{String(k)}</T></View>)}
          </View>
        </Row>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 12, gap: 4 }}>
          <T t="bodyStrong">{displayName(rev, u.id)} {PLAN_MAP[u.plan].badge ?? ''} <T t="small" color={c.text2}>· {formatKm(distanceKm(me.location, u.location))} 떨어짐</T></T>
          <T t="body">{shown ? u.bio || '소개가 없어요' : '편지를 주고받으면 닉네임·소개·도시가 보여요'}</T>
          <Row style={{ flexWrap: 'wrap', marginTop: 4 }} gap={4}><Pill label={u.field} /><Pill label={u.gender === 'private' ? '비공개' : u.gender === 'female' ? '여성' : u.gender === 'male' ? '남성' : '기타'} /><Pill label={u.job} />{u.hobbies.map((h) => <Pill key={h} label={h} color={c.blueSoft} textColor={c.blue} />)}</Row>
          <Row style={{ marginTop: 6 }}><Pill label={`컨택 가능성 ${pct}%`} color={pct >= 60 ? c.greenSoft : c.yellowSoft} textColor={pct >= 60 ? c.green : c.yellowText} icon="📡" /><T t="caption" color={c.text3}>{timeAgo(u.lastActiveAt)} 활동</T></Row>
        </View>
        <Row style={{ paddingHorizontal: spacing.lg, marginTop: 14 }}>
          {isFriend ? <Button title="채팅" style={{ flex: 1 }} icon="message-circle" onPress={() => router.push(`/chat/${u.id}`)} track="user:chat" /> : null}
          <Button title="편지 보내기" variant={isFriend ? 'secondary' : 'primary'} style={{ flex: 1 }} icon="send" onPress={() => router.push({ pathname: '/compose', params: { toId: u.id, field: u.field, job: u.job } } as any)} track="user:letter" />
        </Row>
        {!isFriend ? (
          <View style={{ marginHorizontal: spacing.lg, marginTop: 10, padding: spacing.md, borderRadius: 12, backgroundColor: c.bg2, borderWidth: 1, borderColor: c.lineSoft, gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={8} style={{ flex: 1 }}><ItemIcon id="bolt" size={22} /><View style={{ flex: 1 }}><T t="bodyStrong">직행 편지</T><T t="caption" color={c.text2}>이 사람에게 무조건 도착 · 통과·장난 없음 · 답장은 상대의 마음(환불 없음)</T></View></Row>
              <Button title={pendingDirect ? '가는 중' : priceLabel} size="sm" variant="gradient" disabled={!!pendingDirect} onPress={() => gate('send', () => (canDirect ? router.push({ pathname: '/compose', params: { toId: u.id, direct: '1' } } as any) : router.push('/store')))} track="user:direct" />
            </Row>
          </View>
        ) : null}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 20, gap: 10 }}>
          <T t="h2">엽서 {myPosts.length}</T>
          {myPosts.length === 0 ? <T t="small" color={c.text2}>아직 공개한 엽서가 없어요</T> : myPosts.map((p) => (
            <View key={p.id} style={{ padding: spacing.md, borderRadius: 12, backgroundColor: c.paper }}>
              <T style={{ color: c.paperText }} onPress={() => router.push(`/post/${p.id}`)}>{p.text}</T>
              <T t="caption" color={c.paperMuted}>❤️ {p.likes} · 💬 {p.comments.length} · {timeAgo(p.at)}</T>
            </View>
          ))}
        </View>
      </TrackedScrollView>
    </Screen>
  );
}

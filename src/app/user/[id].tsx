import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar, Button, Header, Pill, Row, Screen, T } from '@/components/ui';
import { PLAN_MAP, PRODUCTS } from '@/data/plans';
import { botFriendCount } from '@/data/bots';
import { genderLabel } from '@/data/profile';
import { distanceKm, formatKm, timeAgo } from '@/engine/geo';
import { displayName, getUser, isRevealed, useStore } from '@/store';
import { spacing, useColors } from '@/theme';
import { contactPct } from './../(tabs)/community';
import { success, warn } from '@/engine/haptics';

export default function UserScreen() {
  const router = useRouter();
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const revealedIds = useStore((s) => s.revealedIds);
  const posts = useStore((s) => s.posts);
  const instant = useStore((s) => s.instantRequests);
  const requestInstant = useStore((s) => s.requestInstantFriend);
  const [msg, setMsg] = useState<string | null>(null);
  const u = id ? getUser({ me }, id) : undefined;
  if (!u) return <Screen><Header title="사용자" /><T style={{ padding: spacing.lg }}>찾을 수 없어요</T></Screen>;
  const rev = { me, friendIds, revealedIds };
  const isFriend = friendIds.includes(u.id);
  const shown = isRevealed(rev, u.id);
  const pct = contactPct(u, me.location);
  const theirPosts = posts.filter((p) => p.authorId === u.id);
  const pendingInstant = instant.find((r) => r.toId === u.id && r.status === 'pending');
  const plan = PLAN_MAP[me.plan];
  const instantProduct = PRODUCTS.find((p) => p.id === 'instant1')!;
  const onInstant = () => {
    const r = requestInstant(u.id);
    if (r === 'done') { success(); setMsg('⚡ 즉시 친구를 요청했어요. 상대가 수락하면 바로 친구 · 거절하면 환불'); }
    else if (r === 'quota') { warn(); setMsg(`즉시 친구권이 없어요. 상점에서 ${instantProduct.priceLabel}(🪙${instantProduct.coins}) 또는 프로 월 2회`); }
    else { warn(); setMsg('이미 요청했거나 친구예요'); }
  };
  return (
    <Screen>
      <Header title={displayName(rev, u.id)} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Row style={{ padding: spacing.lg, gap: 20 }}>
          <Avatar anonymous={!shown} emoji={u.avatar} size={84} ring="ig" />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
            {[['편지', u.stats.sent], ['친구', botFriendCount(u)], ['잡음', u.stats.caught]].map(([k, v]) => <View key={String(k)} style={{ alignItems: 'center' }}><T t="h2">{String(v)}</T><T t="small">{String(k)}</T></View>)}
          </View>
        </Row>
        <View style={{ paddingHorizontal: spacing.lg, gap: 6 }}>
          <T t="bodyStrong">{displayName(rev, u.id)} {PLAN_MAP[u.plan].badge ?? ''} <T t="small" color={c.text2}>· {shown ? `${u.location.city}, ${u.location.country} · ` : ''}{formatKm(distanceKm(me.location, u.location))} 떨어짐</T></T>
          <T t="body">{shown ? u.bio : '편지를 주고받으면 닉네임·소개·도시가 보여요'}</T>
          <Row style={{ flexWrap: 'wrap' }} gap={4}><Pill label={u.field} /><Pill label={genderLabel(u.gender)} /><Pill label={u.job} />{u.hobbies.map((h) => <Pill key={h} label={h} color={c.blueSoft} textColor={c.blue} />)}</Row>
          <Row style={{ marginTop: 6 }}><Pill label={`컨택 가능성 ${pct}%`} color={pct >= 60 ? c.greenSoft : c.yellowSoft} textColor={pct >= 60 ? c.green : c.yellowText} icon="📡" /><T t="caption" color={c.text3}>{timeAgo(u.lastActiveAt)} 활동</T></Row>
        </View>
        <Row style={{ paddingHorizontal: spacing.lg, marginTop: 14 }}>
          {isFriend ? <Button title="채팅" style={{ flex: 1 }} icon="message-circle" onPress={() => router.push(`/chat/${u.id}`)} /> : null}
          <Button title="편지 보내기" variant={isFriend ? 'secondary' : 'primary'} style={{ flex: 1 }} icon="send" onPress={() => router.push({ pathname: '/compose', params: { toId: u.id, field: u.field, job: u.job } } as any)} />
        </Row>
        {!isFriend ? (
          <View style={{ marginHorizontal: spacing.lg, marginTop: 10, padding: spacing.md, borderRadius: 12, backgroundColor: c.bg2, borderWidth: 1, borderColor: c.lineSoft, gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}><T t="bodyStrong">⚡ 즉시 친구</T><T t="caption" color={c.text2}>왕복 없이 바로 요청 · 보유 {me.inventory.instant}개{plan.monthlyInstant ? ` · ${plan.name} 월 ${plan.monthlyInstant}회` : ''} · 거절 시 환불</T></View>
              <Button title={pendingInstant ? '요청 중' : instantProduct.priceLabel} size="sm" variant="gradient" disabled={!!pendingInstant} onPress={onInstant} />
            </Row>
            {msg ? <T t="small" color={c.text2}>{msg}</T> : null}
          </View>
        ) : null}
        <View style={{ padding: spacing.lg, gap: 8 }}>
          <T t="h2">엽서 {theirPosts.length}</T>
          {theirPosts.length === 0 ? <T t="small" color={c.text2}>아직 공개한 엽서가 없어요</T> : theirPosts.map((p) => (
            <View key={p.id} style={{ backgroundColor: c.paper, borderRadius: 12, padding: 12 }} onTouchEnd={() => router.push(`/post/${p.id}`)}><T style={{ color: c.paperText }}>{p.text}</T><T t="caption" color={c.paperMuted}>❤️ {p.likes} · 💬 {p.comments.length} · {timeAgo(p.at)}</T></View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

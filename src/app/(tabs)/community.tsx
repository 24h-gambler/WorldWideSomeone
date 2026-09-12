import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { PostcardThumb } from '@/components/postcard-thumb';
import { useRouter } from 'expo-router';

import { Avatar, Button, Chip, HScroll, Header, Icon, IconButton, Pill, Row, Screen, StoryItem, T, UnderlineTabs } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { FIELDS, HOBBIES } from '@/data/profile';
import { VEHICLE_MAP } from '@/data/vehicles';
import { ITEM_MAP, PLAN_MAP } from '@/data/plans';
import { useGate } from '@/hooks/use-gate';
import { botFriendCount } from '@/data/bots';
import { BOTS, ME_ID, displayName, isRevealed, useStore } from '@/store';
import { distanceKm, formatKm, timeAgo } from '@/engine/geo';
import { spacing, useColors } from '@/theme';
import type { User } from '@/types';
import { tap } from '@/engine/haptics';

export function contactPct(u: User, meLoc: { lat: number; lng: number }) {
  const active = Math.max(0, 1 - (Date.now() - u.lastActiveAt) / (3 * 86_400_000));
  const near = Math.max(0, 1 - distanceKm(meLoc, u.location) / 15000);
  return Math.round(Math.max(4, Math.min(96, 18 + active * 40 + near * 20 + botFriendCount(u) * 0.4 + PLAN_MAP[u.plan].contactBoost)));
}
type Tab = 'feed' | 'people' | 'rank';

export default function Community() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const c = useColors();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const revealedIds = useStore((s) => s.revealedIds);
  const posts = useStore((s) => s.posts);
  const letters = useStore((s) => s.letters);
  const likePost = useStore((s) => s.likePost);
  const setPostStory = useStore((s) => s.setPostStory);
  const setFocus = useStore((s) => s.setFocusLetter);
  const [tab, setTab] = useState<Tab>('feed');
  const [field, setField] = useState<string | null>(null);
  const [hobby, setHobby] = useState<string | null>(null);
  const directPrice = ITEM_MAP.direct1;
  const gate = useGate();

  const people = useMemo(() => BOTS.filter((b) => (!field || b.field === field) && (!hobby || b.hobbies.includes(hobby))).map((b) => ({ b, pct: contactPct(b, me.location) })).sort((x, y) => y.pct - x.pct), [field, hobby, me.location]);
  const ranking = useMemo(() => { const rows = BOTS.map((b) => ({ u: b, friends: botFriendCount(b), caught: b.stats.caught, km: b.stats.distanceKm })); rows.push({ u: me, friends: friendIds.length, caught: me.stats.caught, km: me.stats.distanceKm }); return rows.sort((a, b) => b.friends - a.friends || b.caught - a.caught); }, [me, friendIds.length]);
  const sky = letters.filter((l) => l.status === 'flying' && l.senderId !== ME_ID).slice(0, 12);
  const rev = { me, friendIds, revealedIds };

  return (
    <Screen>
      <Header back={false} title="커뮤니티" divider={false} right={<IconButton name="search" onPress={() => setTab('people')} />} />
      <HScroll style={{ paddingVertical: 4 }}>
        {sky.map((l) => (
          <StoryItem key={l.id} label={VEHICLE_MAP[l.vehicle].name} sub="하늘 위" onPress={() => { setFocus(l.id); router.push('/'); }}>
            <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}><VehicleIcon id={l.vehicle} size={54} bubble ring={VEHICLE_MAP[l.vehicle].color} /></View>
          </StoryItem>
        ))}
      </HScroll>
      <UnderlineTabs value={tab} onChange={setTab} tabs={[{ key: 'feed', label: '엽서 피드', icon: 'grid' }, { key: 'people', label: '사람', icon: 'users' }, { key: 'rank', label: '랭킹', icon: 'award' }]} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {tab === 'feed' && posts.map((p) => {
          const mine = p.authorId === ME_ID;
          const shown = isRevealed(rev, p.authorId);
          return (
            <View key={p.id} style={[styles.post, { borderBottomColor: c.line }]}>
              <Row style={{ paddingHorizontal: spacing.lg, paddingVertical: 8, justifyContent: 'space-between' }}>
                <Pressable onPress={() => { tap(); if (!mine) router.push(`/user/${p.authorId}`); }}>
                  <Row gap={10}>
                    <Avatar anonymous={!shown} emoji={shown ? (mine ? me.avatar : (BOTS.find((b) => b.id === p.authorId)?.avatar)) : undefined} size={34} ring="ig" />
                    <View>
                      <T t="bodyStrong">{displayName(rev, p.authorId)} <T t="small" color={c.text2}>· {mine ? '내 엽서' : `${formatKm(p.distanceKm)} 떨어짐`}</T></T>
                      <T t="caption" color={c.text3}>{VEHICLE_MAP[p.vehicle].name} · {timeAgo(p.at)}{p.shareToStory ? ' · 스토리' : ''}</T>
                    </View>
                  </Row>
                </Pressable>
                {mine ? <Chip label={p.shareToStory ? '스토리 공유 중' : '스토리에 올리기'} small selected={p.shareToStory} onPress={() => setPostStory(p.id, !p.shareToStory)} /> : <Icon name="more-horizontal" size={20} />}
              </Row>
              <Pressable onPress={() => { tap(); router.push(`/post/${p.id}`); }}>
                {p.imageUri ? <Image source={{ uri: p.imageUri }} style={{ width: '100%', aspectRatio: 4 / 3 }} /> : <View style={{ marginHorizontal: spacing.lg, borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}><PostcardThumb seed={p.id} width={width - spacing.lg * 2} height={Math.round((width - spacing.lg * 2) * 0.5)} /></View>}
                <View style={[styles.postcard, { backgroundColor: c.paper, borderColor: c.paperLine }]}>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <T t="caption" color={c.paperMuted}>POSTCARD · {formatKm(p.distanceKm)} AWAY</T>
                    <View style={[styles.stamp, { borderColor: c.stampLine, backgroundColor: c.stampBg }]}><T style={{ fontSize: 18 }}>✉️</T><T t="caption" color={c.paperMuted}>?</T></View>
                  </Row>
                  <T style={{ color: c.paperText, fontSize: 16, lineHeight: 26, marginTop: 6 }}>{p.text}</T>
                </View>
              </Pressable>
              <Row style={{ paddingHorizontal: spacing.lg, paddingTop: 8, gap: 16 }}>
                <IconButton name="heart" color={p.likedByMe ? c.red : c.text} onPress={() => gate('like', () => likePost(p.id))} />
                <IconButton name="message-circle" onPress={() => router.push(`/post/${p.id}`)} />
                <IconButton name="send" onPress={() => (mine ? router.push('/compose') : router.push({ pathname: '/compose', params: { toId: p.authorId } } as any))} />
                <View style={{ flex: 1 }} /><IconButton name="bookmark" />
              </Row>
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: 6, gap: 2 }}>
                <T t="bodyStrong">좋아요 {p.likes.toLocaleString('ko-KR')}개</T>
                {p.comments.length ? <Pressable onPress={() => { tap(); router.push(`/post/${p.id}`); }}><T t="small" color={c.text2}>댓글 {p.comments.length}개 모두 보기</T></Pressable> : null}
                {p.comments[0] ? <T t="small" numberOfLines={1}><T t="smallStrong">{displayName(rev, p.comments[0].authorId)}</T> {p.comments[0].text}</T> : null}
                {!mine ? <Pressable onPress={() => { tap(); router.push({ pathname: '/compose', params: { toId: p.authorId } } as any); }}><T t="small" color={c.blue}>이 사람에게 편지 보내기</T></Pressable> : null}
              </View>
            </View>
          );
        })}

        {tab === 'people' && (
          <View>
            <HScroll style={{ paddingVertical: 8 }}><Chip label="전체 분야" small selected={!field} onPress={() => setField(null)} />{FIELDS.map((f) => <Chip key={f} label={f} small selected={field === f} onPress={() => setField(field === f ? null : f)} />)}</HScroll>
            <HScroll style={{ paddingBottom: 8 }}><Chip label="전체 취미" small selected={!hobby} onPress={() => setHobby(null)} color={c.blue} />{HOBBIES.map((h) => <Chip key={h} label={h} small selected={hobby === h} onPress={() => setHobby(hobby === h ? null : h)} color={c.blue} />)}</HScroll>
            <T t="small" color={c.text2} style={{ paddingHorizontal: spacing.lg, marginBottom: 8 }}>{people.length}명 · 컨택 가능성 높은 순 · 거리만 공개</T>
            <View style={styles.grid}>
              {people.map(({ b, pct }) => { const shown = isRevealed(rev, b.id); const isFriend = friendIds.includes(b.id); return (
                <Pressable key={b.id} onPress={() => { tap(); router.push(`/user/${b.id}`); }} style={[styles.cell, { borderColor: c.line, backgroundColor: c.bg }]}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Avatar anonymous={!shown} emoji={b.avatar} size={44} ring={b.plan === 'pro' ? 'ig' : 'none'} />
                    <Pill label={`${pct}%`} color={pct >= 60 ? c.greenSoft : pct >= 35 ? c.yellowSoft : c.bg3} textColor={pct >= 60 ? c.green : pct >= 35 ? c.yellowText : c.text2} icon="📡" />
                  </Row>
                  <T t="bodyStrong" style={{ marginTop: 8 }}>{displayName(rev, b.id)} {PLAN_MAP[b.plan].badge ?? ''}</T>
                  <T t="caption" color={c.text2}>{formatKm(distanceKm(me.location, b.location))} 떨어짐</T>
                  <View style={styles.tags}><Pill label={b.field} /><Pill label={b.job} />{b.hobbies.slice(0, 2).map((h) => <Pill key={h} label={h} color={c.blueSoft} textColor={c.blue} />)}</View>
                  <T t="caption" color={c.text3} style={{ marginTop: 6 }}>받은 편지 {b.stats.received} · 친구 {botFriendCount(b)} · {timeAgo(b.lastActiveAt)} 활동</T>
                  <Row style={{ marginTop: 8 }} gap={6}>
                    <Button title={isFriend ? '채팅' : '편지'} size="sm" variant={isFriend ? 'secondary' : 'primary'} style={{ flex: 1 }} onPress={() => (isFriend ? router.push(`/chat/${b.id}`) : router.push({ pathname: '/compose', params: { toId: b.id, field: b.field, job: b.job } } as any))} />
                    {!isFriend ? <Button title={`⚡`} size="sm" variant="gradient" onPress={() => router.push(`/user/${b.id}`)} /> : null}
                  </Row>
                </Pressable>
              ); })}
            </View>
            <T t="caption" color={c.text3} style={{ paddingHorizontal: spacing.lg, marginTop: 8 }}>⚡ 직행 편지: 그 사람에게 편지가 무조건 도착 · {directPrice.coins} SC · 프로 월 2회 · 답장은 상대의 마음(환불 없음)</T>
          </View>
        )}

        {tab === 'rank' && (
          <View style={{ paddingTop: 8 }}>
            <T t="small" color={c.text2} style={{ paddingHorizontal: spacing.lg, marginBottom: 6 }}>친구 수 · 잡은 편지 순 (이번 시즌)</T>
            {(() => { const myIdx = ranking.findIndex((r) => r.u.id === ME_ID); const top = ranking.slice(0, 30); const rows = myIdx >= 30 ? [ranking[myIdx], ...top] : top; return rows.map((r, k) => {
              const i = r.u.id === ME_ID ? myIdx : k - (myIdx >= 30 ? 1 : 0); const isMe = r.u.id === ME_ID;
              return (
                <Pressable key={r.u.id} onPress={() => { tap(); if (!isMe) router.push(`/user/${r.u.id}`); }} style={[styles.rankRow, isMe && { backgroundColor: c.blueSoft }]}>
                  <T t="bodyStrong" color={i < 3 ? c.text : c.text3} style={{ width: 28 }}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</T>
                  <Avatar anonymous={!isMe && !isRevealed(rev, r.u.id)} emoji={r.u.avatar} size={40} ring={i < 3 ? 'ig' : 'none'} />
                  <View style={{ flex: 1 }}><T t="bodyStrong">{isMe ? `${me.nickname} (나)` : displayName(rev, r.u.id)} {PLAN_MAP[r.u.plan].badge ?? ''}</T><T t="caption" color={c.text2}>{isMe ? me.location.city : `${formatKm(distanceKm(me.location, r.u.location))} 떨어짐`} · {formatKm(r.km)} 비행</T></View>
                  <View style={{ alignItems: 'flex-end' }}><T t="bodyStrong">친구 {r.friends}</T><T t="caption" color={c.text2}>잡음 {r.caught}</T></View>
                </Pressable>
              ); }); })()}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  post: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  postcard: { marginHorizontal: spacing.lg, borderRadius: 12, padding: 14, borderWidth: 1 },
  stamp: { width: 50, height: 54, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 4, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '4deg' }] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: spacing.lg },
  cell: { width: '48%', flexGrow: 1, padding: 12, borderRadius: 14, borderWidth: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.lg, paddingVertical: 10 },
});

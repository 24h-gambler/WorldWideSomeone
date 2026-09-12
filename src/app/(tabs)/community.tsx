import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar, Button, Chip, HScroll, Header, Icon, IconButton, Pill, Row, Screen, StoryItem, T, UnderlineTabs } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { FIELDS, HOBBIES } from '@/data/profile';
import { findCity } from '@/data/cities';
import { VEHICLE_MAP } from '@/data/vehicles';
import { PLAN_MAP } from '@/data/plans';
import { botFriendCount } from '@/data/bots';
import { BOTS, ME_ID, displayName, useStore } from '@/store';
import { distanceKm, formatKm, timeAgo } from '@/engine/geo';
import { colors, spacing } from '@/theme';
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
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const posts = useStore((s) => s.posts);
  const letters = useStore((s) => s.letters);
  const likePost = useStore((s) => s.likePost);
  const setFocus = useStore((s) => s.setFocusLetter);
  const [tab, setTab] = useState<Tab>('feed');
  const [field, setField] = useState<string | null>(null);
  const [hobby, setHobby] = useState<string | null>(null);

  const people = useMemo(() => BOTS.filter((b) => (!field || b.field === field) && (!hobby || b.hobbies.includes(hobby))).map((b) => ({ b, pct: contactPct(b, me.location) })).sort((x, y) => y.pct - x.pct), [field, hobby, me.location]);
  const ranking = useMemo(() => {
    const rows = BOTS.map((b) => ({ u: b, friends: botFriendCount(b), caught: b.stats.caught, km: b.stats.distanceKm }));
    rows.push({ u: me, friends: friendIds.length, caught: me.stats.caught, km: me.stats.distanceKm });
    return rows.sort((a, b) => b.friends - a.friends || b.caught - a.caught);
  }, [me, friendIds.length]);
  const sky = letters.filter((l) => l.status === 'flying' && l.senderId !== ME_ID).slice(0, 12);

  return (
    <Screen>
      <Header back={false} title="커뮤니티" divider={false} right={<IconButton name="search" onPress={() => setTab('people')} />} />
      <HScroll style={{ paddingVertical: 4 }}>
        {sky.map((l) => (
          <StoryItem key={l.id} label={l.origin.city} sub={VEHICLE_MAP[l.vehicle].name} onPress={() => { setFocus(l.id); router.push('/'); }}>
            <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
              <VehicleIcon id={l.vehicle} size={52} bubble ring={VEHICLE_MAP[l.vehicle].color} />
            </View>
          </StoryItem>
        ))}
      </HScroll>
      <UnderlineTabs value={tab} onChange={setTab} tabs={[{ key: 'feed', label: '엽서 피드', icon: 'grid' }, { key: 'people', label: '사람', icon: 'users' }, { key: 'rank', label: '랭킹', icon: 'award' }]} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {tab === 'feed' && posts.map((p) => {
          const mine = p.authorId === ME_ID;
          const isFriend = friendIds.includes(p.authorId);
          const stamp = findCity(p.stamp);
          return (
            <View key={p.id} style={styles.post}>
              <Row style={{ paddingHorizontal: spacing.lg, paddingVertical: 8, justifyContent: 'space-between' }}>
                <Pressable onPress={() => { tap(); if (!mine) router.push(`/user/${p.authorId}`); }}>
                  <Row gap={10}>
                    <Avatar anonymous={!mine && !isFriend} emoji={mine ? me.avatar : undefined} size={34} ring="ig" />
                    <View>
                      <T t="bodyStrong">{mine ? me.nickname : displayName({ me, friendIds }, p.authorId)} <T t="small" color={colors.text2}>· {p.city}</T></T>
                      <T t="caption" color={colors.text3}>{VEHICLE_MAP[p.vehicle].emoji} {VEHICLE_MAP[p.vehicle].name} · {formatKm(p.distanceKm)} · {timeAgo(p.at)}</T>
                    </View>
                  </Row>
                </Pressable>
                <Icon name="more-horizontal" size={20} />
              </Row>
              {p.imageUri ? <Image source={{ uri: p.imageUri }} style={{ width: '100%', aspectRatio: 4 / 3 }} /> : null}
              <View style={styles.postcard}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <T t="caption" color="#8A7A5A">POSTCARD · {p.city.toUpperCase()}</T>
                  <View style={styles.stamp}><T style={{ fontSize: 18 }}>{stamp?.flag ?? '📮'}</T><T t="caption" color="#8A7A5A">{p.stamp}</T></View>
                </Row>
                <T style={{ color: '#2A2418', fontSize: 16, lineHeight: 26, marginTop: 6 }}>{p.text}</T>
              </View>
              <Row style={{ paddingHorizontal: spacing.lg, paddingTop: 8, gap: 16 }}>
                <IconButton name="heart" color={p.likedByMe ? colors.red : colors.text} onPress={() => likePost(p.id)} />
                <IconButton name="send" onPress={() => (mine ? router.push('/compose') : router.push({ pathname: '/compose', params: { toId: p.authorId } } as any))} />
                <View style={{ flex: 1 }} />
                <IconButton name="bookmark" />
              </Row>
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: 6, gap: 2 }}>
                <T t="bodyStrong">좋아요 {p.likes.toLocaleString('ko-KR')}개</T>
                {!mine ? <Pressable onPress={() => { tap(); router.push({ pathname: '/compose', params: { toId: p.authorId } } as any); }}><T t="small" color={colors.blue}>이 사람에게 편지 보내기</T></Pressable> : null}
              </View>
            </View>
          );
        })}

        {tab === 'people' && (
          <View>
            <HScroll style={{ paddingVertical: 8 }}>
              <Chip label="전체 분야" small selected={!field} onPress={() => setField(null)} />
              {FIELDS.map((f) => <Chip key={f} label={f} small selected={field === f} onPress={() => setField(field === f ? null : f)} />)}
            </HScroll>
            <HScroll style={{ paddingBottom: 8 }}>
              <Chip label="전체 취미" small selected={!hobby} onPress={() => setHobby(null)} color={colors.blue} />
              {HOBBIES.map((h) => <Chip key={h} label={h} small selected={hobby === h} onPress={() => setHobby(hobby === h ? null : h)} color={colors.blue} />)}
            </HScroll>
            <T t="small" color={colors.text2} style={{ paddingHorizontal: spacing.lg, marginBottom: 8 }}>{people.length}명 · 컨택 가능성 높은 순 · 모두 ???로 표시</T>
            <View style={styles.grid}>
              {people.map(({ b, pct }) => {
                const isFriend = friendIds.includes(b.id);
                return (
                  <Pressable key={b.id} onPress={() => { tap(); router.push(`/user/${b.id}`); }} style={styles.cell}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Avatar anonymous={!isFriend} emoji={b.avatar} size={44} ring={b.plan === 'pro' ? 'ig' : 'none'} />
                      <Pill label={`${pct}%`} color={pct >= 60 ? colors.greenSoft : pct >= 35 ? colors.yellowSoft : colors.bg3} textColor={pct >= 60 ? colors.green : pct >= 35 ? '#8A6D00' : colors.text2} icon="📡" />
                    </Row>
                    <T t="bodyStrong" style={{ marginTop: 8 }}>{isFriend ? b.nickname : '???'} {PLAN_MAP[b.plan].badge ?? ''}</T>
                    <T t="caption" color={colors.text2}>{b.location.city} · {formatKm(distanceKm(me.location, b.location))}</T>
                    <View style={styles.tags}>
                      <Pill label={b.field} />
                      <Pill label={b.job} />
                      {b.hobbies.slice(0, 2).map((h) => <Pill key={h} label={h} color={colors.blueSoft} textColor={colors.blue} />)}
                    </View>
                    <T t="caption" color={colors.text3} style={{ marginTop: 6 }}>친구 {botFriendCount(b)} · {timeAgo(b.lastActiveAt)} 활동</T>
                    <Button title={isFriend ? '채팅' : '편지 보내기'} size="sm" variant={isFriend ? 'secondary' : 'primary'} style={{ marginTop: 8 }} onPress={() => (isFriend ? router.push(`/chat/${b.id}`) : router.push({ pathname: '/compose', params: { toId: b.id, field: b.field, job: b.job } } as any))} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {tab === 'rank' && (
          <View style={{ paddingTop: 8 }}>
            <T t="small" color={colors.text2} style={{ paddingHorizontal: spacing.lg, marginBottom: 6 }}>친구 수 · 잡은 편지 순 (이번 시즌)</T>
            {(() => {
              const myIdx = ranking.findIndex((r) => r.u.id === ME_ID);
              const top = ranking.slice(0, 30);
              const rows = myIdx >= 30 ? [ranking[myIdx], ...top] : top;
              return rows.map((r, k) => {
              const i = r.u.id === ME_ID ? myIdx : k - (myIdx >= 30 ? 1 : 0);
              const isMe = r.u.id === ME_ID;
              const isFriend = friendIds.includes(r.u.id);
              return (
                <Pressable key={r.u.id} onPress={() => { tap(); if (!isMe) router.push(`/user/${r.u.id}`); }} style={[styles.rankRow, isMe && { backgroundColor: colors.blueSoft }]}>
                  <T t="bodyStrong" color={i < 3 ? colors.text : colors.text3} style={{ width: 28 }}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</T>
                  <Avatar anonymous={!isMe && !isFriend} emoji={r.u.avatar} size={40} ring={i < 3 ? 'ig' : 'none'} />
                  <View style={{ flex: 1 }}>
                    <T t="bodyStrong">{isMe ? `${me.nickname} (나)` : displayName({ me, friendIds }, r.u.id)} {PLAN_MAP[r.u.plan].badge ?? ''}</T>
                    <T t="caption" color={colors.text2}>{r.u.location.city} · {formatKm(r.km)} 비행</T>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <T t="bodyStrong">친구 {r.friends}</T>
                    <T t="caption" color={colors.text2}>잡음 {r.caught}</T>
                  </View>
                </Pressable>
              );
              });
            })()}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  post: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, paddingBottom: 12 },
  postcard: { marginHorizontal: spacing.lg, backgroundColor: '#FBF4E4', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#EEDFC0' },
  stamp: { width: 50, height: 54, borderWidth: 1.5, borderColor: '#D9C9A6', borderStyle: 'dashed', borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4EAD3', transform: [{ rotate: '4deg' }] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: spacing.lg },
  cell: { width: '48%', flexGrow: 1, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.lg, paddingVertical: 10 },
});

import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar, Button, Header, IconButton, Pill, Row, Screen, T, UnderlineTabs } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { ItemIcon, type ItemId } from '@/components/item-art';
import { FAMILIES, FAMILY_LABEL, VEHICLES, vehicleUnlocked } from '@/data/vehicles';
import { PLAN_MAP } from '@/data/plans';
import { genderLabel } from '@/data/profile';
import { findCity } from '@/data/cities';
import { formatKm } from '@/engine/geo';
import { useStore } from '@/store';
import { spacing, useColors } from '@/theme';

export default function Profile() {
  const router = useRouter();
  const c = useColors();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const posts = useStore((s) => s.posts);
  const [tab, setTab] = useState<'hangar' | 'stamps' | 'posts'>('hangar');
  const plan = PLAN_MAP[me.plan];
  const owned = VEHICLES.filter((v) => vehicleUnlocked(v, friendIds.length, me.inventory, me.plan)).length;
  const myPosts = posts.filter((p) => p.authorId === 'me');
  return (
    <Screen>
      <Header back={false} title={`${me.nickname} ${plan.badge ?? ''}`} divider={false} right={<><IconButton name="shopping-bag" onPress={() => router.push('/store')} /><IconButton name="menu" onPress={() => router.push('/settings')} /></>} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <Row style={{ paddingHorizontal: spacing.lg, gap: 20 }}>
          <Avatar emoji={me.avatar} size={84} ring="ig" />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
            {[['편지', me.stats.sent], ['친구', friendIds.length], ['배달원', `${owned}/${VEHICLES.length}`]].map(([k, v]) => <View key={String(k)} style={{ alignItems: 'center' }}><T t="h2">{String(v)}</T><T t="small">{String(k)}</T></View>)}
          </View>
        </Row>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 12, gap: 4 }}>
          <T t="bodyStrong">{me.nickname}</T>
          <T t="body">{me.bio || '한 줄 소개를 적어보세요'}</T>
          <T t="small" color={c.text2}>📍 {me.location.city}, {me.location.country} · 커뮤니티엔 ??? · 비행 {formatKm(me.stats.distanceKm)} · ❤️ {me.stats.likes}</T>
          <Row style={{ flexWrap: 'wrap', marginTop: 4 }} gap={4}><Pill label={me.field} /><Pill label={genderLabel(me.gender)} /><Pill label={me.job} />{me.hobbies.map((h) => <Pill key={h} label={h} color={c.blueSoft} textColor={c.blue} />)}</Row>
        </View>
        <Row style={{ paddingHorizontal: spacing.lg, marginTop: 12 }}>
          <Button title="프로필 편집" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/profile-edit')} />
          <Button title={me.plan === 'free' ? '플러스 시작' : `${plan.name} 이용 중`} size="sm" variant={me.plan === 'free' ? 'gradient' : 'secondary'} style={{ flex: 1 }} onPress={() => router.push('/store')} />
        </Row>
        <Row style={{ paddingHorizontal: spacing.lg, marginTop: 16, justifyContent: 'space-around' }}>
          {([['shield', '방어권', me.inventory.shield], ['lens', '엿보기', me.inventory.peek], ['magnet', '끌어오기', me.inventory.pull], ['bolt', '즉시친구', me.inventory.instant], ['coin', '코인', me.coins]] as [ItemId, string, number][]).map(([e, n, v]) => (
            <View key={String(n)} style={{ alignItems: 'center', gap: 4 }}><View style={[styles.highlight, { backgroundColor: c.bg3, borderColor: c.line }]}><ItemIcon id={e} size={26} /></View><T t="caption">{String(n)} {String(v)}</T></View>
          ))}
        </Row>
        <View style={{ marginTop: 16 }}><UnderlineTabs value={tab} onChange={setTab} tabs={[{ key: 'hangar', label: '배달원', icon: 'truck' }, { key: 'stamps', label: '스탬프', icon: 'bookmark' }, { key: 'posts', label: '엽서', icon: 'image' }]} /></View>
        {tab === 'hangar' ? FAMILIES.map((fam) => (
          <View key={fam}>
            <T t="smallStrong" color={c.text2} style={{ paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 6 }}>{FAMILY_LABEL[fam]}</T>
            <View style={styles.grid}>
              {VEHICLES.filter((v) => v.family === fam).map((v) => { const ok = vehicleUnlocked(v, friendIds.length, me.inventory, me.plan); return (
                <View key={v.id} style={[styles.hangar, { backgroundColor: c.bg2 }, !ok && { opacity: 0.45 }]}>
                  <VehicleIcon id={v.id} size={48} bubble />
                  <T t="smallStrong" style={{ marginTop: 6 }} numberOfLines={1}>{v.name}</T>
                  <T t="caption" color={c.text2}>{v.speedKmh.toLocaleString()} km/h</T>
                  <T t="caption" color={ok ? c.green : c.text3}>{ok ? '보유' : v.premiumItem === 'event' ? '이벤트' : v.premiumItem === 'dragon' ? `친구 ${v.unlockFriends} / 프로` : v.premiumItem ? '상점 · 프로' : `친구 ${v.unlockFriends}`}</T>
                </View>
              ); })}
            </View>
          </View>
        )) : tab === 'stamps' ? (
          <View style={styles.grid}>{me.stamps.length === 0 ? <T t="small" color={c.text2} style={{ padding: spacing.lg }}>편지를 잡으면 출발 도시의 스탬프가 모여요</T> : me.stamps.map((s) => <View key={s} style={[styles.stamp, { backgroundColor: c.paper }]}><T style={{ fontSize: 26 }}>{findCity(s)?.flag ?? '📮'}</T><T t="caption" color={c.paperText}>{s}</T></View>)}</View>
        ) : (
          <View style={{ padding: spacing.lg, gap: 8 }}>{myPosts.length === 0 ? <T t="small" color={c.text2}>편지를 쓸 때 "엽서로 공개"를 켜면 여기에 모여요. 스토리에 올리면 홈 상단에 내 나라 대표로 보여요.</T> : myPosts.map((p) => <View key={p.id} style={{ backgroundColor: c.paper, borderRadius: 12, padding: 12 }}><T style={{ color: c.paperText }}>{p.text}</T><T t="caption" color={c.paperMuted}>❤️ {p.likes} · 💬 {p.comments.length}{p.shareToStory ? ' · 스토리 공유 중' : ''}</T></View>)}</View>
        )}
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  highlight: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 2 },
  hangar: { width: '32.6%', aspectRatio: 0.95, alignItems: 'center', justifyContent: 'center' },
  stamp: { width: '32.6%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
});

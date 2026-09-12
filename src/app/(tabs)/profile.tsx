import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Avatar, Button, Header, IconButton, Pill, Row, Screen, T, UnderlineTabs } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { VEHICLES, vehicleUnlocked } from '@/data/vehicles';
import { PLAN_MAP } from '@/data/plans';
import { genderLabel } from '@/data/profile';
import { findCity } from '@/data/cities';
import { formatKm } from '@/engine/geo';
import { useStore } from '@/store';
import { colors, spacing } from '@/theme';

export default function Profile() {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const [tab, setTab] = useState<'stamps' | 'hangar'>('hangar');
  const plan = PLAN_MAP[me.plan];

  return (
    <Screen>
      <Header back={false} title={`${me.nickname} ${plan.badge ?? ''}`} divider={false} right={<><IconButton name="shopping-bag" onPress={() => router.push('/store')} /><IconButton name="menu" onPress={() => router.push('/settings')} /></>} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <Row style={{ paddingHorizontal: spacing.lg, gap: 20 }}>
          <Avatar emoji={me.avatar} size={84} ring="ig" />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
            {[['편지', me.stats.sent], ['친구', friendIds.length], ['스탬프', me.stamps.length]].map(([k, v]) => (
              <View key={String(k)} style={{ alignItems: 'center' }}>
                <T t="h2">{String(v)}</T>
                <T t="small">{String(k)}</T>
              </View>
            ))}
          </View>
        </Row>
        <View style={{ paddingHorizontal: spacing.lg, marginTop: 12, gap: 4 }}>
          <T t="bodyStrong">{me.nickname}</T>
          <T t="body">{me.bio || '한 줄 소개를 적어보세요'}</T>
          <T t="small" color={colors.text2}>📍 {me.location.city}, {me.location.country} · 커뮤니티엔 ??? · 비행 {formatKm(me.stats.distanceKm)} · ❤️ {me.stats.likes}</T>
          <Row style={{ flexWrap: 'wrap', marginTop: 4 }} gap={4}>
            <Pill label={me.field} />
            <Pill label={genderLabel(me.gender)} />
            <Pill label={me.job} />
            {me.hobbies.map((h) => <Pill key={h} label={h} color={colors.blueSoft} textColor={colors.blue} />)}
          </Row>
        </View>
        <Row style={{ paddingHorizontal: spacing.lg, marginTop: 12 }}>
          <Button title="프로필 편집" size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/profile-edit')} />
          <Button title={me.plan === 'free' ? '플러스 시작' : `${plan.name} 이용 중`} size="sm" variant={me.plan === 'free' ? 'gradient' : 'secondary'} style={{ flex: 1 }} onPress={() => router.push('/store')} />
        </Row>

        {/* 인벤토리 하이라이트 (IG 하이라이트 원형) */}
        <Row style={{ paddingHorizontal: spacing.lg, marginTop: 16, justifyContent: 'space-around' }}>
          {[['🛡️', '방어권', me.inventory.shield], ['🛸', 'UFO', me.inventory.ufo], ['🛰️', '위성', me.inventory.orbit], ['🪙', '코인', me.coins]].map(([e, n, c]) => (
            <View key={String(n)} style={{ alignItems: 'center', gap: 4 }}>
              <View style={styles.highlight}><T style={{ fontSize: 24 }}>{String(e)}</T></View>
              <T t="caption">{String(n)} {String(c)}</T>
            </View>
          ))}
        </Row>

        <View style={{ marginTop: 16 }}>
          <UnderlineTabs value={tab} onChange={setTab} tabs={[{ key: 'hangar', label: '배달원', icon: 'truck' }, { key: 'stamps', label: '스탬프', icon: 'bookmark' }]} />
        </View>
        {tab === 'hangar' ? (
          <View style={styles.grid}>
            {VEHICLES.map((v) => {
              const ok = vehicleUnlocked(v, friendIds.length, me.inventory, me.plan);
              return (
                <View key={v.id} style={[styles.hangar, !ok && { opacity: 0.45 }]}>
                  <VehicleIcon id={v.id} size={44} bubble />
                  <T t="smallStrong" style={{ marginTop: 6 }}>{v.name}</T>
                  <T t="caption" color={colors.text2}>{v.speedKmh.toLocaleString()} km/h</T>
                  <T t="caption" color={ok ? colors.green : colors.text3}>{ok ? '보유' : v.premiumItem === 'ufo' || v.premiumItem === 'orbit' ? '상점' : v.premiumItem === 'dragon' ? `친구 ${v.unlockFriends} 또는 프로` : `친구 ${v.unlockFriends}`}</T>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.grid}>
            {me.stamps.length === 0 ? <T t="small" color={colors.text2} style={{ padding: spacing.lg }}>편지를 잡으면 출발 도시의 스탬프가 모여요</T> : me.stamps.map((s) => (
              <View key={s} style={styles.stamp}><T style={{ fontSize: 26 }}>{findCity(s)?.flag ?? '📮'}</T><T t="caption">{s}</T></View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  highlight: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 2 },
  hangar: { width: '32.6%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg2 },
  stamp: { width: '32.6%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBF4E4', gap: 4 },
});

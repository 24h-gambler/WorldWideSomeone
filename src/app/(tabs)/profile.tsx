import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Card, Chip, Coin, Header, IconButton, Row, Screen, Section, T } from '@/components/ui';
import { VEHICLES, vehicleUnlocked } from '@/data/vehicles';
import { genderLabel } from '@/data/profile';
import { findCity } from '@/data/cities';
import { formatKm } from '@/engine/geo';
import { useStore } from '@/store';
import { colors, radius, spacing, TAB_BAR_HEIGHT } from '@/theme';
import { VehicleIcon } from '@/components/vehicle-icon';

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);

  return (
    <Screen>
      <Header back={false} title="나" right={<Row><Coin amount={me.coins} /><IconButton icon="⚙️" onPress={() => router.push('/settings')} /></Row>} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}>
        <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
          <Avatar emoji={me.avatar} size={92} />
          <T t="title">{me.nickname} {me.premium ? '⭐' : ''}</T>
          <T t="body" color={colors.textDim}>{me.bio || '한 줄 소개를 적어보세요'}</T>
          <T t="small" color={colors.textFaint}>📍 {me.location.city}, {me.location.country} · 커뮤니티엔 ???</T>
          <View style={styles.tags}>
            <Chip label={me.field} small selected />
            <Chip label={genderLabel(me.gender)} small selected color={colors.accent} />
            <Chip label={me.job} small selected color={colors.sky} />
            {me.hobbies.map((h) => <Chip key={h} label={h} small selected color={colors.mint} />)}
          </View>
          <Button title="프로필 수정" size="sm" variant="ghost" onPress={() => router.push('/profile-edit')} />
        </View>

        <View style={styles.stats}>
          {[
            ['보낸', me.stats.sent],
            ['잡은', me.stats.caught],
            ['친구', friendIds.length],
            ['비행거리', formatKm(me.stats.distanceKm)],
          ].map(([k, v]) => (
            <View key={String(k)} style={styles.stat}>
              <T t="h2">{String(v)}</T>
              <T t="caption" color={colors.textDim}>{String(k)}</T>
            </View>
          ))}
        </View>

        <Section title="인벤토리" right={<Button title="상점" size="sm" variant="gold" icon="🛍️" onPress={() => router.push('/store')} />}>
          <Row style={{ gap: spacing.md }}>
            {[
              ['🛡️', '방어권', me.inventory.shield],
              ['🛸', 'UFO', me.inventory.ufo],
              ['🧭', '경로', me.inventory.route],
              ['🛰️', '위성', me.inventory.orbit],
            ].map(([e, n, c]) => (
              <Card key={String(n)} style={{ flex: 1, alignItems: 'center', padding: spacing.md }}>
                <T style={{ fontSize: 24 }}>{String(e)}</T>
                <T t="bodyStrong">{String(c)}</T>
                <T t="caption" color={colors.textDim}>{String(n)}</T>
              </Card>
            ))}
          </Row>
        </Section>

        <Section title={`스탬프 ${me.stamps.length}`}>
          {me.stamps.length === 0 ? (
            <Card><T t="small" color={colors.textDim}>편지를 잡으면 출발 도시의 스탬프가 모여요</T></Card>
          ) : (
            <View style={styles.tags}>
              {me.stamps.map((s) => (
                <View key={s} style={styles.stamp}>
                  <T style={{ fontSize: 22 }}>{findCity(s)?.flag ?? '📮'}</T>
                  <T t="caption">{s}</T>
                </View>
              ))}
            </View>
          )}
        </Section>

        <Section title="격납고">
          <View style={styles.tags}>
            {VEHICLES.map((v) => {
              const ok = vehicleUnlocked(v, friendIds.length, me.inventory);
              return (
                <View key={v.id} style={[styles.hangar, !ok && { opacity: 0.45 }]}>
                  <VehicleIcon id={v.id} size={28} />
                  <T t="caption">{v.name}</T>
                  <T t="caption" color={colors.textFaint}>{ok ? '보유' : v.unlockFriends !== null ? `친구 ${v.unlockFriends}` : '상점'}</T>
                </View>
              );
            })}
          </View>
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  stats: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg, marginTop: spacing.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  stamp: { width: 72, alignItems: 'center', gap: 2, padding: 8, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  hangar: { width: '30%', flexGrow: 1, alignItems: 'center', gap: 2, padding: 10, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
});

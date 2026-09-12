import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Card, Chip, Header, Row, Screen, T } from '@/components/ui';
import { FIELDS, HOBBIES } from '@/data/profile';
import { BOTS, useStore } from '@/store';
import { botFriendCount } from '@/data/bots';
import { distanceKm, formatKm, timeAgo } from '@/engine/geo';
import { colors, spacing, TAB_BAR_HEIGHT } from '@/theme';
import type { User } from '@/types';

function contactPct(u: User, meLoc: { lat: number; lng: number }) {
  const active = Math.max(0, 1 - (Date.now() - u.lastActiveAt) / (3 * 86_400_000));
  const d = distanceKm(meLoc, u.location);
  const near = Math.max(0, 1 - d / 15000);
  return Math.round(Math.max(4, Math.min(96, 18 + active * 40 + near * 20 + botFriendCount(u) * 0.6)));
}

export default function Community() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const [field, setField] = useState<string | null>(null);
  const [hobby, setHobby] = useState<string | null>(null);

  const list = useMemo(
    () =>
      BOTS.filter((b) => (!field || b.field === field) && (!hobby || b.hobbies.includes(hobby)))
        .map((b) => ({ b, pct: contactPct(b, me.location) }))
        .sort((x, y) => y.pct - x.pct),
    [field, hobby, me.location],
  );

  return (
    <Screen>
      <Header back={false} title="커뮤니티" subtitle="모두 ???로 보여요. 태그와 컨택 가능성만 공개" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
        <Chip label="전체 분야" selected={!field} onPress={() => setField(null)} small />
        {FIELDS.map((f) => <Chip key={f} label={f} selected={field === f} onPress={() => setField(field === f ? null : f)} small />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
        <Chip label="전체 취미" selected={!hobby} onPress={() => setHobby(null)} small color={colors.mint} />
        {HOBBIES.map((h) => <Chip key={h} label={h} selected={hobby === h} onPress={() => setHobby(hobby === h ? null : h)} small color={colors.mint} />)}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24, paddingTop: spacing.sm }}>
        <T t="small" color={colors.textDim} style={{ marginBottom: spacing.md }}>{list.length}명 · 컨택 가능성 높은 순</T>
        <View style={styles.grid}>
          {list.map(({ b, pct }) => {
            const isFriend = friendIds.includes(b.id);
            return (
              <Card key={b.id} style={styles.cell}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Avatar anonymous={!isFriend} emoji={b.avatar} size={40} />
                  <View style={[styles.pct, { backgroundColor: pct >= 60 ? 'rgba(61,220,151,0.18)' : pct >= 35 ? 'rgba(255,209,102,0.18)' : 'rgba(255,255,255,0.08)' }]}>
                    <T t="caption" color={pct >= 60 ? colors.success : pct >= 35 ? colors.gold : colors.textDim}>컨택 {pct}%</T>
                  </View>
                </Row>
                <T t="bodyStrong" style={{ marginTop: spacing.sm }}>{isFriend ? b.nickname : '???'}</T>
                <T t="caption" color={colors.textDim}>{b.location.city} · {formatKm(distanceKm(me.location, b.location))}</T>
                <View style={styles.tags}>
                  <Chip label={b.field} small />
                  <Chip label={b.job} small color={colors.sky} />
                  {b.hobbies.slice(0, 2).map((h) => <Chip key={h} label={h} small color={colors.mint} />)}
                </View>
                <T t="caption" color={colors.textFaint} style={{ marginTop: spacing.sm }}>친구 {botFriendCount(b)}명 · {timeAgo(b.lastActiveAt)} 활동</T>
                <Button
                  title={isFriend ? '채팅' : '편지 보내기'}
                  size="sm"
                  variant={isFriend ? 'secondary' : 'primary'}
                  icon={isFriend ? '💬' : '✉️'}
                  style={{ marginTop: spacing.md }}
                  onPress={() =>
                    isFriend
                      ? router.push(`/chat/${b.id}`)
                      : router.push({ pathname: '/compose', params: { toId: b.id, field: b.field, job: b.job } } as any)
                  }
                />
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexGrow: 0, flexShrink: 0, height: 44, marginBottom: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '48%', flexGrow: 1, padding: spacing.md },
  pct: { paddingHorizontal: 8, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.sm },
});

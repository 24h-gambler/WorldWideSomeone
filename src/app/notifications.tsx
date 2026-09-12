import React, { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Card, Empty, Header, Row, Screen, T } from '@/components/ui';
import { timeAgo } from '@/engine/geo';
import { useStore } from '@/store';
import { colors, spacing } from '@/theme';
import type { NotificationType } from '@/types';

const ICON: Record<NotificationType, string> = {
  passby: '✈️', caught: '🎉', friend_request: '👋', friend_accepted: '🤝', chat: '💬', mischief: '😱', defended: '🛡️', landed: '📍', reward: '🪙',
};

export default function Notifications() {
  const router = useRouter();
  const list = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markNotificationsRead);
  useEffect(() => {
    const t = setTimeout(markRead, 800);
    return () => clearTimeout(t);
  }, [markRead]);
  return (
    <Screen>
      <Header title="알림" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {list.length === 0 ? (
          <Empty emoji="🔕" title="알림이 없어요" />
        ) : (
          list.map((n) => (
            <Card key={n.id} onPress={n.route ? () => router.push(n.route as any) : undefined} style={{ marginBottom: spacing.sm, padding: spacing.md, opacity: n.read ? 0.7 : 1 }}>
              <Row style={{ alignItems: 'flex-start' }}>
                <T style={{ fontSize: 22 }}>{ICON[n.type]}</T>
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T t="bodyStrong" style={{ flex: 1 }}>{n.title}</T>
                    <T t="caption" color={colors.textFaint}>{timeAgo(n.at)}</T>
                  </Row>
                  <T t="small" color={colors.textDim}>{n.body}</T>
                </View>
                {!n.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 6 }} /> : null}
              </Row>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

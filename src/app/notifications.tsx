import React, { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Empty, Header, ListRow, Screen, T } from '@/components/ui';
import { timeAgo } from '@/engine/geo';
import { useStore } from '@/store';
import { useColors } from '@/theme';
import type { NotificationType } from '@/types';

const ICON: Record<NotificationType, string> = { passby: '✈️', caught: '🎉', reply: '📬', direct: '📨', boost: '⚡', approved: '🤝', chat: '💬', mischief: '😈', defended: '🛡️', landed: '📍', reward: '🪙', like: '❤️', comment: '💬', sunk: '🌊', system: '🌍' };

export default function Notifications() {
  const router = useRouter();
  const colors = useColors();
  const list = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markNotificationsRead);
  useEffect(() => { const t = setTimeout(markRead, 800); return () => clearTimeout(t); }, [markRead]);
  return (
    <Screen>
      <Header title="활동" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {list.length === 0 ? <Empty icon="heart" title="활동이 없어요" /> : list.map((n) => (
          <ListRow key={n.id} left={<View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: n.read ? colors.bg3 : colors.blueSoft, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 20 }}>{ICON[n.type]}</T></View>} title={n.title} subtitle={`${n.body} · ${timeAgo(n.at)}`} right={!n.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue }} /> : undefined} onPress={n.route ? () => router.push(n.route as any) : undefined} />
        ))}
      </ScrollView>
    </Screen>
  );
}

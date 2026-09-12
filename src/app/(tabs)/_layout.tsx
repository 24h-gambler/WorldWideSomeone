import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, TAB_BAR_HEIGHT } from '@/theme';
import { Avatar, Badge, Icon, type FeatherName } from '@/components/ui';
import { selectPendingReplies, selectUnreadChats, useStore } from '@/store';
import { tap } from '@/engine/haptics';

/** Instagram 하단 바: 홈 · 편지 · 친구(채팅) · 커뮤니티 · 프로필(아바타) */
const TABS: { name: string; icon: FeatherName }[] = [
  { name: 'index', icon: 'globe' },
  { name: 'letters', icon: 'send' },
  { name: 'friends', icon: 'message-circle' },
  { name: 'community', icon: 'compass' },
  { name: 'profile', icon: 'user' },
];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const unreadChats = useStore(selectUnreadChats);
  const pendingReplies = useStore(selectPendingReplies);
  const me = useStore((s) => s.me);
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6), height: TAB_BAR_HEIGHT + Math.max(insets.bottom, 6) }]}>
      {state.routes.map((route, i) => {
        const meta = TABS.find((t) => t.name === route.name);
        if (!meta) return null;
        const focused = state.index === i;
        const badge = route.name === 'friends' ? unreadChats : route.name === 'letters' ? pendingReplies : 0;
        return (
          <Pressable key={route.key} onPress={() => { tap(); navigation.navigate(route.name); }} style={styles.item} hitSlop={6}>
            {route.name === 'profile' ? (
              <View style={{ borderWidth: focused ? 1.5 : 0, borderColor: colors.text, borderRadius: 16, padding: 1 }}>
                <Avatar emoji={me.avatar} size={24} />
              </View>
            ) : (
              <Icon name={meta.icon} size={26} color={colors.text} style={{ opacity: focused ? 1 : 0.9 }} />
            )}
            {focused && route.name !== 'profile' ? <View style={styles.dot} /> : null}
            {badge ? <View style={{ position: 'absolute', top: 6, right: 14 }}><Badge count={badge} /></View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} />)}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', height: TAB_BAR_HEIGHT },
  dot: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.text },
});

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius, TAB_BAR_HEIGHT } from '@/theme';
import { Badge, T } from '@/components/ui';
import { selectPendingIncoming, selectUnreadChats, useStore } from '@/store';
import { tap } from '@/engine/haptics';

const TABS: { name: string; label: string; icon: string }[] = [
  { name: 'index', label: '지구', icon: '🌍' },
  { name: 'letters', label: '편지', icon: '✉️' },
  { name: 'friends', label: '친구', icon: '👥' },
  { name: 'community', label: '커뮤니티', icon: '🫧' },
  { name: 'profile', label: '나', icon: '🙂' },
];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const pending = useStore((s) => selectPendingIncoming(s).length);
  const unreadChats = useStore(selectUnreadChats);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, i) => {
          const meta = TABS.find((t) => t.name === route.name);
          if (!meta) return null;
          const focused = state.index === i;
          const badge = route.name === 'friends' ? pending + unreadChats : 0;
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                tap();
                navigation.navigate(route.name);
              }}
              style={styles.item}>
              {focused ? (
                <LinearGradient colors={['rgba(124,92,255,0.45)', 'rgba(255,92,138,0.35)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.focusPill}>
                  <T style={{ fontSize: 20 }}>{meta.icon}</T>
                </LinearGradient>
              ) : (
                <View style={styles.focusPill}>
                  <T style={{ fontSize: 20, opacity: 0.8 }}>{meta.icon}</T>
                </View>
              )}
              <T t="caption" color={focused ? colors.text : colors.textFaint}>{meta.label}</T>
              {badge ? <View style={{ position: 'absolute', top: 2, right: 10 }}><Badge count={badge} /></View> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(p) => <TabBar {...p} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  bar: {
    height: TAB_BAR_HEIGHT,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(13,19,48,0.92)',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  item: { alignItems: 'center', justifyContent: 'center', gap: 2, flex: 1, height: TAB_BAR_HEIGHT },
  focusPill: { width: 44, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});

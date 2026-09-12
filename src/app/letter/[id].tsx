import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Globe } from '@/components/globe/Globe';
import { STATUS_LABEL } from '@/components/letter-helpers';
import { Avatar, Button, Card, Chip, Header, ProgressBar, Row, Screen, Section, T } from '@/components/ui';
import { VEHICLE_MAP } from '@/data/vehicles';
import { findCity } from '@/data/cities';
import { formatDuration, formatKm } from '@/engine/geo';
import { useNow } from '@/hooks/use-now';
import { ME_ID, displayName, getUser, progressOf, useStore } from '@/store';
import { colors, radius, spacing } from '@/theme';

const EVENT_LABEL: Record<string, string> = {
  departed: '출발', passby: '누군가의 머리 위 통과', landed: '착륙', caught: '잡힘', defended: '🛡️ 장난 방어 성공', returned: '↩️ 되돌아감', ocean: '🌊 바다에 빠짐', space: '🪐 우주로', expired: '만료', friend_request: '친구 요청',
};

export default function LetterScreen() {
  const router = useRouter();
  const { id, reveal } = useLocalSearchParams<{ id: string; reveal?: string }>();
  const { width } = useWindowDimensions();
  const now = useNow(1);
  const letter = useStore((s) => s.letters.find((l) => l.id === id));
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const requests = useStore((s) => s.requests);
  const sendFriendRequest = useStore((s) => s.sendFriendRequest);

  const anim = useRef(new Animated.Value(reveal ? 0 : 1)).current;
  useEffect(() => {
    if (reveal) Animated.spring(anim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [reveal, anim]);

  if (!letter) {
    return (
      <Screen>
        <Header title="편지" />
        <T color={colors.textDim}>편지를 찾을 수 없어요</T>
      </Screen>
    );
  }

  const v = VEHICLE_MAP[letter.vehicle];
  const st = STATUS_LABEL[letter.status];
  const mine = letter.senderId === ME_ID;
  const caughtByMe = letter.caughtBy === ME_ID;
  const canRead = mine || caughtByMe;
  const otherId = mine ? letter.caughtBy : letter.senderId;
  const other = otherId ? getUser({ me }, otherId) : undefined;
  const isFriend = otherId ? friendIds.includes(otherId) : false;
  const pending = otherId ? requests.find((r) => r.status === 'pending' && ((r.fromId === ME_ID && r.toId === otherId) || (r.toId === ME_ID && r.fromId === otherId))) : undefined;
  const p = progressOf(letter, now);
  const stamp = findCity(letter.stamp);

  return (
    <Screen>
      <Header title={`${letter.origin.city} → ${letter.destination.city}`} subtitle={`${v.emoji} ${v.name} · ${formatKm(letter.distanceKm)}`} right={<Chip label={`${st.emoji} ${st.label}`} small selected color={st.color} />} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {(letter.status === 'flying' || letter.status === 'landed') && (
          <View style={{ alignItems: 'center' }}>
            <Globe size={Math.min(width - 32, 300)} letters={[letter]} me={me.location} focusLetterId={letter.id} fps={24} showStars={false} />
            <View style={{ width: '100%', gap: 6, marginTop: -8 }}>
              <ProgressBar value={p} color={mine ? colors.accent : v.color} />
              <Row style={{ justifyContent: 'space-between' }}>
                <T t="caption" color={colors.textFaint}>{Math.round(p * 100)}%</T>
                <T t="caption" color={colors.textFaint}>{letter.status === 'landed' ? '착륙 · 집어갈 사람을 기다려요' : `${formatDuration(letter.arrivesAt - now)} 후 도착`}</T>
              </Row>
            </View>
          </View>
        )}

        {/* 편지 본문 */}
        <Animated.View style={{ marginTop: spacing.lg, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }], opacity: anim }}>
          {canRead ? (
            <View style={styles.paper}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <T t="caption" color="#6B5E4A">FROM {letter.origin.city.toUpperCase()}</T>
                  <T t="caption" color="#6B5E4A">{new Date(letter.departedAt).toLocaleString('ko-KR')}</T>
                </View>
                <View style={styles.stamp}>
                  <T style={{ fontSize: 22 }}>{stamp?.flag ?? '📮'}</T>
                  <T t="caption" color="#6B5E4A">{letter.stamp}</T>
                </View>
              </Row>
              <T style={{ color: '#2A2418', fontSize: 17, lineHeight: 28, marginTop: spacing.md }}>{letter.text}</T>
              {letter.imageUri ? <Image source={{ uri: letter.imageUri }} style={{ width: '100%', height: 200, borderRadius: radius.sm, marginTop: spacing.md }} /> : null}
              <T t="caption" color="#6B5E4A" style={{ marginTop: spacing.md, textAlign: 'right' }}>— {mine ? me.nickname : isFriend ? other?.nickname : '???'}</T>
            </View>
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <T style={{ fontSize: 40 }}>✉️</T>
              <T t="bodyStrong" style={{ marginTop: 6 }}>봉인된 편지</T>
              <T t="small" color={colors.textDim} style={{ textAlign: 'center' }}>머리 위를 지나갈 때 잡아야 읽을 수 있어요</T>
            </Card>
          )}
        </Animated.View>

        {/* 상대 & 친구 요청 */}
        {otherId && other ? (
          <Card style={{ marginTop: spacing.lg }} glow={caughtByMe && !isFriend && !pending ? colors.accent : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <Avatar anonymous={!isFriend} emoji={other.avatar} size={48} />
                <View>
                  <T t="bodyStrong">{displayName({ me, friendIds }, otherId)} <T t="small" color={colors.textDim}>· {other.location.city}</T></T>
                  <T t="small" color={colors.textDim}>{other.field} · {other.job} · {other.hobbies.slice(0, 2).join(', ')}</T>
                </View>
              </Row>
            </Row>
            <T t="small" color={colors.textDim} style={{ marginTop: spacing.sm }}>{mine ? '내 편지를 잡은 사람이에요' : '이 편지를 보낸 사람이에요'}</T>
            <Row style={{ marginTop: spacing.md }}>
              {isFriend ? (
                <Button title="채팅하기" icon="💬" onPress={() => router.push(`/chat/${otherId}`)} style={{ flex: 1 }} />
              ) : pending ? (
                <>
                  <Button title={pending.fromId === ME_ID ? '요청 보냄 · 대기 중' : '요청 받음'} variant="secondary" disabled style={{ flex: 1 }} />
                  <Button title="채팅 (3통)" variant="ghost" onPress={() => router.push(`/chat/${otherId}`)} />
                </>
              ) : (
                <>
                  <Button title="친구 요청 보내기" icon="🤝" onPress={() => { sendFriendRequest(otherId, letter.id); router.push(`/chat/${otherId}`); }} style={{ flex: 1 }} />
                </>
              )}
            </Row>
          </Card>
        ) : mine && letter.status === 'caught' ? null : mine ? (
          <Card style={{ marginTop: spacing.lg }}>
            <T t="small" color={colors.textDim}>{letter.status === 'flying' ? '누군가의 머리 위를 지나가면 그 사람이 잡을 수 있어요. 잡히면 알림이 와요.' : letter.status === 'landed' ? '목적지 근처 사람이 집어가길 기다리고 있어요.' : letter.status === 'expired' ? '아무도 집어가지 않았어요. 다시 보내볼까요?' : '이 편지는 여정을 마쳤어요.'}</T>
          </Card>
        ) : null}

        {hasTarget(letter) ? (
          <Card style={{ marginTop: spacing.md }}>
            <T t="caption" color={colors.textDim}>받는 사람 조건</T>
            <Row style={{ flexWrap: 'wrap', marginTop: 4 }}>
              {letter.target.field ? <Chip label={letter.target.field} small /> : null}
              {letter.target.job ? <Chip label={letter.target.job} small color={colors.sky} /> : null}
              {letter.target.hobby ? <Chip label={letter.target.hobby} small color={colors.mint} /> : null}
              {letter.target.gender ? <Chip label={letter.target.gender} small color={colors.accent} /> : null}
            </Row>
          </Card>
        ) : null}

        <Section title="여정">
          <Card style={{ gap: 10 }}>
            {letter.events.map((e, i) => (
              <Row key={i} style={{ alignItems: 'flex-start' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === letter.events.length - 1 ? colors.accent : colors.textFaint, marginTop: 6 }} />
                <View style={{ flex: 1 }}>
                  <T t="small">{EVENT_LABEL[e.type] ?? e.type}{e.place ? ` · ${e.place}` : ''}</T>
                  <T t="caption" color={colors.textFaint}>{new Date(e.at).toLocaleTimeString('ko-KR')}</T>
                </View>
              </Row>
            ))}
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}

function hasTarget(l: { target: Record<string, unknown> }) {
  return !!(l.target.field || l.target.job || l.target.hobby || l.target.gender);
}

const styles = StyleSheet.create({
  paper: { backgroundColor: '#FBF4E4', borderRadius: radius.lg, padding: spacing.lg },
  stamp: { width: 60, height: 64, borderWidth: 1.5, borderColor: '#C9B99A', borderStyle: 'dashed', borderRadius: 6, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: '#F4EAD3', transform: [{ rotate: '4deg' }] },
});

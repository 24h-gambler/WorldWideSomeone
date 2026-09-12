import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { Globe } from '@/components/globe/Globe';
import { EVENT_LABEL, STATUS_LABEL, hasTarget } from '@/components/letter-helpers';
import { Avatar, Button, Header, Icon, Pill, ProgressBar, Row, Screen, Section, T } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { VEHICLE_MAP } from '@/data/vehicles';
import { findCity } from '@/data/cities';
import { formatDuration, formatKm } from '@/engine/geo';
import { useNow } from '@/hooks/use-now';
import { ME_ID, displayName, getUser, progressOf, useStore } from '@/store';
import { colors, radius, spacing } from '@/theme';

export default function LetterScreen() {
  const router = useRouter();
  const { id, reveal } = useLocalSearchParams<{ id: string; reveal?: string }>();
  const { width } = useWindowDimensions();
  const now = useNow(1);
  const letter = useStore((s) => s.letters.find((l) => l.id === id));
  const letters = useStore((s) => s.letters);
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const approve = useStore((s) => s.approveReply);
  const decline = useStore((s) => s.declineReply);
  const publish = useStore((s) => s.publishPost);
  const posts = useStore((s) => s.posts);
  const anim = useRef(new Animated.Value(reveal ? 0 : 1)).current;
  useEffect(() => { if (reveal) Animated.spring(anim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: Platform.OS !== 'web' }).start(); }, [reveal, anim]);

  if (!letter) return <Screen><Header title="편지" /><T style={{ padding: spacing.lg }} color={colors.text2}>편지를 찾을 수 없어요</T></Screen>;

  const v = VEHICLE_MAP[letter.vehicle];
  const st = STATUS_LABEL[letter.status];
  const mine = letter.senderId === ME_ID;
  const toMe = letter.recipientId === ME_ID;
  const caughtByMe = letter.caughtBy === ME_ID;
  const canRead = mine || caughtByMe || toMe;
  const otherId = mine ? letter.caughtBy ?? letter.recipientId : letter.senderId;
  const other = otherId ? getUser({ me }, otherId) : undefined;
  const isFriend = otherId ? friendIds.includes(otherId) : false;
  const p = progressOf(letter, now);
  const stamp = findCity(letter.stamp);
  const myReply = caughtByMe ? letters.find((l) => l.replyToId === letter.id && l.senderId === ME_ID) : undefined;
  const isPosted = posts.some((x) => x.letterId === letter.id);
  const snail = !!letter.penalty && now < letter.penalty.until;

  return (
    <Screen>
      <Header title={`${letter.origin.city} → ${letter.destination.city}`} subtitle={`${v.emoji} ${v.name} · ${formatKm(letter.distanceKm)}${letter.replyToId ? ' · 답장' : ''}`} right={<Pill label={st.label} color={st.bg} textColor={st.color} icon={st.emoji} />} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {(letter.status === 'flying' || letter.status === 'landed') && (
          <LinearGradient colors={['#F4FAFF', '#DDEEFF']} style={{ alignItems: 'center', paddingBottom: 12 }}>
            <Globe size={Math.min(width, 360)} letters={[letter]} me={me.location} meAvatar={me.avatar} focusLetterId={letter.id} fps={24} />
            <View style={{ width: '100%', paddingHorizontal: spacing.lg, gap: 4, marginTop: -8 }}>
              <ProgressBar value={p} color={mine || toMe ? colors.pink : v.color} track="rgba(255,255,255,0.8)" />
              <Row style={{ justifyContent: 'space-between' }}>
                <T t="caption" color={colors.text2}>{Math.round(p * 100)}%{snail ? ' · 🐌 달팽이 벌칙 중' : ''}{letter.redirects ? ` · 경로변경 ${letter.redirects}회` : ''}</T>
                <T t="caption" color={colors.text2}>{letter.status === 'landed' ? '착륙 · 집어갈 사람을 기다려요' : `${formatDuration(letter.arrivesAt - now)} 후 도착`}</T>
              </Row>
            </View>
          </LinearGradient>
        )}

        <Animated.View style={{ padding: spacing.lg, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }], opacity: anim }}>
          {canRead ? (
            <View style={styles.paper}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View><T t="caption" color="#8A7A5A">FROM {letter.origin.city.toUpperCase()}</T><T t="caption" color="#8A7A5A">{new Date(letter.departedAt).toLocaleString('ko-KR')}</T></View>
                <View style={styles.stamp}><T style={{ fontSize: 22 }}>{stamp?.flag ?? '📮'}</T><T t="caption" color="#8A7A5A">{letter.stamp}</T></View>
              </Row>
              <T style={{ color: '#2A2418', fontSize: 17, lineHeight: 28, marginTop: spacing.md }}>{letter.text}</T>
              {letter.imageUri ? <Image source={{ uri: letter.imageUri }} style={{ width: '100%', height: 200, borderRadius: 8, marginTop: spacing.md }} /> : null}
              <T t="caption" color="#8A7A5A" style={{ marginTop: spacing.md, textAlign: 'right' }}>— {mine ? me.nickname : isFriend ? other?.nickname : '???'}</T>
            </View>
          ) : (
            <View style={[styles.paper, { alignItems: 'center', paddingVertical: 36 }]}>
              <Icon name="lock" size={28} color="#8A7A5A" />
              <T t="bodyStrong" style={{ marginTop: 8, color: '#2A2418' }}>봉인된 편지</T>
              <T t="small" color="#8A7A5A" style={{ textAlign: 'center' }}>머리 위를 지나갈 때 잡아야 읽을 수 있어요</T>
            </View>
          )}
        </Animated.View>

        {/* 흐름별 액션 */}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {toMe && letter.status === 'delivered' ? (
            <View style={styles.actionBox}>
              <T t="bodyStrong">📬 답장이 도착했어요{letter.friendRequest ? ' · 친구 요청 포함' : ''}</T>
              <T t="small" color={colors.text2}>승인하면 {other ? '???' : '상대'}와 친구가 되고, 지연 없는 실시간 채팅이 시작돼요. 위치는 50km 반경으로 공유돼요.</T>
              <Row><Button title="승인하고 채팅 시작" icon="message-circle" style={{ flex: 1 }} onPress={() => { approve(letter.id); if (otherId) router.replace(`/chat/${otherId}`); }} /><Button title="거절" variant="ghost" onPress={() => { decline(letter.id); router.back(); }} /></Row>
            </View>
          ) : null}
          {caughtByMe && !isFriend && !myReply ? (
            <View style={styles.actionBox}>
              <T t="bodyStrong">✉️ 답장을 보내 친구가 되어보세요</T>
              <T t="small" color={colors.text2}>답장은 발신자에게 직행해요. 상대가 승인하면 실시간 채팅이 열려요.</T>
              <Button title="답장 편지 쓰기" icon="edit-3" onPress={() => router.push({ pathname: '/compose', params: { replyTo: letter.id } } as any)} />
            </View>
          ) : null}
          {myReply ? (
            <View style={styles.actionBox}>
              <T t="bodyStrong">{myReply.status === 'flying' ? '✈️ 답장이 가는 중' : myReply.status === 'delivered' ? '📬 답장 도착 · 상대 승인 대기' : myReply.status === 'approved' ? '🤝 승인됨 · 친구' : '🙅 상대가 승인하지 않았어요'}</T>
              <Row><Button title="답장 보기" size="sm" variant="secondary" onPress={() => router.push(`/letter/${myReply.id}`)} />{isFriend && otherId ? <Button title="채팅" size="sm" onPress={() => router.push(`/chat/${otherId}`)} /> : null}</Row>
            </View>
          ) : null}
          {mine && letter.status === 'caught' && other ? (
            <View style={styles.actionBox}>
              <Row gap={10}><Avatar anonymous={!isFriend} emoji={other.avatar} size={40} ring="ig" /><View style={{ flex: 1 }}><T t="bodyStrong">{displayName({ me, friendIds }, other.id)} · {other.location.city}</T><T t="small" color={colors.text2}>{other.field} · {other.job} · 내 편지를 잡았어요</T></View></Row>
              <T t="small" color={colors.text2}>{isFriend ? '친구예요. 채팅해보세요.' : '상대가 답장을 보내면 우편함에 도착해요. 승인하면 채팅이 열려요.'}</T>
              {isFriend ? <Button title="채팅하기" icon="message-circle" onPress={() => router.push(`/chat/${other.id}`)} /> : null}
            </View>
          ) : null}
          {mine && !letter.replyToId && !isPosted ? <Button title="커뮤니티에 엽서로 공개" variant="secondary" icon="image" onPress={() => publish(letter.id)} /> : null}
          {mine && letter.status === 'expired' ? <Button title="다시 보내기" variant="secondary" icon="refresh-cw" onPress={() => router.push('/compose')} /> : null}
          {isFriend && otherId && !mine && !toMe ? <Button title="채팅하기" icon="message-circle" onPress={() => router.push(`/chat/${otherId}`)} /> : null}
          {other && !mine ? (
            <Row gap={10} style={{ paddingVertical: 4 }}>
              <Avatar anonymous={!isFriend} emoji={other.avatar} size={36} />
              <View style={{ flex: 1 }}><T t="bodyStrong">{displayName({ me, friendIds }, other.id)} <T t="small" color={colors.text2}>· {other.location.city}</T></T><T t="small" color={colors.text2}>{other.field} · {other.job} · {other.hobbies.slice(0, 2).join(', ')}</T></View>
              <Button title="프로필" size="sm" variant="ghost" onPress={() => router.push(`/user/${other.id}`)} />
            </Row>
          ) : null}
          {hasTarget(letter) ? <Row style={{ flexWrap: 'wrap' }} gap={4}><T t="caption" color={colors.text2}>조건</T>{letter.target.field ? <Pill label={letter.target.field} /> : null}{letter.target.job ? <Pill label={letter.target.job} /> : null}{letter.target.hobby ? <Pill label={letter.target.hobby} /> : null}{letter.target.gender ? <Pill label={letter.target.gender} /> : null}</Row> : null}
        </View>

        <Section title="여정">
          <View style={{ paddingHorizontal: spacing.lg, gap: 10 }}>
            {letter.events.map((e, i) => (
              <Row key={i} style={{ alignItems: 'flex-start' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === letter.events.length - 1 ? colors.blue : colors.line, marginTop: 6 }} />
                <View style={{ flex: 1 }}><T t="small">{EVENT_LABEL[e.type] ?? e.type}{e.place ? ` · ${e.place}` : ''}</T><T t="caption" color={colors.text3}>{new Date(e.at).toLocaleTimeString('ko-KR')}</T></View>
              </Row>
            ))}
          </View>
        </Section>
        <View style={{ alignItems: 'center', marginTop: spacing.xl }}><VehicleIcon id={letter.vehicle} size={40} bubble snail={snail} /></View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: '#FBF4E4', borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: '#EEDFC0' },
  stamp: { width: 58, height: 62, borderWidth: 1.5, borderColor: '#D9C9A6', borderStyle: 'dashed', borderRadius: 6, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: '#F4EAD3', transform: [{ rotate: '4deg' }] },
  actionBox: { backgroundColor: colors.bg2, borderRadius: radius.lg, padding: spacing.lg, gap: 10, borderWidth: 1, borderColor: colors.lineSoft },
});

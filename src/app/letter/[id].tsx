import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { Globe } from '@/components/globe/Globe';
import { EVENT_LABEL, hasTarget, kindLabel, statusLabel } from '@/components/letter-helpers';
import { Avatar, Button, Header, Icon, IconButton, Paper, Pill, ProgressBar, Row, Screen, Section, Stamp, T, Wordmark } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { ItemIcon } from '@/components/item-art';
import { VEHICLE_MAP } from '@/data/vehicles';
import { OCEAN_RESCUE_COINS, REPLY_BOOST, discounted } from '@/data/plans';
import { useGate } from '@/hooks/use-gate';
import { findCity } from '@/data/cities';
import { formatDuration, formatKm } from '@/engine/geo';
import { useNow } from '@/hooks/use-now';
import { ME_ID, displayName, getUser, incomingStatus, isRevealed, progressOf, useStore } from '@/store';
import { spacing, useColors } from '@/theme';
import { success, warn } from '@/engine/haptics';

export default function LetterScreen() {
  const router = useRouter();
  const c = useColors();
  const { id, reveal } = useLocalSearchParams<{ id: string; reveal?: string }>();
  const { width } = useWindowDimensions();
  const now = useNow(1);
  const letter = useStore((s) => s.letters.find((l) => l.id === id));
  const letters = useStore((s) => s.letters);
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const revealedIds = useStore((s) => s.revealedIds);
  const approve = useStore((s) => s.approveReply);
  const boost = useStore((s) => s.boostReply);
  const settings = useStore((s) => s.settings);
  const gate = useGate();
  const decline = useStore((s) => s.declineLetter);
  const publish = useStore((s) => s.publishPost);
  const rescue = useStore((s) => s.rescueLetter);
  const posts = useStore((s) => s.posts);
  const anim = useRef(new Animated.Value(reveal ? 0 : 1)).current;
  const paperRef = useRef<View>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  useEffect(() => { if (reveal) Animated.spring(anim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: Platform.OS !== 'web' }).start(); }, [reveal, anim]);
  if (!letter) return <Screen><Header title="편지" /><T style={{ padding: spacing.lg }} color={c.text2}>편지를 찾을 수 없어요</T></Screen>;

  const v = VEHICLE_MAP[letter.vehicle];
  const st = statusLabel(c)[letter.status];
  const mine = letter.senderId === ME_ID;
  const toMe = letter.recipientId === ME_ID;
  const caughtByMe = letter.caughtBy === ME_ID;
  const peekedByMe = letter.peekedBy.includes(ME_ID);
  const canRead = mine || caughtByMe || toMe || peekedByMe;
  const otherId = mine ? letter.caughtBy ?? letter.recipientId : letter.senderId;
  const other = otherId ? getUser({ me }, otherId) : undefined;
  const rev = { me, friendIds, revealedIds };
  const otherShown = otherId ? isRevealed(rev, otherId) : false;
  const isFriend = otherId ? friendIds.includes(otherId) : false;
  const p = progressOf(letter, now);
  const stamp = findCity(letter.stamp);
  const myReply = caughtByMe || toMe ? letters.find((l) => l.replyToId === letter.id && l.senderId === ME_ID) : undefined;
  const isPosted = posts.some((x) => x.letterId === letter.id);
  const snail = !!letter.penalty && now < letter.penalty.until;
  const sunk = letter.status === 'sunk';
  const share = async () => {
    try {
      if (Platform.OS === 'web') { setShareMsg('이미지 공유는 앱에서 지원해요 (웹은 캡처 미지원)'); return; }
      const uri = await captureRef(paperRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '편지 공유' });
      success();
    } catch { warn(); setShareMsg('공유에 실패했어요'); }
    setTimeout(() => setShareMsg(null), 2500);
  };

  return (
    <Screen>
      <Header title={`${letter.origin.city} → ${mine || toMe || caughtByMe ? letter.destination.city : '어딘가'}`} subtitle={`${v.name} · ${formatKm(letter.distanceKm)} · ${kindLabel(letter)}`} right={<><Pill label={st.label} color={st.bg} textColor={st.color} icon={<ItemIcon id={st.icon} size={12} />} />{canRead ? <IconButton name="share" label="공유" onPress={share} /> : null}</>} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {(letter.status === 'flying' || letter.status === 'landed' || sunk) && (
          <LinearGradient colors={[...c.sky] as any} style={{ alignItems: 'center', paddingBottom: 12 }}>
            <Globe size={Math.min(width, 360)} letters={[letter]} me={me.location} meAvatar={me.avatar} focusLetterId={letter.id} fps={24} showRoutes="focus" />
            <View style={{ width: '100%', paddingHorizontal: spacing.lg, gap: 4, marginTop: -8 }}>
              <ProgressBar value={p} color={sunk ? c.red : mine || toMe ? c.pink : v.color} track={c.bubble} />
              <Row style={{ justifyContent: 'space-between' }}><T t="caption" color={c.text2}>{Math.round(p * 100)}%{snail ? ' · 🐌 달팽이 벌칙 중' : ''}{letter.redirects ? ` · 경로변경 ${letter.redirects}회` : ''}{letter.pulls ? ' · 🧲 끌려감' : ''}</T><T t="caption" color={c.text2}>{sunk ? `🌊 ${formatDuration((letter.sunkUntil ?? now) - now)} 뒤 떠오름` : letter.status === 'landed' ? '착륙 · 집어갈 사람을 기다려요' : `${incomingStatus(letter, me.location, now, settings.timeScale).speedKmh.toLocaleString()} km/h · ${mine ? `남은 ${formatKm(Math.max(0, letter.distanceKm * (1 - p)))}` : `나와 ${formatKm(incomingStatus(letter, me.location, now, settings.timeScale).distanceKm)}`}`}</T></Row>
            </View>
          </LinearGradient>
        )}
        {sunk ? (
          <View style={[styles.box, { backgroundColor: c.redSoft, borderColor: c.red, marginHorizontal: spacing.lg, marginTop: spacing.lg }]}>
            <T t="bodyStrong" color={c.red}>🌊 침수됐어요</T>
            <T t="small" color={c.text2}>{formatDuration((letter.sunkUntil ?? now) - now)} 뒤 저절로 떠오르거나, 주인이 지금 건져낼 수 있어요.</T>
            {mine ? <Button title={`지금 건져내기 · ${OCEAN_RESCUE_COINS} SC`} size="sm" icon="anchor" track="letter:rescue" onPress={() => { const r = rescue(letter.id); if (r === 'nofunds') { warn(); setShareMsg('코인이 부족해요'); setTimeout(() => setShareMsg(null), 2000); } else success(); }} /> : null}
          </View>
        ) : null}
        {shareMsg ? <T t="small" color={c.text2} style={{ paddingHorizontal: spacing.lg, paddingTop: 8 }}>{shareMsg}</T> : null}

        <Animated.View style={{ padding: spacing.lg, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }], opacity: anim }}>
          <View ref={paperRef} collapsable={false} style={{ backgroundColor: c.bg, borderRadius: 16 }}>
            {canRead ? (
              <Paper>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><View><T t="caption" color={c.paperMuted}>FROM {letter.origin.city.toUpperCase()}</T><T t="caption" color={c.paperMuted}>{new Date(letter.departedAt).toLocaleString('ko-KR')}</T></View><Stamp flag={stamp?.flag ?? '📮'} label={letter.stamp} /></Row>
                <T style={{ color: c.paperText, fontSize: 17, lineHeight: 28, marginTop: spacing.md }}>{letter.text}</T>
                {letter.imageUri ? <Image source={{ uri: letter.imageUri }} style={{ width: '100%', height: 200, borderRadius: 8, marginTop: spacing.md }} /> : null}
                <Row style={{ justifyContent: 'space-between', marginTop: spacing.md }}><Row gap={6}><VehicleIcon id={letter.vehicle} size={26} bubble /><T t="caption" color={c.paperMuted}>{v.name} · {formatKm(letter.distanceKm)}</T></Row><T t="caption" color={c.paperMuted}>— {mine ? me.nickname : otherShown ? other?.nickname : '???'}</T></Row>
                <View style={{ alignItems: 'flex-end', marginTop: 4 }}><Wordmark size={14} color={c.paperMuted} /></View>
              </Paper>
            ) : (
              <Paper style={{ alignItems: 'center', paddingVertical: 36 }}><Icon name="lock" size={28} color={c.paperMuted} /><T t="bodyStrong" style={{ marginTop: 8, color: c.paperText }}>봉인된 편지</T><T t="small" color={c.paperMuted} style={{ textAlign: 'center' }}>머리 위를 지나갈 때 잡거나 엿봐야 읽을 수 있어요</T></Paper>
            )}
          </View>
        </Animated.View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {/* 상대 프로필: 편지를 받았거나 잡았으면 공개 */}
          {other && !mine && otherShown ? (
            <View style={[styles.box, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}>
              <Row gap={10}><Avatar emoji={other.avatar} size={52} ring="ig" /><View style={{ flex: 1 }}><T t="bodyStrong">{other.nickname} <T t="small" color={c.text2}>· {other.location.city}, {other.location.country}</T></T><T t="small">{other.bio}</T><T t="caption" color={c.text2}>{other.field} · {other.job} · {other.hobbies.join(', ')}</T></View></Row>
              <Row><Button title="프로필 · 엽서 보기" size="sm" variant="secondary" icon="user" onPress={() => router.push(`/user/${other.id}`)} />{isFriend ? <Button title="채팅" size="sm" icon="message-circle" onPress={() => router.push(`/chat/${other.id}`)} /> : null}</Row>
            </View>
          ) : other && !mine ? (
            <Row gap={10} style={{ paddingVertical: 4 }}><Avatar anonymous size={36} /><View style={{ flex: 1 }}><T t="bodyStrong">??? <T t="small" color={c.text2}>· {other.location.city}</T></T><T t="small" color={c.text2}>{other.field} · {other.job} · 잡으면 프로필이 공개돼요</T></View></Row>
          ) : null}

          {toMe && letter.status === 'flying' ? (
            <View style={[styles.box, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}>
              <T t="bodyStrong">{letter.kind === 'reply' ? '✉️ 답장이 오는 중' : '⚡ 직행 편지가 오는 중'}{letter.boost ? ' · 가속 중' : ''}</T>
              <T t="small" color={c.text2}>도착 시간은 알 수 없어요. 프로필은 도착하면 열려요. 상대 배달원이 느리면 코인으로 당길 수 있어요.</T>
              {letter.boost !== 'instant' ? <Row>{letter.boost !== 'fast' ? <Button title={`4배 빠르게 · ${discounted(REPLY_BOOST.fast.coins, me.plan)} SC`} size="sm" variant="secondary" style={{ flex: 1 }} track="letter:boost:fast" onPress={() => { const r = boost(letter.id, 'fast'); if (r === 'nofunds') { warn(); router.push('/store'); } else success(); }} /> : null}<Button title={`1분 안에 · ${discounted(REPLY_BOOST.instant.coins, me.plan)} SC`} size="sm" variant="gradient" style={{ flex: 1 }} track="letter:boost:instant" onPress={() => { const r = boost(letter.id, 'instant'); if (r === 'nofunds') { warn(); router.push('/store'); } else success(); }} /></Row> : null}
            </View>
          ) : null}
          {toMe && letter.status === 'delivered' && letter.kind === 'reply' ? (
            <View style={[styles.box, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}>
              <T t="bodyStrong">📬 답장이 도착했어요{letter.friendRequest ? ' · 친구 요청 포함' : ''}</T>
              <T t="small" color={c.text2}>편지가 한 번 왕복했어요. 프로필을 보고 수락하면 친구가 되고 지연 없는 실시간 채팅이 열려요. 위치는 50km 반경으로 공유돼요.</T>
              <Row><Button title="수락하고 채팅 시작" icon="check" style={{ flex: 1 }} track="letter:approve" onPress={() => { approve(letter.id); success(); if (otherId) router.replace(`/chat/${otherId}`); }} /><Button title="거절" variant="ghost" track="letter:decline" onPress={() => { decline(letter.id); router.back(); }} /></Row>
            </View>
          ) : null}
          {(caughtByMe || (toMe && letter.kind === 'letter' && letter.status === 'delivered')) && !isFriend && !myReply ? (
            <View style={[styles.box, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}><T t="bodyStrong">✉️ 답장을 보내 친구가 되어보세요</T><T t="small" color={c.text2}>답장은 발신자에게 직행해요. 상대가 수락하면 친구 · 그때부터 실시간 채팅.</T><Button title="답장 편지 쓰기" icon="edit-3" track="letter:reply" onPress={() => gate('reply', () => router.push({ pathname: '/compose', params: { replyTo: letter.id } } as any))} /></View>
          ) : null}
          {myReply ? <View style={[styles.box, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}><T t="bodyStrong">{myReply.status === 'flying' ? '✈️ 답장이 가는 중' : myReply.status === 'delivered' ? '📬 답장 도착 · 상대 수락 대기' : myReply.status === 'approved' ? '✅ 상대가 수락 · 친구' : '🙅 상대가 수락하지 않았어요'}</T><Row><Button title="답장 보기" size="sm" variant="secondary" onPress={() => router.push(`/letter/${myReply.id}`)} />{isFriend && otherId ? <Button title="채팅" size="sm" onPress={() => router.push(`/chat/${otherId}`)} /> : null}</Row></View> : null}
          {mine && letter.status === 'caught' && other ? (
            <View style={[styles.box, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}>
              <Row gap={10}><Avatar anonymous={!otherShown} emoji={other.avatar} size={40} ring="ig" /><View style={{ flex: 1 }}><T t="bodyStrong">{displayName(rev, other.id)} · {other.location.city}</T><T t="small" color={c.text2}>{other.field} · {other.job} · 내 편지를 잡았어요</T></View></Row>
              <T t="small" color={c.text2}>{isFriend ? '친구예요. 채팅해보세요.' : '상대가 답장을 보내면 우편함에 도착해요. 프로필을 보고 수락하세요.'}</T>
              {isFriend ? <Button title="채팅하기" icon="message-circle" onPress={() => router.push(`/chat/${other.id}`)} /> : null}
            </View>
          ) : null}
          {mine && letter.kind === 'letter' && !letter.direct && !isPosted ? <Button title="커뮤니티에 엽서로 공개 (+스토리)" variant="secondary" icon="image" track="letter:publish" onPress={() => publish(letter.id, true)} /> : null}
          {isFriend && otherId && !mine && !toMe ? <Button title="채팅하기" icon="message-circle" onPress={() => router.push(`/chat/${otherId}`)} /> : null}
          {hasTarget(letter) ? <Row style={{ flexWrap: 'wrap' }} gap={4}><T t="caption" color={c.text2}>조건</T>{letter.target.field ? <Pill label={letter.target.field} /> : null}{letter.target.job ? <Pill label={letter.target.job} /> : null}{letter.target.hobby ? <Pill label={letter.target.hobby} /> : null}{letter.target.gender ? <Pill label={letter.target.gender} /> : null}</Row> : null}
        </View>

        <Section title="여정">
          <View style={{ paddingHorizontal: spacing.lg, gap: 10 }}>
            {letter.events.map((e, i) => (
              <Row key={i} style={{ alignItems: 'flex-start' }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === letter.events.length - 1 ? c.blue : c.line, marginTop: 6 }} /><View style={{ flex: 1 }}><T t="small">{EVENT_LABEL[e.type] ?? e.type}{e.place ? ` · ${e.place}` : ''}</T><T t="caption" color={c.text3}>{new Date(e.at).toLocaleTimeString('ko-KR')}</T></View></Row>
            ))}
          </View>
        </Section>
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({ box: { borderRadius: 16, padding: spacing.lg, gap: 10, borderWidth: 1 } });

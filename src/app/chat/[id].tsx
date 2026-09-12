import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Header, Icon, IconButton, Row, Screen, T } from '@/components/ui';
import { distanceKm, formatKm, timeAgo } from '@/engine/geo';
import { ME_ID, displayName, getUser, isRevealed, useStore } from '@/store';
import { fontFamily, radius, spacing, useColors } from '@/theme';
import { remote } from '@/services/sync';

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const revealedIds = useStore((s) => s.revealedIds);
  const chat = useStore((s) => s.chats.find((c) => c.otherId === id));
  const letters = useStore((s) => s.letters);
  const send = useStore((s) => s.sendMessage);
  const markRead = useStore((s) => s.markChatRead);
  const [text, setText] = useState('');
  const scroll = useRef<ScrollView>(null);
  const other = id ? getUser({ me }, id) : undefined;
  const isFriend = !!id && friendIds.includes(id);
  const messages = chat?.messages ?? [];
  const pendingReply = letters.find((l) => l.recipientId === ME_ID && l.senderId === id && l.status === 'delivered');
  const myPendingReply = letters.find((l) => l.senderId === ME_ID && l.recipientId === id && (l.status === 'flying' || l.status === 'delivered'));
  const isRevealedUser = isRevealed({ friendIds, revealedIds }, other?.id ?? '');
  const caughtTheirs = letters.find((l) => l.senderId === id && l.caughtBy === ME_ID);

  useEffect(() => { if (id) markRead(id); }, [id, markRead, messages.length]);
  useEffect(() => { const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50); return () => clearTimeout(t); }, [messages.length]);

  if (!other) return <Screen><Header title="채팅" /><T style={{ padding: spacing.lg }}>사용자를 찾을 수 없어요</T></Screen>;

  const onSend = () => {
    const t = text.trim();
    if (!t) return;
    if (send(other.id, t)) { setText(''); if (remote.enabled) remote.sendMessage(other.id, t).catch(() => {}); }
  };

  return (
    <Screen>
      <Header
        left={<Row gap={8}><Pressable hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/friends'))}><Icon name="chevron-left" size={28} /></Pressable><Avatar anonymous={!isRevealedUser} emoji={other.avatar} size={36} /></Row>}
        title={displayName({ me, friendIds, revealedIds }, other.id)}
        subtitle={`${other.location.city} · ${formatKm(distanceKm(me.location, other.location))} · ${isFriend ? '친구 · 실시간' : '아직 친구가 아니에요'}`}
        right={<><IconButton name="send" onPress={() => router.push({ pathname: '/compose', params: { toId: other.id } } as any)} /><IconButton name="info" onPress={() => router.push(`/user/${other.id}`)} /></>}
      />
      {!isFriend ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 12 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: colors.text, alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={32} /></View>
          <T t="title" style={{ textAlign: 'center' }}>편지로만 대화할 수 있어요</T>
          <T t="body" color={colors.text2} style={{ textAlign: 'center' }}>실시간 채팅은 편지가 한 번 왕복한 뒤에 열려요: 내 편지 → 상대 답장 → 수락. 답장이 오는 동안은 편지가 날아가는 시간만큼 기다려요.</T>
          {pendingReply ? <Button title="도착한 답장 수락하기" icon="check" onPress={() => router.push(`/letter/${pendingReply.id}`)} /> : null}
          {myPendingReply ? <T t="small" color={colors.text2}>{myPendingReply.status === 'flying' ? '내 답장이 가는 중' : '내 답장 도착 · 상대 차례'}</T> : caughtTheirs && !pendingReply ? <Button title="답장 편지 쓰기" icon="edit-3" onPress={() => router.push({ pathname: '/compose', params: { replyTo: caughtTheirs.id } } as any)} /> : !pendingReply ? <Button title="편지 보내기" icon="send" onPress={() => router.push({ pathname: '/compose', params: { toId: other.id } } as any)} /> : null}
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 6 }} showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center', gap: 6, paddingVertical: 16 }}>
              <Avatar emoji={other.avatar} size={80} ring="ig" />
              <T t="h2">{other.nickname}</T>
              <T t="small" color={colors.text2}>{other.location.city}, {other.location.country} · {other.field} · {other.job}</T>
              <T t="caption" color={colors.text3}>{chat ? `${timeAgo(chat.since)} 친구가 됨 · 편지에서 시작된 대화` : ''}</T>
              <Button title="프로필 보기" size="sm" variant="secondary" onPress={() => router.push(`/user/${other.id}`)} />
            </View>
            {messages.map((m, i) => {
              const mine = m.senderId === ME_ID;
              const prevSame = i > 0 && messages[i - 1].senderId === m.senderId;
              return (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 6, marginTop: prevSame ? 0 : 6 }}>
                  {!mine ? <View style={{ width: 26 }}>{!prevSame ? <Avatar emoji={other.avatar} size={26} /> : null}</View> : null}
                  {mine ? (
                    <LinearGradient colors={[...colors.bubbleMe] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, { borderBottomRightRadius: 4 }]}><T color="#fff">{m.text}</T></LinearGradient>
                  ) : (
                    <View style={[styles.bubble, { backgroundColor: colors.bubbleThem, borderBottomLeftRadius: 4 }]}><T>{m.text}</T></View>
                  )}
                </View>
              );
            })}
            {messages.length ? <T t="caption" color={colors.text3} style={{ alignSelf: 'flex-end', marginTop: 2 }}>{new Date(messages[messages.length - 1].at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</T> : null}
          </ScrollView>
          <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={[styles.inputWrap, { borderColor: colors.line }]}>
              <TextInput value={text} onChangeText={setText} placeholder="메시지 보내기…" placeholderTextColor={colors.text3} style={[styles.input, { color: colors.text }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]} onSubmitEditing={onSend} returnKeyType="send" />
              {text.trim() ? <Pressable onPress={onSend} hitSlop={8}><T t="bodyStrong" color={colors.blue}>보내기</T></Pressable> : <Row gap={12}><Icon name="mic" size={20} /><Icon name="image" size={20} /></Row>}
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.xl },
  inputRow: { paddingHorizontal: spacing.lg, paddingTop: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingLeft: 16, paddingRight: 14, height: 44 },
  input: { flex: 1, fontSize: 14, fontFamily, height: 44 },
});

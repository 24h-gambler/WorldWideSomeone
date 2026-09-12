import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Header, IconButton, Row, Screen, T } from '@/components/ui';
import { distanceKm, formatKm } from '@/engine/geo';
import { ME_ID, displayName, getUser, useStore } from '@/store';
import { colors, fontFamily, radius, spacing } from '@/theme';

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const chat = useStore((s) => s.chats.find((c) => c.otherId === id));
  const requests = useStore((s) => s.requests);
  const send = useStore((s) => s.sendMessage);
  const markRead = useStore((s) => s.markChatRead);
  const sendFriendRequest = useStore((s) => s.sendFriendRequest);
  const acceptRequest = useStore((s) => s.acceptRequest);
  const [text, setText] = useState('');
  const scroll = useRef<ScrollView>(null);

  const other = id ? getUser({ me }, id) : undefined;
  const isFriend = !!id && friendIds.includes(id);
  const pending = requests.find((r) => r.status === 'pending' && ((r.fromId === ME_ID && r.toId === id) || (r.toId === ME_ID && r.fromId === id)));
  const mineCount = chat?.messages.filter((m) => m.senderId === ME_ID).length ?? 0;
  const limitLeft = isFriend ? Infinity : Math.max(0, 3 - mineCount);
  const messages = chat?.messages ?? [];

  useEffect(() => {
    if (id) markRead(id);
  }, [id, markRead, messages.length]);
  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  if (!other) {
    return (
      <Screen>
        <Header title="채팅" />
        <T color={colors.textDim}>사용자를 찾을 수 없어요</T>
      </Screen>
    );
  }

  const onSend = () => {
    const t = text.trim();
    if (!t) return;
    if (send(other.id, t)) setText('');
  };

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Header
          title={displayName({ me, friendIds }, other.id)}
          subtitle={`${other.location.city} · ${formatKm(distanceKm(me.location, other.location))} · ${isFriend ? '친구 · 50km 반경 공유' : pending ? '친구 요청 대기 중' : '아직 친구가 아니에요'}`}
          right={
            <Row>
              <Avatar anonymous={!isFriend} emoji={other.avatar} size={40} />
              <IconButton icon="✈️" onPress={() => router.push({ pathname: '/compose', params: { toId: other.id } } as any)} />
            </Row>
          }
        />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: 8 }} showsVerticalScrollIndicator={false}>
          <View style={styles.sys}>
            <T t="caption" color={colors.textDim} style={{ textAlign: 'center' }}>
              {isFriend ? `${other.nickname} 님과 친구예요. 위치는 50km 반경으로만 공유돼요.` : '친구가 되기 전에는 3통까지 보낼 수 있어요. 상대는 ???로 표시돼요.'}
            </T>
          </View>
          {messages.map((m) => {
            const mine = m.senderId === ME_ID;
            return (
              <View key={m.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {mine ? (
                  <LinearGradient colors={['#7C5CFF', '#FF5C8A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, { borderBottomRightRadius: 4 }]}>
                    <T color="#fff">{m.text}</T>
                  </LinearGradient>
                ) : (
                  <View style={[styles.bubble, { backgroundColor: colors.cardStrong, borderBottomLeftRadius: 4 }]}>
                    <T>{m.text}</T>
                  </View>
                )}
                <T t="caption" color={colors.textFaint} style={{ marginTop: 2 }}>{new Date(m.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</T>
              </View>
            );
          })}
        </ScrollView>

        {!isFriend ? (
          <View style={styles.friendBar}>
            {pending?.toId === ME_ID ? (
              <>
                <T t="small" style={{ flex: 1 }}>??? 님이 친구가 되고 싶어해요</T>
                <Button title="수락" size="sm" onPress={() => acceptRequest(pending.id)} />
              </>
            ) : pending ? (
              <T t="small" color={colors.textDim} style={{ flex: 1 }}>친구 요청을 보냈어요. 수락하면 무제한 대화 + 위치 공유</T>
            ) : (
              <>
                <T t="small" style={{ flex: 1 }}>남은 메시지 {limitLeft}통 · 친구가 되면 무제한</T>
                <Button title="친구 요청" size="sm" icon="🤝" onPress={() => sendFriendRequest(other.id)} />
              </>
            )}
          </View>
        ) : null}

        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={limitLeft === 0 ? '친구가 되면 계속 대화할 수 있어요' : '메시지 보내기'}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            editable={limitLeft > 0}
            onSubmitEditing={onSend}
            returnKeyType="send"
          />
          <Button title="전송" size="sm" disabled={!text.trim() || limitLeft === 0} onPress={onSend} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sys: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.card, marginBottom: 8, maxWidth: '90%' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  friendBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: spacing.lg, padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(124,92,255,0.18)', borderWidth: 1, borderColor: 'rgba(124,92,255,0.4)' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingTop: 10 },
  input: { flex: 1, backgroundColor: colors.card, borderRadius: 999, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 16, height: 44, fontSize: 15, fontFamily, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },
});

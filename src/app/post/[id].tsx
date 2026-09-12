import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { PostcardThumb } from '@/components/postcard-thumb';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Header, IconButton, Paper, Pill, Row, Screen, Stamp, T } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { findCity } from '@/data/cities';
import { VEHICLE_MAP } from '@/data/vehicles';
import { formatKm, timeAgo } from '@/engine/geo';
import { BOTS, ME_ID, displayName, isRevealed, useStore } from '@/store';
import { fontFamily, spacing, useColors } from '@/theme';
import { tap } from '@/engine/haptics';

/** 엽서 상세 — 여기서 '그때' 국가가 공개된다. 댓글 가능. */
export default function PostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const revealedIds = useStore((s) => s.revealedIds);
  const post = useStore((s) => s.posts.find((p) => p.id === id));
  const likePost = useStore((s) => s.likePost);
  const commentPost = useStore((s) => s.commentPost);
  const [text, setText] = useState('');
  if (!post) return <Screen><Header title="엽서" /><T style={{ padding: spacing.lg }}>엽서를 찾을 수 없어요</T></Screen>;
  const rev = { me, friendIds, revealedIds };
  const mine = post.authorId === ME_ID;
  const author = mine ? me : BOTS.find((b) => b.id === post.authorId);
  const city = findCity(post.stamp);
  const shown = isRevealed(rev, post.authorId);
  return (
    <Screen>
      <Header title="엽서" subtitle={`${city?.flag ?? '🌍'} ${post.country} · ${post.city} · ${formatKm(post.distanceKm)}`} right={<IconButton name="send" onPress={() => (mine ? router.push('/compose') : router.push({ pathname: '/compose', params: { toId: post.authorId } } as any))} />} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          <Row style={{ padding: spacing.lg, justifyContent: 'space-between' }}>
            <Pressable onPress={() => { tap(); if (!mine) router.push(`/user/${post.authorId}`); }}>
              <Row gap={10}>
                <Avatar anonymous={!shown} emoji={author?.avatar} size={40} ring="ig" />
                <View><T t="bodyStrong">{displayName(rev, post.authorId)}</T><T t="caption" color={c.text2}>{city?.flag} {post.country} · {timeAgo(post.at)}</T></View>
              </Row>
            </Pressable>
            <Pill label={VEHICLE_MAP[post.vehicle].name} />
          </Row>
          {post.imageUri ? <Image source={{ uri: post.imageUri }} style={{ width: '100%', aspectRatio: 4 / 3 }} /> : <PostcardThumb seed={post.id} width={width} height={Math.round(width * 0.56)} />}
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Paper>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <T t="caption" color={c.paperMuted}>POSTCARD · {post.city.toUpperCase()}</T>
                <Stamp flag={city?.flag ?? '📮'} label={post.stamp} />
              </Row>
              <T style={{ color: c.paperText, fontSize: 17, lineHeight: 28, marginTop: 8 }}>{post.text}</T>
            </Paper>
          </View>
          <Row style={{ paddingHorizontal: spacing.lg, paddingTop: 10, gap: 16 }}>
            <IconButton name="heart" color={post.likedByMe ? c.red : c.text} onPress={() => likePost(post.id)} />
            <T t="bodyStrong">좋아요 {post.likes}개</T>
            <View style={{ flex: 1 }} />
            <VehicleIcon id={post.vehicle} size={30} bubble />
          </Row>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: 12, gap: 10 }}>
            <T t="h2">댓글 {post.comments.length}</T>
            {post.comments.map((cm) => (
              <Row key={cm.id} style={{ alignItems: 'flex-start' }} gap={10}>
                <Avatar anonymous={!isRevealed(rev, cm.authorId)} emoji={cm.authorId === ME_ID ? me.avatar : BOTS.find((b) => b.id === cm.authorId)?.avatar} size={30} />
                <View style={{ flex: 1 }}><T t="small"><T t="smallStrong">{displayName(rev, cm.authorId)}</T>  {cm.text}</T><T t="caption" color={c.text3}>{timeAgo(cm.at)}</T></View>
              </Row>
            ))}
            {!mine ? <Button title="이 사람에게 편지 보내기" variant="secondary" size="sm" icon="send" onPress={() => router.push({ pathname: '/compose', params: { toId: post.authorId } } as any)} /> : null}
          </View>
        </ScrollView>
        <Row style={{ paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10), borderTopWidth: 0.5, borderTopColor: c.line }} gap={8}>
          <Avatar emoji={me.avatar} size={32} />
          <TextInput value={text} onChangeText={setText} placeholder="댓글 달기…" placeholderTextColor={c.text3} style={[{ flex: 1, color: c.text, fontFamily, fontSize: 14, height: 40 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]} onSubmitEditing={() => { commentPost(post.id, text); setText(''); }} />
          <Pressable disabled={!text.trim()} onPress={() => { tap(); commentPost(post.id, text); setText(''); }}><T t="bodyStrong" color={text.trim() ? c.blue : c.text3}>게시</T></Pressable>
        </Row>
      </KeyboardAvoidingView>
    </Screen>
  );
}

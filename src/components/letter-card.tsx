import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import type { Letter } from '@/types';
import { VEHICLE_MAP } from '@/data/vehicles';
import { ME_ID, displayName, progressOf, useStore } from '@/store';
import { formatDuration, formatKm, timeAgo } from '@/engine/geo';
import { colors, spacing } from '@/theme';
import { Icon, Pill, ProgressBar, Row, T } from '@/components/ui';
import { STATUS_LABEL } from './letter-helpers';
import { VehicleIcon } from './vehicle-icon';
import { Pressable } from 'react-native';
import { tap } from '@/engine/haptics';

export function LetterCard({ letter, now }: { letter: Letter; now: number }) {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const v = VEHICLE_MAP[letter.vehicle];
  const st = STATUS_LABEL[letter.status];
  const p = progressOf(letter, now);
  const mine = letter.senderId === ME_ID;
  const toMe = letter.recipientId === ME_ID;
  const who = mine ? '나' : displayName({ me, friendIds }, letter.senderId);
  const canRead = mine || letter.caughtBy === ME_ID || toMe;
  const snail = !!letter.penalty && now < letter.penalty.until;
  return (
    <Pressable onPress={() => { tap(); router.push(`/letter/${letter.id}`); }} style={({ pressed }) => ({ backgroundColor: pressed ? colors.bg2 : colors.bg, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.lineSoft })}>
      <Row style={{ alignItems: 'flex-start' }} gap={12}>
        <VehicleIcon id={letter.vehicle} size={44} bubble snail={snail} ring={mine ? colors.pink : undefined} />
        <View style={{ flex: 1, gap: 3 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T t="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{letter.origin.city} <Icon name="arrow-right" size={12} color={colors.text3} /> {letter.destination.city}</T>
            <Pill label={st.label} color={st.bg} textColor={st.color} icon={st.emoji} />
          </Row>
          <T t="small" color={colors.text2}>{who} · {v.name} · {formatKm(letter.distanceKm)}{letter.replyToId ? ' · 답장' : ''}{letter.shield ? ' · 🛡️' : ''}{letter.redirects ? ` · 경로변경 ${letter.redirects}` : ''}</T>
          <T t="small" color={canRead ? colors.text : colors.text3} numberOfLines={1}>{canRead ? `“${letter.text}”` : '잡아야 읽을 수 있어요'}</T>
          {letter.status === 'flying' ? (
            <View style={{ gap: 4, marginTop: 4 }}>
              <ProgressBar value={p} color={mine || toMe ? colors.pink : v.color} />
              <Row style={{ justifyContent: 'space-between' }}>
                <T t="caption" color={colors.text3}>{Math.round(p * 100)}%{snail ? ' · 🐌 느려짐' : ''}</T>
                <T t="caption" color={colors.text3}>{formatDuration(letter.arrivesAt - now)} 후 도착</T>
              </Row>
            </View>
          ) : (
            <T t="caption" color={colors.text3}>{letter.status === 'caught' ? `${letter.catchPlace}에서 ${timeAgo(letter.caughtAt ?? now, now)} 잡힘` : timeAgo(letter.events[letter.events.length - 1]?.at ?? letter.departedAt, now)}</T>
          )}
        </View>
      </Row>
    </Pressable>
  );
}

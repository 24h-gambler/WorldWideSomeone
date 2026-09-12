import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import type { Letter } from '@/types';
import { VEHICLE_MAP } from '@/data/vehicles';
import { ME_ID, displayName, progressOf, useStore } from '@/store';
import { formatDuration, formatKm, timeAgo } from '@/engine/geo';
import { colors, spacing } from '@/theme';
import { Card, Chip, ProgressBar, Row, T } from '@/components/ui';
import { STATUS_LABEL } from './letter-helpers';
import { VehicleIcon } from './vehicle-icon';

export function LetterCard({ letter, now }: { letter: Letter; now: number }) {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const v = VEHICLE_MAP[letter.vehicle];
  const st = STATUS_LABEL[letter.status];
  const p = progressOf(letter, now);
  const mine = letter.senderId === ME_ID;
  const who = mine ? '나' : displayName({ me, friendIds }, letter.senderId);
  return (
    <Card onPress={() => router.push(`/letter/${letter.id}`)} style={{ marginBottom: spacing.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <VehicleIcon id={letter.vehicle} size={26} />
          </View>
          <View>
            <T t="bodyStrong">{letter.origin.city} → {letter.destination.city}</T>
            <T t="small" color={colors.textDim}>{who} · {v.name} · {formatKm(letter.distanceKm)}</T>
          </View>
        </Row>
        <Chip label={`${st.emoji} ${st.label}`} small selected color={st.color} />
      </Row>
      <T t="small" color={colors.textDim} numberOfLines={1} style={{ marginTop: spacing.md }}>
        {mine || letter.caughtBy === ME_ID ? `“${letter.text}”` : '내용은 잡아야 볼 수 있어요'}
      </T>
      {letter.status === 'flying' ? (
        <View style={{ marginTop: spacing.md, gap: 6 }}>
          <ProgressBar value={p} color={mine ? colors.accent : v.color} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T t="caption" color={colors.textFaint}>{Math.round(p * 100)}%</T>
            <T t="caption" color={colors.textFaint}>{formatDuration(letter.arrivesAt - now)} 후 도착</T>
          </Row>
        </View>
      ) : (
        <T t="caption" color={colors.textFaint} style={{ marginTop: spacing.sm }}>
          {letter.status === 'caught' ? `${letter.catchPlace}에서 ${timeAgo(letter.caughtAt ?? now, now)} 잡힘` : timeAgo(letter.events[letter.events.length - 1]?.at ?? letter.departedAt, now)}
        </T>
      )}
    </Card>
  );
}

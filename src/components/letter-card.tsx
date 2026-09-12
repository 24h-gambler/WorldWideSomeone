import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Letter } from '@/types';
import { VEHICLE_MAP } from '@/data/vehicles';
import { ME_ID, displayName, progressOf, useStore } from '@/store';
import { formatDuration, formatKm, timeAgo } from '@/engine/geo';
import { spacing, useColors } from '@/theme';
import { Icon, Pill, ProgressBar, Row, T } from '@/components/ui';
import { kindLabel, statusLabel } from './letter-helpers';
import { VehicleIcon } from './vehicle-icon';
import { ItemIcon } from './item-art';
import { tap } from '@/engine/haptics';

export function LetterCard({ letter, now }: { letter: Letter; now: number }) {
  const router = useRouter();
  const c = useColors();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const revealedIds = useStore((s) => s.revealedIds);
  const v = VEHICLE_MAP[letter.vehicle];
  const st = statusLabel(c)[letter.status];
  const p = progressOf(letter, now);
  const mine = letter.senderId === ME_ID;
  const toMe = letter.recipientId === ME_ID;
  const who = mine ? '나' : displayName({ me, friendIds, revealedIds }, letter.senderId);
  const canRead = mine || letter.caughtBy === ME_ID || toMe || letter.peekedBy.includes(ME_ID);
  const snail = !!letter.penalty && now < letter.penalty.until;
  const sunk = letter.status === 'sunk';
  return (
    <Pressable onPress={() => { tap(); router.push(`/letter/${letter.id}`); }} style={({ pressed }) => ({ backgroundColor: pressed ? c.bg2 : c.bg, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: c.lineSoft })}>
      <Row style={{ alignItems: 'flex-start' }} gap={12}>
        <VehicleIcon id={letter.vehicle} size={46} bubble snail={snail} sunk={sunk} ring={mine ? c.pink : undefined} />
        <View style={{ flex: 1, gap: 3 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T t="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{letter.origin.city} <Icon name="arrow-right" size={12} color={c.text3} /> {mine || toMe || letter.caughtBy === ME_ID ? letter.destination.city : '어딘가'}</T>
            <Pill label={st.label} color={st.bg} textColor={st.color} icon={<ItemIcon id={st.icon} size={12} />} />
          </Row>
          <T t="small" color={c.text2}>{who} · {v.name} · {formatKm(letter.distanceKm)} · {kindLabel(letter)}{letter.shield ? ' · 🛡️' : ''}{letter.redirects ? ` · 경로변경 ${letter.redirects}` : ''}{letter.pulls ? ' · 🧲' : ''}</T>
          <T t="small" color={canRead ? c.text : c.text3} numberOfLines={1}>{canRead ? `“${letter.text}”` : '잡아야 읽을 수 있어요'}</T>
          {letter.status === 'flying' || sunk ? (
            <View style={{ gap: 4, marginTop: 4 }}>
              <ProgressBar value={p} color={sunk ? c.red : mine || toMe ? c.pink : v.color} />
              <Row style={{ justifyContent: 'space-between' }}>
                <T t="caption" color={c.text3}>{Math.round(p * 100)}%{snail ? ' · 🐌 느려짐' : ''}{sunk ? ' · 🌊 정지' : ''}</T>
                <T t="caption" color={c.text3}>{sunk ? `${formatDuration((letter.sunkUntil ?? now) - now)} 뒤 떠오름` : `${v.speedKmh.toLocaleString()} km/h · 남은 ${formatKm(Math.max(0, letter.distanceKm * (1 - p)))}`}</T>
              </Row>
            </View>
          ) : <T t="caption" color={c.text3}>{letter.status === 'caught' ? `${letter.catchPlace}에서 ${timeAgo(letter.caughtAt ?? now, now)} 잡힘` : timeAgo(letter.events[letter.events.length - 1]?.at ?? letter.departedAt, now)}</T>}
        </View>
      </Row>
    </Pressable>
  );
}

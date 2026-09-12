import React from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { AVATARS, FIELDS, GENDERS, HOBBIES, JOBS } from '@/data/profile';
import type { Gender } from '@/types';
import { colors, fontFamily, radius, spacing } from '@/theme';
import { Chip, T } from '@/components/ui';
import { tap } from '@/engine/haptics';
import { Pressable } from 'react-native';

export type ProfileDraft = {
  nickname: string;
  avatar: string;
  bio: string;
  field: string;
  gender: Gender;
  job: string;
  hobbies: string[];
};

export function ProfileForm({ value, onChange }: { value: ProfileDraft; onChange: (v: ProfileDraft) => void }) {
  const set = (patch: Partial<ProfileDraft>) => onChange({ ...value, ...patch });
  return (
    <View style={{ gap: spacing.xl }}>
      <View>
        <T t="small" color={colors.textDim} style={styles.label}>아바타</T>
        <View style={styles.grid}>
          {AVATARS.map((a) => (
            <Pressable
              key={a}
              onPress={() => {
                tap();
                set({ avatar: a });
              }}
              style={[styles.avatarCell, value.avatar === a && styles.avatarSelected]}>
              <T style={{ fontSize: 24 }}>{a}</T>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <T t="small" color={colors.textDim} style={styles.label}>닉네임 (친구에게만 보여요)</T>
        <TextInput
          value={value.nickname}
          onChangeText={(t) => set({ nickname: t.slice(0, 16) })}
          placeholder="예: moonwalker"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
        />
      </View>

      <View>
        <T t="small" color={colors.textDim} style={styles.label}>한 줄 소개</T>
        <TextInput
          value={value.bio}
          onChangeText={(t) => set({ bio: t.slice(0, 60) })}
          placeholder="오늘도 하늘을 봅니다"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
        />
      </View>

      <View>
        <T t="small" color={colors.textDim} style={styles.label}>분야</T>
        <View style={styles.wrap}>
          {FIELDS.map((f) => (
            <Chip key={f} label={f} selected={value.field === f} onPress={() => set({ field: f })} small />
          ))}
        </View>
      </View>

      <View>
        <T t="small" color={colors.textDim} style={styles.label}>성별</T>
        <View style={styles.wrap}>
          {GENDERS.map((g) => (
            <Chip key={g.id} label={g.label} selected={value.gender === g.id} onPress={() => set({ gender: g.id })} small color={colors.accent} />
          ))}
        </View>
      </View>

      <View>
        <T t="small" color={colors.textDim} style={styles.label}>직무</T>
        <View style={styles.wrap}>
          {JOBS.map((j) => (
            <Chip key={j} label={j} selected={value.job === j} onPress={() => set({ job: j })} small color={colors.sky} />
          ))}
        </View>
      </View>

      <View>
        <T t="small" color={colors.textDim} style={styles.label}>취미 (최대 5개)</T>
        <View style={styles.wrap}>
          {HOBBIES.map((h) => {
            const on = value.hobbies.includes(h);
            return (
              <Chip
                key={h}
                label={h}
                selected={on}
                color={colors.mint}
                small
                onPress={() => {
                  if (on) set({ hobbies: value.hobbies.filter((x) => x !== h) });
                  else if (value.hobbies.length < 5) set({ hobbies: [...value.hobbies, h] });
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.sm, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatarCell: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarSelected: { borderColor: colors.accent, backgroundColor: 'rgba(255,92,138,0.18)' },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 14, height: 48, fontSize: 15, fontFamily, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

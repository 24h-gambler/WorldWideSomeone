import React from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AVATARS, FIELDS, GENDERS, HOBBIES, JOBS } from '@/data/profile';
import type { Gender } from '@/types';
import { fontFamily, radius, spacing, useColors, useStyles, type ThemeColors } from '@/theme';
import { Chip, T } from '@/components/ui';
import { tap } from '@/engine/haptics';

export type ProfileDraft = { nickname: string; avatar: string; bio: string; field: string; gender: Gender; job: string; hobbies: string[] };
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {};

export function ProfileForm({ value, onChange }: { value: ProfileDraft; onChange: (v: ProfileDraft) => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const set = (patch: Partial<ProfileDraft>) => onChange({ ...value, ...patch });
  return (
    <View style={{ gap: spacing.xl }}>
      <View>
        <T t="smallStrong" color={colors.text2} style={styles.label}>아바타</T>
        <View style={styles.grid}>
          {AVATARS.map((a) => (
            <Pressable key={a} onPress={() => { tap(); set({ avatar: a }); }} style={[styles.avatarCell, value.avatar === a && styles.avatarSelected]}>
              <T style={{ fontSize: 22 }}>{a}</T>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ gap: spacing.md }}>
        <TextInput value={value.nickname} onChangeText={(t) => set({ nickname: t.slice(0, 16) })} placeholder="닉네임 (친구에게만 보여요)" placeholderTextColor={colors.text3} style={[styles.input, noOutline]} />
        <TextInput value={value.bio} onChangeText={(t) => set({ bio: t.slice(0, 60) })} placeholder="한 줄 소개" placeholderTextColor={colors.text3} style={[styles.input, noOutline]} />
      </View>
      <Group label="분야">{FIELDS.map((f) => <Chip key={f} label={f} small selected={value.field === f} onPress={() => set({ field: f })} />)}</Group>
      <Group label="성별">{GENDERS.map((g) => <Chip key={g.id} label={g.label} small selected={value.gender === g.id} onPress={() => set({ gender: g.id })} />)}</Group>
      <Group label="직무">{JOBS.map((j) => <Chip key={j} label={j} small selected={value.job === j} onPress={() => set({ job: j })} />)}</Group>
      <Group label={`취미 (${value.hobbies.length}/5)`}>
        {HOBBIES.map((h) => {
          const on = value.hobbies.includes(h);
          return <Chip key={h} label={h} small selected={on} color={colors.blue} onPress={() => (on ? set({ hobbies: value.hobbies.filter((x) => x !== h) }) : value.hobbies.length < 5 && set({ hobbies: [...value.hobbies, h] }))} />;
        })}
      </Group>
    </View>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View>
      <T t="smallStrong" color={colors.text2} style={styles.label}>{label}</T>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  label: { marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatarCell: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarSelected: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  input: { backgroundColor: colors.bg2, borderRadius: radius.xs, borderWidth: 1, borderColor: colors.line, color: colors.text, paddingHorizontal: 12, height: 44, fontSize: 14, fontFamily },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

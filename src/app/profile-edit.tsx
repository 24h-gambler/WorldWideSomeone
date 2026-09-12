import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import { ProfileDraft, ProfileForm } from '@/components/profile-form';
import { Button, Header, Screen } from '@/components/ui';
import { useStore } from '@/store';
import { spacing } from '@/theme';
import { pushProfile } from '@/services/sync';

export default function ProfileEdit() {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const update = useStore((s) => s.updateProfile);
  const [draft, setDraft] = useState<ProfileDraft>({ nickname: me.nickname, avatar: me.avatar, bio: me.bio, field: me.field, gender: me.gender, job: me.job, hobbies: me.hobbies });
  const save = () => { update(draft); pushProfile().catch(() => {}); router.back(); };
  return (
    <Screen>
      <Header title="프로필 편집" right={<Button title="완료" size="sm" variant="ghost" disabled={draft.nickname.trim().length < 2} onPress={save} />} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <ProfileForm value={draft} onChange={setDraft} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

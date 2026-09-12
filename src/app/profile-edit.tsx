import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ProfileDraft, ProfileForm } from '@/components/profile-form';
import { Button, Header, Screen } from '@/components/ui';
import { useStore } from '@/store';
import { spacing } from '@/theme';

export default function ProfileEdit() {
  const router = useRouter();
  const me = useStore((s) => s.me);
  const update = useStore((s) => s.updateProfile);
  const [draft, setDraft] = useState<ProfileDraft>({ nickname: me.nickname, avatar: me.avatar, bio: me.bio, field: me.field, gender: me.gender, job: me.job, hobbies: me.hobbies });
  return (
    <Screen>
      <Header title="프로필 수정" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <ProfileForm value={draft} onChange={setDraft} />
        </ScrollView>
        <View style={{ paddingVertical: spacing.lg }}>
          <Button title="저장" size="lg" full disabled={draft.nickname.trim().length < 2} onPress={() => { update(draft); router.back(); }} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

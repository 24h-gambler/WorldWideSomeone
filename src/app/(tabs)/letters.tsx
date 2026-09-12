import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LetterCard } from '@/components/letter-card';
import { Chip, Empty, Header, Row, Screen, T } from '@/components/ui';
import { useNow } from '@/hooks/use-now';
import { ME_ID, useStore } from '@/store';
import { colors, spacing, TAB_BAR_HEIGHT } from '@/theme';

type Tab = 'sent' | 'caught' | 'sky';

export default function Letters() {
  const insets = useSafeAreaInsets();
  const now = useNow(1);
  const letters = useStore((s) => s.letters);
  const [tab, setTab] = useState<Tab>('sent');

  const list = useMemo(() => {
    if (tab === 'sent') return letters.filter((l) => l.senderId === ME_ID);
    if (tab === 'caught') return letters.filter((l) => l.caughtBy === ME_ID);
    return letters.filter((l) => l.senderId !== ME_ID && (l.status === 'flying' || l.status === 'landed')).sort((a, b) => a.arrivesAt - b.arrivesAt);
  }, [letters, tab]);

  const sentCount = letters.filter((l) => l.senderId === ME_ID).length;
  const caughtCount = letters.filter((l) => l.caughtBy === ME_ID).length;

  return (
    <Screen>
      <Header back={false} title="편지" subtitle={`보낸 ${sentCount} · 잡은 ${caughtCount}`} />
      <Row style={{ marginBottom: spacing.md }}>
        <Chip label="보낸 편지" selected={tab === 'sent'} onPress={() => setTab('sent')} color={colors.accent} />
        <Chip label="잡은 편지" selected={tab === 'caught'} onPress={() => setTab('caught')} color={colors.success} />
        <Chip label="하늘 위" selected={tab === 'sky'} onPress={() => setTab('sky')} color={colors.sky} />
      </Row>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}>
        {list.length === 0 ? (
          tab === 'sent' ? (
            <Empty emoji="✈️" title="아직 보낸 편지가 없어요" body="지구 탭에서 첫 편지를 접어 날려보세요" />
          ) : tab === 'caught' ? (
            <Empty emoji="🫳" title="아직 잡은 편지가 없어요" body="머리 위로 편지가 지나가면 알림이 와요" />
          ) : (
            <Empty emoji="🌌" title="하늘이 조용해요" body="곧 누군가의 편지가 날아올 거예요" />
          )
        ) : (
          list.map((l) => <LetterCard key={l.id} letter={l} now={now} />)
        )}
        <View style={{ height: 8 }} />
      </ScrollView>
    </Screen>
  );
}

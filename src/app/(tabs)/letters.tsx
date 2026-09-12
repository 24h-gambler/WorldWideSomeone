import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { LetterCard } from '@/components/letter-card';
import { Avatar, Button, Empty, Header, Row, Screen, T, UnderlineTabs } from '@/components/ui';
import { useNow } from '@/hooks/use-now';
import { ME_ID, getUser, useStore } from '@/store';
import { colors, spacing } from '@/theme';
import { VehicleIcon } from '@/components/vehicle-icon';
import { VEHICLE_MAP } from '@/data/vehicles';

type Tab = 'sent' | 'inbox' | 'caught' | 'sky';

export default function Letters() {
  const router = useRouter();
  const now = useNow(1);
  const letters = useStore((s) => s.letters);
  const me = useStore((s) => s.me);
  const approve = useStore((s) => s.approveReply);
  const decline = useStore((s) => s.declineReply);
  const inbox = useMemo(() => letters.filter((l) => l.recipientId === ME_ID).sort((a, b) => (a.status === 'delivered' ? -1 : 1) - (b.status === 'delivered' ? -1 : 1)), [letters]);
  const pending = inbox.filter((l) => l.status === 'delivered').length;
  const [tab, setTab] = useState<Tab>(pending > 0 ? 'inbox' : 'sent');
  // 답장이 새로 도착하면 답장 탭으로 자동 전환
  useEffect(() => { if (pending > 0) setTab('inbox'); }, [pending]);
  const list = useMemo(() => {
    if (tab === 'sent') return letters.filter((l) => l.senderId === ME_ID);
    if (tab === 'inbox') return inbox;
    if (tab === 'caught') return letters.filter((l) => l.caughtBy === ME_ID);
    return letters.filter((l) => l.senderId !== ME_ID && l.recipientId !== ME_ID && (l.status === 'flying' || l.status === 'landed')).sort((a, b) => a.arrivesAt - b.arrivesAt);
  }, [letters, tab, inbox]);

  return (
    <Screen>
      <Header back={false} title="편지" divider={false} />
      <UnderlineTabs value={tab} onChange={setTab} tabs={[{ key: 'sent', label: '보낸' }, { key: 'inbox', label: pending ? `답장 ${pending}` : '답장' }, { key: 'caught', label: '잡은' }, { key: 'sky', label: '하늘 위' }]} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {tab === 'inbox' && pending > 0 ? (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            {inbox.filter((l) => l.status === 'delivered').map((l) => {
              const u = getUser({ me }, l.senderId);
              return (
                <View key={l.id} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: spacing.lg, gap: 10 }}>
                  <Row gap={10}>
                    <Avatar anonymous size={44} ring="ig" />
                    <View style={{ flex: 1 }}>
                      <T t="bodyStrong">??? · {l.origin.city}</T>
                      <T t="small" color={colors.text2}>{u?.field} · {u?.job} · {u?.hobbies.slice(0, 2).join(', ')}</T>
                    </View>
                    <VehicleIcon id={l.vehicle} size={36} bubble />
                  </Row>
                  <T t="body" numberOfLines={2}>“{l.text}”</T>
                  <T t="small" color={colors.text2}>{l.friendRequest ? '친구 요청이 포함된 답장이에요. 승인하면 지연 없는 실시간 채팅이 시작돼요.' : '답장 편지예요.'}</T>
                  <Row>
                    <Button title="승인하고 채팅 시작" size="sm" style={{ flex: 1 }} onPress={() => { approve(l.id); router.push(`/chat/${l.senderId}`); }} />
                    <Button title="읽기" size="sm" variant="secondary" onPress={() => router.push(`/letter/${l.id}`)} />
                    <Button title="거절" size="sm" variant="ghost" onPress={() => decline(l.id)} />
                  </Row>
                </View>
              );
            })}
          </View>
        ) : null}
        {list.length === 0 ? (
          tab === 'sent' ? <Empty icon="send" title="아직 보낸 편지가 없어요" body={`지금은 ${VEHICLE_MAP.walk.emoji} 걷는 배달원이 편지를 들고 가요. 친구가 늘면 빨라져요.`} action={<Button title="첫 편지 쓰기" onPress={() => router.push('/compose')} />} />
          : tab === 'inbox' ? <Empty icon="inbox" title="받은 답장이 없어요" body="내 편지를 잡은 사람이 답장을 보내면 여기에 도착해요. 승인하면 채팅이 열려요." />
          : tab === 'caught' ? <Empty icon="download" title="아직 잡은 편지가 없어요" body="머리 위로 편지가 지나가면 알림이 와요" />
          : <Empty icon="cloud" title="하늘이 조용해요" body="곧 누군가의 편지가 날아올 거예요" />
        ) : (
          list.filter((l) => !(tab === 'inbox' && l.status === 'delivered')).map((l) => <LetterCard key={l.id} letter={l} now={now} />)
        )}
      </ScrollView>
    </Screen>
  );
}

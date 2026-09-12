import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { LetterCard } from '@/components/letter-card';
import { Avatar, Button, Empty, Header, Row, Screen, T, UnderlineTabs } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { useNow } from '@/hooks/use-now';
import { ME_ID, getUser, useStore } from '@/store';
import { spacing, useColors } from '@/theme';
import { VEHICLE_MAP } from '@/data/vehicles';

type Tab = 'sent' | 'inbox' | 'caught' | 'sky';

export default function Letters() {
  const router = useRouter();
  const c = useColors();
  const now = useNow(1);
  const letters = useStore((s) => s.letters);
  const me = useStore((s) => s.me);
  const acceptReply = useStore((s) => s.acceptReply);
  const confirmAccept = useStore((s) => s.confirmAccept);
  const decline = useStore((s) => s.declineLetter);
  const inbox = useMemo(() => letters.filter((l) => l.recipientId === ME_ID).sort((a, b) => (a.status === 'delivered' ? -1 : 1) - (b.status === 'delivered' ? -1 : 1)), [letters]);
  const pending = inbox.filter((l) => l.status === 'delivered').length;
  const [tab, setTab] = useState<Tab>(pending > 0 ? 'inbox' : 'sent');
  useEffect(() => { if (pending > 0) setTab('inbox'); }, [pending]);
  const list = useMemo(() => {
    if (tab === 'sent') return letters.filter((l) => l.senderId === ME_ID);
    if (tab === 'inbox') return inbox;
    if (tab === 'caught') return letters.filter((l) => l.caughtBy === ME_ID);
    return letters.filter((l) => l.senderId !== ME_ID && l.recipientId !== ME_ID && (l.status === 'flying' || l.status === 'landed' || l.status === 'sunk')).sort((a, b) => a.arrivesAt - b.arrivesAt);
  }, [letters, tab, inbox]);

  return (
    <Screen>
      <Header back={false} title="편지" divider={false} />
      <UnderlineTabs value={tab} onChange={setTab} tabs={[{ key: 'sent', label: '보낸' }, { key: 'inbox', label: pending ? `우편함 ${pending}` : '우편함' }, { key: 'caught', label: '잡은' }, { key: 'sky', label: '하늘 위' }]} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {tab === 'inbox' && pending > 0 ? (
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            {inbox.filter((l) => l.status === 'delivered').map((l) => {
              const u = getUser({ me }, l.senderId);
              const isAccept = l.kind === 'accept';
              return (
                <View key={l.id} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: spacing.lg, gap: 10, backgroundColor: c.bg }}>
                  <Row gap={10}>
                    <Avatar emoji={u?.avatar} size={44} ring="ig" />
                    <View style={{ flex: 1 }}>
                      <T t="bodyStrong">{u?.nickname} <T t="small" color={c.text2}>· {l.origin.city}</T></T>
                      <T t="small" color={c.text2}>{u?.bio || `${u?.field} · ${u?.job}`}</T>
                    </View>
                    <VehicleIcon id={l.vehicle} size={38} bubble />
                  </Row>
                  <T t="body" numberOfLines={2}>“{l.text}”</T>
                  <T t="small" color={c.text2}>{isAccept ? '왕복이 끝났어요. 확정하면 친구가 되고 지연 없는 실시간 채팅이 시작돼요.' : '답장이 도착했어요. 프로필을 보고 수락하면 수락 편지가 상대에게 출발하고, 상대가 확정하면 친구가 돼요.'}</T>
                  <Row>
                    {isAccept
                      ? <Button title="확정하고 채팅 시작" size="sm" style={{ flex: 1 }} onPress={() => { confirmAccept(l.id); router.push(`/chat/${l.senderId}`); }} />
                      : <Button title="수락 · 수락 편지 보내기" size="sm" style={{ flex: 1 }} onPress={() => { acceptReply(l.id); router.push('/'); }} />}
                    <Button title="프로필" size="sm" variant="secondary" onPress={() => router.push(`/user/${l.senderId}`)} />
                    <Button title="거절" size="sm" variant="ghost" onPress={() => decline(l.id)} />
                  </Row>
                </View>
              );
            })}
          </View>
        ) : null}
        {list.length === 0 ? (
          tab === 'sent' ? <Empty icon="send" title="아직 보낸 편지가 없어요" body={`지금은 ${VEHICLE_MAP.walk.name}이 편지를 들고 가요. 친구가 늘면 빨라져요.`} action={<Button title="첫 편지 쓰기" onPress={() => router.push('/compose')} />} />
          : tab === 'inbox' ? <Empty icon="inbox" title="우편함이 비어 있어요" body="내 편지에 온 답장과 수락 편지가 여기에 도착해요." />
          : tab === 'caught' ? <Empty icon="download" title="아직 잡은 편지가 없어요" body="머리 위로 편지가 지나가면 알림이 와요" />
          : <Empty icon="cloud" title="하늘이 조용해요" body="곧 누군가의 편지가 날아올 거예요" />
        ) : list.filter((l) => !(tab === 'inbox' && l.status === 'delivered')).map((l) => <LetterCard key={l.id} letter={l} now={now} />)}
      </ScrollView>
    </Screen>
  );
}

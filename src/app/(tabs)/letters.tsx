/**
 * 편지 탭 — 보낸 · 우편함(오는 답장: 속도·거리만, 도착한 답장: 수락) · 잡은 · 하늘 위
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { LetterCard } from '@/components/letter-card';
import { Avatar, Button, Empty, Header, Row, Screen, T, TrackedScrollView, UnderlineTabs } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { VEHICLE_MAP } from '@/data/vehicles';
import { REPLY_BOOST, discounted } from '@/data/plans';
import { formatKm } from '@/engine/geo';
import { useNow } from '@/hooks/use-now';
import { ME_ID, getUser, incomingStatus, selectPendingInbox, useStore } from '@/store';
import { spacing, useColors } from '@/theme';
import { success, warn } from '@/engine/haptics';

type Tab = 'sent' | 'inbox' | 'caught' | 'sky';

export default function Letters() {
  const router = useRouter();
  const c = useColors();
  const now = useNow(1);
  const letters = useStore((s) => s.letters);
  const me = useStore((s) => s.me);
  const settings = useStore((s) => s.settings);
  const approve = useStore((s) => s.approveReply);
  const decline = useStore((s) => s.declineLetter);
  const boost = useStore((s) => s.boostReply);
  const pending = useStore(selectPendingInbox);
  const incomingCount = useStore((s) => s.letters.filter((l) => l.recipientId === ME_ID && l.status === 'flying').length);
  const [tab, setTab] = useState<Tab>(pending > 0 || incomingCount > 0 ? 'inbox' : 'sent');
  const [msg, setMsg] = useState<string | null>(null);
  // 답장이 오는 중이거나 도착하면 우편함으로 (사용자가 다른 탭을 보는 중이어도 새 소식일 때만)
  useEffect(() => { if (pending > 0 || incomingCount > 0) setTab('inbox'); }, [pending, incomingCount]);

  const sent = useMemo(() => letters.filter((l) => l.senderId === ME_ID), [letters]);
  const delivered = useMemo(() => letters.filter((l) => l.recipientId === ME_ID && l.status === 'delivered'), [letters]);
  const incoming = useMemo(() => letters.filter((l) => l.recipientId === ME_ID && l.status === 'flying'), [letters]);
  const inboxDone = useMemo(() => letters.filter((l) => l.recipientId === ME_ID && (l.status === 'approved' || l.status === 'declined')), [letters]);
  const caught = useMemo(() => letters.filter((l) => l.caughtBy === ME_ID), [letters]);
  const sky = useMemo(() => letters.filter((l) => l.status === 'flying' && l.senderId !== ME_ID && !l.recipientId), [letters]);
  const list = tab === 'sent' ? sent : tab === 'inbox' ? inboxDone : tab === 'caught' ? caught : sky;
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2500); };
  const doBoost = (id: string, tier: 'fast' | 'instant') => { const r = boost(id, tier); if (r === 'nofunds') { warn(); flash('코인이 부족해요'); router.push('/store'); } else if (r === 'limit') { warn(); flash('이미 가속했어요'); } else { success(); flash(tier === 'instant' ? '1분 안에 도착해요' : '4배 빨라졌어요'); } };

  return (
    <Screen>
      <Header back={false} title="편지" divider={false} />
      <UnderlineTabs value={tab} onChange={setTab} tabs={[{ key: 'sent', label: '보낸' }, { key: 'inbox', label: pending + incoming.length ? `우편함 ${pending + incoming.length}` : '우편함' }, { key: 'caught', label: '잡은' }, { key: 'sky', label: '하늘 위' }]} />
      <TrackedScrollView id={`letters-${tab}`} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {msg ? <T t="small" color={c.blue} style={{ padding: spacing.lg, paddingBottom: 0 }}>{msg}</T> : null}
        {tab === 'inbox' && incoming.length ? (
          <View style={{ padding: spacing.lg, gap: 12 }}>
            <T t="smallStrong" color={c.text2}>오는 중 · 도착 시간은 알 수 없어요. 지금 어디쯤인지만.</T>
            {incoming.map((l) => {
              const u = getUser({ me }, l.senderId);
              const st = incomingStatus(l, me.location, now, settings.timeScale);
              const fast = discounted(REPLY_BOOST.fast.coins, me.plan); const inst = discounted(REPLY_BOOST.instant.coins, me.plan);
              return (
                <View key={l.id} style={{ borderRadius: 16, padding: spacing.lg, gap: 8, borderWidth: 1, borderColor: c.lineSoft, backgroundColor: c.bg2 }}>
                  <Row gap={10}>
                    <Avatar emoji={u?.avatar} size={44} ring="ig" />
                    <View style={{ flex: 1 }}>
                      <T t="bodyStrong">{u?.nickname} <T t="small" color={c.text2}>· {l.origin.city}</T></T>
                      <T t="small" color={c.text2} numberOfLines={1}>{u?.bio || `${u?.field} · ${u?.job}`}</T>
                    </View>
                    <VehicleIcon id={l.vehicle} size={40} bubble snail={!!l.penalty && now < l.penalty.until} />
                  </Row>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T t="small">{VEHICLE_MAP[l.vehicle].name} · <T t="smallStrong">{st.speedKmh.toLocaleString()} km/h</T></T>
                    <T t="small">나와 <T t="smallStrong">{formatKm(st.distanceKm)}</T></T>
                  </Row>
                  <T t="caption" color={c.text3}>{l.kind === 'reply' ? '답장이 오는 중 · 도착하면 프로필을 보고 수락' : '직행 편지가 오는 중'} · 프로필은 도착 후 열려요</T>
                  {l.boost !== 'instant' ? <Row>{l.boost !== 'fast' ? <Button title={`4배 빠르게 · ${fast} SC`} size="sm" variant="secondary" style={{ flex: 1 }} onPress={() => doBoost(l.id, 'fast')} track="letters:boost:fast" /> : null}<Button title={`1분 안에 · ${inst} SC`} size="sm" variant="gradient" style={{ flex: 1 }} onPress={() => doBoost(l.id, 'instant')} track="letters:boost:instant" /></Row> : <T t="caption" color={c.blue}>⚡ 가속 중</T>}
                </View>
              );
            })}
          </View>
        ) : null}
        {tab === 'inbox' && delivered.length ? (
          <View style={{ padding: spacing.lg, paddingTop: incoming.length ? 0 : spacing.lg, gap: 12 }}>
            {delivered.map((l) => {
              const u = getUser({ me }, l.senderId);
              const isReply = l.kind === 'reply';
              return (
                <View key={l.id} style={{ borderRadius: 16, padding: spacing.lg, gap: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.bg }}>
                  <Row gap={10}>
                    <Avatar emoji={u?.avatar} size={44} ring="ig" />
                    <View style={{ flex: 1 }}>
                      <T t="bodyStrong">{u?.nickname} <T t="small" color={c.text2}>· {l.origin.city}</T></T>
                      <T t="small" color={c.text2}>{u?.bio || `${u?.field} · ${u?.job}`}</T>
                    </View>
                    <VehicleIcon id={l.vehicle} size={38} bubble />
                  </Row>
                  <T t="body" numberOfLines={2}>“{l.text}”</T>
                  <T t="small" color={c.text2}>{isReply ? '왕복이 끝났어요. 프로필을 보고 수락하면 친구가 되고 지연 없는 실시간 채팅이 시작돼요.' : '누군가 나에게 직접 보낸 편지예요. 읽고 답장하면 왕복이 시작돼요.'}</T>
                  <Row>
                    {isReply
                      ? <Button title="수락하고 채팅 시작" size="sm" style={{ flex: 1 }} onPress={() => { approve(l.id); success(); router.push(`/chat/${l.senderId}`); }} track="letters:approve" />
                      : <Button title="읽고 답장하기" size="sm" style={{ flex: 1 }} onPress={() => router.push(`/letter/${l.id}`)} track="letters:read-direct" />}
                    <Button title="프로필" size="sm" variant="secondary" onPress={() => router.push(`/user/${l.senderId}`)} track="letters:profile" />
                    {isReply ? <Button title="거절" size="sm" variant="ghost" onPress={() => decline(l.id)} track="letters:decline" /> : null}
                  </Row>
                </View>
              );
            })}
          </View>
        ) : null}
        {list.length === 0 && !(tab === 'inbox' && (incoming.length || delivered.length)) ? (
          tab === 'sent' ? <Empty icon="send" title="아직 보낸 편지가 없어요" body={`지금은 ${VEHICLE_MAP.walk.name}이 편지를 들고 가요. 친구가 늘면 빨라져요.`} action={<Button title="첫 편지 쓰기" onPress={() => router.push('/compose')} track="letters:empty:compose" />} />
          : tab === 'inbox' ? <Empty icon="inbox" title="우편함이 비어 있어요" body="내 편지에 온 답장과 직행 편지가 여기에 도착해요." />
          : tab === 'caught' ? <Empty icon="download" title="아직 잡은 편지가 없어요" body="머리 위로 편지가 지나가면 알림이 와요" />
          : <Empty icon="wind" title="하늘이 조용해요" body="곧 누군가의 편지가 날아올 거예요" />
        ) : (
          <View style={{ paddingTop: 4 }}>{list.map((l) => <LetterCard key={l.id} letter={l} now={now} />)}</View>
        )}
      </TrackedScrollView>
    </Screen>
  );
}

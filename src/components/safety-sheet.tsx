/**
 * 신고 · 차단 시트 — 사용자·편지·엽서·댓글·채팅 어디서든 같은 시트를 연다.
 * 스토어 심사(App Store 1.2 · Google Play UGC 정책) 필수 요건: 부적절한 콘텐츠 신고 + 사용자 차단.
 * 신고는 서버 reports 테이블에 쌓이고 24시간 안에 검토한다(개인정보처리방침과 같은 문구).
 */
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, Row, T } from '@/components/ui';
import { ME_ID, NO_IDS, useStore, type ReportKind, type ReportReason } from '@/store';
import { radius, spacing, useColors } from '@/theme';
import { success } from '@/engine/haptics';

export type SafetyTarget = { userId: string; kind: ReportKind; targetId?: string; label?: string };

const REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: '스팸 · 광고' },
  { key: 'harassment', label: '욕설 · 괴롭힘 · 혐오' },
  { key: 'sexual', label: '성적인 콘텐츠' },
  { key: 'violence', label: '폭력 · 위험한 행동' },
  { key: 'scam', label: '사기 · 사칭' },
  { key: 'underage', label: '미성년자 안전 문제' },
  { key: 'other', label: '기타' },
];

const KIND_LABEL: Record<ReportKind, string> = { user: '사용자', letter: '편지', post: '엽서', comment: '댓글', message: '메시지' };

type Step = 'menu' | 'reasons' | 'done';

export function SafetySheet({ target, onClose, onBlocked }: { target: SafetyTarget | null; onClose: () => void; onBlocked?: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const blockedIds = (useStore((s) => s.blockedIds) ?? NO_IDS);
  const blockUser = useStore((s) => s.blockUser);
  const unblockUser = useStore((s) => s.unblockUser);
  const reportContent = useStore((s) => s.reportContent);
  const [step, setStep] = useState<Step>('menu');
  const [blockedNow, setBlockedNow] = useState(false);

  const close = useCallback(() => { setStep('menu'); setBlockedNow(false); onClose(); }, [onClose]);
  if (!target || target.userId === ME_ID) return null;
  const isBlocked = blockedIds.includes(target.userId);
  const what = KIND_LABEL[target.kind];

  const doBlock = () => { blockUser(target.userId); setBlockedNow(true); success(); onBlocked?.(); };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={close} testID="safety:backdrop">
        <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: c.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16), maxHeight: '80%' }}>
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.line, marginBottom: 8 }} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 4 }}>
            {step === 'menu' ? (
              <>
                <T t="h2" style={{ marginBottom: 6 }}>{target.label ?? what}</T>
                <SheetRow icon="flag" label={`${what} 신고하기`} sub="운영팀이 24시간 안에 검토해요. 상대에게는 알리지 않아요." danger onPress={() => setStep('reasons')} testID="safety:report" />
                {isBlocked ? (
                  <SheetRow icon="user-check" label="차단 해제" sub="이 사람의 편지·엽서·댓글이 다시 보여요." onPress={() => { unblockUser(target.userId); close(); }} testID="safety:unblock" />
                ) : (
                  <SheetRow icon="slash" label="이 사용자 차단하기" sub="서로 채팅할 수 없고, 이 사람의 편지·엽서·댓글이 더 이상 보이지 않아요." danger onPress={() => { doBlock(); setStep('done'); }} testID="safety:block" />
                )}
                <Button title="닫기" variant="secondary" onPress={close} style={{ marginTop: 10 }} />
              </>
            ) : step === 'reasons' ? (
              <>
                <T t="h2" style={{ marginBottom: 2 }}>신고 사유</T>
                <T t="small" color={c.text2} style={{ marginBottom: 6 }}>가장 가까운 사유를 골라 주세요.</T>
                {REASONS.map((r) => (
                  <SheetRow key={r.key} label={r.label} onPress={() => { reportContent({ targetUserId: target.userId, kind: target.kind, targetId: target.targetId, reason: r.key }); success(); setStep('done'); }} testID={`safety:reason:${r.key}`} />
                ))}
                <Button title="뒤로" variant="secondary" onPress={() => setStep('menu')} style={{ marginTop: 10 }} />
              </>
            ) : (
              <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
                <Icon name="check-circle" size={40} color={c.green} />
                <T t="title" style={{ textAlign: 'center' }}>{blockedNow ? '차단했어요' : '신고가 접수됐어요'}</T>
                <T t="body" color={c.text2} style={{ textAlign: 'center' }}>{blockedNow ? '이제 이 사람의 편지·엽서·댓글이 보이지 않고 채팅도 막혀요. 설정 → 차단한 사용자에서 언제든 해제할 수 있어요.' : '운영팀이 24시간 안에 검토하고, 정책 위반이면 콘텐츠 삭제·이용 제한을 해요.'}</T>
                {!blockedNow && !isBlocked ? <Button title="이 사용자도 차단하기" variant="secondary" icon="slash" onPress={doBlock} full testID="safety:block-after-report" /> : null}
                <Button title="확인" onPress={close} full />
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetRow({ icon, label, sub, danger, onPress, testID }: { icon?: React.ComponentProps<typeof Icon>['name']; label: string; sub?: string; danger?: boolean; onPress: () => void; testID?: string }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} testID={testID} style={({ pressed }) => ({ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: c.lineSoft, opacity: pressed ? 0.6 : 1 })}>
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        {icon ? <Icon name={icon} size={20} color={danger ? c.red : c.text} /> : null}
        <View style={{ flex: 1 }}>
          <T t="bodyStrong" color={danger ? c.red : c.text}>{label}</T>
          {sub ? <T t="small" color={c.text2}>{sub}</T> : null}
        </View>
      </Row>
    </Pressable>
  );
}

/** 화면에서 쓰기: const safety = useSafety(); … safety.open({ userId, kind: 'post', targetId }) … {safety.sheet} */
export function useSafety(onBlocked?: () => void) {
  const [target, setTarget] = useState<SafetyTarget | null>(null);
  const open = useCallback((t: SafetyTarget) => setTarget(t), []);
  const sheet = <SafetySheet target={target} onClose={() => setTarget(null)} onBlocked={onBlocked} />;
  return { open, sheet };
}

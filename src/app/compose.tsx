import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { LocationPicker } from '@/components/location-picker';
import { Button, Chip, Header, Icon, Paper, Pill, Row, Screen, Stamp, T } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { Globe } from '@/components/globe/Globe';
import { FIELDS, GENDERS, HOBBIES, JOBS } from '@/data/profile';
import { FAMILIES, FAMILY_LABEL, VEHICLES, VEHICLE_MAP, bestVehicle, vehicleUnlocked, type Family } from '@/data/vehicles';
import { ITEM_MAP, PLAN_MAP, discounted, rentalCoins } from '@/data/plans';
import { useGate } from '@/hooks/use-gate';
import { findCity } from '@/data/cities';
import { describePlace, formatKm, fuzz50km } from '@/engine/geo';
import { buildRoute, contactChance, planFlight } from '@/engine/sim';
import { BOTS, ME_ID, getUser, matchesTarget, useStore } from '@/store';
import type { Gender, LatLng, Place, TargetFilter, VehicleId } from '@/types';
import { fontFamily, radius, spacing, useColors } from '@/theme';
import { success, warn } from '@/engine/haptics';

type DestMode = 'random' | 'pick' | 'route';
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {};

export default function Compose() {
  const router = useRouter();
  const c = useColors();
  const params = useLocalSearchParams<{ toId?: string; field?: string; job?: string; hobby?: string; gender?: string; replyTo?: string; direct?: string }>();
  const gate = useGate();
  const { width } = useWindowDimensions();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const letters = useStore((s) => s.letters);
  const settings = useStore((s) => s.settings);
  const sendLetter = useStore((s) => s.sendLetter);
  const plan = PLAN_MAP[me.plan];
  const replyTo = params.replyTo ? letters.find((l) => l.id === params.replyTo) : undefined;
  const replyUser = replyTo ? getUser({ me }, replyTo.senderId) : undefined;
  const toUser = params.toId ? BOTS.find((b) => b.id === params.toId) : undefined;
  const isReply = !!replyTo && !!replyUser;
  const isDirect = !!toUser && params.direct === '1';

  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [destMode, setDestMode] = useState<DestMode>(toUser ? 'pick' : 'random');
  const [dest, setDest] = useState<Place | null>(isReply ? replyUser!.location : toUser ? (params.direct === '1' ? toUser.location : describePlace(fuzz50km(toUser.location))) : null);
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [vehicle, setVehicle] = useState<VehicleId>('walk');
  const [family, setFamily] = useState<Family>('human');
  const [target, setTarget] = useState<TargetFilter>({ field: params.field, job: params.job, hobby: params.hobby, gender: params.gender as Gender | undefined });
  const [useShield, setUseShield] = useState(me.inventory.shield > 0);
  const [isPublic, setIsPublic] = useState(false);
  const [shareToStory, setShareToStory] = useState(true);
  const [friendRequest, setFriendRequest] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const fly = useRef(new Animated.Value(0)).current;

  useEffect(() => { const b = bestVehicle(friendIds.length, me.inventory, me.plan); setVehicle(b); setFamily(VEHICLE_MAP[b].family); }, [friendIds.length, me.inventory, me.plan]);

  const previewDest = dest ?? { lat: 35.6762, lng: 139.6503, city: '랜덤', country: '' };
  const wps = destMode === 'route' ? waypoints : [];
  const flight = useMemo(() => planFlight(me.location, previewDest, wps, vehicle, settings.timeScale), [me.location, previewDest, wps, vehicle, settings.timeScale]);
  const chance = useMemo(() => contactChance(buildRoute(me.location, previewDest, wps, vehicle), BOTS.map((b) => ({ location: b.location, match: matchesTarget(b, target) })), vehicle, plan.contactBoost), [me.location, previewDest, wps, vehicle, target, plan.contactBoost]);
  const matching = BOTS.filter((b) => matchesTarget(b, target)).length;
  const hasTarget = !!(target.field || target.job || target.hobby || target.gender);
  const vehicleObj = VEHICLE_MAP[vehicle];
  const stamp = findCity(me.location.city);
  const canNext = step === 0 ? text.trim().length >= 2 : step === 1 ? isDirect || isReply || destMode === 'random' || !!dest : true;

  const pickImage = async () => { try { const ImagePicker = await import('expo-image-picker'); const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [4, 3] }); if (!res.canceled && res.assets[0]) setImageUri(res.assets[0].uri); } catch { /* ignore */ } };
  const rentPrice = !vehicleUnlocked(vehicleObj, friendIds.length, me.inventory, me.plan) ? discounted(rentalCoins(vehicleObj.speedKmh), me.plan) : 0;
  const launch = () => gate('send', () => {
    setError(null);
    const res = sendLetter({ text: text.trim(), imageUri, destination: destMode === 'random' && !isReply && !isDirect ? undefined : dest ?? undefined, waypoints: wps, vehicle, target: isReply || isDirect ? {} : target, useShield, isPublic: isReply || isDirect ? false : isPublic, shareToStory: isPublic && shareToStory, replyToId: isReply ? replyTo!.id : undefined, recipientId: isReply ? replyTo!.senderId : isDirect ? toUser!.id : undefined, friendRequest: isReply ? friendRequest : undefined, kind: isReply ? 'reply' : 'letter', direct: isDirect || undefined, rent: rentPrice > 0 || undefined });
    if ('error' in res) { warn(); setError(res.error); return; }
    setLaunching(true); success();
    Animated.timing(fly, { toValue: 1, duration: 1300, useNativeDriver: Platform.OS !== 'web' }).start(() => router.replace('/'));
  });

  if (launching) return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, -420] }) }, { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }) }, { scale: fly.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1.3, 0.4] }) }], opacity: fly.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }) }}><VehicleIcon id={vehicle} size={130} bubble /></Animated.View>
      <T t="title" style={{ marginTop: spacing.xl }}>출발!</T>
      <T t="body" color={c.text2}>{me.location.city} → {destMode === 'random' && !isReply && !isDirect ? '어딘가' : dest?.city} · {formatKm(flight.distanceKm)} · {vehicleObj.speedKmh.toLocaleString()} km/h</T>
    </Screen>
  );

  const stepTitles = isReply ? ['답장 쓰기', '배달원', '확인'] : isDirect ? ['내용', '받는 사람', '배달원'] : ['내용', '목적지', '배달원 · 조건'];
  const VehiclePicker = (
    <View>
      <T t="bodyStrong" style={{ marginBottom: 8 }}>배달원 <T t="small" color={c.text2}>· 친구 수로 해금 · 느린 것부터 빠른 것까지{isReply ? ' · 답장은 자전거 이상으로 가요' : ''}</T></T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>{FAMILIES.map((f) => <Chip key={f} label={FAMILY_LABEL[f]} small selected={family === f} onPress={() => setFamily(f)} />)}</ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {VEHICLES.filter((v) => v.family === family).map((v) => { const ok = vehicleUnlocked(v, friendIds.length, me.inventory, me.plan); const on = vehicle === v.id; return (
          <Pressable key={v.id} testID={`vehicle:${v.id}`} onPress={() => (ok || (v.premiumItem !== 'event' && !v.premiumItem) ? setVehicle(v.id) : router.push('/store'))} style={[styles.vehicle, { backgroundColor: c.bg, borderColor: c.line }, on && { borderColor: c.blue, backgroundColor: c.blueSoft }, !ok && !on && { opacity: 0.6 }]}>
            <VehicleIcon id={v.id} size={52} bubble />
            <T t="smallStrong" style={{ marginTop: 6 }} numberOfLines={1}>{v.name}</T>
            <T t="caption" color={c.text2}>{v.speedKmh.toLocaleString()} km/h</T>
            {!ok ? <T t="caption" color={c.orange}>{v.premiumItem === 'event' ? '이벤트' : v.premiumItem === 'dragon' ? '프로 / 친구 80' : v.premiumItem ? '상점' : `친구 ${v.unlockFriends} · 대여 ${discounted(rentalCoins(v.speedKmh), me.plan)} SC`}</T> : v.trait ? <T t="caption" color={c.green}>{v.trait}</T> : null}
          </Pressable>
        ); })}
      </ScrollView>
      <T t="small" color={c.text2} style={{ marginTop: 8 }}>{vehicleObj.desc}</T>
      {rentPrice > 0 ? <View style={[styles.box, { backgroundColor: c.yellowSoft, borderColor: c.yellowSoft, marginTop: 8 }]}><T t="smallStrong" color={c.yellowText}>🎟️ 이 편지에만 {vehicleObj.name} 대여 · {rentPrice} SC (보유 {me.coins})</T><T t="caption" color={c.text2}>친구 {vehicleObj.unlockFriends}명이 되면 영구 해금. 플러스/프로는 대여 할인.</T></View> : null}
    </View>
  );
  const ShieldBox = (
    <View style={[styles.box, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}>
      <Row style={{ justifyContent: 'space-between' }}><T t="bodyStrong">🛡️ 방어권 {vehicleObj.builtInShield ? '(내장)' : me.inventory.shield > 0 ? `(보유 ${me.inventory.shield})` : '(없음)'}</T>{vehicleObj.builtInShield ? <Pill label="내장" color={c.greenSoft} textColor={c.green} /> : me.inventory.shield > 0 ? <Switch value={useShield} onValueChange={setUseShield} trackColor={{ true: c.blue }} /> : <Button title="얻기" size="sm" variant="gradient" onPress={() => router.push('/store')} />}</Row>
      <T t="small" color={c.text2}>경로 변경 · 끌어오기 · 달팽이 · 침수 · 우주 장난을 1회 튕겨내요. 친구 5명마다 1개 또는 상점.</T>
    </View>
  );

  return (
    <Screen>
      <Header title={isReply ? '답장 편지' : '새 편지'} subtitle={`${step + 1}/3 · ${stepTitles[step]}`} left={<Pressable hitSlop={10} onPress={() => (step > 0 ? setStep(step - 1) : router.back())}><T t="body">{step > 0 ? '이전' : '취소'}</T></Pressable>} right={step < 2 ? <Pressable hitSlop={10} disabled={!canNext} onPress={() => setStep(step + 1)}><T t="bodyStrong" color={canNext ? c.blue : c.text3}>다음</T></Pressable> : <Pressable hitSlop={10} onPress={launch}><T t="bodyStrong" color={c.blue}>보내기</T></Pressable>} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {error ? <View style={[styles.error, { backgroundColor: c.redSoft }]}><Icon name="alert-circle" size={16} color={c.red} /><T t="small" color={c.red} style={{ flex: 1 }}>{error}</T><Button title="플랜" size="sm" variant="ghost" onPress={() => router.push('/store')} /></View> : null}
          {step === 0 && (
            <View style={{ gap: spacing.md }}>
              {isReply ? <View style={[styles.box, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}><T t="smallStrong" color={c.text2}>답장 대상 · {replyUser!.nickname} ({replyUser!.location.city})</T><T t="small" color={c.text2} numberOfLines={2}>“{replyTo!.text}”</T><T t="caption" color={c.text3}>답장은 상대에게 직행해요. 상대가 수락하면 친구.</T></View>
                : isDirect ? <View style={[styles.box, { backgroundColor: c.blueSoft, borderColor: c.blueSoft }]}><T t="smallStrong">⚡ 직행 편지 · ??? · {formatKm(flight.distanceKm)}</T><T t="caption" color={c.text2}>이 사람에게 무조건 도착해요(통과·장난 없음). 답장은 상대의 마음 · {ITEM_MAP.direct1.coins} SC 또는 보유권/월 한도</T></View>
                : toUser ? <View style={[styles.box, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}><T t="smallStrong">??? · {formatKm(flight.distanceKm)} 떨어진 곳 · {toUser.field} · {toUser.job}</T><T t="caption" color={c.text3}>커뮤니티에서 고른 사람 근처(50km)로 날아가고 조건이 자동 설정됐어요</T></View> : null}
              <Paper>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><T t="caption" color={c.paperMuted}>FROM {me.location.city.toUpperCase()} · {new Date().toLocaleDateString('ko-KR')}</T><Stamp flag={stamp?.flag ?? '📮'} label={me.location.city} /></Row>
                <TextInput value={text} onChangeText={(t) => setText(t.slice(0, 500))} multiline placeholder={isReply ? '편지 잘 받았어요…' : '지금 이 편지를 읽는 당신에게…'} placeholderTextColor={c.paperMuted} style={[styles.paperInput, { color: c.paperText }, noOutline]} textAlignVertical="top" />
                {imageUri ? <Pressable onPress={() => setImageUri(undefined)}><Image source={{ uri: imageUri }} style={{ width: '100%', height: 180, borderRadius: 8, marginTop: 8 }} /><T t="caption" color={c.paperMuted}>탭하면 삭제</T></Pressable> : null}
                <Row style={{ justifyContent: 'space-between', marginTop: 6 }}><Pressable onPress={pickImage} style={[styles.paperBtn, { backgroundColor: c.stampBg }]}><Icon name="image" size={16} color={c.paperText} /><T t="smallStrong" color={c.paperText}>{imageUri ? '사진 바꾸기' : '사진'}</T></Pressable><T t="caption" color={c.paperMuted}>{text.length}/500</T></Row>
              </Paper>
              <T t="small" color={c.text2}>잡은 사람에게는 내 프로필(아바타·닉네임·소개·엽서)이 보여요. 커뮤니티에서는 ???로만.</T>
            </View>
          )}
          {step === 1 && isDirect ? <View style={[styles.box, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}><T t="bodyStrong">받는 사람: ??? · {toUser?.field} · {toUser?.job}</T><T t="small" color={c.text2}>직행 편지는 목적지를 고르지 않아요. 그 사람에게 곧장 갑니다.</T></View> : null}
          {step === 1 && !isReply && !isDirect && (
            <View style={{ gap: spacing.md }}>
              <Row><Chip label="🎲 랜덤" selected={destMode === 'random'} onPress={() => setDestMode('random')} /><Chip label="📍 직접" selected={destMode === 'pick'} onPress={() => setDestMode('pick')} /><Chip label={`🧭 경유지 (${plan.maxWaypoints})`} selected={destMode === 'route'} onPress={() => setDestMode('route')} /></Row>
              {destMode === 'random' ? (
                <View style={[styles.box, { alignItems: 'center', backgroundColor: c.bg2, borderColor: c.lineSoft }]}><T t="bodyStrong">육지 어딘가로 날아가요</T><T t="small" color={c.text2} style={{ textAlign: 'center' }}>도착지는 나만 알아요. 지나가는 사람에게는 위치와 방향만 보여요.</T><View style={{ marginTop: 8 }}><Globe size={Math.min(width - 64, 240)} letters={letters.filter((l) => l.status === 'flying').slice(0, 6)} me={me.location} meAvatar={me.avatar} autoRotate fps={20} interactive={false} showRoutes="none" /></View></View>
              ) : (<>
                <LocationPicker value={dest} points={destMode === 'route' ? waypoints : []} hint={destMode === 'route' ? `탭할 때마다 경유지가 추가돼요 (${waypoints.length}/${plan.maxWaypoints}) · 마지막이 목적지` : undefined} onChange={(p) => { if (destMode === 'route' && dest && waypoints.length < plan.maxWaypoints && p.city !== dest.city) setWaypoints([...waypoints, { lat: dest.lat, lng: dest.lng }]); setDest(p); }} compact />
                {destMode === 'route' ? <Row style={{ justifyContent: 'space-between' }}><T t="small" color={c.text2}>경유지 {waypoints.length}/{plan.maxWaypoints}{me.plan === 'free' ? ' · 플러스 2 · 프로 3' : ''}</T><Row><Button title="초기화" size="sm" variant="ghost" onPress={() => setWaypoints([])} />{me.plan !== 'pro' ? <Button title="더 많이" size="sm" variant="gradient" onPress={() => router.push('/store')} /> : null}</Row></Row> : null}
              </>)}
            </View>
          )}
          {step === 1 && isReply ? <View style={{ gap: spacing.lg }}>{VehiclePicker}{ShieldBox}</View> : null}
          {step === 2 ? (
            <View style={{ gap: spacing.lg }}>
              {isReply ? <View style={[styles.box, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}><Row style={{ justifyContent: 'space-between' }}><T t="bodyStrong">🤝 친구 요청 포함</T><Switch value={friendRequest} onValueChange={setFriendRequest} trackColor={{ true: c.blue }} /></Row><T t="small" color={c.text2}>상대가 수락하면 친구. 그때부터 실시간 채팅.</T></View> : null}
              {!isReply ? VehiclePicker : null}
              {!isReply && !isDirect ? ShieldBox : null}
              {!isReply && !isDirect ? (<>
                <View style={[styles.box, { backgroundColor: c.bg2, borderColor: c.lineSoft }]}>
                  <Row style={{ justifyContent: 'space-between' }}><T t="bodyStrong">🖼️ 커뮤니티에 엽서로 공개</T><Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: c.blue }} /></Row>
                  <T t="small" color={c.text2}>피드에 ???로 올라가요(거리만 공개). 좋아요·댓글을 받으면 코인.</T>
                  {isPublic ? <Row style={{ justifyContent: 'space-between', marginTop: 6 }}><T t="small">홈 스토리에 내 나라 대표로 올리기</T><Switch value={shareToStory} onValueChange={setShareToStory} trackColor={{ true: c.blue }} /></Row> : null}
                </View>
                <View>
                  <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}><T t="bodyStrong">받는 사람 조건 <T t="small" color={c.text2}>(선택)</T></T>{hasTarget ? <Pressable onPress={() => setTarget({})}><T t="smallStrong" color={c.blue}>해제</T></Pressable> : null}</Row>
                  <Group label="분야">{FIELDS.map((f) => <Chip key={f} label={f} small selected={target.field === f} onPress={() => setTarget({ ...target, field: target.field === f ? undefined : f })} />)}</Group>
                  <Group label="성별">{GENDERS.filter((g) => g.id !== 'private').map((g) => <Chip key={g.id} label={g.label} small selected={target.gender === g.id} onPress={() => setTarget({ ...target, gender: target.gender === g.id ? undefined : g.id })} />)}</Group>
                  <Group label="직무">{JOBS.map((j) => <Chip key={j} label={j} small selected={target.job === j} onPress={() => setTarget({ ...target, job: target.job === j ? undefined : j })} />)}</Group>
                  <Group label="취미">{HOBBIES.map((h) => <Chip key={h} label={h} small selected={target.hobby === h} color={c.blue} onPress={() => setTarget({ ...target, hobby: target.hobby === h ? undefined : h })} />)}</Group>
                </View>
              </>) : null}
              <LinearGradient colors={[...c.sky] as any} style={[styles.summary, { borderColor: c.lineSoft }]}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View><T t="caption" color={c.text2}>{isReply ? '도착 후 상대 수락' : isDirect ? '도착 보장' : '컨택 가능성'}</T><T t="hero" color={isReply || isDirect ? c.blue : chance >= 60 ? c.green : chance >= 35 ? c.yellowText : c.text}>{isReply || isDirect ? '직행' : `${chance}%`}</T></View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Row gap={6}><VehicleIcon id={vehicle} size={28} bubble /><T t="smallStrong">{vehicleObj.name}</T></Row>
                    <T t="small" color={c.text2}>{formatKm(flight.distanceKm)} · {vehicleObj.speedKmh.toLocaleString()} km/h{rentPrice ? ` · 대여 ${rentPrice} SC` : ''}</T>
                    <T t="small" color={c.text2}>{me.location.city} → {destMode === 'random' && !isReply && !isDirect ? '???' : dest?.city ?? '미정'}</T>
                    {!isReply ? <T t="caption" color={c.text3}>{hasTarget ? `조건 일치 ${matching}명` : '조건 없음 · 누구나'}{plan.contactBoost ? ` · ${plan.name} +${plan.contactBoost}%` : ''}</T> : null}
                  </View>
                </Row>
              </LinearGradient>
            </View>
          ) : null}
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.line }]}>{step < 2 ? <Button title="다음" size="lg" full disabled={!canNext} onPress={() => setStep(step + 1)} track="compose:next" /> : <Button title={rentPrice ? `보내기 · 대여 ${rentPrice} SC` : isDirect ? '직행 보내기' : '보내기'} size="lg" full onPress={launch} track="compose:send" />}</View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
function Group({ label, children }: { label: string; children: React.ReactNode }) { const c = useColors(); return <View style={{ marginBottom: 8 }}><T t="caption" color={c.text2} style={{ marginBottom: 4 }}>{label}</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View></View>; }
const styles = StyleSheet.create({
  paperInput: { minHeight: 180, fontSize: 16, lineHeight: 26, fontFamily, paddingTop: 4 },
  paperBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16 },
  box: { borderRadius: radius.md, padding: spacing.md, gap: 6, borderWidth: 1 },
  vehicle: { width: 116, padding: 10, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center' },
  summary: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.sm, marginBottom: spacing.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
});

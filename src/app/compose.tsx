import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { LocationPicker } from '@/components/location-picker';
import { Button, Chip, Header, Icon, Pill, Row, Screen, T } from '@/components/ui';
import { VehicleIcon } from '@/components/vehicle-icon';
import { Globe } from '@/components/globe/Globe';
import { FIELDS, GENDERS, HOBBIES, JOBS } from '@/data/profile';
import { VEHICLES, bestVehicle, vehicleUnlocked } from '@/data/vehicles';
import { PLAN_MAP } from '@/data/plans';
import { findCity } from '@/data/cities';
import { describePlace, formatDuration, formatKm, fuzz50km } from '@/engine/geo';
import { buildRoute, contactChance, planFlight } from '@/engine/sim';
import { BOTS, ME_ID, getUser, matchesTarget, useStore } from '@/store';
import type { Gender, LatLng, Place, TargetFilter, VehicleId } from '@/types';
import { colors, fontFamily, radius, spacing } from '@/theme';
import { success, warn } from '@/engine/haptics';

type DestMode = 'random' | 'pick' | 'route';
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {};

export default function Compose() {
  const router = useRouter();
  const params = useLocalSearchParams<{ toId?: string; field?: string; job?: string; hobby?: string; gender?: string; replyTo?: string }>();
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

  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [destMode, setDestMode] = useState<DestMode>(toUser ? 'pick' : 'random');
  const [dest, setDest] = useState<Place | null>(isReply ? replyUser!.location : toUser ? describePlace(fuzz50km(toUser.location)) : null);
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [vehicle, setVehicle] = useState<VehicleId>('walk');
  const [target, setTarget] = useState<TargetFilter>({ field: params.field, job: params.job, hobby: params.hobby, gender: params.gender as Gender | undefined });
  const [useShield, setUseShield] = useState(me.inventory.shield > 0);
  const [isPublic, setIsPublic] = useState(false);
  const [friendRequest, setFriendRequest] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const fly = useRef(new Animated.Value(0)).current;

  useEffect(() => { setVehicle(bestVehicle(friendIds.length, me.inventory, me.plan)); }, [friendIds.length, me.inventory, me.plan]);

  const previewDest = dest ?? { lat: 35.6762, lng: 139.6503, city: '랜덤', country: '' };
  const wps = destMode === 'route' ? waypoints : [];
  const flight = useMemo(() => planFlight(me.location, previewDest, wps, vehicle, settings.timeScale), [me.location, previewDest, wps, vehicle, settings.timeScale]);
  const chance = useMemo(() => contactChance(buildRoute(me.location, previewDest, wps, vehicle), BOTS.map((b) => ({ location: b.location, match: matchesTarget(b, target) })), vehicle, plan.contactBoost), [me.location, previewDest, wps, vehicle, target, plan.contactBoost]);
  const matching = BOTS.filter((b) => matchesTarget(b, target)).length;
  const hasTarget = !!(target.field || target.job || target.hobby || target.gender);
  const vehicleObj = VEHICLES.find((v) => v.id === vehicle)!;
  const stamp = findCity(me.location.city);
  const canNext = step === 0 ? text.trim().length >= 2 : step === 1 ? destMode === 'random' || !!dest : true;

  const pickImage = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [4, 3] });
      if (!res.canceled && res.assets[0]) setImageUri(res.assets[0].uri);
    } catch { /* ignore */ }
  };

  const launch = () => {
    setError(null);
    const res = sendLetter({
      text: text.trim(), imageUri, destination: destMode === 'random' && !isReply ? undefined : dest ?? undefined, waypoints: wps, vehicle, target: isReply ? {} : target, useShield, isPublic: isReply ? false : isPublic,
      replyToId: isReply ? replyTo!.id : undefined, recipientId: isReply ? replyTo!.senderId : undefined, friendRequest: isReply ? friendRequest : undefined,
    });
    if ('error' in res) { warn(); setError(res.error); return; }
    setLaunching(true);
    success();
    Animated.timing(fly, { toValue: 1, duration: 1300, useNativeDriver: Platform.OS !== 'web' }).start(() => router.replace('/'));
  };

  if (launching) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ transform: [{ translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, -420] }) }, { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }) }, { scale: fly.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1.3, 0.4] }) }], opacity: fly.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }) }}>
          <VehicleIcon id={vehicle} size={120} bubble />
        </Animated.View>
        <T t="title" style={{ marginTop: spacing.xl }}>출발!</T>
        <T t="body" color={colors.text2}>{me.location.city} → {destMode === 'random' && !isReply ? '어딘가' : dest?.city} · 약 {formatDuration(flight.durationMs)}</T>
      </Screen>
    );
  }

  const stepTitles = isReply ? ['답장 쓰기', '수단', '확인'] : ['내용', '목적지', '수단 · 조건'];
  const lastStep = isReply ? 2 : 2;

  return (
    <Screen>
      <Header title={isReply ? '답장 편지' : '새 편지'} subtitle={`${step + 1}/3 · ${stepTitles[step]}`} left={<Pressable hitSlop={10} onPress={() => (step > 0 ? setStep(step - 1) : router.back())}><T t="body">{step > 0 ? '이전' : '취소'}</T></Pressable>} right={step < lastStep ? <Pressable hitSlop={10} disabled={!canNext} onPress={() => setStep(step + 1)}><T t="bodyStrong" color={canNext ? colors.blue : colors.text3}>다음</T></Pressable> : <Pressable hitSlop={10} onPress={launch}><T t="bodyStrong" color={colors.blue}>보내기</T></Pressable>} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {error ? <View style={styles.error}><Icon name="alert-circle" size={16} color={colors.red} /><T t="small" color={colors.red} style={{ flex: 1 }}>{error}</T><Button title="플랜 보기" size="sm" variant="ghost" onPress={() => router.push('/store')} /></View> : null}

          {step === 0 && (
            <View style={{ gap: spacing.md }}>
              {isReply ? (
                <View style={styles.replyBox}>
                  <T t="smallStrong" color={colors.text2}>답장 대상 · {replyUser!.location.city}에서 온 편지</T>
                  <T t="small" color={colors.text2} numberOfLines={2}>“{replyTo!.text}”</T>
                  <T t="caption" color={colors.text3}>답장은 상대에게 직행해요. 상대가 승인하면 실시간 채팅이 시작돼요.</T>
                </View>
              ) : toUser ? (
                <View style={styles.replyBox}><T t="smallStrong">??? · {toUser.location.city} · {toUser.field} · {toUser.job}</T><T t="caption" color={colors.text3}>커뮤니티에서 고른 사람의 도시 근처(50km)로 날아가고, 조건이 자동 설정됐어요</T></View>
              ) : null}
              <View style={styles.paper}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <T t="caption" color="#8A7A5A">FROM {me.location.city.toUpperCase()} · {new Date().toLocaleDateString('ko-KR')}</T>
                  <View style={styles.stamp}><T style={{ fontSize: 22 }}>{stamp?.flag ?? '📮'}</T><T t="caption" color="#8A7A5A">{me.location.city}</T></View>
                </Row>
                <TextInput value={text} onChangeText={(t) => setText(t.slice(0, 500))} multiline placeholder={isReply ? '편지 잘 받았어요…' : '지금 이 편지를 읽는 당신에게…'} placeholderTextColor="#B3A88F" style={[styles.paperInput, noOutline]} textAlignVertical="top" />
                {imageUri ? <Pressable onPress={() => setImageUri(undefined)}><Image source={{ uri: imageUri }} style={{ width: '100%', height: 180, borderRadius: 8, marginTop: 8 }} /><T t="caption" color="#8A7A5A">탭하면 삭제</T></Pressable> : null}
                <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                  <Pressable onPress={pickImage} style={styles.paperBtn}><Icon name="image" size={16} color="#5A4A2A" /><T t="smallStrong" color="#5A4A2A">{imageUri ? '사진 바꾸기' : '사진'}</T></Pressable>
                  <T t="caption" color="#8A7A5A">{text.length}/500</T>
                </Row>
              </View>
              <T t="small" color={colors.text2}>닉네임은 공개되지 않아요. 잡은 사람에게는 ???로 보이고, 답장을 승인해 친구가 되면 서로 보여요.</T>
            </View>
          )}

          {step === 1 && !isReply && (
            <View style={{ gap: spacing.md }}>
              <Row>
                <Chip label="🎲 랜덤" selected={destMode === 'random'} onPress={() => setDestMode('random')} />
                <Chip label="📍 직접" selected={destMode === 'pick'} onPress={() => setDestMode('pick')} />
                <Chip label={`🧭 경유지 (${plan.maxWaypoints})`} selected={destMode === 'route'} onPress={() => setDestMode('route')} />
              </Row>
              {destMode === 'random' ? (
                <View style={[styles.replyBox, { alignItems: 'center' }]}>
                  <T t="bodyStrong">육지 어딘가로 날아가요</T>
                  <T t="small" color={colors.text2} style={{ textAlign: 'center' }}>도착지는 출발 후 공개돼요. 누군가의 머리 위를 지나면 그 사람이 잡을 수 있어요.</T>
                  <View style={{ marginTop: 8 }}><Globe size={Math.min(width - 64, 240)} letters={letters.filter((l) => l.status === 'flying').slice(0, 6)} me={me.location} meAvatar={me.avatar} autoRotate fps={20} interactive={false} /></View>
                </View>
              ) : (
                <>
                  <LocationPicker value={dest} points={destMode === 'route' ? waypoints : []} hint={destMode === 'route' ? `탭할 때마다 경유지가 추가돼요 (${waypoints.length}/${plan.maxWaypoints}) · 마지막이 목적지` : undefined} onChange={(p) => {
                    if (destMode === 'route' && dest && waypoints.length < plan.maxWaypoints && p.city !== dest.city) setWaypoints([...waypoints, { lat: dest.lat, lng: dest.lng }]);
                    setDest(p);
                  }} compact />
                  {destMode === 'route' ? (
                    <Row style={{ justifyContent: 'space-between' }}>
                      <T t="small" color={colors.text2}>경유지 {waypoints.length}/{plan.maxWaypoints}{me.plan === 'free' ? ' · 플러스 2 · 프로 3' : ''}</T>
                      <Row><Button title="초기화" size="sm" variant="ghost" onPress={() => setWaypoints([])} />{me.plan !== 'pro' ? <Button title="더 많이" size="sm" variant="gradient" onPress={() => router.push('/store')} /> : null}</Row>
                    </Row>
                  ) : null}
                </>
              )}
            </View>
          )}

          {(step === 1 && isReply) || step === 2 ? (
            <View style={{ gap: spacing.lg }}>
              {step === 2 && isReply ? (
                <View style={styles.replyBox}>
                  <Row style={{ justifyContent: 'space-between' }}><T t="bodyStrong">🤝 친구 요청 포함</T><Switch value={friendRequest} onValueChange={setFriendRequest} trackColor={{ true: colors.blue }} /></Row>
                  <T t="small" color={colors.text2}>상대가 승인하면 친구가 되고 실시간 채팅이 열려요. 위치는 50km 반경으로 공유돼요.</T>
                </View>
              ) : null}
              {(step === 1 && isReply) || (step === 2 && !isReply) ? (
                <View>
                  <T t="bodyStrong" style={{ marginBottom: 8 }}>배달원</T>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {VEHICLES.map((v) => {
                      const ok = vehicleUnlocked(v, friendIds.length, me.inventory, me.plan);
                      const on = vehicle === v.id;
                      return (
                        <Pressable key={v.id} onPress={() => (ok ? setVehicle(v.id) : router.push(v.premiumItem ? '/store' : '/friends'))} style={[styles.vehicle, on && { borderColor: colors.blue, backgroundColor: colors.blueSoft }, !ok && { opacity: 0.5 }]}>
                          <VehicleIcon id={v.id} size={44} bubble />
                          <T t="smallStrong" style={{ marginTop: 6 }}>{v.name}</T>
                          <T t="caption" color={colors.text2}>{v.speedKmh.toLocaleString()} km/h</T>
                          {!ok ? <T t="caption" color={colors.orange}>{v.premiumItem === 'ufo' || v.premiumItem === 'orbit' ? '🛍️ 상점' : v.premiumItem === 'dragon' ? '★ 프로 / 친구 80' : `🔒 친구 ${v.unlockFriends}`}</T> : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <T t="small" color={colors.text2} style={{ marginTop: 8 }}>{vehicleObj.desc}</T>
                </View>
              ) : null}
              {step === 2 || (step === 1 && isReply) ? (
                <View style={styles.replyBox}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T t="bodyStrong">🛡️ 방어권 {me.inventory.shield > 0 ? `(보유 ${me.inventory.shield})` : '(없음)'}</T>
                    {me.inventory.shield > 0 ? <Switch value={useShield} onValueChange={setUseShield} trackColor={{ true: colors.blue }} /> : <Button title="얻기" size="sm" variant="gradient" onPress={() => router.push('/store')} />}
                  </Row>
                  <T t="small" color={colors.text2}>지나가는 사람이 경로를 바꾸거나 달팽이를 붙이거나 바다에 빠뜨리려 할 때 1회 튕겨내요. 친구 5명마다 1개, 또는 상점.</T>
                </View>
              ) : null}
              {step === 2 && !isReply ? (
                <>
                  <View style={styles.replyBox}>
                    <Row style={{ justifyContent: 'space-between' }}><T t="bodyStrong">🖼️ 커뮤니티에 엽서로 공개</T><Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.blue }} /></Row>
                    <T t="small" color={colors.text2}>피드에 ???로 올라가요. 좋아요를 받으면 코인이 쌓여요.</T>
                  </View>
                  <View>
                    <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                      <T t="bodyStrong">받는 사람 조건 <T t="small" color={colors.text2}>(선택)</T></T>
                      {hasTarget ? <Pressable onPress={() => setTarget({})}><T t="smallStrong" color={colors.blue}>해제</T></Pressable> : null}
                    </Row>
                    <Group label="분야">{FIELDS.map((f) => <Chip key={f} label={f} small selected={target.field === f} onPress={() => setTarget({ ...target, field: target.field === f ? undefined : f })} />)}</Group>
                    <Group label="성별">{GENDERS.filter((g) => g.id !== 'private').map((g) => <Chip key={g.id} label={g.label} small selected={target.gender === g.id} onPress={() => setTarget({ ...target, gender: target.gender === g.id ? undefined : g.id })} />)}</Group>
                    <Group label="직무">{JOBS.map((j) => <Chip key={j} label={j} small selected={target.job === j} onPress={() => setTarget({ ...target, job: target.job === j ? undefined : j })} />)}</Group>
                    <Group label="취미">{HOBBIES.map((h) => <Chip key={h} label={h} small selected={target.hobby === h} color={colors.blue} onPress={() => setTarget({ ...target, hobby: target.hobby === h ? undefined : h })} />)}</Group>
                  </View>
                </>
              ) : null}
              <LinearGradient colors={['#F7FBFF', '#EAF4FF']} style={styles.summary}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View>
                    <T t="caption" color={colors.text2}>{isReply ? '도착 후 상대 승인' : '컨택 가능성'}</T>
                    <T t="hero" color={isReply ? colors.blue : chance >= 60 ? colors.green : chance >= 35 ? '#8A6D00' : colors.text}>{isReply ? '직행' : `${chance}%`}</T>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Pill label={`${vehicleObj.emoji} ${vehicleObj.name}`} color="#fff" />
                    <T t="small" color={colors.text2}>{formatKm(flight.distanceKm)} · 약 {formatDuration(flight.durationMs)}</T>
                    <T t="small" color={colors.text2}>{me.location.city} → {destMode === 'random' && !isReply ? '???' : dest?.city ?? '미정'}</T>
                    {!isReply ? <T t="caption" color={colors.text3}>{hasTarget ? `조건 일치 ${matching}명` : '조건 없음 · 누구나'}{plan.contactBoost ? ` · ${plan.name} +${plan.contactBoost}%` : ''}</T> : null}
                  </View>
                </Row>
              </LinearGradient>
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          {step < lastStep ? <Button title="다음" size="lg" full disabled={!canNext} onPress={() => setStep(step + 1)} /> : <Button title={`${vehicleObj.emoji} 보내기`} size="lg" full onPress={launch} />}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <T t="caption" color={colors.text2} style={{ marginBottom: 4 }}>{label}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: '#FBF4E4', borderRadius: radius.lg, padding: spacing.lg, gap: 6, borderWidth: 1, borderColor: '#EEDFC0' },
  paperInput: { minHeight: 180, color: '#2A2418', fontSize: 16, lineHeight: 26, fontFamily, paddingTop: 4 },
  paperBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EADFC7', paddingHorizontal: 12, height: 32, borderRadius: 16 },
  stamp: { width: 58, height: 62, borderWidth: 1.5, borderColor: '#D9C9A6', borderStyle: 'dashed', borderRadius: 6, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: '#F4EAD3', transform: [{ rotate: '4deg' }] },
  replyBox: { backgroundColor: colors.bg2, borderRadius: radius.md, padding: spacing.md, gap: 6, borderWidth: 1, borderColor: colors.lineSoft },
  vehicle: { width: 112, padding: 10, borderRadius: radius.md, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center' },
  summary: { borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.lineSoft },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.redSoft, padding: 10, borderRadius: radius.sm, marginBottom: spacing.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});

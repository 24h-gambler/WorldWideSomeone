import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { LocationPicker } from '@/components/location-picker';
import { Button, Card, Chip, Header, Row, Screen, T } from '@/components/ui';
import { Globe } from '@/components/globe/Globe';
import { FIELDS, GENDERS, HOBBIES, JOBS } from '@/data/profile';
import { VEHICLES, vehicleUnlocked } from '@/data/vehicles';
import { findCity } from '@/data/cities';
import { describePlace, formatDuration, formatKm, fuzz50km } from '@/engine/geo';
import { buildRoute, contactChance, planFlight } from '@/engine/sim';
import { BOTS, matchesTarget, useStore } from '@/store';
import type { Gender, LatLng, Place, TargetFilter, VehicleId } from '@/types';
import { colors, fontFamily, radius, spacing } from '@/theme';
import { success } from '@/engine/haptics';
import { VehicleIcon } from '@/components/vehicle-icon';

type DestMode = 'random' | 'pick' | 'route';

export default function Compose() {
  const router = useRouter();
  const params = useLocalSearchParams<{ toId?: string; field?: string; job?: string; hobby?: string; gender?: string }>();
  const { width } = useWindowDimensions();
  const me = useStore((s) => s.me);
  const friendIds = useStore((s) => s.friendIds);
  const letters = useStore((s) => s.letters);
  const settings = useStore((s) => s.settings);
  const sendLetter = useStore((s) => s.sendLetter);

  const toUser = params.toId ? BOTS.find((b) => b.id === params.toId) : undefined;

  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [destMode, setDestMode] = useState<DestMode>(toUser ? 'pick' : 'random');
  const [dest, setDest] = useState<Place | null>(toUser ? describePlace(fuzz50km(toUser.location)) : null);
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [vehicle, setVehicle] = useState<VehicleId>('paper');
  const [target, setTarget] = useState<TargetFilter>({ field: params.field, job: params.job, hobby: params.hobby, gender: params.gender as Gender | undefined });
  const [useShield, setUseShield] = useState(me.inventory.shield > 0);
  const [launching, setLaunching] = useState(false);
  const fly = useRef(new Animated.Value(0)).current;

  // 기본 운송수단: 해금된 것 중 최고
  useEffect(() => {
    const best = VEHICLES.filter((v) => v.unlockFriends !== null && vehicleUnlocked(v, friendIds.length, me.inventory)).pop();
    if (best) setVehicle(best.id);
  }, [friendIds.length, me.inventory]);

  const previewDest = dest ?? { lat: 35.6762, lng: 139.6503, city: '랜덤', country: '' };
  const plan = useMemo(() => planFlight(me.location, previewDest, destMode === 'route' ? waypoints : [], vehicle, settings.timeScale), [me.location, previewDest, waypoints, vehicle, destMode, settings.timeScale]);
  const chance = useMemo(() => {
    const route = buildRoute(me.location, previewDest, destMode === 'route' ? waypoints : [], vehicle);
    return contactChance(route, BOTS.map((b) => ({ location: b.location, match: matchesTarget(b, target) })), vehicle);
  }, [me.location, previewDest, waypoints, vehicle, destMode, target]);
  const matching = BOTS.filter((b) => matchesTarget(b, target)).length;
  const hasTarget = !!(target.field || target.job || target.hobby || target.gender);

  const pickImage = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [4, 3] });
      if (!res.canceled && res.assets[0]) setImageUri(res.assets[0].uri);
    } catch {
      /* ignore */
    }
  };

  const launch = () => {
    setLaunching(true);
    success();
    Animated.timing(fly, { toValue: 1, duration: 1300, useNativeDriver: Platform.OS !== 'web' }).start(() => {
      sendLetter({ text: text.trim(), imageUri, destination: destMode === 'random' ? undefined : dest ?? undefined, waypoints: destMode === 'route' ? waypoints : [], vehicle, target, useShield });
      router.replace('/');
    });
  };

  const vehicleObj = VEHICLES.find((v) => v.id === vehicle)!;
  const stamp = findCity(me.location.city);

  if (launching) {
    const ty = fly.interpolate({ inputRange: [0, 1], outputRange: [0, -420] });
    const tx = fly.interpolate({ inputRange: [0, 1], outputRange: [0, 120] });
    const sc = fly.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1.3, 0.4] });
    const op = fly.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ transform: [{ translateY: ty }, { translateX: tx }, { scale: sc }], opacity: op }}>
          <VehicleIcon id={vehicle} size={110} />
        </Animated.View>
        <T t="title" style={{ marginTop: spacing.xl }}>날아갑니다!</T>
        <T t="body" color={colors.textDim}>{me.location.city} → {destMode === 'random' ? '어딘가' : dest?.city} · {formatDuration(plan.durationMs)}</T>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="편지 쓰기" subtitle={['1. 내용', '2. 목적지', '3. 수단과 조건'][step]} onBack={() => (step > 0 ? setStep(step - 1) : router.back())} />
      <Row style={{ marginBottom: spacing.md }}>
        {[0, 1, 2].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.accent : colors.card }} />)}
      </Row>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <View style={{ gap: spacing.md }}>
              {toUser ? (
                <Card style={{ borderColor: colors.primary }}>
                  <T t="small" color={colors.textDim}>받는 사람 조건이 커뮤니티 카드에서 설정됐어요</T>
                  <T t="bodyStrong">??? · {toUser.location.city} · {toUser.field} · {toUser.job}</T>
                </Card>
              ) : null}
              <View style={styles.paper}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <T t="caption" color="#6B5E4A">FROM {me.location.city.toUpperCase()} · {new Date().toLocaleDateString('ko-KR')}</T>
                  <View style={styles.stamp}>
                    <T style={{ fontSize: 22 }}>{stamp?.flag ?? '📮'}</T>
                    <T t="caption" color="#6B5E4A">{me.location.city}</T>
                  </View>
                </Row>
                <TextInput
                  value={text}
                  onChangeText={(t) => setText(t.slice(0, 500))}
                  multiline
                  placeholder="지금 이 편지를 읽는 당신에게…"
                  placeholderTextColor="#A69A85"
                  style={styles.paperInput}
                  textAlignVertical="top"
                />
                {imageUri ? (
                  <Pressable onPress={() => setImageUri(undefined)}>
                    <Image source={{ uri: imageUri }} style={{ width: '100%', height: 180, borderRadius: radius.sm, marginTop: spacing.sm }} />
                    <T t="caption" color="#6B5E4A" style={{ marginTop: 4 }}>탭하면 사진 삭제</T>
                  </Pressable>
                ) : null}
                <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
                  <Button title={imageUri ? '사진 바꾸기' : '사진 붙이기'} size="sm" variant="paper" icon="🖼️" onPress={pickImage} />
                  <T t="caption" color="#6B5E4A">{text.length}/500</T>
                </Row>
              </View>
              <T t="small" color={colors.textDim}>닉네임은 공개되지 않아요. 잡은 사람에게는 ???로 보이고, 친구가 되면 서로 보여요.</T>
            </View>
          )}

          {step === 1 && (
            <View style={{ gap: spacing.md }}>
              <Row>
                <Chip label="🎲 랜덤" selected={destMode === 'random'} onPress={() => setDestMode('random')} />
                <Chip label="📍 직접 찍기" selected={destMode === 'pick'} onPress={() => setDestMode('pick')} />
                <Chip label={`🧭 경로 지정 (${me.inventory.route})`} selected={destMode === 'route'} onPress={() => me.inventory.route > 0 ? setDestMode('route') : router.push('/store')} color={colors.gold} />
              </Row>
              {destMode === 'random' ? (
                <Card>
                  <T t="bodyStrong">🎲 육지 어딘가로 날아가요</T>
                  <T t="small" color={colors.textDim}>도착지는 출발 후에 공개돼요. 누군가의 머리 위를 지나면 그 사람이 잡을 수 있어요.</T>
                  <View style={{ alignItems: 'center', marginTop: spacing.md }}>
                    <Globe size={Math.min(width - 64, 260)} letters={letters.filter((l) => l.status === 'flying').slice(0, 6)} me={me.location} autoRotate fps={20} showStars={false} interactive={false} />
                  </View>
                </Card>
              ) : (
                <>
                  <LocationPicker
                    value={dest}
                    onChange={(p) => {
                      if (destMode === 'route' && dest && waypoints.length < 3 && p.city !== dest.city) {
                        // 경로 모드: 현재 목적지를 경유지로 밀고 새 목적지 지정
                        setWaypoints([...waypoints, { lat: dest.lat, lng: dest.lng }]);
                      }
                      setDest(p);
                    }}
                    compact
                  />
                  {destMode === 'route' ? (
                    <Card>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <T t="bodyStrong">경유지 {waypoints.length}/3</T>
                        <Button title="초기화" size="sm" variant="ghost" onPress={() => setWaypoints([])} />
                      </Row>
                      <T t="small" color={colors.textDim}>지구를 계속 탭하면 이전 목적지가 경유지가 되고 새 지점이 최종 목적지가 돼요.</T>
                    </Card>
                  ) : null}
                </>
              )}
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: spacing.lg }}>
              <View>
                <T t="bodyStrong" style={{ marginBottom: spacing.sm }}>운송수단</T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {VEHICLES.map((v) => {
                    const ok = vehicleUnlocked(v, friendIds.length, me.inventory);
                    const on = vehicle === v.id;
                    return (
                      <Pressable key={v.id} onPress={() => (ok ? setVehicle(v.id) : v.premiumItem ? router.push('/store') : undefined)} style={[styles.vehicle, on && { borderColor: v.color, backgroundColor: 'rgba(255,255,255,0.12)' }, !ok && { opacity: 0.45 }]}>
                        <VehicleIcon id={v.id} size={36} />
                        <T t="small" style={{ fontWeight: '700' }}>{v.name}</T>
                        <T t="caption" color={colors.textDim}>{v.speedKmh.toLocaleString()} km/h</T>
                        {!ok ? <T t="caption" color={colors.gold}>{v.unlockFriends !== null ? `🔒 친구 ${v.unlockFriends}` : '🛍️ 상점'}</T> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <T t="small" color={colors.textDim} style={{ marginTop: spacing.sm }}>{vehicleObj.desc}</T>
              </View>

              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T t="bodyStrong">🛡️ 방어권 장착</T>
                  <Chip label={useShield && me.inventory.shield > 0 ? `장착 (보유 ${me.inventory.shield})` : me.inventory.shield > 0 ? '미장착' : '없음'} selected={useShield && me.inventory.shield > 0} onPress={() => (me.inventory.shield > 0 ? setUseShield(!useShield) : router.push('/store'))} small color={colors.sky} />
                </Row>
                <T t="small" color={colors.textDim}>누군가 편지를 바다에 빠뜨리거나 되돌리려 할 때 1회 튕겨내요.{vehicleObj.immune ? ' (드래곤은 항상 면역)' : ''}</T>
              </Card>

              <View>
                <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <T t="bodyStrong">받는 사람 조건 <T t="small" color={colors.textDim}>(선택)</T></T>
                  {hasTarget ? <Button title="해제" size="sm" variant="ghost" onPress={() => setTarget({})} /> : null}
                </Row>
                <T t="caption" color={colors.textDim} style={{ marginBottom: 6 }}>분야</T>
                <View style={styles.wrap}>{FIELDS.map((f) => <Chip key={f} label={f} small selected={target.field === f} onPress={() => setTarget({ ...target, field: target.field === f ? undefined : f })} />)}</View>
                <T t="caption" color={colors.textDim} style={{ marginVertical: 6 }}>성별</T>
                <View style={styles.wrap}>{GENDERS.filter((g) => g.id !== 'private').map((g) => <Chip key={g.id} label={g.label} small color={colors.accent} selected={target.gender === g.id} onPress={() => setTarget({ ...target, gender: target.gender === g.id ? undefined : g.id })} />)}</View>
                <T t="caption" color={colors.textDim} style={{ marginVertical: 6 }}>직무</T>
                <View style={styles.wrap}>{JOBS.map((j) => <Chip key={j} label={j} small color={colors.sky} selected={target.job === j} onPress={() => setTarget({ ...target, job: target.job === j ? undefined : j })} />)}</View>
                <T t="caption" color={colors.textDim} style={{ marginVertical: 6 }}>취미</T>
                <View style={styles.wrap}>{HOBBIES.map((h) => <Chip key={h} label={h} small color={colors.mint} selected={target.hobby === h} onPress={() => setTarget({ ...target, hobby: target.hobby === h ? undefined : h })} />)}</View>
              </View>

              <LinearGradient colors={['rgba(124,92,255,0.35)', 'rgba(79,227,193,0.2)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View>
                    <T t="caption" color={colors.textDim}>컨택 가능성</T>
                    <T t="hero" color={chance >= 60 ? colors.success : chance >= 35 ? colors.gold : colors.text}>{chance}%</T>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <T t="small" color={colors.textDim}>{hasTarget ? `조건 일치 ${matching}명` : '조건 없음 · 누구나 잡을 수 있어요'}</T>
                    <T t="small" color={colors.textDim}>{formatKm(plan.distanceKm)} · 약 {formatDuration(plan.durationMs)}</T>
                    <T t="small" color={colors.textDim}>{me.location.city} → {destMode === 'random' ? '???' : dest?.city ?? '미정'}</T>
                  </View>
                </Row>
              </LinearGradient>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step < 2 ? (
            <Button title="다음" size="lg" full disabled={(step === 0 && text.trim().length < 2) || (step === 1 && destMode !== 'random' && !dest)} onPress={() => setStep(step + 1)} />
          ) : (
            <Button title={`${vehicleObj.emoji} 날리기`} size="lg" full onPress={launch} />
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: '#FBF4E4', borderRadius: radius.lg, padding: spacing.lg, gap: 8 },
  paperInput: { minHeight: 200, color: '#2A2418', fontSize: 16, lineHeight: 26, fontFamily, paddingTop: 4, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },
  stamp: { width: 60, height: 64, borderWidth: 1.5, borderColor: '#C9B99A', borderStyle: 'dashed', borderRadius: 6, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: '#F4EAD3', transform: [{ rotate: '4deg' }] },
  vehicle: { width: 112, padding: 12, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', gap: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: spacing.lg, backgroundColor: colors.bg },
});

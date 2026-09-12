import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';

import { CITIES } from '@/data/cities';
import type { LatLng, Place } from '@/types';
import { describePlace } from '@/engine/geo';
import { colors, fontFamily, radius, spacing } from '@/theme';
import { Button, Chip, T } from '@/components/ui';
import { Globe } from '@/components/globe/Globe';

export function LocationPicker({ value, onChange, letters = [], compact }: { value: Place | null; onChange: (p: Place) => void; letters?: any[]; compact?: boolean }) {
  const { width } = useWindowDimensions();
  const [q, setQ] = useState('');
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const size = Math.min(width - spacing.lg * 2, compact ? 260 : 320);

  const results = useMemo(() => {
    const s = q.trim();
    const list = s ? CITIES.filter((c) => c.city.includes(s) || c.country.includes(s)) : CITIES.slice(0, 12);
    return list.slice(0, 12);
  }, [q]);

  const useMyLocation = async () => {
    setLocating(true);
    setErr(null);
    try {
      const Location = await import('expo-location');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error('위치 권한이 거부되었어요. 도시를 직접 선택해주세요.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      onChange(describePlace({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
    } catch (e: any) {
      setErr(e?.message ?? '위치를 가져올 수 없어요');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ alignItems: 'center' }}>
        <Globe
          size={size}
          letters={letters}
          me={null}
          pickedPoint={value}
          focusPoint={value}
          autoRotate={!value}
          fps={24}
          onSelectPoint={(p: LatLng) => onChange(describePlace(p))}
          showStars={false}
        />
        <T t="small" color={colors.textDim} style={{ marginTop: -6 }}>지구를 돌려서 탭하면 위치가 찍혀요</T>
      </View>

      <View style={styles.selected}>
        <T style={{ fontSize: 20 }}>📍</T>
        <View style={{ flex: 1 }}>
          <T t="bodyStrong">{value ? `${value.city}` : '위치를 선택하세요'}</T>
          {value ? <T t="small" color={colors.textDim}>{value.country} · {value.lat.toFixed(2)}, {value.lng.toFixed(2)}</T> : null}
        </View>
        <Button title={locating ? '찾는 중…' : '내 위치'} size="sm" variant="secondary" icon="🎯" onPress={useMyLocation} loading={locating} />
      </View>
      {err ? <T t="small" color={colors.danger}>{err}</T> : null}
      {Platform.OS === 'web' && !value ? <T t="caption" color={colors.textFaint}>웹에서는 브라우저 위치 권한을 허용해야 해요</T> : null}

      <TextInput value={q} onChangeText={setQ} placeholder="도시 검색 (예: 도쿄, 파리)" placeholderTextColor={colors.textFaint} style={styles.input} />
      <View style={styles.wrap}>
        {results.map((c) => (
          <Chip key={c.city} label={`${c.flag} ${c.city}`} selected={value?.city === c.city} small onPress={() => onChange({ lat: c.lat, lng: c.lng, city: c.city, country: c.country })} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  selected: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 14, height: 44, fontSize: 14, fontFamily, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

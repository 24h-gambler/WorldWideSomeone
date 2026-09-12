import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CITIES } from '@/data/cities';
import type { LatLng, Place } from '@/types';
import { describePlace } from '@/engine/geo';
import { fontFamily, radius, spacing, useColors, useStyles, type ThemeColors } from '@/theme';
import { Button, Chip, Icon, Row, T } from '@/components/ui';
import { Globe } from '@/components/globe/Globe';
import { getCurrentPlace } from '@/services/location';

export function LocationPicker({ value, onChange, letters = [], compact, points = [], hint }: { value: Place | null; onChange: (p: Place) => void; letters?: any[]; compact?: boolean; points?: LatLng[]; hint?: string }) {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [q, setQ] = useState('');
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const size = Math.min(width - spacing.lg * 2, compact ? 280 : 340);
  const results = useMemo(() => {
    const s = q.trim();
    return (s ? CITIES.filter((c) => c.city.includes(s) || c.country.includes(s)) : CITIES.slice(0, 12)).slice(0, 12);
  }, [q]);

  const useMyLocation = async () => {
    setLocating(true);
    setErr(null);
    try {
      const p = await getCurrentPlace();
      onChange(p);
    } catch (e: any) {
      setErr(e?.message ?? '위치를 가져올 수 없어요');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <LinearGradient colors={[...colors.sky] as any} style={{ borderRadius: radius.lg, alignItems: 'center', paddingVertical: 8 }}>
        <Globe size={size} letters={letters} me={null} pickedPoints={value ? [...points, value] : points} focusPoint={value} autoRotate={!value} fps={24} onSelectPoint={(p: LatLng) => onChange(describePlace(p))} />
        <T t="small" color={colors.text2}>{hint ?? '지구를 돌려서 탭하면 위치가 찍혀요'}</T>
      </LinearGradient>
      <View style={styles.selected}>
        <Icon name="map-pin" size={18} color={colors.red} />
        <View style={{ flex: 1 }}>
          <T t="bodyStrong">{value ? value.city : '위치를 선택하세요'}</T>
          {value ? <T t="small" color={colors.text2}>{value.country} · {value.lat.toFixed(2)}, {value.lng.toFixed(2)}</T> : null}
        </View>
        <Button title={locating ? '찾는 중' : '내 위치'} size="sm" variant="secondary" icon="crosshair" onPress={useMyLocation} loading={locating} />
      </View>
      {err ? <T t="small" color={colors.red}>{err}</T> : null}
      <Row style={[styles.search]}>
        <Icon name="search" size={16} color={colors.text3} />
        <TextInput value={q} onChangeText={setQ} placeholder="도시 검색" placeholderTextColor={colors.text3} style={[styles.input, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]} />
      </Row>
      <View style={styles.wrap}>
        {results.map((c) => <Chip key={c.city} label={`${c.flag} ${c.city}`} small selected={value?.city === c.city} onPress={() => onChange({ lat: c.lat, lng: c.lng, city: c.city, country: c.country })} />)}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  selected: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bg2, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.line },
  search: { backgroundColor: colors.bg3, borderRadius: radius.sm, paddingHorizontal: 10, height: 38 },
  input: { flex: 1, color: colors.text, fontSize: 14, fontFamily, height: 38 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

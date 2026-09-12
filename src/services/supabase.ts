/**
 * Supabase 클라이언트 — EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 가 있을 때만 활성.
 * 없으면 로컬 봇 시뮬 모드로 동작한다. 스키마·정책·함수는 supabase/ 폴더.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseEnabled = !!(url && anon);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url!, anon!, { auth: { storage: AsyncStorage as any, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })
  : null;

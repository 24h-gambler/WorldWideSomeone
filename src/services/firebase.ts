/**
 * Firebase 초기화 (JS SDK). EXPO_PUBLIC_FIREBASE_* 환경변수가 없으면 비활성 → 로컬 시뮬 모드.
 * .env.example 참고. Expo SDK 53+ 에서는 metro.config.js 의 unstable_enablePackageExports=false 필요.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const cfg = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseEnabled = !!(cfg.apiKey && cfg.projectId && cfg.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let fns: Functions | null = null;
let storage: FirebaseStorage | null = null;

export function fb() {
  if (!firebaseEnabled) throw new Error('Firebase not configured');
  if (!app) {
    app = getApps()[0] ?? initializeApp(cfg as any);
    if (Platform.OS === 'web') auth = getAuth(app);
    else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getReactNativePersistence } = require('firebase/auth');
        auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
      } catch {
        auth = getAuth(app);
      }
    }
    db = getFirestore(app);
    fns = getFunctions(app, process.env.EXPO_PUBLIC_FIREBASE_REGION ?? 'asia-northeast3');
    storage = getStorage(app);
  }
  return { app: app!, auth: auth!, db: db!, fns: fns!, storage: storage! };
}

export async function ensureSignedIn(): Promise<string> {
  const { auth } = fb();
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

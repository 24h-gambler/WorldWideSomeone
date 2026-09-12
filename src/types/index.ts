export type LatLng = { lat: number; lng: number };

export type Place = LatLng & {
  city: string; // 가장 가까운 도시명 (또는 '바다 위')
  country: string;
};

export type Gender = 'female' | 'male' | 'other' | 'private';

export type VehicleId =
  | 'paper'
  | 'pigeon'
  | 'balloon'
  | 'prop'
  | 'jet'
  | 'rocket'
  | 'dragon'
  | 'ufo'
  | 'satellite';

export type Inventory = {
  shield: number;
  ufo: number;
  route: number;
  orbit: number;
};

export type User = {
  id: string;
  nickname: string;
  avatar: string; // emoji
  bio: string;
  field: string;
  gender: Gender;
  job: string;
  hobbies: string[];
  location: Place;
  isBot: boolean;
  lastActiveAt: number;
  // 통계
  stats: { sent: number; caught: number; distanceKm: number };
  stamps: string[]; // 잡은 편지 출발 도시
  coins: number;
  inventory: Inventory;
  premium: boolean;
};

export type TargetFilter = {
  field?: string;
  gender?: Gender;
  job?: string;
  hobby?: string;
};

export type LetterStatus =
  | 'flying'
  | 'landed'
  | 'caught'
  | 'returned'
  | 'ocean'
  | 'space'
  | 'expired';

export type LetterEvent = {
  type:
    | 'departed'
    | 'passby'
    | 'landed'
    | 'caught'
    | 'defended'
    | 'returned'
    | 'ocean'
    | 'space'
    | 'expired'
    | 'friend_request';
  at: number;
  by?: string; // userId
  place?: string;
};

export type Letter = {
  id: string;
  senderId: string;
  text: string;
  imageUri?: string;
  origin: Place;
  destination: Place;
  randomDestination: boolean;
  waypoints: LatLng[];
  vehicle: VehicleId;
  shield: boolean;
  target: TargetFilter;
  status: LetterStatus;
  departedAt: number; // 실제 epoch ms
  arrivesAt: number; // 실제 epoch ms
  distanceKm: number;
  landedAt?: number;
  caughtBy?: string;
  caughtAt?: number;
  catchPlace?: string;
  events: LetterEvent[];
  stamp: string; // 출발 도시 스탬프
};

export type Passby = {
  id: string;
  letterId: string;
  at: number;
  expiresAt: number;
  canCatch: boolean; // 조건 일치 여부
  resolved?: 'caught' | 'returned' | 'ocean' | 'space' | 'missed' | 'defended';
};

export type FriendRequest = {
  id: string;
  fromId: string;
  toId: string;
  letterId?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  at: number;
};

export type Chat = {
  id: string; // otherUserId 기준
  otherId: string;
  messages: ChatMessage[];
  lastReadAt: number;
};

export type NotificationType =
  | 'passby'
  | 'caught'
  | 'friend_request'
  | 'friend_accepted'
  | 'chat'
  | 'mischief'
  | 'defended'
  | 'landed'
  | 'reward';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  at: number;
  read: boolean;
  route?: string; // expo-router href
};

export type ScheduledEvent = {
  id: string;
  at: number;
  type:
    | 'bot_send'
    | 'bot_catch'
    | 'bot_friend_request'
    | 'bot_accept'
    | 'bot_chat'
    | 'bot_mischief';
  payload: Record<string, any>;
};

export type Settings = {
  timeScale: number;
  notifications: boolean;
  devMode: boolean;
  haptics: boolean;
};

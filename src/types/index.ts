export type LatLng = { lat: number; lng: number };
export type Place = LatLng & { city: string; country: string };
export type Gender = 'female' | 'male' | 'other' | 'private';
export type PlanId = 'free' | 'plus' | 'pro';

export type VehicleId =
  | 'walk' | 'jog' | 'sprint' | 'bike' | 'horse' | 'scooter' | 'car' | 'train' | 'plane' | 'rocket'
  | 'dragon' | 'ufo' | 'satellite';

export type Inventory = { shield: number; ufo: number; orbit: number };

export type User = {
  id: string;
  nickname: string;
  avatar: string;
  bio: string;
  field: string;
  gender: Gender;
  job: string;
  hobbies: string[];
  location: Place;
  isBot: boolean;
  lastActiveAt: number;
  stats: { sent: number; caught: number; distanceKm: number; likes: number };
  stamps: string[];
  coins: number;
  inventory: Inventory;
  plan: PlanId;
  planExpiresAt?: number;
  shieldMilestone: number; // 친구 5명 단위 방어권 지급 카운트
  pushToken?: string;
  createdAt: number;
};

export type TargetFilter = { field?: string; gender?: Gender; job?: string; hobby?: string };

export type LetterStatus =
  | 'flying'     // 비행 중
  | 'landed'     // 목적지 착륙(집어갈 사람 대기)
  | 'delivered'  // 답장 편지가 수신자에게 도착(우편함)
  | 'caught'     // 누군가 잡음
  | 'approved'   // 답장 승인 → 채팅 시작
  | 'declined'
  | 'returned' | 'ocean' | 'space' | 'expired';

export type LetterEventType =
  | 'departed' | 'passby' | 'landed' | 'delivered' | 'caught' | 'approved' | 'declined'
  | 'defended' | 'rerouted' | 'snail' | 'returned' | 'ocean' | 'space' | 'expired';

export type LetterEvent = { type: LetterEventType; at: number; by?: string; place?: string };

export type Letter = {
  id: string;
  senderId: string;
  recipientId?: string; // 답장(회수) 편지: 원 발신자에게 직행
  replyToId?: string;   // 어떤 편지에 대한 답장인지
  friendRequest?: boolean; // 답장에 친구 요청 포함
  text: string;
  imageUri?: string;
  origin: Place;
  destination: Place;
  randomDestination: boolean;
  waypoints: LatLng[];
  vehicle: VehicleId;
  shield: boolean;
  target: TargetFilter;
  isPublic: boolean; // 커뮤니티 엽서 공개
  status: LetterStatus;
  departedAt: number;
  arrivesAt: number;
  distanceKm: number;
  penalty?: { from: number; until: number }; // 달팽이 벌칙 구간
  redirects: number; // 지나가던 사람이 경로를 바꾼 횟수
  landedAt?: number;
  caughtBy?: string;
  caughtAt?: number;
  catchPlace?: string;
  events: LetterEvent[];
  stamp: string;
};

export type PassbyResolution = 'caught' | 'rerouted' | 'snail' | 'returned' | 'ocean' | 'space' | 'missed' | 'defended';
export type Passby = { id: string; letterId: string; at: number; expiresAt: number; canCatch: boolean; resolved?: PassbyResolution };

export type ChatMessage = { id: string; senderId: string; text: string; at: number };
export type Chat = { id: string; otherId: string; messages: ChatMessage[]; lastReadAt: number; since: number };

export type Post = {
  id: string;
  letterId?: string;
  authorId: string;
  text: string;
  imageUri?: string;
  city: string;
  country: string;
  stamp: string;
  vehicle: VehicleId;
  at: number;
  likes: number;
  likedByMe: boolean;
  distanceKm: number;
};

export type NotificationType = 'passby' | 'caught' | 'reply' | 'approved' | 'chat' | 'mischief' | 'defended' | 'landed' | 'reward' | 'like' | 'system';
export type AppNotification = { id: string; type: NotificationType; title: string; body: string; at: number; read: boolean; route?: string };

export type ScheduledEvent = {
  id: string;
  at: number;
  type: 'bot_send' | 'bot_catch' | 'bot_reply' | 'bot_approve' | 'bot_chat' | 'bot_mischief' | 'bot_like' | 'bot_post';
  payload: Record<string, any>;
};

export type Settings = { timeScale: number; notifications: boolean; haptics: boolean; devMode: boolean; backgroundLocation: boolean };

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

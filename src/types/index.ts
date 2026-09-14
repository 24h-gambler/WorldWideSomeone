export type LatLng = { lat: number; lng: number };
export type Place = LatLng & { city: string; country: string };
export type Gender = 'female' | 'male' | 'other' | 'private';
export type PlanId = 'free' | 'plus' | 'pro';
export type ThemeMode = 'system' | 'light' | 'dark';

export type VehicleId =
  | 'walk' | 'jog' | 'run' | 'kick' | 'bike'
  | 'pigeon' | 'seagull' | 'goose' | 'crane' | 'hawk' | 'eagle' | 'albatross'
  | 'horse' | 'camel' | 'dolphin' | 'cheetah'
  | 'scooter' | 'kei' | 'bus' | 'sedan' | 'truck' | 'sports' | 'train' | 'ktx' | 'maglev'
  | 'sail' | 'speedboat' | 'cruise' | 'submarine' | 'hover'
  | 'balloon' | 'paraglider' | 'heli' | 'prop' | 'airliner' | 'fighter' | 'concorde'
  | 'rocket' | 'satellite' | 'ufo'
  | 'carpet' | 'unicorn' | 'dragon';

export type Inventory = { shield: number; ufo: number; orbit: number; peek: number; pull: number; direct: number; carpet: number };
/** 일일 한도(엿보기·끌어오기·무료 코인 획득) + 월 한도(직행 편지) */
export type Quota = { date: string; peeks: number; pulls: number; earned: number; month: string; direct: number };
export type AuthProvider = 'guest' | 'google' | 'apple' | 'kakao';
export type Auth = { provider: AuthProvider; email?: string; signedUpAt?: number };

export type User = {
  id: string; nickname: string; avatar: string; bio: string; photoUri?: string;
  field: string; gender: Gender; job: string; hobbies: string[];
  location: Place; isBot: boolean; lastActiveAt: number;
  stats: { sent: number; received: number; caught: number; distanceKm: number; likes: number };
  stamps: string[]; coins: number; inventory: Inventory; quota: Quota;
  plan: PlanId; planExpiresAt?: number; shieldMilestone: number; pushToken?: string; createdAt: number; auth?: Auth;
};

export type TargetFilter = { field?: string; gender?: Gender; job?: string; hobby?: string };

export type LetterKind = 'letter' | 'reply';
export type LetterStatus = 'flying' | 'sunk' | 'landed' | 'delivered' | 'caught' | 'approved' | 'declined' | 'space' | 'expired';
export type LetterEventType = 'departed' | 'passby' | 'landed' | 'delivered' | 'caught' | 'approved' | 'declined' | 'defended' | 'rerouted' | 'pulled' | 'peeked' | 'snail' | 'sunk' | 'rescued' | 'resurfaced' | 'space' | 'expired' | 'boosted' | 'rented';
export type LetterEvent = { type: LetterEventType; at: number; by?: string; place?: string };

export type Letter = {
  id: string; kind: LetterKind; senderId: string; recipientId?: string; replyToId?: string; friendRequest?: boolean;
  direct?: boolean;   // 결제로 특정 사람에게 무조건 도착 (통과·장난 없음)
  rented?: boolean;   // 코인으로 1회 대여한 배달원
  boost?: 'fast' | 'instant'; // 받는 쪽이 코인으로 답장을 가속
  text: string; imageUri?: string;
  origin: Place; destination: Place; randomDestination: boolean; waypoints: LatLng[];
  vehicle: VehicleId; shield: boolean; target: TargetFilter; isPublic: boolean;
  status: LetterStatus; departedAt: number; arrivesAt: number; distanceKm: number;
  penalty?: { from: number; until: number };
  sunkAt?: number; sunkUntil?: number;
  redirects: number; pulls: number; pulledBy?: string; peekedBy: string[];
  trail: LatLng[]; // 실제 지나온 경로(샘플) — 경로 변경·침수 포함
  landedAt?: number; caughtBy?: string; caughtAt?: number; catchPlace?: string;
  events: LetterEvent[]; stamp: string;
};

export type PassbyResolution = 'caught' | 'rerouted' | 'pulled' | 'snail' | 'sunk' | 'space' | 'missed' | 'defended';
export type Passby = { id: string; letterId: string; at: number; expiresAt: number; canCatch: boolean; peeked?: boolean; resolved?: PassbyResolution };

export type ChatMessage = { id: string; senderId: string; text: string; at: number };
export type Chat = { id: string; otherId: string; messages: ChatMessage[]; lastReadAt: number; since: number };

export type Comment = { id: string; authorId: string; text: string; at: number };
export type Post = {
  id: string; letterId?: string; authorId: string; text: string; imageUri?: string;
  city: string; country: string; stamp: string; vehicle: VehicleId; at: number;
  likes: number; likedByMe: boolean; distanceKm: number; comments: Comment[]; shareToStory: boolean;
};

export type NotificationType = 'passby' | 'caught' | 'reply' | 'approved' | 'chat' | 'mischief' | 'defended' | 'landed' | 'reward' | 'like' | 'comment' | 'sunk' | 'direct' | 'boost' | 'system';
export type AppNotification = { id: string; type: NotificationType; title: string; body: string; at: number; read: boolean; route?: string };

export type ScheduledEvent = {
  id: string; at: number;
  type: 'bot_send' | 'bot_catch' | 'bot_reply' | 'bot_approve' | 'bot_chat' | 'bot_mischief' | 'bot_like' | 'bot_post' | 'bot_comment' | 'bot_resurface';
  payload: Record<string, any>;
};

export type Settings = { timeScale: number; notifications: boolean; haptics: boolean; devMode: boolean; backgroundLocation: boolean; theme: ThemeMode };
export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

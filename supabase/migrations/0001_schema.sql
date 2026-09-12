-- WorldWideSomeone · Supabase schema v4
-- 원칙: 클라이언트는 자기 프로필·이벤트·채팅 메시지만 직접 쓴다. 게임 상태(편지·코인·친구)는 Edge Function(service role)만 바꾼다.
create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ───────────────────────── users ─────────────────────────
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '',
  avatar text not null default '🙂',
  bio text not null default '',
  photo_url text,
  field text not null default '',
  gender text not null default 'private',
  job text not null default '',
  hobbies text[] not null default '{}',
  city text not null default '',
  country text not null default '',
  plan text not null default 'free' check (plan in ('free','plus','pro')),
  plan_expires_at timestamptz,
  coins int not null default 100 check (coins >= 0),
  inventory jsonb not null default '{"shield":1,"ufo":0,"orbit":0,"peek":1,"pull":0,"direct":0,"carpet":0}',
  quota jsonb not null default '{"date":"","peeks":0,"pulls":0,"earned":0,"month":"","direct":0}',
  stats jsonb not null default '{"sent":0,"received":0,"caught":0,"distanceKm":0,"likes":0}',
  stamps text[] not null default '{}',
  friend_ids uuid[] not null default '{}',
  revealed_ids uuid[] not null default '{}',
  shield_milestone int not null default 0,
  auth_provider text not null default 'guest',
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- 위치·푸시토큰은 아무도 읽지 못한다 (서버만)
create table if not exists public.users_private (
  user_id uuid primary key references public.users(id) on delete cascade,
  lat double precision, lng double precision,
  geohash6 text,                 -- 통과 판정용 ~1.2km 셀 (친구에게는 50km 반경만)
  geohash4 text,                 -- 지역 배치용 ~39km 셀
  location_updated_at timestamptz,
  push_token text,
  notify_passby boolean not null default true,
  notify_quiet_from smallint not null default 23,   -- 조용한 시간(현지 시각)
  notify_quiet_to smallint not null default 8,
  tz text not null default 'Asia/Seoul',
  passby_pushes_today int not null default 0,
  passby_push_day date
);
create index if not exists users_private_geohash4_idx on public.users_private (geohash4);
create index if not exists users_private_geohash6_idx on public.users_private (geohash6);

-- ───────────────────────── letters ─────────────────────────
create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'letter' check (kind in ('letter','reply')),
  sender_id uuid not null references public.users(id),
  recipient_id uuid references public.users(id),
  reply_to_id uuid references public.letters(id),
  direct boolean not null default false,
  rented boolean not null default false,
  boost text check (boost in ('fast','instant')),
  text text not null check (char_length(text) between 1 and 500),
  image_url text,
  origin jsonb not null,           -- {lat,lng,city,country}
  destination jsonb not null,
  random_destination boolean not null default false,
  waypoints jsonb not null default '[]',
  vehicle text not null,
  shield boolean not null default false,
  target jsonb not null default '{}',
  is_public boolean not null default false,
  status text not null default 'flying' check (status in ('flying','sunk','landed','delivered','caught','approved','declined','space','expired')),
  departed_at timestamptz not null default now(),
  arrives_at timestamptz not null,
  distance_km double precision not null,
  penalty jsonb,
  sunk_at timestamptz, sunk_until timestamptz,
  redirects int not null default 0,
  pulls int not null default 0,
  pulled_by uuid,
  peeked_by uuid[] not null default '{}',
  trail jsonb not null default '[]',
  landed_at timestamptz, caught_by uuid, caught_at timestamptz, catch_place text,
  events jsonb not null default '[]',
  stamp text not null default '',
  participants uuid[] not null default '{}',   -- sender, recipient, catcher — 본문 읽기 권한
  -- 통과 판정 최적화: 다음 60초 동안 지날 geohash4 셀 목록 (tick-world 가 갱신)
  cells4 text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists letters_status_idx on public.letters (status);
create index if not exists letters_participants_idx on public.letters using gin (participants);
create index if not exists letters_cells4_idx on public.letters using gin (cells4);
create index if not exists letters_arrives_idx on public.letters (arrives_at) where status = 'flying';

-- 하늘 위 표시용 공개 뷰 (본문·목적지 도시 없음 — 목적지는 비밀)
create or replace view public.letters_public as
  select id, kind, sender_id, vehicle, shield, status, departed_at, arrives_at, distance_km, penalty, sunk_at, sunk_until,
         origin - 'city' - 'country' as origin, destination - 'city' - 'country' as destination, waypoints, trail, redirects, pulls, direct
  from public.letters where status in ('flying','sunk') and recipient_id is null;

-- ───────────────────────── passbys ─────────────────────────
create table if not exists public.passbys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  letter_id uuid not null references public.letters(id) on delete cascade,
  at timestamptz not null default now(),
  expires_at timestamptz not null,
  can_catch boolean not null default true,
  peeked boolean not null default false,
  resolved text check (resolved in ('caught','rerouted','pulled','snail','sunk','space','missed','defended')),
  unique (user_id, letter_id)
);
create index if not exists passbys_user_open_idx on public.passbys (user_id) where resolved is null;

-- ───────────────────────── chats ─────────────────────────
create table if not exists public.chats (
  id text primary key,            -- 작은 uuid _ 큰 uuid
  members uuid[] not null,
  since timestamptz not null default now(),
  last_message_at timestamptz
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.users(id),
  text text not null check (char_length(text) between 1 and 2000),
  at timestamptz not null default now()
);
create index if not exists messages_chat_at_idx on public.messages (chat_id, at desc);
create table if not exists public.chat_reads (chat_id text references public.chats(id) on delete cascade, user_id uuid references public.users(id) on delete cascade, last_read_at timestamptz not null default now(), primary key (chat_id, user_id));

-- ───────────────────────── community ─────────────────────────
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid references public.letters(id),
  author_id uuid not null references public.users(id) on delete cascade,
  text text not null,
  image_url text,
  city text not null, country text not null, stamp text not null default '',
  lat double precision not null, lng double precision not null,   -- 거리 계산용(클라이언트엔 거리만)
  vehicle text not null,
  share_to_story boolean not null default false,
  likes int not null default 0,
  at timestamptz not null default now()
);
create index if not exists posts_at_idx on public.posts (at desc);
create index if not exists posts_story_idx on public.posts (country, at desc) where share_to_story;
create table if not exists public.post_likes (post_id uuid references public.posts(id) on delete cascade, user_id uuid references public.users(id) on delete cascade, at timestamptz default now(), primary key (post_id, user_id));
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 300),
  at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, at);

-- ───────────────────────── notifications · purchases · ledger ─────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null, title text not null, body text not null, route text,
  read boolean not null default false,
  at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, at desc);
create table if not exists public.push_queue (
  id bigserial primary key,
  user_id uuid not null,
  title text not null, body text not null, route text,
  kind text not null,                 -- passby | reply | friend | chat | mischief | system
  priority smallint not null default 5,
  created_at timestamptz not null default now(),
  sent_at timestamptz, error text
);
create index if not exists push_queue_pending_idx on public.push_queue (priority, created_at) where sent_at is null;
create table if not exists public.purchases (
  id text primary key,                -- 스토어 트랜잭션 id (중복 지급 방지)
  user_id uuid not null references public.users(id),
  product_id text not null, kind text not null check (kind in ('pack','plan')),
  krw int not null, coins int not null default 0,
  raw jsonb, at timestamptz not null default now()
);
create table if not exists public.coin_ledger (
  id bigserial primary key,
  user_id uuid not null references public.users(id),
  delta int not null, reason text not null, ref text,
  balance_after int not null,
  at timestamptz not null default now()
);
create index if not exists coin_ledger_user_idx on public.coin_ledger (user_id, at desc);

-- ───────────────────────── analytics events ─────────────────────────
create table if not exists public.events (
  id bigserial primary key,
  device text not null,
  user_id uuid,
  guest boolean not null default true,
  session text not null,
  name text not null,
  screen text,
  props jsonb,
  at timestamptz not null,
  received_at timestamptz not null default now()
);
create index if not exists events_name_at_idx on public.events (name, at desc);
create index if not exists events_device_at_idx on public.events (device, at desc);
-- 파티셔닝은 월 단위로 전환 권장(트래픽 증가 시): docs/SCALE.md

-- ───────────────────────── RLS ─────────────────────────
alter table public.users enable row level security;
alter table public.users_private enable row level security;
alter table public.letters enable row level security;
alter table public.passbys enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.chat_reads enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.push_queue enable row level security;
alter table public.purchases enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.events enable row level security;

-- users: 공개 프로필은 누구나(비회원 포함) 읽음. 게임 필드는 서버만 수정 → 클라이언트는 프로필 컬럼만 update (트리거로 강제)
create policy users_read on public.users for select using (true);
create policy users_insert_self on public.users for insert with check (auth.uid() = id);
create policy users_update_self on public.users for update using (auth.uid() = id) with check (auth.uid() = id);
create or replace function public.guard_user_update() returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    -- 게임 상태는 클라이언트가 못 바꾼다
    new.coins := old.coins; new.inventory := old.inventory; new.quota := old.quota; new.stats := old.stats; new.stamps := old.stamps;
    new.friend_ids := old.friend_ids; new.revealed_ids := old.revealed_ids; new.plan := old.plan; new.plan_expires_at := old.plan_expires_at; new.shield_milestone := old.shield_milestone;
  end if;
  return new;
end $$;
drop trigger if exists users_guard on public.users;
create trigger users_guard before update on public.users for each row execute function public.guard_user_update();

-- users_private: 본인만 쓰고, 아무도 읽지 못한다 (서버 service_role 만)
create policy users_private_write on public.users_private for insert with check (auth.uid() = user_id);
create policy users_private_update on public.users_private for update using (auth.uid() = user_id);

-- letters: 참여자만 본문 읽기. 쓰기는 Edge Function 만. 하늘 위 표시는 letters_public 뷰
create policy letters_read_participants on public.letters for select using (auth.uid() = any (participants));
grant select on public.letters_public to anon, authenticated;

-- passbys: 본인 것만 읽기
create policy passbys_read on public.passbys for select using (auth.uid() = user_id);

-- chats/messages: 멤버만 · 메시지 생성은 본인 sender 만 · 멤버가 아니면 불가
create policy chats_read on public.chats for select using (auth.uid() = any (members));
create policy messages_read on public.messages for select using (exists (select 1 from public.chats ch where ch.id = chat_id and auth.uid() = any (ch.members)));
create policy messages_insert on public.messages for insert with check (auth.uid() = sender_id and exists (select 1 from public.chats ch where ch.id = chat_id and auth.uid() = any (ch.members)));
create policy chat_reads_rw on public.chat_reads for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- posts: 누구나 읽음(비회원 포함) — 좌표는 뷰로 숨긴다. 쓰기는 Edge Function(엽서 공개)
create policy posts_read on public.posts for select using (true);
create or replace view public.posts_public as select id, letter_id, author_id, text, image_url, stamp, vehicle, share_to_story, likes, at from public.posts;
grant select on public.posts_public to anon, authenticated;
create policy post_likes_rw on public.post_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy comments_read on public.comments for select using (true);
create policy comments_insert on public.comments for insert with check (auth.uid() = author_id);

create policy notifications_read on public.notifications for select using (auth.uid() = user_id);
create policy notifications_update on public.notifications for update using (auth.uid() = user_id);
create policy purchases_read on public.purchases for select using (auth.uid() = user_id);
create policy coin_ledger_read on public.coin_ledger for select using (auth.uid() = user_id);
-- events: 비회원(anon)도 insert 만 가능, 읽기는 서버만
create policy events_insert on public.events for insert with check (true);

-- 좋아요 카운터 (트리거)
create or replace function public.bump_likes() returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then update public.posts set likes = likes + 1 where id = new.post_id; return new;
  else update public.posts set likes = greatest(0, likes - 1) where id = old.post_id; return old; end if;
end $$;
drop trigger if exists post_likes_bump on public.post_likes;
create trigger post_likes_bump after insert or delete on public.post_likes for each row execute function public.bump_likes();

-- 채팅 마지막 시각 + 푸시 큐 (수신자에게)
create or replace function public.on_message() returns trigger language plpgsql security definer as $$
declare m uuid; snd text;
begin
  update public.chats set last_message_at = new.at where id = new.chat_id;
  select nickname into snd from public.users where id = new.sender_id;
  for m in select unnest(members) from public.chats where id = new.chat_id loop
    if m <> new.sender_id then insert into public.push_queue (user_id, title, body, route, kind, priority) values (m, coalesce(snd,'친구'), left(new.text, 80), '/chat/' || new.sender_id, 'chat', 2); end if;
  end loop;
  return new;
end $$;
drop trigger if exists messages_after on public.messages;
create trigger messages_after after insert on public.messages for each row execute function public.on_message();

-- 실시간: 채팅·알림·통과는 postgres_changes 로 구독
alter publication supabase_realtime add table public.messages, public.notifications, public.passbys;

-- ───────────────────────── 스케줄 ─────────────────────────
-- 매 분 세계 틱 (Edge Function tick-world) · 매 30초 푸시 디스패치. URL/키는 setup 스크립트가 치환한다.
-- select cron.schedule('tick-world', '* * * * *', $$select net.http_post(url:='https://<PROJECT>.functions.supabase.co/tick-world', headers:='{"Authorization":"Bearer <SERVICE_ROLE>"}'::jsonb, body:='{}'::jsonb)$$);
-- select cron.schedule('push-dispatch', '30 seconds', $$select net.http_post(url:='https://<PROJECT>.functions.supabase.co/push-dispatch', headers:='{"Authorization":"Bearer <SERVICE_ROLE>"}'::jsonb, body:='{}'::jsonb)$$);

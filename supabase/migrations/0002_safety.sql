-- WorldWideSomeone · 안전(신고·차단) + 계정 삭제
-- 스토어 심사 필수 요건: App Store 1.2(UGC 신고·차단) · 5.1.1(v)(앱 안에서 계정 삭제) · Google Play UGC/계정 삭제 정책.
-- SQL 에디터에 그대로 붙여 실행해도 된다(여러 번 실행해도 안전).

-- ───────────────────────── 차단 ─────────────────────────
create table if not exists public.blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;
drop policy if exists blocks_rw on public.blocks;
create policy blocks_rw on public.blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

-- 두 사람 사이에 어느 쪽이든 차단이 있는지 (RLS·서버 함수에서 사용)
create or replace function public.is_blocked(a uuid, b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- 채팅: 차단 관계면 메시지를 보낼 수 없다
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  auth.uid() = sender_id
  and exists (select 1 from public.chats ch where ch.id = chat_id and auth.uid() = any (ch.members)
              and not exists (select 1 from unnest(ch.members) m where m <> auth.uid() and public.is_blocked(auth.uid(), m)))
);
-- 댓글: 엽서 작성자와 차단 관계면 댓글을 달 수 없다
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert with check (
  auth.uid() = author_id
  and not exists (select 1 from public.posts p where p.id = post_id and public.is_blocked(auth.uid(), p.author_id))
);

-- ───────────────────────── 신고 ─────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete set null,
  target_user_id uuid references public.users(id) on delete set null,
  target_ref text,                                  -- 대상 사용자 식별자 원문(봇·삭제된 계정 대비)
  kind text not null check (kind in ('user','letter','post','comment','message')),
  target_id text,                                   -- 편지·엽서·댓글·메시지 id
  reason text not null check (reason in ('spam','harassment','sexual','violence','scam','underage','other')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text
);
create index if not exists reports_open_idx on public.reports (created_at) where status = 'open';
alter table public.reports enable row level security;
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert with check (auth.uid() = reporter_id);
-- 읽기·처리는 서버(service_role)와 대시보드만. 운영: 테이블 에디터에서 status='open' 을 24시간 안에 처리한다.

-- 운영 큐: 신고 대상 콘텐츠 본문을 함께 보여준다(대시보드 전용 — 클라이언트에 권한 없음)
create or replace view public.reports_queue as
  select r.id, r.created_at, r.kind, r.reason, r.note, r.status,
         r.reporter_id, r.target_user_id, u.nickname as target_nickname,
         coalesce(
           (select l.text from public.letters l where r.kind = 'letter' and l.id::text = r.target_id),
           (select p.text from public.posts p where r.kind = 'post' and p.id::text = r.target_id),
           (select c.text from public.comments c where r.kind = 'comment' and c.id::text = r.target_id),
           (select m.text from public.messages m where r.kind = 'message' and m.id::text = r.target_id)
         ) as content,
         (select count(*) from public.reports r2 where r2.target_user_id = r.target_user_id) as reports_on_user
  from public.reports r left join public.users u on u.id = r.target_user_id
  order by (r.status = 'open') desc, r.created_at;
revoke all on public.reports_queue from anon, authenticated;

-- ───────────────────────── 계정 삭제 ─────────────────────────
-- 결제 기록은 전자상거래법상 5년 보관 → 사용자 FK 를 끊고 남긴다(user_id 값만 보존)
alter table public.purchases drop constraint if exists purchases_user_id_fkey;

-- 게임 필드 보호 트리거가 삭제 정리(친구 목록에서 빼기)까지 막지 않도록, 이 함수 안에서만 우회 플래그를 켠다
create or replace function public.guard_user_update() returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' and coalesce(current_setting('wws.bypass_guard', true), '') <> 'on' then
    new.coins := old.coins; new.inventory := old.inventory; new.quota := old.quota; new.stats := old.stats; new.stamps := old.stamps;
    new.friend_ids := old.friend_ids; new.revealed_ids := old.revealed_ids; new.plan := old.plan; new.plan_expires_at := old.plan_expires_at; new.shield_milestone := old.shield_milestone;
  end if;
  return new;
end $$;

create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  perform set_config('wws.bypass_guard', 'on', true);
  delete from public.coin_ledger where user_id = me;
  delete from public.chats where me = any (members);                 -- 메시지·읽음 표시는 cascade
  delete from public.messages where sender_id = me;
  -- 편지: 내가 보냈거나 나에게 온 편지. 답장·엽서의 참조를 먼저 끊는다
  update public.letters set reply_to_id = null where reply_to_id in (select id from public.letters where sender_id = me or recipient_id = me);
  update public.posts set letter_id = null where letter_id in (select id from public.letters where sender_id = me or recipient_id = me);
  delete from public.letters where sender_id = me or recipient_id = me;
  update public.letters set caught_by = case when caught_by = me then null else caught_by end, participants = array_remove(participants, me), peeked_by = array_remove(peeked_by, me)
    where me = any (participants) or caught_by = me or me = any (peeked_by);
  update public.users set friend_ids = array_remove(friend_ids, me), revealed_ids = array_remove(revealed_ids, me) where me = any (friend_ids) or me = any (revealed_ids);
  update public.reports set reporter_id = null where reporter_id = me;
  delete from public.events where user_id = me;
  delete from public.push_queue where user_id = me;
  -- auth 사용자 삭제 → public.users 와 users_private·posts·comments·likes·notifications·passbys·blocks 가 cascade 로 지워진다
  delete from auth.users where id = me;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

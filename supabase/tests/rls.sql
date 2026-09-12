-- RLS 검증 (supabase db query -f supabase/tests/rls.sql 또는 SQL 에디터). 각 문장은 실패해야 정상인 것을 주석으로 표시.
-- 준비: 두 사용자 uuid 를 a, b 로 치환
-- 1) 타인의 users_private 읽기 → 0행
set role authenticated; set request.jwt.claims = '{"sub":"<a>","role":"authenticated"}';
select count(*) as should_be_0 from public.users_private where user_id = '<b>';
-- 2) 내 users_private 읽기도 0행 (서버만 읽음)
select count(*) as should_be_0 from public.users_private where user_id = '<a>';
-- 3) 비참여 편지 본문 읽기 → 0행
select count(*) as should_be_0 from public.letters where not ('<a>' = any(participants));
-- 4) 게임 필드 수정 시도 → 트리거가 되돌린다
update public.users set coins = 999999 where id = '<a>'; select coins as should_be_unchanged from public.users where id = '<a>';
-- 5) 남의 채팅방 메시지 insert → 실패(정책 위반)
insert into public.messages (chat_id, sender_id, text) values ('<b>_<c>', '<a>', 'x');
-- 6) 비회원(anon) 이벤트 insert → 성공, 읽기 → 0행
set role anon; insert into public.events (device, session, name, at) values ('dev1', 's1', 'screen_view', now()); select count(*) as should_be_0 from public.events;
reset role;

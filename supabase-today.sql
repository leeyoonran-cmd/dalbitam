-- 달빛암 '오늘 다녀간 사람 · 지금까지 달린 소원 연등' 숫자 (누구나 볼 수 있는 숫자 두 개만 알려줘요)
-- Supabase → SQL Editor → New query 에 통째로 붙여 넣고 [Run] 을 누르세요. (여러 번 실행해도 괜찮아요)
-- supabase-visits.sql 을 먼저 실행해 둔 상태여야 해요.

create or replace function public.temple_today()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'today', (select count(distinct visitor) from public.visits
               where started_at > date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'),
    'wishes', (select count(*) from public.wishes)
  );
$$;

revoke all on function public.temple_today() from public;
grant execute on function public.temple_today() to anon, authenticated;

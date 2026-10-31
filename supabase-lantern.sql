-- 달빛암 연등 종류(황금등·지혜등…) + 108배 불 켜기
-- Supabase → SQL Editor → New query 에 통째로 붙여 넣고 [Run] 을 누르세요. (여러 번 실행해도 괜찮아요)

-- 1) 연등 종류와 불 켜짐 칸 추가
alter table public.wishes add column if not exists kind text;
alter table public.wishes add column if not exists lit boolean not null default false;

alter table public.wishes drop constraint if exists wishes_kind_check;
alter table public.wishes add constraint wishes_kind_check
  check (kind is null or kind in ('gold', 'wisdom', 'health', 'love', 'hope'));

-- 2) 예전에 단 연등(종류 없음)은 원래처럼 불이 켜진 채로 둬요
update public.wishes set lit = true where kind is null and lit = false;

-- 3) 새 연등은 꼭 불이 꺼진 채로만 달 수 있게
drop policy if exists "wishes insert" on public.wishes;
create policy "wishes insert" on public.wishes for insert
  with check (
    char_length(text) between 1 and 40
    and (nick is null or char_length(nick) <= 8)
    and (kind is null or kind in ('gold', 'wisdom', 'health', 'love', 'hope'))
    and lit = false
  );

-- 4) 108배를 마치면 불을 켜는 함수 (불 켜기만 가능, 글은 못 고쳐요 · 최근 30일 연등만)
create or replace function public.light_wish(wish_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.wishes
     set lit = true
   where id = wish_id
     and lit = false
     and created_at > now() - interval '30 days';
$$;

revoke all on function public.light_wish(bigint) from public;
grant execute on function public.light_wish(bigint) to anon, authenticated;

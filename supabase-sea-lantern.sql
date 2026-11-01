-- 달빛암 바다 연등: 연등을 마당 대신 바닷가 연등 줄에 걸 수 있게 해요
-- Supabase → SQL Editor → New query 에 통째로 붙여 넣고 [Run] 을 누르세요. (여러 번 실행해도 괜찮아요)

alter table public.wishes add column if not exists place text;
alter table public.wishes drop constraint if exists wishes_place_check;
alter table public.wishes add constraint wishes_place_check check (place is null or place in ('sea'));

drop policy if exists "wishes insert" on public.wishes;
create policy "wishes insert" on public.wishes for insert
  with check (
    char_length(text) between 1 and 40
    and (nick is null or char_length(nick) <= 8)
    and (kind is null or kind in ('gold', 'wisdom', 'health', 'love', 'hope'))
    and (place is null or place = 'sea')
    and lit = false
  );

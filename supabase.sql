-- 달빛암: Supabase SQL Editor 에 통째로 붙여 넣고 [Run] 을 누르세요.

-- 1) 소원 연등 테이블
create table if not exists public.wishes (
  id bigint generated always as identity primary key,
  text text not null check (char_length(text) between 1 and 40),
  nick text check (char_length(nick) <= 8),
  created_at timestamptz not null default now()
);

-- 2) 누구나 읽고, 누구나 새 연등을 달 수 있게 (수정·삭제는 관리자 화면에서만)
alter table public.wishes enable row level security;

drop policy if exists "wishes read" on public.wishes;
create policy "wishes read" on public.wishes for select using (true);

drop policy if exists "wishes insert" on public.wishes;
create policy "wishes insert" on public.wishes for insert
  with check (char_length(text) between 1 and 40 and (nick is null or char_length(nick) <= 8));

-- 3) 새 연등이 올라오면 모두의 화면에 바로 보이게
alter publication supabase_realtime add table public.wishes;

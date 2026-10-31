-- 달빛암 기와 불사(소원 기와)
-- Supabase → SQL Editor → New query 에 통째로 붙여 넣고 [Run] 을 누르세요. (여러 번 실행해도 괜찮아요)

create table if not exists public.giwa (
  id bigint generated always as identity primary key,
  text text not null check (char_length(text) between 1 and 20),
  nick text check (char_length(nick) <= 8),
  created_at timestamptz not null default now()
);

alter table public.giwa enable row level security;

drop policy if exists "giwa read" on public.giwa;
create policy "giwa read" on public.giwa for select using (true);

drop policy if exists "giwa insert" on public.giwa;
create policy "giwa insert" on public.giwa for insert
  with check (char_length(text) between 1 and 20 and (nick is null or char_length(nick) <= 8));

-- 새 기와가 올라오면 모두의 화면에 바로 보이게
do $$ begin
  alter publication supabase_realtime add table public.giwa;
exception when duplicate_object then null;
end $$;

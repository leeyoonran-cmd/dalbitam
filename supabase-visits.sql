-- 달빛암 방문 기록 (방문자 수 · 머무른 시간) + 통계 보기
-- Supabase → SQL Editor → New query 에 통째로 붙여 넣고 [Run]. (여러 번 실행해도 괜찮아요)
-- 통계 페이지 비밀번호는 아래 'dal-chf7sz29' 이에요. 바꾸고 싶으면 이 글자만 고쳐서 다시 실행하세요.

create table if not exists public.visits (
  id uuid primary key,
  visitor text not null check (char_length(visitor) <= 24),   -- 기기마다 만든 무작위 번호 (개인정보 아님)
  nick text check (char_length(nick) <= 8),
  ref text check (char_length(ref) <= 40),                     -- 어디서 왔는지 (instagram 등)
  mobile boolean,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  secs int not null default 0,
  bows int not null default 0,
  acts jsonb not null default '{}'::jsonb
);
create index if not exists visits_started on public.visits (started_at desc);
create index if not exists visits_visitor on public.visits (visitor);

-- 아무도 표를 직접 읽거나 고칠 수 없게 (아래 함수로만)
alter table public.visits enable row level security;

create table if not exists public.stats_conf (k text primary key, v text not null);
alter table public.stats_conf enable row level security;
insert into public.stats_conf (k, v) values ('pass', 'dal-chf7sz29') on conflict (k) do update set v = excluded.v;

-- 입장할 때
create or replace function public.visit_start(p_id uuid, p_visitor text, p_nick text, p_ref text, p_mobile boolean)
returns void language sql security definer set search_path = public as $$
  insert into public.visits (id, visitor, nick, ref, mobile)
  values (p_id, left(p_visitor, 24), left(p_nick, 8), left(p_ref, 40), p_mobile)
  on conflict (id) do nothing;
$$;

-- 머무는 동안 20초마다 (5분 넘게 소식이 없으면 그 방문은 끝난 것으로 봐요)
create or replace function public.visit_ping(p_id uuid, p_bows int, p_acts jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.visits
     set last_seen = now(),
         secs = least(extract(epoch from now() - started_at)::int, 6 * 3600),
         bows = greatest(bows, least(coalesce(p_bows, 0), 5000)),
         acts = case when pg_column_size(p_acts) < 2000 then coalesce(p_acts, acts) else acts end
   where id = p_id and last_seen > now() - interval '5 minutes' and started_at > now() - interval '6 hours';
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- 통계 (비밀번호가 맞을 때만)
create or replace function public.visit_stats(p_pass text, p_days int default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; d int := least(greatest(coalesce(p_days, 7), 1), 90);
begin
  if p_pass is distinct from (select v from public.stats_conf where k = 'pass') then return null; end if;
  with v as (select * from public.visits where started_at > now() - make_interval(days => d)),
  first_seen as (select visitor, min(started_at) f from public.visits group by visitor)
  select jsonb_build_object(
    'days', d,
    'visits', (select count(*) from v),
    'visitors', (select count(distinct visitor) from v),
    'today', (select count(distinct visitor) from v where started_at > date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'),
    'now', (select count(*) from public.visits where last_seen > now() - interval '1 minute'),
    'avg_secs', (select coalesce(round(avg(secs)), 0) from v),
    'median_secs', (select coalesce(percentile_cont(.5) within group (order by secs), 0) from v),
    'max_secs', (select coalesce(max(secs), 0) from v),
    'stayed_5m', (select count(*) from v where secs >= 300),
    'bow108', (select count(*) from v where bows >= 108),
    'returning', (select count(distinct v.visitor) from v join first_seen f using (visitor) where f.f < now() - make_interval(days => d) or exists (select 1 from public.visits x where x.visitor = v.visitor and x.started_at < v.started_at - interval '30 minutes')),
    'mobile_pct', (select coalesce(round(100.0 * count(*) filter (where mobile) / nullif(count(*), 0)), 0) from v),
    'per_day', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'visitors', n, 'avg_secs', a) order by day), '[]') from (
        select to_char(started_at at time zone 'Asia/Seoul', 'MM-DD') day, count(distinct visitor) n, round(avg(secs)) a from v group by 1) t),
    'refs', (select coalesce(jsonb_agg(jsonb_build_object('ref', ref, 'n', n) order by n desc), '[]') from (
        select coalesce(nullif(ref, ''), '직접 방문') ref, count(*) n from v group by 1 order by 2 desc limit 6) t),
    'acts', (select coalesce(jsonb_object_agg(k, n), '{}') from (select k, sum((val)::int) n from v, jsonb_each_text(v.acts) e(k, val) where val ~ '^[0-9]+$' group by k) t),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('nick', nick, 'at', to_char(started_at at time zone 'Asia/Seoul', 'MM-DD HH24:MI'), 'secs', secs, 'bows', bows, 'ref', ref) order by started_at desc), '[]') from (
        select * from v order by started_at desc limit 30) t)
  ) into r;
  return r;
end $$;

revoke all on function public.visit_start(uuid, text, text, text, boolean) from public;
revoke all on function public.visit_ping(uuid, int, jsonb) from public;
revoke all on function public.visit_stats(text, int) from public;
grant execute on function public.visit_start(uuid, text, text, text, boolean) to anon, authenticated;
grant execute on function public.visit_ping(uuid, int, jsonb) to anon, authenticated;
grant execute on function public.visit_stats(text, int) to anon, authenticated;

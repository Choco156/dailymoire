/* ================================================================
   daymoire · core.js
   DB 연결 설정, 공통 도구(날짜·아이콘·알림), 상태, 처음 설정용 SQL
   ================================================================ */

/* ================================================================
   ▼ 설정: Supabase > Project Settings > API 에서 복사해 넣으세요 ▼
   - SUPABASE_URL      : Project URL (https://xxxx.supabase.co)
   - SUPABASE_ANON_KEY : anon public 키 (또는 Publishable key)
   ※ service_role / Secret 키는 절대 넣지 마세요.
   ================================================================ */
const SUPABASE_URL = 'https://xnqmopfspqeqslgvtvlx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_a4WXfWomjpz3nqdtfUrETw_t3LkMZAN';
/* ================================================================ */

const KEY_STORE = 'dm_access_key';
const DOW = ['일','월','화','수','목','금','토'];
const CATS = ['must','home','routine','personal'];
const CAT_LABEL = { must:'Must Do', home:'Home', routine:'Routine', personal:'Personal' };
const CAT_HINT = { must:'꼭 해야 하는 일', home:'집안일', routine:'생활 루틴', personal:'개인 일정' };
const PRIS = ['high','medium','low'];
const PRI_LABEL = { high:'높음', medium:'보통', low:'낮음' };

/* ---------- 날짜 ---------- */
const pad = n => String(n).padStart(2, '0');
const toStr = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseDate = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const todayStr = () => toStr(new Date());
const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate()+n); return toStr(d); };
const weekStart = s => { const d = parseDate(s); const w = d.getDay(); d.setDate(d.getDate() + (w === 0 ? -6 : 1 - w)); return toStr(d); };
const rangeDays = (a, b) => { const o = []; for (let c = a; c <= b; c = addDays(c, 1)) o.push(c); return o; };
const monthStart = s => s.slice(0, 8) + '01';
const monthEnd = s => { const d = parseDate(monthStart(s)); d.setMonth(d.getMonth()+1); d.setDate(0); return toStr(d); };
const addMonths = (s, n) => { const d = parseDate(monthStart(s)); d.setMonth(d.getMonth()+n); return toStr(d); };
const fmtMD = s => { const d = parseDate(s); return `${d.getMonth()+1}월 ${d.getDate()}일`; };
const fmtShort = s => { const d = parseDate(s); return `${d.getMonth()+1}/${d.getDate()}`; };
const dow = s => parseDate(s).getDay();
const lk = (rid, d) => rid + '|' + d;

/* ---------- 유틸 ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const ICONS = {
  check:'<path d="M20 6 9 17l-5-5"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  pencil:'<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  left:'<path d="m15 18-6-6 6-6"/>',
  right:'<path d="m9 18 6-6-6-6"/>',
  star:'<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  calplus:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  sprout:'<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  up:'<path d="m18 15-6-6-6 6"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  archive:'<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'
};
const icon = (n, size = 18, sw = 1.75) =>
  `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
const flower = (s = 14) =>
  `<svg width="${s}" height="${s}" viewBox="-16 -16 32 32" aria-hidden="true"><g fill="#DFA6A3"><circle cy="-8" r="5.6"/><circle cx="7.6" cy="-2.5" r="5.6"/><circle cx="4.7" cy="6.5" r="5.6"/><circle cx="-4.7" cy="6.5" r="5.6"/><circle cx="-7.6" cy="-2.5" r="5.6"/></g><circle r="3.4" fill="#E8DDBF"/></svg>`;
const logo = (cls = '') => `<span class="logo ${cls}">daymoire${flower()}</span>`;

function toast(message, kind = 'info') {
  const el = document.createElement('div');
  el.className = 'toast' + (kind === 'error' ? ' error' : '');
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = message;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 5000 : 2500);
}

/* ---------- 상태 ---------- */
const S = {
  page: 'today', today: '', locked: false, loading: true, error: null,
  tasks: [], inbox: [], upcoming: [], routines: [], routinesAll: [], logs: {}, daily: {}, free: [],
  mood: '', freeNew: '', memoDraft: {}, showInboxDone: false,
  weekStart: '', mlPeriod: 'week', mlAnchor: '',
  modal: null, lockMsg: ''
};

/* ---------- Supabase ---------- */
let sb = null;
const getKey = () => { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } };
const setKey = v => { try { v ? localStorage.setItem(KEY_STORE, v) : localStorage.removeItem(KEY_STORE); } catch {} };

function friendly(m = '') {
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return '네트워크에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.';
  if (/Could not find the function|does not exist/i.test(m)) return 'DB 설정 SQL이 아직 실행되지 않았어요. Supabase SQL Editor에서 설정 SQL을 실행해 주세요.';
  if (/Invalid API key|JWT/i.test(m)) return 'Supabase 키가 맞지 않아요. 파일 위쪽 SUPABASE_ANON_KEY 값을 확인해 주세요.';
  return m;
}

async function rpc(fn, args = {}) {
  const { data, error } = await sb.rpc(fn, { p_key: getKey(), ...args });
  if (error) {
    if ((error.message || '').includes('ACCESS_DENIED')) {
      setKey('');
      S.locked = true;
      S.lockMsg = '접속 키가 맞지 않아요. 다시 입력해 주세요.';
      render();
      throw new Error('접속 키가 맞지 않아요.');
    }
    throw new Error(friendly(error.message));
  }
  return data;
}

/* ---------- 처음 설정용 SQL ----------
   Supabase > SQL Editor 에 붙여넣고 Run 하는 내용이에요.
   (core.js 위쪽 SUPABASE 값이 비어 있으면 화면에 이 SQL과 복사 버튼이 나와요.)
   이미 설정을 마쳤다면 다시 실행할 필요 없어요. 업데이트는 별도 SQL 파일을 쓰세요. */
const SETUP_SQL = String.raw`
-- ▼▼▼ 1. 아래 '여기에_접속키' 를 나만의 접속 키(영문·숫자 12자 이상)로 바꾸세요 ▼▼▼
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.dm_secret (
  id int primary key default 1 check (id = 1),
  key_hash text not null
);
alter table public.dm_secret enable row level security;
revoke all on table public.dm_secret from anon, authenticated;

do $$
declare my_key text := '여기에_접속키';
begin
  if my_key = '여기에_접속키' or length(my_key) < 12 then
    raise exception '접속 키를 12자 이상의 나만의 값으로 바꾼 뒤 다시 실행해 주세요.';
  end if;
  insert into public.dm_secret (id, key_hash)
  values (1, encode(extensions.digest(my_key, 'sha256'), 'hex'))
  on conflict (id) do update set key_hash = excluded.key_hash;
end $$;
-- ▲▲▲ 여기까지만 바꾸면 됩니다. 나머지는 그대로 두세요. ▲▲▲

create table if not exists public.dm_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  category text not null default 'personal' check (category in ('must','home','routine','personal')),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  due_date date,
  memo text,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dm_tasks_due_idx on public.dm_tasks (due_date);

create table if not exists public.dm_routines (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  frequency text not null default 'daily' check (frequency in ('daily','weekly')),
  target_count int not null default 7,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.dm_routine_logs (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.dm_routines(id) on delete cascade,
  log_date date not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (routine_id, log_date)
);

create table if not exists public.dm_daily_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  home_cooked boolean not null default false,
  exercised boolean not null default false,
  went_out boolean not null default false,
  memo text,
  mood text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dm_free_activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 보안: 표는 전부 잠금. 페이지는 아래 함수로만, 접속 키가 맞을 때만 읽고 쓸 수 있음
alter table public.dm_tasks enable row level security;
alter table public.dm_routines enable row level security;
alter table public.dm_routine_logs enable row level security;
alter table public.dm_daily_logs enable row level security;
alter table public.dm_free_activities enable row level security;
revoke all on table public.dm_tasks, public.dm_routines, public.dm_routine_logs,
  public.dm_daily_logs, public.dm_free_activities from anon, authenticated;

create or replace function public.dm_auth(p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_key is null or not exists (
    select 1 from public.dm_secret where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
  ) then
    raise exception 'ACCESS_DENIED';
  end if;
end $$;

create or replace function public.dm_check(p_key text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin perform public.dm_auth(p_key); return true; end $$;

create or replace function public.dm_tasks_today(p_key text, p_date date, p_since timestamptz)
returns setof public.dm_tasks
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.dm_auth(p_key);
  return query select * from public.dm_tasks t
  where t.due_date = p_date
     or (t.due_date < p_date and (t.is_completed = false or t.completed_at >= p_since))
  order by t.created_at;
end $$;

create or replace function public.dm_tasks_inbox(p_key text)
returns setof public.dm_tasks
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.dm_auth(p_key);
  return query select * from public.dm_tasks t where t.due_date is null order by t.created_at;
end $$;

create or replace function public.dm_tasks_upcoming(p_key text, p_date date)
returns setof public.dm_tasks
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.dm_auth(p_key);
  return query select * from public.dm_tasks t
  where t.due_date > p_date and t.is_completed = false order by t.due_date, t.created_at;
end $$;

create or replace function public.dm_task_save(p_key text, p_data jsonb)
returns public.dm_tasks
language plpgsql security definer set search_path = public, extensions as $$
declare r public.dm_tasks;
begin
  perform public.dm_auth(p_key);
  if p_data ? 'title' and coalesce(btrim(p_data->>'title'), '') = '' then
    raise exception '할 일 제목을 입력해 주세요.';
  end if;
  if coalesce(p_data->>'id', '') <> '' then
    update public.dm_tasks set
      title        = case when p_data ? 'title' then left(btrim(p_data->>'title'), 200) else title end,
      category     = case when p_data ? 'category' then p_data->>'category' else category end,
      priority     = case when p_data ? 'priority' then p_data->>'priority' else priority end,
      due_date     = case when p_data ? 'due_date' then nullif(p_data->>'due_date', '')::date else due_date end,
      memo         = case when p_data ? 'memo' then nullif(left(p_data->>'memo', 2000), '') else memo end,
      is_completed = case when p_data ? 'is_completed' then (p_data->>'is_completed')::boolean else is_completed end,
      completed_at = case when p_data ? 'is_completed'
                       then (case when (p_data->>'is_completed')::boolean then now() else null end)
                       else completed_at end,
      updated_at   = now()
    where id = (p_data->>'id')::uuid
    returning * into r;
    if not found then raise exception '해당 할 일을 찾을 수 없어요.'; end if;
  else
    if coalesce(btrim(p_data->>'title'), '') = '' then raise exception '할 일 제목을 입력해 주세요.'; end if;
    insert into public.dm_tasks (title, category, priority, due_date, memo)
    values (left(btrim(p_data->>'title'), 200),
            coalesce(p_data->>'category', 'personal'),
            coalesce(p_data->>'priority', 'medium'),
            nullif(p_data->>'due_date', '')::date,
            nullif(left(p_data->>'memo', 2000), ''))
    returning * into r;
  end if;
  return r;
end $$;

create or replace function public.dm_task_delete(p_key text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.dm_auth(p_key);
  delete from public.dm_tasks where id = p_id;
end $$;

create or replace function public.dm_routines_list(p_key text)
returns setof public.dm_routines
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.dm_auth(p_key);
  return query select * from public.dm_routines r where r.is_active order by r.sort_order, r.created_at;
end $$;

create or replace function public.dm_routine_logs_range(p_key text, p_from date, p_to date)
returns setof public.dm_routine_logs
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.dm_auth(p_key);
  return query select * from public.dm_routine_logs l where l.log_date between p_from and p_to;
end $$;

create or replace function public.dm_routine_set(p_key text, p_routine uuid, p_date date, p_done boolean)
returns public.dm_routine_logs
language plpgsql security definer set search_path = public, extensions as $$
declare r public.dm_routine_logs;
begin
  perform public.dm_auth(p_key);
  insert into public.dm_routine_logs (routine_id, log_date, is_completed)
  values (p_routine, p_date, p_done)
  on conflict (routine_id, log_date) do update set is_completed = excluded.is_completed
  returning * into r;
  return r;
end $$;

create or replace function public.dm_daily_range(p_key text, p_from date, p_to date)
returns setof public.dm_daily_logs
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.dm_auth(p_key);
  return query select * from public.dm_daily_logs d where d.log_date between p_from and p_to order by d.log_date;
end $$;

create or replace function public.dm_daily_set(p_key text, p_date date, p_data jsonb)
returns public.dm_daily_logs
language plpgsql security definer set search_path = public, extensions as $$
declare r public.dm_daily_logs;
begin
  perform public.dm_auth(p_key);
  insert into public.dm_daily_logs (log_date) values (p_date) on conflict (log_date) do nothing;
  update public.dm_daily_logs set
    home_cooked = case when p_data ? 'home_cooked' then (p_data->>'home_cooked')::boolean else home_cooked end,
    exercised   = case when p_data ? 'exercised' then (p_data->>'exercised')::boolean else exercised end,
    went_out    = case when p_data ? 'went_out' then (p_data->>'went_out')::boolean else went_out end,
    memo        = case when p_data ? 'memo' then nullif(left(p_data->>'memo', 500), '') else memo end,
    mood        = case when p_data ? 'mood' then nullif(left(p_data->>'mood', 200), '') else mood end,
    updated_at  = now()
  where log_date = p_date
  returning * into r;
  return r;
end $$;

create or replace function public.dm_free_list(p_key text)
returns setof public.dm_free_activities
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.dm_auth(p_key);
  return query select * from public.dm_free_activities f where f.is_active order by f.created_at;
end $$;

create or replace function public.dm_free_add(p_key text, p_title text)
returns public.dm_free_activities
language plpgsql security definer set search_path = public, extensions as $$
declare r public.dm_free_activities;
begin
  perform public.dm_auth(p_key);
  if coalesce(btrim(p_title), '') = '' then raise exception '활동 이름을 입력해 주세요.'; end if;
  insert into public.dm_free_activities (title) values (left(btrim(p_title), 50)) returning * into r;
  return r;
end $$;

create or replace function public.dm_free_hide(p_key text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.dm_auth(p_key);
  update public.dm_free_activities set is_active = false where id = p_id;
end $$;

-- 루틴 관리 (ROUTINE 탭)
create or replace function public.dm_routines_all(p_key text)
returns setof public.dm_routines
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.dm_auth(p_key);
  return query select * from public.dm_routines r order by r.is_active desc, r.sort_order, r.created_at;
end $$;

create or replace function public.dm_routine_save(p_key text, p_data jsonb)
returns public.dm_routines
language plpgsql security definer set search_path = public, extensions as $$
declare r public.dm_routines;
begin
  perform public.dm_auth(p_key);
  if p_data ? 'title' and coalesce(btrim(p_data->>'title'), '') = '' then
    raise exception '루틴 이름을 입력해 주세요.';
  end if;
  if p_data ? 'frequency' and coalesce(p_data->>'frequency', '') not in ('daily', 'weekly') then
    raise exception '빈도 값이 올바르지 않아요.';
  end if;
  if coalesce(p_data->>'id', '') <> '' then
    update public.dm_routines set
      title        = case when p_data ? 'title' then left(btrim(p_data->>'title'), 50) else title end,
      frequency    = case when p_data ? 'frequency' then p_data->>'frequency' else frequency end,
      target_count = case when p_data ? 'target_count' then least(7, greatest(1, (p_data->>'target_count')::int)) else target_count end,
      sort_order   = case when (p_data->>'is_active')::boolean is true and not is_active
                       then (select coalesce(max(x.sort_order), 0) + 1 from public.dm_routines x) else sort_order end,
      is_active    = case when p_data ? 'is_active' then (p_data->>'is_active')::boolean else is_active end
    where id = (p_data->>'id')::uuid
    returning * into r;
    if not found then raise exception '해당 루틴을 찾을 수 없어요.'; end if;
  else
    if coalesce(btrim(p_data->>'title'), '') = '' then raise exception '루틴 이름을 입력해 주세요.'; end if;
    insert into public.dm_routines (title, frequency, target_count, sort_order)
    values (left(btrim(p_data->>'title'), 50),
            coalesce(p_data->>'frequency', 'daily'),
            case when coalesce(p_data->>'frequency', 'daily') = 'daily' then 7
                 else least(7, greatest(1, coalesce((p_data->>'target_count')::int, 2))) end,
            (select coalesce(max(x.sort_order), 0) + 1 from public.dm_routines x))
    returning * into r;
  end if;
  return r;
end $$;

create or replace function public.dm_routine_reorder(p_key text, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.dm_auth(p_key);
  update public.dm_routines r set sort_order = x.ord
  from unnest(p_ids) with ordinality as x(id, ord)
  where r.id = x.id;
end $$;

-- 완전 삭제: 이 루틴의 체크 기록도 함께 지워짐
create or replace function public.dm_routine_delete(p_key text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.dm_auth(p_key);
  delete from public.dm_routines where id = p_id;
end $$;

-- 페이지에서 함수 호출 허용
do $$
declare f text;
begin
  for f in
    select p.oid::regprocedure::text from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'dm\_%'
  loop
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;

-- 초기 데이터 (비어 있을 때만)
insert into public.dm_routines (title, frequency, target_count, sort_order)
select * from (values
  ('말해보카', 'daily', 7, 1), ('스픽', 'daily', 7, 2), ('방 정리', 'daily', 7, 3),
  ('샤워', 'daily', 7, 4), ('세안', 'daily', 7, 5), ('홈케어', 'weekly', 2, 6)
) v(title, frequency, target_count, sort_order)
where not exists (select 1 from public.dm_routines);

insert into public.dm_free_activities (title)
select * from (values ('블로그 쓰기'), ('독서'), ('닌텐도'), ('앵챗'), ('기타')) v(title)
where not exists (select 1 from public.dm_free_activities);

insert into public.dm_tasks (title, category, priority, memo)
select * from (values
  ('캐비닛 청소', 'home', 'medium', null),
  ('옷장 정리', 'home', 'medium', null),
  ('옷장 제습제 교체', 'home', 'medium', null),
  ('다이소에서 제습제 구매', 'personal', 'medium', null),
  ('트롤리 청소', 'home', 'low', null),
  ('이불빨래', 'home', 'medium', '코인워시 방문 필요')
) v(title, category, priority, memo)
where not exists (select 1 from public.dm_tasks);

notify pgrst, 'reload schema';
`;

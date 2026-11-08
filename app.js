/* ================================================================
   daymoire · app.js
   화면(TODAY·INBOX·ROUTINE·WEEKLY·MY LIFE)과 버튼 동작, 시작 처리
   ================================================================ */

/* ---------- 데이터 불러오기 ---------- */
const setLogs = list => { S.logs = {}; for (const l of list) if (l.is_completed) S.logs[lk(l.routine_id, l.log_date)] = true; };
const setDaily = list => { S.daily = {}; S.memoDraft = {}; for (const l of list) { S.daily[l.log_date] = l; S.memoDraft[l.log_date] = l.memo || ''; } };

function mlRange() {
  if (S.mlPeriod === 'week') { const s = weekStart(S.mlAnchor); return { from: s, to: addDays(s, 6) }; }
  return { from: monthStart(S.mlAnchor), to: monthEnd(S.mlAnchor) };
}

const LOADERS = {
  async today() {
    const d = S.today;
    const [t, r, l, dl, f] = await Promise.all([
      rpc('dm_tasks_today', { p_date: d, p_since: parseDate(d).toISOString() }),
      rpc('dm_routines_list'),
      rpc('dm_routine_logs_range', { p_from: d, p_to: d }),
      rpc('dm_daily_range', { p_from: d, p_to: d }),
      rpc('dm_free_list')
    ]);
    S.tasks = t; S.routines = r; setLogs(l); setDaily(dl); S.free = f;
    S.mood = (dl[0] && dl[0].mood) || '';
  },
  async routine() {
    S.routinesAll = await rpc('dm_routines_all');
  },
  async project() {
    const [p, t] = await Promise.all([rpc('dm_projects_list'), rpc('dm_ptasks_list')]);
    S.projects = p; S.ptasks = t;
  },
  async inbox() {
    const [a, b] = await Promise.all([rpc('dm_tasks_inbox'), rpc('dm_tasks_upcoming', { p_date: S.today })]);
    S.inbox = a; S.upcoming = b;
  },
  async weekly() {
    const s = S.weekStart, e = addDays(s, 6);
    const [r, l, dl] = await Promise.all([
      rpc('dm_routines_list'),
      rpc('dm_routine_logs_range', { p_from: s, p_to: e }),
      rpc('dm_daily_range', { p_from: s, p_to: e })
    ]);
    S.routines = r; setLogs(l); setDaily(dl);
  },
  async mylife() {
    const { from, to } = mlRange();
    const [r, l, dl] = await Promise.all([
      rpc('dm_routines_list'),
      rpc('dm_routine_logs_range', { p_from: from, p_to: to }),
      rpc('dm_daily_range', { p_from: from, p_to: to })
    ]);
    S.routines = r; setLogs(l); setDaily(dl);
  }
};

async function loadPage() {
  S.loading = true; S.error = null; render();
  try { await LOADERS[S.page](); } catch (e) { S.error = e.message; }
  S.loading = false;
  render();
}

async function refresh() {
  try { await LOADERS[S.page](); render(); } catch (e) { toast(e.message, 'error'); }
}

function route() {
  if (S.locked) { render(); return; }
  const h = (location.hash || '#today').slice(1);
  S.page = ['today', 'inbox', 'project', 'routine', 'weekly', 'mylife'].includes(h) ? h : 'today';
  S.today = todayStr();
  if (!S.weekStart) S.weekStart = weekStart(S.today);
  if (!S.mlAnchor) S.mlAnchor = S.today;
  closeModal();
  window.scrollTo(0, 0);
  loadPage();
}

/* ---------- 공통 화면 ---------- */
const NAV = [
  { id: 'today', label: 'TODAY', icon: 'sun' },
  { id: 'inbox', label: 'INBOX', icon: 'inbox' },
  { id: 'project', label: 'PROJECT', icon: 'folder' },
  { id: 'routine', label: 'ROUTINE', icon: 'repeat' },
  { id: 'weekly', label: 'WEEKLY', icon: 'cal' },
  { id: 'mylife', label: 'MY LIFE', icon: 'sprout' }
];

const viewSide = () => `
  <aside class="side">
    <a href="#today" style="padding:0;background:none">${logo()}</a>
    <nav>${NAV.map(n => `<a href="#${n.id}" class="${S.page === n.id ? 'on' : ''}">${icon(n.icon)}${n.label}</a>`).join('')}</nav>
    <p class="motto">오늘도 나에게<br>알맞은 속도로.</p>
  </aside>`;

const viewBottomNav = () => `
  <nav class="bnav"><ul>${NAV.map(n => `
    <li><a href="#${n.id}" class="${S.page === n.id ? 'on' : ''}"><span class="pill">${icon(n.icon, 20)}</span>${n.label}</a></li>`).join('')}
  </ul></nav>`;

const pageHead = (title, sub, right = '') => `
  <div class="m-logo">${logo()}</div>
  <header class="page-head"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${right}</header>`;

function body(fn) {
  if (S.loading) return `<p class="loading">불러오는 중…</p>`;
  if (S.error) return `
    <div class="err-card">
      <p class="t">데이터를 불러오지 못했어요</p>
      <p class="m">${esc(S.error)}</p>
      <button class="btn" data-act="retry">${icon('refresh', 16)}다시 불러오기</button>
    </div>`;
  return fn();
}

const bar = (v, tone = '') => `<div class="bar ${tone}" role="progressbar" aria-valuenow="${Math.round(Math.min(1, v) * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(0, Math.min(1, v)) * 100}%"></i></div>`;

function sortTasks(list) {
  const rank = { high: 0, medium: 1, low: 2 };
  return [...list].sort((a, b) =>
    a.is_completed !== b.is_completed ? (a.is_completed ? 1 : -1)
    : rank[a.priority] !== rank[b.priority] ? rank[a.priority] - rank[b.priority]
    : String(a.created_at).localeCompare(String(b.created_at)));
}

function taskItem(t, { moveToday = false, showDate = false } = {}) {
  const overdue = t.due_date && t.due_date < S.today;
  const done = t.is_completed;
  return `
  <li class="${done ? 'done' : ''}">
    <button class="check ${done ? 'on' : ''}" data-act="task-toggle" data-id="${t.id}" aria-pressed="${done}" aria-label="${esc(t.title)} ${done ? '완료 취소' : '완료'}"><span>${done ? icon('check', 16, 3) : ''}</span></button>
    <div class="t-body">
      <p class="t-title">${esc(t.title)}</p>
      <div class="t-meta">
        <span class="badge b-${t.category}">${CAT_LABEL[t.category]}</span>
        ${t.priority === 'high' ? `<span class="badge b-high">중요</span>` : ''}
        ${t.priority === 'low' ? `<span class="tiny">여유 있게</span>` : ''}
        ${overdue && !done ? `<span class="tiny warn">${fmtShort(t.due_date)}부터 이어진 일</span>` : ''}
        ${showDate && t.due_date && !overdue ? `<span class="tiny">${fmtMD(t.due_date)}</span>` : ''}
      </div>
      ${t.memo ? `<p class="t-memo">${esc(t.memo)}</p>` : ''}
    </div>
    <div class="t-acts">
      ${moveToday && !done ? `<button class="to-today" data-act="task-today" data-id="${t.id}">${icon('calplus', 14)}오늘로</button>` : ''}
      <button class="icon-btn" data-act="task-edit" data-id="${t.id}" aria-label="${esc(t.title)} 수정">${icon('pencil', 16)}</button>
      <button class="icon-btn" data-act="task-del" data-id="${t.id}" aria-label="${esc(t.title)} 삭제">${icon('trash', 16)}</button>
    </div>
  </li>`;
}

/* ---------- TODAY ---------- */
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return '늦은 밤이에요. 오늘은 여기까지 해도 괜찮아요.';
  if (h < 12) return '좋은 아침이에요. 오늘은 무엇부터 해볼까요?';
  if (h < 18) return '오후도 천천히, 하나씩 해봐요.';
  return '오늘 하루도 수고했어요.';
}

function viewToday() {
  const d = S.today, dt = parseDate(d);
  const head = `
    <header class="today-head rise">
      <div class="m-logo">${logo()}</div>
      <div class="date-row">
        <h1 class="big-date">${fmtMD(d)}</h1>
        <p class="dow">${DOW[dt.getDay()]}요일<span>${dt.getFullYear()}</span></p>
      </div>
      <p class="greet">${greeting()}</p>
      <label class="mood"><span>오늘의 한 줄</span>
        <input id="mood" maxlength="80" placeholder="기분이나 짧은 다짐을 적어보세요" value="${esc(S.mood)}">
      </label>
    </header>`;

  return head + body(() => {
    const list = sortTasks(S.tasks);
    const open = list.filter(t => !t.is_completed), done = list.filter(t => t.is_completed);
    const rc = S.routines.filter(r => S.logs[lk(r.id, d)]).length;
    const tr = S.tasks.length ? done.length / S.tasks.length : 0;
    const rr = S.routines.length ? rc / S.routines.length : 0;

    const tasksCard = `
      <section class="card tall">
        <div class="row-between" style="margin-bottom:8px">
          <h2 class="lg">Today's Tasks</h2>
          <button class="btn" data-act="task-new">${icon('plus')}할 일 추가</button>
        </div>
        ${S.tasks.length === 0 ? `<p class="empty">오늘 정해둔 할 일이 없어요.<br>INBOX에서 오늘로 옮기거나 새로 추가해 보세요.</p>` : `
          <ul class="tasks">${open.map(t => taskItem(t)).join('')}</ul>
          ${open.length === 0 ? `<p class="all-done">오늘 할 일을 모두 마쳤어요.</p>` : ''}
          ${done.length ? `<div class="done-box"><p class="lb">완료한 일 ${done.length}</p><ul class="tasks">${done.map(t => taskItem(t)).join('')}</ul></div>` : ''}
        `}
      </section>`;

    const progress = `
      <section class="card sage">
        <div class="row-between"><h2>Daily Progress</h2><p class="cnt">완료 ${done.length + rc}개</p></div>
        <div class="prog">
          <div><div class="prog-row"><span>할 일</span><span class="mute">${done.length}/${S.tasks.length}<span class="pct">${Math.round(tr * 100)}%</span></span></div>${bar(tr)}</div>
          <div><div class="prog-row"><span>루틴</span><span class="mute">${rc}/${S.routines.length}<span class="pct">${Math.round(rr * 100)}%</span></span></div>${bar(rr, 'sage')}</div>
        </div>
      </section>`;

    const routine = `
      <section class="card">
        <div class="row-between"><h2>Today's Routine</h2><a class="more" href="#routine">관리${icon('right', 14)}</a></div>
        ${S.routines.length === 0 ? `<p class="empty" style="padding:16px 0">진행 중인 루틴이 없어요.<br>ROUTINE 탭에서 추가해 보세요.</p>` : `
        <ul class="r-grid">${S.routines.map(r => {
          const on = !!S.logs[lk(r.id, d)];
          return `<li><button class="r-btn ${on ? 'on' : ''}" data-act="routine" data-id="${r.id}" data-date="${d}" aria-pressed="${on}"><span class="dot">${on ? icon('check', 14, 3) : ''}</span>${esc(r.title)}</button></li>`;
        }).join('')}</ul>`}
      </section>`;

    const free = `
      <section class="card butter">
        <h2>Free Time</h2>
        <p class="note">하고 싶을 때 하는 일이라 완료율에는 넣지 않아요.</p>
        <ul class="free">${S.free.map(a => `<li>${esc(a.title)}<button data-act="free-hide" data-id="${a.id}" aria-label="${esc(a.title)} 지우기">${icon('x', 14)}</button></li>`).join('')}</ul>
        <div class="add-row">
          <input id="free-new" class="field" maxlength="50" placeholder="하고 싶은 활동 추가" value="${esc(S.freeNew)}">
          <button class="sq" data-act="free-add" aria-label="활동 추가">${icon('plus')}</button>
        </div>
      </section>`;

    return `<div class="grid g-today">${tasksCard}${progress}${routine}${free}</div>`;
  });
}

/* ---------- INBOX ---------- */
function viewInbox() {
  const head = pageHead('Inbox', '날짜를 아직 정하지 않은 일을 모아두는 곳이에요.',
    `<button class="btn" data-act="task-new">${icon('plus')}추가</button>`);
  return head + body(() => {
    const list = sortTasks(S.inbox);
    const open = list.filter(t => !t.is_completed), done = list.filter(t => t.is_completed);
    return `
    <div class="grid g-inbox">
      <section class="card">
        <h2>언젠가 할 일 ${open.length ? `<span style="color:var(--mute)">${open.length}</span>` : ''}</h2>
        ${open.length === 0 ? `<p class="empty">보관 중인 할 일이 없어요. 떠오르는 일을 추가해 두세요.</p>`
          : `<ul class="tasks" style="margin-top:4px">${open.map(t => taskItem(t, { moveToday: true })).join('')}</ul>`}
        ${done.length ? `
          <div style="margin-top:16px;border-top:1px solid var(--line);padding-top:8px">
            <button class="text-btn" style="padding:0" data-act="inbox-done" aria-expanded="${S.showInboxDone}">${S.showInboxDone ? '완료한 일 접기' : `완료한 일 ${done.length}개 보기`}</button>
            ${S.showInboxDone ? `<ul class="tasks">${done.map(t => taskItem(t)).join('')}</ul>` : ''}
          </div>` : ''}
      </section>
      <section class="card butter">
        <h2>날짜를 정한 일</h2>
        <p class="note">정한 날이 되면 TODAY에 나타나요.</p>
        ${S.upcoming.length === 0 ? `<p class="empty" style="padding:24px 0;text-align:left">예정된 할 일이 없어요.</p>`
          : `<ul class="tasks" style="margin-top:8px">${S.upcoming.map(t => taskItem(t, { moveToday: true, showDate: true })).join('')}</ul>`}
      </section>
    </div>`;
  });
}

/* ---------- PROJECT ---------- */
const findPT = id => S.ptasks.find(t => t.id === id);
const patchPT = (id, obj) => { S.ptasks = S.ptasks.map(t => t.id === id ? { ...t, ...obj } : t); };

function ptItem(t, kind = 'open') {
  const done = kind === 'done';
  return `
  <li class="${done ? 'done' : ''}">
    ${kind === 'sent' ? '' : `<button class="check ${t.is_completed ? 'on' : ''}" data-act="pt-toggle" data-id="${t.id}" aria-pressed="${!!t.is_completed}" aria-label="${esc(t.title)} ${t.is_completed ? '완료 취소' : '완료'}"><span>${t.is_completed ? icon('check', 16, 3) : ''}</span></button>`}
    <div class="t-body">
      <p class="t-title">${esc(t.title)}</p>
      ${kind === 'sent' ? `<div class="t-meta"><span class="tiny">${fmtMD(toStr(new Date(t.sent_at)))} TODO로 보냄</span></div>` : ''}
    </div>
    <div class="t-acts">
      ${kind === 'open' ? `<button class="to-today" data-act="pt-send" data-id="${t.id}">${icon('right', 14)}TODO로 보내기</button>` : ''}
      <button class="icon-btn" data-act="pt-del" data-id="${t.id}" aria-label="${esc(t.title)} 삭제">${icon('trash', 16)}</button>
    </div>
  </li>`;
}

function projectCard(p) {
  const all = S.ptasks.filter(t => t.project_id === p.id);
  const open = all.filter(t => !t.sent_at && !t.is_completed);
  const done = all.filter(t => !t.sent_at && t.is_completed).sort((a, b) => String(b.completed_at || '').localeCompare(String(a.completed_at || '')));
  const sent = all.filter(t => t.sent_at).sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at)));
  const section = (key, list, kind, label) => {
    if (!list.length) return '';
    const on = !!S.pShow[p.id + ':' + key];
    return `
      <div style="margin-top:12px;border-top:1px solid var(--line);padding-top:4px">
        <button class="text-btn" style="padding:0" data-act="p-show" data-id="${p.id}" data-key="${key}" aria-expanded="${on}">${on ? `${label} 접기` : `${label} ${list.length}개 보기`}</button>
        ${on ? `<ul class="tasks pt">${list.map(t => ptItem(t, kind)).join('')}</ul>` : ''}
      </div>`;
  };
  return `
  <section class="card">
    <div class="row-between">
      <h2 class="lg">${esc(p.title)} ${open.length ? `<span style="color:var(--mute);font-size:16px">${open.length}</span>` : ''}</h2>
      <div class="t-acts">
        <button class="icon-btn" data-act="p-edit" data-id="${p.id}" aria-label="${esc(p.title)} 이름 수정">${icon('pencil', 16)}</button>
        <button class="icon-btn" data-act="p-del" data-id="${p.id}" aria-label="${esc(p.title)} 삭제">${icon('trash', 16)}</button>
      </div>
    </div>
    ${open.length ? `<ul class="tasks pt" style="margin-top:8px">${open.map(t => ptItem(t)).join('')}</ul>` : `<p class="empty" style="padding:20px 0">할 일을 아래에 적어 추가해 보세요.</p>`}
    <div class="add-row">
      <input id="p-add-${p.id}" class="field" maxlength="200" placeholder="이 프로젝트의 할 일 추가" value="${esc(S.pDraft[p.id] || '')}">
      <button class="sq" data-act="pt-add" data-id="${p.id}" aria-label="할 일 추가">${icon('plus')}</button>
    </div>
    ${section('done', done, 'done', '완료한 일')}
    ${section('sent', sent, 'sent', 'TODO로 보낸 일')}
  </section>`;
}

function viewProject() {
  const head = pageHead('Project', '큰 일을 잘게 나눠 두는 곳이에요. 준비되면 TODO로 보내요.',
    `<button class="btn" data-act="p-new">${icon('plus')}프로젝트 추가</button>`);
  return head + body(() => {
    if (S.projects.length === 0) return `<section class="card"><p class="empty">아직 프로젝트가 없어요.<br>오래 걸리는 일을 프로젝트로 만들어 보세요.</p></section>`;
    return `<div class="grid g-proj">${S.projects.map(projectCard).join('')}</div>`;
  });
}

/* ---------- ROUTINE ---------- */
function viewRoutine() {
  const head = pageHead('Routine', '진행 중인 루틴은 TODAY와 WEEKLY에 나타나요.',
    `<button class="btn" data-act="r-new">${icon('plus')}루틴 추가</button>`);
  return head + body(() => {
    const act = S.routinesAll.filter(r => r.is_active), arc = S.routinesAll.filter(r => !r.is_active);
    const meta = r => `<div class="t-body"><p class="t-title">${esc(r.title)}</p><div class="t-meta"><span class="badge b-routine">${freqLabel(r)}</span></div></div>`;

    const activeCard = `
      <section class="card">
        <h2>진행 중 ${act.length ? `<span style="color:var(--mute)">${act.length}</span>` : ''}</h2>
        ${act.length === 0 ? `<p class="empty">진행 중인 루틴이 없어요.<br>꾸준히 하고 싶은 일을 추가해 보세요.</p>` : `
        <ul class="tasks rlist">${act.map((r, i) => `
          <li>
            ${meta(r)}
            <div class="t-acts">
              <button class="icon-btn sm" data-act="r-up" data-id="${r.id}" ${i === 0 ? 'disabled' : ''} aria-label="${esc(r.title)} 위로">${icon('up', 16)}</button>
              <button class="icon-btn sm" data-act="r-down" data-id="${r.id}" ${i === act.length - 1 ? 'disabled' : ''} aria-label="${esc(r.title)} 아래로">${icon('down', 16)}</button>
              <button class="icon-btn" data-act="r-edit" data-id="${r.id}" aria-label="${esc(r.title)} 수정">${icon('pencil', 16)}</button>
              <button class="icon-btn" data-act="r-archive" data-id="${r.id}" aria-label="${esc(r.title)} 보관">${icon('archive', 16)}</button>
            </div>
          </li>`).join('')}</ul>`}
      </section>`;

    const archCard = arc.length ? `
      <section class="card butter">
        <h2>보관한 루틴</h2>
        <p class="note">TODAY·WEEKLY에는 보이지 않고, 지난 체크 기록은 그대로 남아 있어요.</p>
        <ul class="tasks rlist" style="margin-top:8px">${arc.map(r => `
          <li>
            ${meta(r)}
            <div class="t-acts">
              <button class="to-today" data-act="r-restore" data-id="${r.id}">${icon('refresh', 14)}다시 사용</button>
              <button class="icon-btn" data-act="r-del" data-id="${r.id}" aria-label="${esc(r.title)} 완전 삭제">${icon('trash', 16)}</button>
            </div>
          </li>`).join('')}</ul>
      </section>` : '';

    return `<div class="grid ${arc.length ? 'g-inbox' : ''}">${activeCard}${archCard}</div>`;
  });
}

/* ---------- WEEKLY ---------- */
const wentOut = l => !!l && (l.went_out || l.exercised); // 헬스장 방문도 외출로 인정

const freqLabel = r => r.frequency === 'daily' ? '매일' : `주 ${r.target_count}회`;
const freqTarget = r => r.frequency === 'daily' ? 7 : Math.max(1, r.target_count);

function weeklyGoals(days) {
  const find = t => S.routines.find(r => r.title === t);
  const countR = r => r ? days.filter(d => S.logs[lk(r.id, d)]).length : 0;
  const row = (r, label = r.title, tl = freqLabel(r)) => ({ label, tl, count: countR(r), target: freqTarget(r) });
  const rows = [];
  rows.push({ label: '헬스장', tl: '주 2~3회', count: days.filter(d => S.daily[d]?.exercised).length, target: 2 });
  for (const t of ['말해보카', '스픽']) { const r = find(t); if (r) rows.push(row(r)); }
  rows.push({ label: '집밥', tl: '수~일요일', count: days.filter(d => [3,4,5,6,0].includes(dow(d)) && S.daily[d]?.home_cooked).length, target: 5 });
  const room = find('방 정리'); if (room) rows.push(row(room));
  const sh = find('샤워'), wa = find('세안');
  if (sh && wa) rows.push({ label: '샤워 및 세안', tl: '매일', count: days.filter(d => S.logs[lk(sh.id, d)] && S.logs[lk(wa.id, d)]).length, target: 7 });
  const care = find('홈케어');
  if (care) rows.push(row(care, '홈케어', care.frequency === 'weekly' && care.target_count === 2 ? '주 2~3회' : freqLabel(care)));
  rows.push({ label: '외출', tl: '수~금 중 2일 이상', count: days.filter(d => [3,4,5].includes(dow(d)) && wentOut(S.daily[d])).length, target: 2 });
  const covered = ['말해보카', '스픽', '방 정리', '샤워', '세안', '홈케어'];
  for (const r of S.routines) {
    if (covered.includes(r.title)) continue;
    rows.push(row(r));
  }
  return rows;
}

function viewWeekly() {
  const s = S.weekStart, days = rangeDays(s, addDays(s, 6));
  const isThis = s === weekStart(S.today);
  const right = `<div class="arrows">
    <button class="round" data-act="week-prev" aria-label="지난주">${icon('left')}</button>
    ${isThis ? '' : `<button class="text-btn" data-act="week-this">이번 주</button>`}
    <button class="round" data-act="week-next" aria-label="다음 주">${icon('right')}</button></div>`;
  const head = pageHead('Weekly', `${fmtMD(days[0])} ~ ${fmtMD(days[6])}`, right);

  return head + body(() => {
    const goals = weeklyGoals(days);
    const met = goals.filter(g => g.count >= g.target).length;
    const goalsCard = `
      <section class="card">
        <div class="row-between" style="align-items:baseline">
          <h2 class="lg">${isThis ? '이번 주' : '그 주'} 목표</h2>
          <p style="font-size:14px;color:var(--mute)">${goals.length}개 중 <b style="color:var(--ink)">${met}개</b> 채웠어요</p>
        </div>
        <ul class="goals">${goals.map(g => {
          const ok = g.count >= g.target;
          return `<li><div class="goal-top"><span class="l">${esc(g.label)}<small>${g.tl}</small>${ok ? `<span class="star" aria-label="달성">${icon('star', 13, 1.5).replace('fill="none"', 'fill="#E8DDBF"')}</span>` : ''}</span><span class="n">${g.count}/${g.target}</span></div>${bar(g.count / g.target, ok ? 'sage' : '')}</li>`;
        }).join('')}</ul>
      </section>`;

    const table = `
      <section class="card">
        <h2>루틴 체크</h2>
        <div class="scroll-x"><table class="wk">
          <thead><tr><th></th>${days.map(d => `<th><span class="dayhead ${d === S.today ? 'on' : ''}">${DOW[dow(d)]}<small>${fmtShort(d)}</small></span></th>`).join('')}</tr></thead>
          <tbody>${S.routines.map(r => `<tr><th scope="row">${esc(r.title)}</th>${days.map(d => {
            const on = !!S.logs[lk(r.id, d)], future = d > S.today;
            return `<td><button class="cell ${on ? 'on' : ''}" data-act="routine" data-id="${r.id}" data-date="${d}" ${future ? 'disabled' : ''} aria-pressed="${on}" aria-label="${fmtMD(d)} ${esc(r.title)}">${icon('check', 16, 3)}</button></td>`;
          }).join('')}</tr>`).join('')}</tbody>
        </table></div>
      </section>`;

    const records = `
      <section class="card butter">
        <h2>생활 기록</h2>
        <p class="note">헬스장에 다녀온 날은 외출로도 함께 세어요.</p>
        <ul class="days">${days.map(d => {
          const l = S.daily[d] || {};
          const future = d > S.today;
          const cookDay = [3,4,5,6,0].includes(dow(d));
          const chip = (f, label, dim) => {
            const on = !!l[f], auto = f === 'went_out' && !on && l.exercised;
            return `<button class="chip ${on ? 'on' : auto ? 'auto' : dim ? 'dim' : ''}" data-act="daily" data-date="${d}" data-field="${f}" ${future ? 'disabled' : ''} aria-pressed="${on}">${auto ? '외출 (헬스)' : label}</button>`;
          };
          return `<li>
            <p class="dl ${d === S.today ? 'on' : ''}">${fmtShort(d)} ${DOW[dow(d)]}</p>
            <div class="chips">${chip('exercised', '운동')}${chip('home_cooked', '집밥', !cookDay)}${chip('went_out', '외출')}</div>
            <input class="field" data-memo="${d}" maxlength="200" ${future ? 'disabled' : ''} placeholder="${future ? '' : '운동 메모 (선택)'}" aria-label="${fmtMD(d)} 메모" value="${esc(S.memoDraft[d] || '')}">
          </li>`;
        }).join('')}</ul>
      </section>`;

    return `<div class="grid">${goalsCard}${table}${records}</div>`;
  });
}

/* ---------- MY LIFE ---------- */
function viewMyLife() {
  const { from, to } = mlRange();
  const isCur = from <= S.today && S.today <= to;
  const word = S.mlPeriod === 'week' ? '이번 주' : '이번 달';
  const prefix = isCur ? word : (S.mlPeriod === 'week' ? '그 주' : '그 달');
  const title = S.mlPeriod === 'week' ? `${fmtMD(from)} ~ ${fmtMD(to)}` : `${parseDate(from).getFullYear()}년 ${parseDate(from).getMonth() + 1}월`;

  const toolbar = `
    <div class="toolbar">
      <div class="seg" role="tablist">
        <button role="tab" class="${S.mlPeriod === 'week' ? 'on' : ''}" aria-selected="${S.mlPeriod === 'week'}" data-act="ml-period" data-val="week">주간</button>
        <button role="tab" class="${S.mlPeriod === 'month' ? 'on' : ''}" aria-selected="${S.mlPeriod === 'month'}" data-act="ml-period" data-val="month">월간</button>
      </div>
      <div class="arrows">
        <button class="round" data-act="ml-prev" aria-label="이전">${icon('left')}</button>
        ${isCur ? '' : `<button class="text-btn" data-act="ml-this">${word}</button>`}
        <button class="round" data-act="ml-next" aria-label="다음">${icon('right')}</button>
      </div>
    </div>`;

  return pageHead('My Life', title) + toolbar + body(() => {
    if (from > S.today) return `<p class="loading">아직 오지 않은 기간이에요.</p>`;
    const days = rangeDays(from, to < S.today ? to : S.today);
    const R = S.routines;
    const ids = t => R.filter(r => r.title === t).map(r => r.id);
    const eng = [...ids('말해보카'), ...ids('스픽')], room = ids('방 정리');
    const any = (d, list) => list.some(id => S.logs[lk(id, d)]);
    const doneOn = d => R.filter(r => S.logs[lk(r.id, d)]).length;
    const total = days.reduce((s, d) => s + doneOn(d), 0);
    const rate = R.length && days.length ? total / (R.length * days.length) : 0;
    const hasData = Object.keys(S.logs).length > 0 || Object.values(S.daily).some(l => l.exercised || l.home_cooked || l.went_out);

    if (!hasData) return `
      <section class="card" style="text-align:center;padding:56px 24px">
        <h2>아직 쌓인 기록이 없어요</h2>
        <p class="empty" style="padding:8px 0 0">TODAY에서 루틴을 체크하고 WEEKLY에 운동·집밥·외출을 남기면<br>이곳에 나의 생활이 조금씩 모여요.</p>
      </section>`;

    const tiles = [
      [`${prefix} 운동`, days.filter(d => S.daily[d]?.exercised).length, '회'],
      [`${prefix} 집밥`, days.filter(d => S.daily[d]?.home_cooked).length, '회'],
      ['영어 공부', days.filter(d => any(d, eng)).length, '일'],
      ['방 정리', days.filter(d => any(d, room)).length, '일'],
      ['외출', days.filter(d => wentOut(S.daily[d])).length, '일']
    ];

    return `
      <div class="grid">
        <div class="ml-top">
          <section class="card rose rate">
            <h2>전체 루틴 달성률</h2>
            <p class="num">${Math.round(rate * 100)}<small>%</small></p>
            <p class="cap">${days.length}일 동안 루틴 ${R.length}개 기준</p>
          </section>
          <section class="tiles">${tiles.map(([l, v, u]) => `<div class="tile"><p>${l}</p><p class="v">${v}<small>${u}</small></p></div>`).join('')}</section>
        </div>
        <section class="card">
          <h2>날짜별 루틴 흐름</h2>
          <div class="flow-wrap"><div class="flow">${rangeDays(from, to).map(d => {
            const r = d > S.today || !R.length ? 0 : doneOn(d) / R.length;
            return `<div class="col" title="${fmtMD(d)} ${Math.round(r * 100)}%">
              <div class="track"><div class="fill ${r >= 1 ? 'full' : ''}" style="height:${r > 0 ? Math.max(r * 100, 8) : 0}%"></div></div>
              <span class="lb ${d === S.today ? 'on' : ''}">${S.mlPeriod === 'week' ? DOW[dow(d)] : parseDate(d).getDate()}</span>
            </div>`;
          }).join('')}</div></div>
        </section>
      </div>`;
  });
}

/* ---------- 할 일 입력 창 ---------- */
function openModal(mode, t) {
  S.modal = {
    kind: 'task', mode, id: t ? t.id : null, saving: false, error: '',
    v: t ? { title: t.title, category: t.category, priority: t.priority, due_date: t.due_date, memo: t.memo || '' }
         : { title: '', category: S.page === 'inbox' ? 'home' : 'must', priority: 'medium', due_date: S.page === 'inbox' ? null : S.today, memo: '' }
  };
  document.body.style.overflow = 'hidden';
  renderModal();
  const el = $('#m-title'); if (el) el.focus();
}

function closeModal() {
  S.modal = null;
  document.body.style.overflow = '';
  renderModal();
}

function renderModal() {
  const m = S.modal;
  if (!m) { $('#modal').innerHTML = ''; return; }
  if (m.kind === 'routine') { renderRoutineModal(); return; }
  if (m.kind === 'project') { renderProjectModal(); return; }
  const v = m.v;
  const oc = (on) => `ochip ${on ? 'on' : ''}`;
  $('#modal').innerHTML = `
  <div class="backdrop" data-act="m-close">
    <div class="dialog" role="dialog" aria-modal="true" aria-label="${m.mode === 'edit' ? '할 일 수정' : m.mode === 'send' ? 'TODO로 보내기' : '새 할 일'}" data-act="noop">
      <div class="row-between">
        <h2>${m.mode === 'edit' ? '할 일 수정' : m.mode === 'send' ? 'TODO로 보내기' : '새 할 일'}</h2>
        <button class="icon-btn" data-act="m-close" aria-label="닫기">${icon('x', 20)}</button>
      </div>
      <form class="form" data-form="task">
        <div><label class="lbl" for="m-title">제목</label>
          <input id="m-title" class="inp" maxlength="200" placeholder="무엇을 해볼까요?" value="${esc(v.title)}"></div>
        <div><span class="lbl">카테고리</span><div class="ochips">${CATS.map(c =>
          `<button type="button" class="${oc(v.category === c)}" data-act="m-cat" data-val="${c}">${CAT_LABEL[c]}<small>${CAT_HINT[c]}</small></button>`).join('')}</div></div>
        <div><span class="lbl">우선순위</span><div class="ochips">${PRIS.map(p =>
          `<button type="button" class="${oc(v.priority === p)}" data-act="m-pri" data-val="${p}">${PRI_LABEL[p]}</button>`).join('')}</div></div>
        <div><label class="lbl" for="m-date">날짜</label>
          <div class="date-line">
            <input id="m-date" type="date" class="inp" value="${v.due_date || ''}">
            <button type="button" class="${oc(v.due_date === S.today)}" data-act="m-today">오늘</button>
            <button type="button" class="${oc(!v.due_date)}" data-act="m-nodate">날짜 없음</button>
          </div>
          <p class="note" style="margin-top:8px">날짜를 비워두면 INBOX에 보관돼요.</p></div>
        <div><label class="lbl" for="m-memo">메모 (선택)</label>
          <textarea id="m-memo" class="inp" rows="3" maxlength="2000">${esc(v.memo)}</textarea></div>
        ${m.error ? `<p class="err" role="alert">${esc(m.error)}</p>` : ''}
        <button type="submit" class="submit" ${m.saving ? 'disabled' : ''}>${m.saving ? '저장하는 중…' : m.mode === 'edit' ? '수정 저장' : m.mode === 'send' ? 'TODO로 보내기' : (S.page === 'inbox' ? '보관하기' : '할 일 추가')}</button>
      </form>
    </div>
  </div>`;
}

async function saveModal() {
  const m = S.modal; const v = m.v;
  if (m.kind === 'routine') return saveRoutineModal();
  if (m.kind === 'project') return saveProjectModal();
  if (!v.title.trim()) { m.error = '할 일 제목을 입력해 주세요.'; renderModal(); return; }
  m.saving = true; m.error = ''; renderModal();
  try {
    const data = { title: v.title.trim(), category: v.category, priority: v.priority, due_date: v.due_date || null, memo: v.memo };
    if (m.mode === 'send') {
      const sent = await rpc('dm_ptask_send', { p_id: m.id, p_data: data });
      closeModal();
      toast(!sent.due_date ? 'INBOX로 보냈어요.' : sent.due_date === S.today ? '오늘 할 일로 보냈어요.' : `${fmtMD(sent.due_date)} 할 일로 보냈어요.`);
      await refresh();
      return;
    }
    if (m.mode === 'edit') data.id = m.id;
    const saved = await rpc('dm_task_save', { p_data: data });
    closeModal();
    if (!saved.due_date) toast(m.mode === 'edit' && S.page === 'inbox' ? '수정했어요.' : 'INBOX에 보관했어요.');
    else if (saved.due_date > S.today) toast(`${fmtMD(saved.due_date)}로 일정을 잡았어요. 그날 TODAY에 보여요.`);
    else toast(m.mode === 'edit' && S.page === 'today' ? '수정했어요.' : '오늘 할 일에 넣었어요.');
    await refresh();
  } catch (e) {
    if (!S.modal) return;
    m.saving = false; m.error = '저장하지 못했어요. ' + e.message; renderModal();
  }
}

/* ---------- 프로젝트 입력 창·동작 ---------- */
function openProjectModal(mode, p) {
  S.modal = { kind: 'project', mode, id: p ? p.id : null, saving: false, error: '', v: { title: p ? p.title : '' } };
  document.body.style.overflow = 'hidden';
  renderModal();
  const el = $('#m-title'); if (el) el.focus();
}

function renderProjectModal() {
  const m = S.modal, v = m.v;
  const name = m.mode === 'edit' ? '프로젝트 이름 수정' : '새 프로젝트';
  $('#modal').innerHTML = `
  <div class="backdrop" data-act="m-close">
    <div class="dialog" role="dialog" aria-modal="true" aria-label="${name}" data-act="noop">
      <div class="row-between">
        <h2>${name}</h2>
        <button class="icon-btn" data-act="m-close" aria-label="닫기">${icon('x', 20)}</button>
      </div>
      <form class="form" data-form="project">
        <div><label class="lbl" for="m-title">프로젝트 이름</label>
          <input id="m-title" class="inp" maxlength="100" placeholder="예: 이사 준비, 블로그 개편" value="${esc(v.title)}"></div>
        ${m.error ? `<p class="err" role="alert">${esc(m.error)}</p>` : ''}
        <button type="submit" class="submit" ${m.saving ? 'disabled' : ''}>${m.saving ? '저장하는 중…' : m.mode === 'edit' ? '수정 저장' : '프로젝트 추가'}</button>
      </form>
    </div>
  </div>`;
}

async function saveProjectModal() {
  const m = S.modal, v = m.v;
  if (!v.title.trim()) { m.error = '프로젝트 이름을 입력해 주세요.'; renderModal(); return; }
  m.saving = true; m.error = ''; renderModal();
  try {
    const data = { title: v.title.trim() };
    if (m.mode === 'edit') data.id = m.id;
    await rpc('dm_project_save', { p_data: data });
    closeModal();
    toast(m.mode === 'edit' ? '수정했어요.' : '프로젝트를 만들었어요.');
    await refresh();
  } catch (e) {
    if (!S.modal) return;
    m.saving = false; m.error = '저장하지 못했어요. ' + e.message; renderModal();
  }
}

async function deleteProject(id) {
  const p = S.projects.find(x => x.id === id); if (!p) return;
  const n = S.ptasks.filter(t => t.project_id === id).length;
  if (!confirm(`'${p.title}' 프로젝트를 삭제할까요?${n ? `\n안에 있는 할 일 ${n}개(완료·보낸 기록 포함)도 함께 지워지고 되돌릴 수 없어요.\nTODO로 이미 보낸 할 일은 그대로 남아요.` : ''}`)) return;
  const snap = { projects: S.projects, ptasks: S.ptasks };
  S.projects = S.projects.filter(x => x.id !== id); S.ptasks = S.ptasks.filter(t => t.project_id !== id); render();
  try { await rpc('dm_project_delete', { p_id: id }); toast('삭제했어요.'); }
  catch (e) { Object.assign(S, snap); render(); toast('삭제하지 못했어요. ' + e.message, 'error'); }
}

async function addPTask(pid) {
  const title = (S.pDraft[pid] || '').trim(); if (!title) return;
  try {
    const t = await rpc('dm_ptask_save', { p_data: { project_id: pid, title } });
    S.ptasks = [...S.ptasks, t]; S.pDraft[pid] = ''; render();
    const el = document.getElementById('p-add-' + pid); if (el) el.focus();
  } catch (e) { toast('할 일을 추가하지 못했어요. ' + e.message, 'error'); }
}

async function togglePTask(id) {
  const t = findPT(id); if (!t) return;
  const next = !t.is_completed;
  patchPT(id, { is_completed: next }); render();
  try { const saved = await rpc('dm_ptask_save', { p_data: { id, is_completed: next } }); patchPT(id, saved); render(); }
  catch (e) { patchPT(id, { is_completed: !next }); render(); toast('완료 상태를 저장하지 못했어요. ' + e.message, 'error'); }
}

async function deletePTask(id) {
  const t = findPT(id); if (!t) return;
  if (!confirm(`'${t.title}'을(를) 삭제할까요?`)) return;
  const snap = S.ptasks;
  S.ptasks = S.ptasks.filter(x => x.id !== id); render();
  try { await rpc('dm_ptask_delete', { p_id: id }); toast('삭제했어요.'); }
  catch (e) { S.ptasks = snap; render(); toast('삭제하지 못했어요. ' + e.message, 'error'); }
}

function openSendModal(id) {
  const t = findPT(id); if (!t) return;
  S.modal = { kind: 'task', mode: 'send', id, saving: false, error: '', v: { title: t.title, category: 'must', priority: 'medium', due_date: S.today, memo: '' } };
  document.body.style.overflow = 'hidden';
  renderModal();
}

/* ---------- 루틴 입력 창 ---------- */
function openRoutineModal(mode, r) {
  S.modal = {
    kind: 'routine', mode, id: r ? r.id : null, saving: false, error: '',
    v: r ? { title: r.title, frequency: r.frequency, target_count: r.frequency === 'weekly' ? r.target_count : 2 }
         : { title: '', frequency: 'daily', target_count: 2 }
  };
  document.body.style.overflow = 'hidden';
  renderModal();
  const el = $('#m-title'); if (el) el.focus();
}

function renderRoutineModal() {
  const m = S.modal, v = m.v;
  const oc = on => `ochip ${on ? 'on' : ''}`;
  const name = m.mode === 'edit' ? '루틴 수정' : '새 루틴';
  $('#modal').innerHTML = `
  <div class="backdrop" data-act="m-close">
    <div class="dialog" role="dialog" aria-modal="true" aria-label="${name}" data-act="noop">
      <div class="row-between">
        <h2>${name}</h2>
        <button class="icon-btn" data-act="m-close" aria-label="닫기">${icon('x', 20)}</button>
      </div>
      <form class="form" data-form="routine">
        <div><label class="lbl" for="m-title">이름</label>
          <input id="m-title" class="inp" maxlength="50" placeholder="예: 스트레칭, 물 2L 마시기" value="${esc(v.title)}"></div>
        <div><span class="lbl">얼마나 자주</span><div class="ochips">
          <button type="button" class="${oc(v.frequency === 'daily')}" data-act="r-freq" data-val="daily">매일</button>
          <button type="button" class="${oc(v.frequency === 'weekly')}" data-act="r-freq" data-val="weekly">일주일에 몇 번</button>
        </div></div>
        ${v.frequency === 'weekly' ? `
        <div><span class="lbl">주 목표 횟수</span><div class="ochips">${[1, 2, 3, 4, 5, 6].map(n =>
          `<button type="button" class="${oc(v.target_count === n)}" data-act="r-cnt" data-val="${n}">${n}회</button>`).join('')}</div>
          <p class="note" style="margin-top:8px">체크는 매일 할 수 있고, WEEKLY 목표에서 이 횟수를 채웠는지 보여줘요.</p></div>` : ''}
        ${m.error ? `<p class="err" role="alert">${esc(m.error)}</p>` : ''}
        <button type="submit" class="submit" ${m.saving ? 'disabled' : ''}>${m.saving ? '저장하는 중…' : m.mode === 'edit' ? '수정 저장' : '루틴 추가'}</button>
      </form>
    </div>
  </div>`;
}

async function saveRoutineModal() {
  const m = S.modal, v = m.v;
  if (!v.title.trim()) { m.error = '루틴 이름을 입력해 주세요.'; renderModal(); return; }
  m.saving = true; m.error = ''; renderModal();
  try {
    const data = { title: v.title.trim(), frequency: v.frequency, target_count: v.frequency === 'daily' ? 7 : v.target_count };
    if (m.mode === 'edit') data.id = m.id;
    await rpc('dm_routine_save', { p_data: data });
    closeModal();
    toast(m.mode === 'edit' ? '수정했어요.' : '루틴을 추가했어요. TODAY에 바로 보여요.');
    await refresh();
  } catch (e) {
    if (!S.modal) return;
    m.saving = false; m.error = '저장하지 못했어요. ' + e.message; renderModal();
  }
}

/* ---------- 루틴 관리 동작 ---------- */
const findRoutine = id => S.routinesAll.find(r => r.id === id);

async function setRoutineActive(id, active) {
  const r = findRoutine(id); if (!r) return;
  const snap = S.routinesAll;
  S.routinesAll = S.routinesAll.map(x => x.id === id ? { ...x, is_active: active } : x); render();
  try {
    await rpc('dm_routine_save', { p_data: { id, is_active: active } });
    toast(active ? `'${r.title}'을(를) 다시 시작해요.` : `'${r.title}'을(를) 보관했어요. 기록은 남아 있어요.`);
    await refresh();
  } catch (e) { S.routinesAll = snap; render(); toast('변경하지 못했어요. ' + e.message, 'error'); }
}

async function deleteRoutine(id) {
  const r = findRoutine(id); if (!r) return;
  if (!confirm(`'${r.title}'을(를) 완전히 삭제할까요?\n지금까지의 체크 기록도 함께 지워지고 되돌릴 수 없어요.`)) return;
  const snap = S.routinesAll;
  S.routinesAll = S.routinesAll.filter(x => x.id !== id); render();
  try { await rpc('dm_routine_delete', { p_id: id }); toast('삭제했어요.'); }
  catch (e) { S.routinesAll = snap; render(); toast('삭제하지 못했어요. ' + e.message, 'error'); }
}

async function moveRoutine(id, dir) {
  const act = S.routinesAll.filter(r => r.is_active);
  const i = act.findIndex(r => r.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= act.length) return;
  [act[i], act[j]] = [act[j], act[i]];
  const snap = S.routinesAll;
  S.routinesAll = [...act, ...S.routinesAll.filter(r => !r.is_active)]; render();
  try { await rpc('dm_routine_reorder', { p_ids: act.map(r => r.id) }); }
  catch (e) { S.routinesAll = snap; render(); toast('순서를 바꾸지 못했어요. ' + e.message, 'error'); }
}

/* ---------- 할 일 동작 ---------- */
const allTasks = () => [...S.tasks, ...S.inbox, ...S.upcoming];
const findTask = id => allTasks().find(t => t.id === id);
const patchTask = (id, obj) => { for (const k of ['tasks', 'inbox', 'upcoming']) S[k] = S[k].map(t => t.id === id ? { ...t, ...obj } : t); };
const dropTask = id => { for (const k of ['tasks', 'inbox', 'upcoming']) S[k] = S[k].filter(t => t.id !== id); };

async function toggleTask(id) {
  const t = findTask(id); if (!t) return;
  const next = !t.is_completed;
  patchTask(id, { is_completed: next }); render();
  try { const saved = await rpc('dm_task_save', { p_data: { id, is_completed: next } }); patchTask(id, saved); render(); }
  catch (e) { patchTask(id, { is_completed: !next }); render(); toast('완료 상태를 저장하지 못했어요. ' + e.message, 'error'); }
}

async function deleteTask(id) {
  const t = findTask(id); if (!t) return;
  if (!confirm(`'${t.title}'을(를) 삭제할까요?`)) return;
  const snap = { tasks: S.tasks, inbox: S.inbox, upcoming: S.upcoming };
  dropTask(id); render();
  try { await rpc('dm_task_delete', { p_id: id }); toast('삭제했어요.'); }
  catch (e) { Object.assign(S, snap); render(); toast('삭제하지 못했어요. ' + e.message, 'error'); }
}

async function moveToday(id) {
  const t = findTask(id); if (!t) return;
  const snap = { inbox: S.inbox, upcoming: S.upcoming };
  dropTask(id); render();
  try { await rpc('dm_task_save', { p_data: { id, due_date: S.today } }); toast(`'${t.title}'을(를) 오늘 할 일로 옮겼어요.`); }
  catch (e) { Object.assign(S, snap); render(); toast('오늘로 옮기지 못했어요. ' + e.message, 'error'); }
}

/* ---------- 루틴·생활 기록 ---------- */
async function toggleRoutine(rid, d) {
  const k = lk(rid, d), next = !S.logs[k];
  S.logs[k] = next; render();
  try { await rpc('dm_routine_set', { p_routine: rid, p_date: d, p_done: next }); }
  catch (e) { S.logs[k] = !next; render(); toast('루틴 체크를 저장하지 못했어요. ' + e.message, 'error'); }
}

async function toggleDaily(d, field) {
  const prev = S.daily[d] ? { ...S.daily[d] } : null;
  const next = !(prev && prev[field]);
  S.daily[d] = { ...(prev || { log_date: d }), [field]: next }; render();
  try { S.daily[d] = await rpc('dm_daily_set', { p_date: d, p_data: { [field]: next } }); render(); }
  catch (e) { if (prev) S.daily[d] = prev; else delete S.daily[d]; render(); toast('기록을 저장하지 못했어요. ' + e.message, 'error'); }
}

async function saveMemo(d) {
  const v = (S.memoDraft[d] || '').trim();
  if (v === ((S.daily[d] && S.daily[d].memo) || '')) return;
  try { S.daily[d] = await rpc('dm_daily_set', { p_date: d, p_data: { memo: v } }); toast(`${fmtMD(d)} 메모를 저장했어요.`); }
  catch (e) { toast('메모를 저장하지 못했어요. ' + e.message, 'error'); }
}

async function saveMood() {
  const v = S.mood.trim();
  if (v === ((S.daily[S.today] && S.daily[S.today].mood) || '')) return;
  try { S.daily[S.today] = await rpc('dm_daily_set', { p_date: S.today, p_data: { mood: v } }); toast('오늘의 한 줄을 저장했어요.'); }
  catch (e) { toast('오늘의 한 줄을 저장하지 못했어요. ' + e.message, 'error'); }
}

async function addFree() {
  const title = S.freeNew.trim(); if (!title) return;
  try { const a = await rpc('dm_free_add', { p_title: title }); S.free.push(a); S.freeNew = ''; render(); const el = $('#free-new'); if (el) el.focus(); }
  catch (e) { toast('활동을 추가하지 못했어요. ' + e.message, 'error'); }
}

async function hideFree(id) {
  const snap = S.free;
  S.free = S.free.filter(a => a.id !== id); render();
  try { await rpc('dm_free_hide', { p_id: id }); }
  catch (e) { S.free = snap; render(); toast('활동을 지우지 못했어요. ' + e.message, 'error'); }
}

/* ---------- 잠금·설정 화면 ---------- */
const viewLock = () => `
  <div class="center"><div class="box">
    ${logo()}
    <p>나만 쓰는 비공개 페이지예요.<br>처음 한 번만 접속 키를 넣어 주세요. 이 기기에 기억돼요.</p>
    <form data-form="lock">
      <input id="lock-key" type="password" class="inp" autocomplete="current-password" placeholder="접속 키" aria-label="접속 키">
      ${S.lockMsg ? `<p class="err" role="alert">${esc(S.lockMsg)}</p>` : ''}
      <button type="submit" class="submit">들어가기</button>
    </form>
  </div></div>`;

function showSetup() {
  const sql = SETUP_SQL.trim();
  $('#app').innerHTML = `
  <div class="setup">
    ${logo()}
    <h1>처음 설정이 필요해요</h1>
    <ol>
      <li>Supabase에서 프로젝트를 열고 <b>SQL Editor</b>로 이동</li>
      <li>아래 SQL을 복사해 붙여넣고, 맨 위 <code>여기에_접속키</code>를 나만의 접속 키(12자 이상)로 바꾼 뒤 <b>Run</b></li>
      <li><b>Project Settings → API</b>에서 <b>Project URL</b>과 <b>anon public</b>(또는 Publishable) 키를 복사</li>
      <li><code>core.js</code> 파일 위쪽 <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code> 따옴표 안에 붙여넣고 저장</li>
      <li>GitHub에 올린 뒤 페이지를 열고 접속 키 입력</li>
    </ol>
    <button class="btn" data-act="copy-sql">SQL 복사</button>
    <textarea readonly aria-label="설정 SQL">${esc(sql)}</textarea>
  </div>`;
}

/* ---------- 그리기 ---------- */
const VIEWS = { today: viewToday, inbox: viewInbox, project: viewProject, routine: viewRoutine, weekly: viewWeekly, mylife: viewMyLife };

function render() {
  if (S.locked) { $('#app').innerHTML = viewLock(); return; }
  const active = document.activeElement;
  const keepId = active && (active.id === 'mood' || active.id === 'free-new' || (active.id || '').startsWith('p-add-')) ? active.id : null;
  $('#app').innerHTML = `<div class="shell">${viewSide()}<main class="main"><div class="wrap">${VIEWS[S.page]()}</div></main>${viewBottomNav()}</div>`;
  if (keepId) { const el = document.getElementById(keepId); if (el) { el.focus(); const n = el.value.length; try { el.setSelectionRange(n, n); } catch {} } }
}

/* ---------- 이벤트 ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id, d = el.dataset.date;
  switch (a) {
    case 'noop': return;
    case 'retry': loadPage(); break;
    case 'task-new': openModal('new'); break;
    case 'task-edit': { const t = findTask(id); if (t) openModal('edit', t); break; }
    case 'task-toggle': toggleTask(id); break;
    case 'task-del': deleteTask(id); break;
    case 'task-today': moveToday(id); break;
    case 'routine': toggleRoutine(id, d); break;
    case 'r-new': openRoutineModal('new'); break;
    case 'r-edit': { const r = findRoutine(id); if (r) openRoutineModal('edit', r); break; }
    case 'r-up': moveRoutine(id, -1); break;
    case 'r-down': moveRoutine(id, 1); break;
    case 'r-archive': setRoutineActive(id, false); break;
    case 'r-restore': setRoutineActive(id, true); break;
    case 'r-del': deleteRoutine(id); break;
    case 'r-freq': S.modal.v.frequency = el.dataset.val; renderModal(); break;
    case 'r-cnt': S.modal.v.target_count = Number(el.dataset.val); renderModal(); break;
    case 'daily': toggleDaily(d, el.dataset.field); break;
    case 'p-new': openProjectModal('new'); break;
    case 'p-edit': { const p = S.projects.find(x => x.id === id); if (p) openProjectModal('edit', p); break; }
    case 'p-del': deleteProject(id); break;
    case 'p-show': { const k = id + ':' + el.dataset.key; S.pShow[k] = !S.pShow[k]; render(); break; }
    case 'pt-add': addPTask(id); break;
    case 'pt-toggle': togglePTask(id); break;
    case 'pt-del': deletePTask(id); break;
    case 'pt-send': openSendModal(id); break;
    case 'free-add': addFree(); break;
    case 'free-hide': hideFree(id); break;
    case 'inbox-done': S.showInboxDone = !S.showInboxDone; render(); break;
    case 'week-prev': S.weekStart = addDays(S.weekStart, -7); loadPage(); break;
    case 'week-next': S.weekStart = addDays(S.weekStart, 7); loadPage(); break;
    case 'week-this': S.weekStart = weekStart(S.today); loadPage(); break;
    case 'ml-period': S.mlPeriod = el.dataset.val; S.mlAnchor = S.today; loadPage(); break;
    case 'ml-prev': S.mlAnchor = S.mlPeriod === 'week' ? addDays(weekStart(S.mlAnchor), -7) : addMonths(S.mlAnchor, -1); loadPage(); break;
    case 'ml-next': S.mlAnchor = S.mlPeriod === 'week' ? addDays(weekStart(S.mlAnchor), 7) : addMonths(S.mlAnchor, 1); loadPage(); break;
    case 'ml-this': S.mlAnchor = S.today; loadPage(); break;
    case 'm-close': if (e.target.closest('[data-act]') === el) closeModal(); break;
    case 'm-cat': S.modal.v.category = el.dataset.val; renderModal(); break;
    case 'm-pri': S.modal.v.priority = el.dataset.val; renderModal(); break;
    case 'm-today': S.modal.v.due_date = S.today; renderModal(); break;
    case 'm-nodate': S.modal.v.due_date = null; renderModal(); break;
    case 'copy-sql': {
      const sql = SETUP_SQL.trim();
      (navigator.clipboard ? navigator.clipboard.writeText(sql) : Promise.reject())
        .then(() => toast('SQL을 복사했어요.'))
        .catch(() => toast('복사하지 못했어요. 아래 칸을 직접 선택해 복사해 주세요.', 'error'));
      break;
    }
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'mood') S.mood = t.value;
  else if (t.id === 'free-new') S.freeNew = t.value;
  else if ((t.id || '').startsWith('p-add-')) S.pDraft[t.id.slice(6)] = t.value;
  else if (t.dataset && t.dataset.memo) S.memoDraft[t.dataset.memo] = t.value;
  else if (S.modal && t.id === 'm-title') S.modal.v.title = t.value;
  else if (S.modal && t.id === 'm-memo') S.modal.v.memo = t.value;
  else if (S.modal && t.id === 'm-date') { S.modal.v.due_date = t.value || null; renderModalChipsOnly(); }
});

function renderModalChipsOnly() {
  // 날짜 입력 중 포커스가 튀지 않도록 칩 상태만 갱신
  document.querySelectorAll('[data-act="m-today"]').forEach(b => b.classList.toggle('on', S.modal.v.due_date === S.today));
  document.querySelectorAll('[data-act="m-nodate"]').forEach(b => b.classList.toggle('on', !S.modal.v.due_date));
}

document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'mood') saveMood();
  else if (t.dataset && t.dataset.memo) saveMemo(t.dataset.memo);
});

document.addEventListener('keydown', e => {
  const t = e.target;
  if (e.key === 'Escape' && S.modal) { closeModal(); return; }
  if (e.key !== 'Enter' || e.isComposing) return;
  if (t.id === 'mood' || (t.dataset && t.dataset.memo)) { e.preventDefault(); t.blur(); }
  else if (t.id === 'free-new') { e.preventDefault(); addFree(); }
  else if ((t.id || '').startsWith('p-add-')) { e.preventDefault(); addPTask(t.id.slice(6)); }
});

document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target.dataset.form;
  if (f === 'task' || f === 'routine' || f === 'project') saveModal();
  if (f === 'lock') {
    const v = ($('#lock-key').value || '').trim();
    if (!v) return;
    setKey(v);
    S.locked = false;
    try {
      await rpc('dm_check');
      S.locked = false; S.lockMsg = '';
      route();
    } catch (err) {
      if (!S.locked) { setKey(''); S.lockMsg = err.message; S.locked = true; render(); }
    }
  }
});

document.addEventListener('visibilitychange', () => {
  // 다음 날 앱을 다시 열면 오늘 날짜로 새로고침
  if (!document.hidden && sb && !S.locked && S.today && todayStr() !== S.today) {
    S.weekStart = weekStart(todayStr()); S.mlAnchor = todayStr(); route();
  }
});

/* ---------- 시작 ---------- */
(function boot() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) { showSetup(); return; }
  if (!window.supabase) {
    $('#app').innerHTML = `<div class="err-card"><p class="t">불러오지 못했어요</p><p class="m">Supabase 라이브러리를 받지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</p></div>`;
    return;
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const u = new URL(location.href), k = u.searchParams.get('key');
  if (k !== null) { setKey(k.trim()); u.searchParams.delete('key'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
  window.addEventListener('hashchange', route);
  if (!getKey()) { S.locked = true; render(); return; }
  route();
})();

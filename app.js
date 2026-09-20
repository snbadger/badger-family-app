(function () {
  'use strict';
  const CFG = window.BADGER_CONFIG;
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const view = $('#view');
  const S = { session: null, me: null, profiles: [], tab: 'home', person: null, week: null, projectId: null, showPast: false, showDone: false };

  // ───────── helpers ─────────
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const CATS = { family: '👨‍👩‍👧‍👦 Family', fhe: '🏠 FHE', trip: '🚗 Trip', church: '⛪ Church', school: '🎓 School', sports: '🏀 Sports', other: '📌 Other' };
  const EMOJIS = ['🦡', '😀', '😎', '🤓', '🥳', '🦁', '🐯', '🐻', '🦊', '🐼', '🐨', '🦄', '🐸', '🐙', '🦖', '🚀', '⚽', '🎸', '🎨', '📚', '🌟', '🔥', '🍕', '🌮'];
  const COLORS = ['#1f3a5f', '#2e7d7b', '#b83232', '#c47f17', '#2f7a3d', '#6b3fa0', '#d6336c', '#0b7285', '#5c4033', '#495057'];
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const monday = s => { const d = parseYmd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
  const dow = s => parseYmd(s).getDay();
  const fmtDate = s => s ? parseYmd(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const fmtTime = iso => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const fmtClock = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; return `${h % 12 || 12}:${pad(m)} ${ap}`; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const prof = id => S.profiles.find(p => p.id === id);
  const pname = id => prof(id)?.display_name || '—';
  const avatar = (p, size) => p ? `<span class="avatar" style="background:${esc(p.color)}${size ? `;width:${size}px;height:${size}px;font-size:${size * .55}px` : ''}">${esc(p.emoji)}</span>` : '';
  const isParent = () => S.me?.role === 'parent';
  const canEditFor = id => isParent() || id === S.me.id;
  const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 2200); }
  async function q(p) { const { data, error } = await p; if (error) { console.error(error); toast(error.message); throw error; } return data; }
  function localIso(date, time) { return new Date(`${date}T${time || '00:00'}:00`).toISOString(); }
  function isoDate(iso) { return ymd(new Date(iso)); }
  function isoTime(iso) { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

  // ───────── modal form builder ─────────
  function closeModal() { $('#modal').hidden = true; $('#modal-body').innerHTML = ''; }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  function fieldHtml(f) {
    const v = f.value ?? '';
    const lab = `<span>${esc(f.label)}</span>`;
    switch (f.type) {
      case 'textarea': return `<label class="field">${lab}<textarea name="${f.name}" ${f.required ? 'required' : ''}>${esc(v)}</textarea></label>`;
      case 'select': return `<label class="field">${lab}<select name="${f.name}">${f.options.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></label>`;
      case 'person': return fieldHtml({ ...f, type: 'select', options: [...(f.allowNone ? [{ v: '', l: '— nobody —' }] : []), ...S.profiles.map(p => ({ v: p.id, l: `${p.emoji} ${p.display_name}` }))] });
      case 'checkbox': return `<label class="field row"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''} style="width:auto"> <span style="margin:0">${esc(f.label)}</span></label>`;
      case 'days': return `<div class="field">${lab}<div class="daypick" data-name="${f.name}">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" data-d="${d}" class="${(v || []).includes(d) ? 'on' : ''}">${DAYS[d]}</button>`).join('')}</div></div>`;
      case 'emoji': return `<div class="field">${lab}<div class="daypick" data-name="${f.name}" style="flex-wrap:wrap">${EMOJIS.map(e => `<button type="button" data-d="${e}" class="${v === e ? 'on' : ''}" style="flex:0 0 40px;font-size:20px">${e}</button>`).join('')}</div></div>`;
      case 'color': return `<div class="field">${lab}<div class="daypick" data-name="${f.name}" style="flex-wrap:wrap">${COLORS.map(c => `<button type="button" data-d="${c}" class="${v === c ? 'on' : ''}" style="flex:0 0 40px;height:34px;background:${c};border-color:${c}${v === c ? ';outline:3px solid var(--ink)' : ''}"></button>`).join('')}</div></div>`;
      default: return `<label class="field">${lab}<input type="${f.type || 'text'}" name="${f.name}" value="${esc(v)}" ${f.required ? 'required' : ''} ${f.step ? `step="${f.step}"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} ${f.min ? `min="${f.min}"` : ''}></label>`;
    }
  }
  function readForm(fields, form) {
    const out = {};
    for (const f of fields) {
      if (f.type === 'days') out[f.name] = $$(`.daypick[data-name="${f.name}"] button.on`, form).map(b => Number(b.dataset.d));
      else if (f.type === 'emoji' || f.type === 'color') out[f.name] = $(`.daypick[data-name="${f.name}"] button.on`, form)?.dataset.d || f.value || '';
      else if (f.type === 'checkbox') out[f.name] = form.elements[f.name].checked;
      else out[f.name] = form.elements[f.name].value;
    }
    return out;
  }
  function openForm({ title, fields, submitLabel = 'Save', onSubmit, onDelete }) {
    const body = $('#modal-body');
    body.innerHTML = `<h3>${esc(title)}</h3><form id="mf">${fields.map(fieldHtml).join('')}<div class="err" id="mf-err"></div>
      <div class="row"><button type="button" class="btn ghost" id="mf-cancel">Cancel</button><span class="grow"></span>
      ${onDelete ? '<button type="button" class="btn danger" id="mf-del">Delete</button>' : ''}<button class="btn" type="submit">${esc(submitLabel)}</button></div></form>`;
    $('#modal').hidden = false;
    $$('.daypick', body).forEach(dp => {
      const single = dp.parentElement.querySelector('span') && ['emoji', 'color'].includes(fields.find(f => f.name === dp.dataset.name)?.type);
      $$('button', dp).forEach(b => b.onclick = () => { if (single) $$('button', dp).forEach(x => { x.classList.remove('on'); x.style.outline = ''; }); b.classList.toggle('on'); if (single) b.style.outline = '3px solid var(--ink)'; });
    });
    $('#mf-cancel').onclick = closeModal;
    if (onDelete) $('#mf-del').onclick = async () => { if (confirm('Delete this?')) { try { await onDelete(); closeModal(); } catch (e) { $('#mf-err').textContent = e.message; } } };
    $('#mf').onsubmit = async e => {
      e.preventDefault();
      const vals = readForm(fields, e.target);
      try { await onSubmit(vals); closeModal(); } catch (err) { $('#mf-err').textContent = err.message || String(err); }
    };
  }

  // ───────── auth ─────────
  function renderAuth(mode = 'signin', msg = '') {
    $('#topbar').hidden = true; $('#tabs').hidden = true;
    const signup = mode === 'signup';
    view.innerHTML = `<div class="auth"><div class="logo">🦡</div><h1>Badger Family</h1>
      ${msg ? `<div class="callout" style="margin-bottom:12px">${esc(msg)}</div>` : ''}
      <form id="authf" class="card">
        ${signup ? fieldHtml({ name: 'display_name', label: 'Your name', required: true, placeholder: 'What the family calls you' }) : ''}
        ${fieldHtml({ name: 'email', label: 'Email', type: 'email', required: true })}
        ${fieldHtml({ name: 'password', label: 'Password', type: 'password', required: true, placeholder: signup ? 'At least 6 characters' : '' })}
        ${signup ? fieldHtml({ name: 'emoji', label: 'Pick your avatar', type: 'emoji', value: '🦡' }) : ''}
        <div class="err" id="auth-err"></div>
        <button class="btn block" type="submit">${signup ? 'Create my account' : 'Sign in'}</button>
      </form>
      <p class="small muted" style="text-align:center">${signup ? 'Already have an account?' : 'New here?'} <a href="#" id="auth-switch">${signup ? 'Sign in' : 'Create an account'}</a></p>
      ${signup ? '<p class="tiny muted" style="text-align:center">After you sign up, a parent approves you from the Family screen.</p>' : ''}
    </div>`;
    const form = $('#authf');
    $$('.daypick button', form).forEach(b => b.onclick = () => { $$('.daypick button', form).forEach(x => x.classList.remove('on')); b.classList.add('on'); });
    $('#auth-switch').onclick = e => { e.preventDefault(); renderAuth(signup ? 'signin' : 'signup'); };
    form.onsubmit = async e => {
      e.preventDefault();
      const email = form.elements.email.value.trim(), password = form.elements.password.value;
      const errEl = $('#auth-err'); errEl.textContent = '';
      try {
        if (signup) {
          const display_name = form.elements.display_name.value.trim();
          const emoji = $('.daypick button.on', form)?.dataset.d || '🦡';
          const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name, emoji } } });
          if (error) throw error;
          if (!data.session) renderAuth('signin', 'Account created. Check your email for a confirmation link, then sign in here.');
        } else {
          const { error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw error;
        }
      } catch (err) { errEl.textContent = err.message; }
    };
  }
  function renderWaiting() {
    $('#topbar').hidden = true; $('#tabs').hidden = true;
    view.innerHTML = `<div class="auth"><div class="logo">${esc(S.me.emoji)}</div><h1>Hi, ${esc(S.me.display_name)}!</h1>
      <div class="card"><p>Your account is waiting for a parent to approve it.</p><p class="small muted">Ask a parent to open the app, tap their avatar (top right), and tap <b>Approve</b> next to your name.</p>
      <div class="row"><button class="btn secondary grow" id="w-refresh">Check again</button><button class="btn ghost" id="w-out">Sign out</button></div></div></div>`;
    $('#w-refresh').onclick = loadMe;
    $('#w-out').onclick = () => sb.auth.signOut();
  }

  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    S.session = session;
    sb.auth.onAuthStateChange((_evt, s) => { const had = !!S.session; S.session = s; if (!s) { S.me = null; renderAuth(); } else if (!had) loadMe(); });
    if (!session) renderAuth(); else loadMe();
  }
  async function loadMe() {
    let me = null;
    for (let i = 0; i < 4 && !me; i++) { me = await q(sb.from('profiles').select('*').eq('id', S.session.user.id).maybeSingle()); if (!me) await new Promise(r => setTimeout(r, 600)); }
    if (!me) { view.innerHTML = '<div class="empty">Could not load your profile. Try refreshing.</div>'; return; }
    S.me = me;
    if (!me.approved) return renderWaiting();
    S.profiles = await q(sb.from('profiles').select('*').order('created_at'));
    if (!S.person) S.person = isParent() ? 'all' : me.id;
    $('#topbar').hidden = false; $('#tabs').hidden = false;
    $('#btn-me').textContent = me.emoji; $('#btn-me').style.background = me.color;
    go(S.tab);
  }

  // ───────── navigation ─────────
  function go(tab) {
    S.tab = tab; S.projectId = tab === 'projects' ? S.projectId : null;
    $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $('.fab')?.remove();
    view.innerHTML = '<div class="empty">Loading…</div>';
    window.scrollTo(0, 0);
    ({ home: renderHome, chores: renderChores, school: renderSchool, calendar: renderCalendar, projects: renderProjects, goals: renderGoals, family: renderFamily })[tab]().catch(e => view.innerHTML = `<div class="empty">${esc(e.message)}</div>`);
  }
  $$('#tabs button').forEach(b => b.onclick = () => go(b.dataset.tab));
  $('#btn-me').onclick = () => go('family');
  $('#btn-refresh').onclick = () => go(S.tab);
  function fab(onclick) { $$('.fab').forEach(x => x.remove()); const b = document.createElement('button'); b.className = 'fab'; b.textContent = '+'; b.onclick = onclick; document.body.appendChild(b); }
  function personChips(onchange, includeAll = true) {
    const opts = [...(includeAll && isParent() ? [{ id: 'all', label: 'Everyone' }] : []), ...S.profiles.map(p => ({ id: p.id, label: `${p.emoji} ${p.display_name}` }))];
    if (!opts.some(o => o.id === S.person)) S.person = opts[0].id;
    const html = `<div class="chips">${opts.map(o => `<button class="chip ${S.person === o.id ? 'active' : ''}" data-id="${o.id}">${esc(o.label)}</button>`).join('')}</div>`;
    setTimeout(() => $$('.chips .chip').forEach(c => c.onclick = () => { S.person = c.dataset.id; onchange(); }), 0);
    return html;
  }
  function weekNav(onchange) {
    if (!S.week) S.week = monday(today());
    setTimeout(() => { $('#wk-prev').onclick = () => { S.week = addDays(S.week, -7); onchange(); }; $('#wk-next').onclick = () => { S.week = addDays(S.week, 7); onchange(); }; $('#wk-today').onclick = () => { S.week = monday(today()); onchange(); }; }, 0);
    const cur = S.week === monday(today());
    return `<div class="row between" style="margin:6px 0 10px"><button class="btn sm secondary" id="wk-prev">‹</button><button class="btn ghost sm" id="wk-today">${cur ? 'This week' : 'Week of ' + fmtDate(S.week)}</button><button class="btn sm secondary" id="wk-next">›</button></div>`;
  }
  const filtered = (rows, key = 'profile_id') => S.person === 'all' ? rows : rows.filter(r => r[key] === S.person);

  // ───────── chores logic ─────────
  function choreDue(c, d, comps) {
    if (!c.active) return false;
    if (c.recurrence === 'daily') return true;
    if (c.recurrence === 'weekly') return (c.days || []).includes(dow(d));
    if (c.recurrence === 'once') { if (comps.length) return comps.some(x => x.done_on === d); return c.due_date === d || (c.due_date < d && d === today()); }
    return false;
  }
  async function loadChores(weekStart) {
    const [chores, comps] = await Promise.all([
      q(sb.from('chores').select('*').order('created_at')),
      q(sb.from('chore_completions').select('*').gte('done_on', addDays(weekStart, -60)).lte('done_on', addDays(weekStart, 6)))
    ]);
    return { chores, comps };
  }
  async function toggleChore(chore, d, comps, refresh) {
    const who = chore.assigned_to || S.me.id;
    if (!canEditFor(who)) return toast('Only ' + pname(who) + ' or a parent can check this off');
    const ex = comps.find(x => x.chore_id === chore.id && x.done_on === d);
    if (ex) await q(sb.from('chore_completions').delete().eq('id', ex.id));
    else await q(sb.from('chore_completions').insert({ chore_id: chore.id, profile_id: who, done_on: d }));
    refresh();
  }
  function choreForm(existing) {
    const fields = [
      { name: 'title', label: 'Chore', required: true, value: existing?.title },
      { name: 'assigned_to', label: 'Who', type: 'person', value: existing?.assigned_to || (S.person !== 'all' ? S.person : '') , allowNone: true },
      { name: 'recurrence', label: 'How often', type: 'select', value: existing?.recurrence || 'weekly', options: [{ v: 'daily', l: 'Every day' }, { v: 'weekly', l: 'Certain days each week' }, { v: 'once', l: 'One time' }] },
      { name: 'days', label: 'Days (for weekly)', type: 'days', value: existing?.days || [] },
      { name: 'due_date', label: 'Due date (for one-time)', type: 'date', value: existing?.due_date || '' },
      { name: 'points', label: 'Points', type: 'number', value: existing?.points ?? 1, min: 0 },
      ...(existing ? [{ name: 'active', label: 'Active', type: 'checkbox', value: existing.active }] : [])
    ];
    openForm({
      title: existing ? 'Edit chore' : 'New chore', fields,
      onSubmit: async v => {
        const row = { title: v.title.trim(), assigned_to: v.assigned_to || null, recurrence: v.recurrence, days: v.days, due_date: v.due_date || null, points: Number(v.points) || 0, active: existing ? v.active : true };
        if (v.recurrence === 'weekly' && !v.days.length) throw new Error('Pick at least one day.');
        if (v.recurrence === 'once' && !v.due_date) throw new Error('Pick a due date.');
        if (existing) await q(sb.from('chores').update(row).eq('id', existing.id)); else await q(sb.from('chores').insert({ ...row, created_by: S.me.id }));
        go('chores');
      },
      onDelete: existing ? async () => { await q(sb.from('chores').delete().eq('id', existing.id)); go('chores'); } : null
    });
  }
  async function renderChores() {
    const ws = S.week || (S.week = monday(today()));
    const { chores, comps } = await loadChores(ws);
    if (S.tab !== 'chores') return;
    const days = [...Array(7)].map((_, i) => addDays(ws, i));
    const rows = filtered(chores.filter(c => c.active), 'assigned_to').filter(c => days.some(d => choreDue(c, d, comps.filter(x => x.chore_id === c.id))));
    const pts = {}; S.profiles.forEach(p => pts[p.id] = 0);
    comps.filter(x => x.done_on >= ws && x.done_on <= days[6]).forEach(x => { const c = chores.find(k => k.id === x.chore_id); if (c && pts[x.profile_id] != null) pts[x.profile_id] += c.points; });
    view.innerHTML = `<h1>Chores</h1>${personChips(renderChores)}${weekNav(renderChores)}
      <div class="card">${rows.length ? `<div class="grid7"><div></div>${days.map(d => `<div class="dh ${d === today() ? 'today' : ''}">${DAYS[dow(d)][0]}</div>`).join('')}
        ${rows.map(c => `<div class="name" data-edit="${c.id}">${S.person === 'all' && c.assigned_to ? avatar(prof(c.assigned_to), 22) + ' ' : ''}${esc(c.title)}<span class="tiny muted"> ${c.points}pt</span></div>
          ${days.map(d => { const cs = comps.filter(x => x.chore_id === c.id); const due = choreDue(c, d, cs); const on = cs.some(x => x.done_on === d); return `<button class="check ${on ? 'on' : ''} ${due ? '' : 'na'}" data-c="${c.id}" data-d="${d}">${on ? '✓' : ''}</button>`; }).join('')}`).join('')}</div>`
        : `<div class="empty">No chores this week${isParent() ? '. Tap + to add one.' : '.'}</div>`}</div>
      <h2>Points this week</h2><div class="card">${S.profiles.map(p => `<div class="item">${avatar(p)}<div class="grow">${esc(p.display_name)}</div><b>${pts[p.id]}</b></div>`).join('')}</div>`;
    $$('.check[data-c]').forEach(b => b.onclick = () => toggleChore(chores.find(c => c.id === b.dataset.c), b.dataset.d, comps, renderChores));
    if (isParent()) { $$('[data-edit]').forEach(el => el.onclick = () => choreForm(chores.find(c => c.id === el.dataset.edit))); fab(() => choreForm()); }
  }

  // ───────── school ─────────
  function assignmentForm(existing) {
    const fields = [
      ...(isParent() ? [{ name: 'profile_id', label: 'Student', type: 'person', value: existing?.profile_id || (S.person !== 'all' ? S.person : S.me.id) }] : []),
      { name: 'class_name', label: 'Class', value: existing?.class_name || '', placeholder: 'e.g. Algebra' },
      { name: 'title', label: 'Assignment', required: true, value: existing?.title },
      { name: 'due_date', label: 'Due', type: 'date', value: existing?.due_date || '' },
      ...(existing ? [{ name: 'status', label: 'Status', type: 'select', value: existing.status, options: [{ v: 'todo', l: 'To do' }, { v: 'doing', l: 'Working on it' }, { v: 'done', l: 'Done' }] }] : []),
      { name: 'notes', label: 'Notes', type: 'textarea', value: existing?.notes || '' }
    ];
    openForm({
      title: existing ? 'Edit assignment' : 'New assignment', fields,
      onSubmit: async v => {
        const row = { profile_id: isParent() ? v.profile_id : S.me.id, class_name: v.class_name.trim() || null, title: v.title.trim(), due_date: v.due_date || null, notes: v.notes.trim() || null, ...(existing ? { status: v.status } : {}) };
        if (existing) await q(sb.from('assignments').update(row).eq('id', existing.id)); else await q(sb.from('assignments').insert(row));
        go('school');
      },
      onDelete: existing ? async () => { await q(sb.from('assignments').delete().eq('id', existing.id)); go('school'); } : null
    });
  }
  function assignmentItem(a) {
    const t = today(); const late = a.due_date && a.due_date < t && a.status !== 'done';
    return `<div class="item ${a.status === 'done' ? 'done' : ''}"><button class="check ${a.status === 'done' ? 'on' : ''}" data-done="${a.id}">${a.status === 'done' ? '✓' : ''}</button>
      <div class="grow" data-edit="${a.id}"><div class="title">${esc(a.title)}</div><div class="tiny muted">${S.person === 'all' ? esc(pname(a.profile_id)) + ' · ' : ''}${esc(a.class_name || '')}${a.due_date ? ` · <span class="${late ? 'pill red' : ''}">${late ? 'Late · ' : 'Due '}${fmtDate(a.due_date)}</span>` : ''}${a.status === 'doing' ? ' <span class="pill amber">working on it</span>' : ''}</div></div></div>`;
  }
  async function renderSchool() {
    const all = await q(sb.from('assignments').select('*').order('due_date', { ascending: true, nullsFirst: false }));
    if (S.tab !== 'school') return;
    const rows = filtered(all); const t = today(); const wk = addDays(t, 7);
    const open = rows.filter(a => a.status !== 'done'), done = rows.filter(a => a.status === 'done').slice(-30).reverse();
    const groups = [['Overdue', open.filter(a => a.due_date && a.due_date < t)], ['Due today', open.filter(a => a.due_date === t)], ['This week', open.filter(a => a.due_date > t && a.due_date <= wk)], ['Later', open.filter(a => a.due_date > wk)], ['No due date', open.filter(a => !a.due_date)]].filter(g => g[1].length);
    view.innerHTML = `<h1>School</h1>${personChips(renderSchool)}
      ${groups.length ? groups.map(([h, list]) => `<h2>${h} <span class="pill">${list.length}</span></h2><div class="card">${list.map(assignmentItem).join('')}</div>`).join('') : '<div class="card"><div class="empty">Nothing due. Tap + to add an assignment.</div></div>'}
      <h2><a href="#" id="tog-done" class="muted">${S.showDone ? 'Hide' : 'Show'} done (${done.length})</a></h2>${S.showDone && done.length ? `<div class="card">${done.map(assignmentItem).join('')}</div>` : ''}`;
    $('#tog-done').onclick = e => { e.preventDefault(); S.showDone = !S.showDone; renderSchool(); };
    $$('[data-done]').forEach(b => b.onclick = async () => { const a = all.find(x => x.id === b.dataset.done); if (!canEditFor(a.profile_id)) return toast('Not yours to check off'); await q(sb.from('assignments').update({ status: a.status === 'done' ? 'todo' : 'done' }).eq('id', a.id)); renderSchool(); });
    $$('[data-edit]').forEach(el => el.onclick = () => { const a = all.find(x => x.id === el.dataset.edit); if (canEditFor(a.profile_id)) assignmentForm(a); });
    fab(() => assignmentForm());
  }

  // ───────── calendar / plans ─────────
  function eventForm(existing) {
    const fields = [
      { name: 'title', label: 'What', required: true, value: existing?.title },
      { name: 'category', label: 'Type', type: 'select', value: existing?.category || 'family', options: Object.entries(CATS).map(([v, l]) => ({ v, l })) },
      { name: 'date', label: 'Date', type: 'date', required: true, value: existing ? isoDate(existing.starts_at) : today() },
      { name: 'all_day', label: 'All day', type: 'checkbox', value: existing?.all_day || false },
      { name: 'start', label: 'Start time', type: 'time', value: existing && !existing.all_day ? isoTime(existing.starts_at) : '' },
      { name: 'end', label: 'End time', type: 'time', value: existing?.ends_at && !existing.all_day ? isoTime(existing.ends_at) : '' },
      { name: 'location', label: 'Where', value: existing?.location || '' },
      { name: 'in_charge', label: "Who's in charge", type: 'person', allowNone: true, value: existing?.in_charge || '' },
      { name: 'notes', label: 'Notes / plan', type: 'textarea', value: existing?.notes || '' }
    ];
    openForm({
      title: existing ? 'Edit plan' : 'New plan', fields,
      onSubmit: async v => {
        if (!v.all_day && !v.start) throw new Error('Pick a start time or check All day.');
        const row = { title: v.title.trim(), category: v.category, all_day: v.all_day, starts_at: localIso(v.date, v.all_day ? '00:00' : v.start), ends_at: !v.all_day && v.end ? localIso(v.date, v.end) : null, location: v.location.trim() || null, in_charge: v.in_charge || null, notes: v.notes.trim() || null };
        if (existing) await q(sb.from('events').update(row).eq('id', existing.id)); else await q(sb.from('events').insert({ ...row, created_by: S.me.id }));
        go('calendar');
      },
      onDelete: existing ? async () => { await q(sb.from('events').delete().eq('id', existing.id)); go('calendar'); } : null
    });
  }
  async function renderCalendar() {
    const from = S.showPast ? addDays(today(), -90) : today();
    const evs = await q(sb.from('events').select('*').gte('starts_at', new Date(from + 'T00:00:00').toISOString()).lte('starts_at', new Date(addDays(today(), 120) + 'T23:59:59').toISOString()).order('starts_at'));
    if (S.tab !== 'calendar') return;
    const byDay = {}; evs.forEach(e => { const d = isoDate(e.starts_at); (byDay[d] = byDay[d] || []).push(e); });
    view.innerHTML = `<h1>Family plans</h1><div class="row between"><span class="small muted">Next 120 days</span><a href="#" id="tog-past" class="small">${S.showPast ? 'Hide past' : 'Show past'}</a></div>
      ${Object.keys(byDay).length ? Object.entries(byDay).map(([d, list]) => `<div class="datehdr">${d === today() ? 'Today · ' : ''}${fmtDate(d)}</div><div class="card">${list.map(e => `<div class="item" data-ev="${e.id}">
        <div style="min-width:64px" class="small muted">${e.all_day ? 'All day' : fmtTime(e.starts_at) + (e.ends_at ? '<br>' + fmtTime(e.ends_at) : '')}</div>
        <div class="grow"><div class="title">${esc(e.title)}</div><div class="tiny muted">${CATS[e.category] || e.category}${e.location ? ' · ' + esc(e.location) : ''}${e.in_charge ? ' · ' + esc(pname(e.in_charge)) + ' in charge' : ''}</div>${e.notes ? `<div class="small" style="margin-top:4px;white-space:pre-wrap">${esc(e.notes)}</div>` : ''}</div>${e.in_charge ? avatar(prof(e.in_charge), 28) : ''}</div>`).join('')}</div>`).join('')
        : '<div class="card"><div class="empty">Nothing planned yet. Tap + to add a trip, FHE, game, or anything the family is doing.</div></div>'}`;
    $('#tog-past').onclick = e => { e.preventDefault(); S.showPast = !S.showPast; renderCalendar(); };
    $$('[data-ev]').forEach(el => el.onclick = () => { const e = evs.find(x => x.id === el.dataset.ev); if (isParent() || e.created_by === S.me.id) eventForm(e); else toast('Only a parent or whoever added this can edit it'); });
    fab(() => eventForm());
  }

  // ───────── projects ─────────
  const PSTAT = { idea: ['Idea', 'pill'], planning: ['Planning', 'pill amber'], active: ['In progress', 'pill teal'], done: ['Done', 'pill green'] };
  function projectForm(existing) {
    const fields = [
      { name: 'name', label: 'Project', required: true, value: existing?.name, placeholder: 'e.g. Kitchen backsplash' },
      { name: 'status', label: 'Status', type: 'select', value: existing?.status || 'idea', options: Object.entries(PSTAT).map(([v, [l]]) => ({ v, l })) },
      { name: 'budget', label: 'Budget ($)', type: 'number', value: existing?.budget ?? 0, min: 0 },
      { name: 'target_date', label: 'Target finish', type: 'date', value: existing?.target_date || '' },
      { name: 'notes', label: 'Notes / scope', type: 'textarea', value: existing?.notes || '' }
    ];
    openForm({
      title: existing ? 'Edit project' : 'New project', fields,
      onSubmit: async v => {
        const row = { name: v.name.trim(), status: v.status, budget: Number(v.budget) || 0, target_date: v.target_date || null, notes: v.notes.trim() || null };
        if (existing) await q(sb.from('projects').update(row).eq('id', existing.id)); else { const d = await q(sb.from('projects').insert(row).select().single()); S.projectId = d.id; }
        go('projects');
      },
      onDelete: existing ? async () => { await q(sb.from('projects').delete().eq('id', existing.id)); S.projectId = null; go('projects'); } : null
    });
  }
  function taskForm(projectId, existing) {
    const fields = [
      { name: 'title', label: 'Task', required: true, value: existing?.title },
      { name: 'status', label: 'Status', type: 'select', value: existing?.status || 'todo', options: [{ v: 'todo', l: 'To do' }, { v: 'doing', l: 'In progress' }, { v: 'done', l: 'Done' }] },
      { name: 'assigned_to', label: 'Who', type: 'person', allowNone: true, value: existing?.assigned_to || '' },
      { name: 'cost', label: 'Cost ($)', type: 'number', value: existing?.cost ?? 0, min: 0 },
      { name: 'due_date', label: 'Due', type: 'date', value: existing?.due_date || '' }
    ];
    openForm({
      title: existing ? 'Edit task' : 'New task', fields,
      onSubmit: async v => {
        const row = { project_id: projectId, title: v.title.trim(), status: v.status, assigned_to: v.assigned_to || null, cost: Number(v.cost) || 0, due_date: v.due_date || null };
        if (existing) await q(sb.from('project_tasks').update(row).eq('id', existing.id)); else await q(sb.from('project_tasks').insert(row));
        go('projects');
      },
      onDelete: existing && isParent() ? async () => { await q(sb.from('project_tasks').delete().eq('id', existing.id)); go('projects'); } : null
    });
  }
  async function renderProjects() {
    const [projects, tasks] = await Promise.all([q(sb.from('projects').select('*').order('created_at')), q(sb.from('project_tasks').select('*').order('sort').order('created_at'))]);
    if (S.tab !== 'projects') return;
    const stats = p => { const ts = tasks.filter(t => t.project_id === p.id); return { n: ts.length, done: ts.filter(t => t.status === 'done').length, spent: ts.reduce((a, t) => a + Number(t.cost || 0), 0) }; };
    if (S.projectId) {
      const p = projects.find(x => x.id === S.projectId); if (!p) { S.projectId = null; return renderProjects(); }
      const st = stats(p); const ts = tasks.filter(t => t.project_id === p.id);
      view.innerHTML = `<a href="#" id="back" class="small">‹ All projects</a><h1>${esc(p.name)} <span class="${PSTAT[p.status][1]}">${PSTAT[p.status][0]}</span></h1>
        <div class="card"><div class="row between"><div><div class="tiny muted">Budget</div><b>${money(p.budget)}</b></div><div><div class="tiny muted">Spent</div><b class="${st.spent > p.budget && p.budget ? 'pill red' : ''}">${money(st.spent)}</b></div><div><div class="tiny muted">Tasks</div><b>${st.done}/${st.n}</b></div><div><div class="tiny muted">Target</div><b>${p.target_date ? fmtDate(p.target_date) : '—'}</b></div></div>
        <div class="progress" style="margin-top:8px"><i style="width:${st.n ? st.done / st.n * 100 : 0}%"></i></div>${p.notes ? `<p class="small" style="white-space:pre-wrap">${esc(p.notes)}</p>` : ''}${isParent() ? '<button class="btn ghost sm" id="edit-p">Edit project</button>' : ''}</div>
        <h2>Tasks</h2><div class="card">${ts.length ? ts.map(t => `<div class="item ${t.status === 'done' ? 'done' : ''}"><button class="check ${t.status === 'done' ? 'on' : ''}" data-done="${t.id}">${t.status === 'done' ? '✓' : ''}</button>
          <div class="grow" data-edit="${t.id}"><div class="title">${esc(t.title)}</div><div class="tiny muted">${t.assigned_to ? esc(pname(t.assigned_to)) + ' · ' : ''}${t.cost ? money(t.cost) + ' · ' : ''}${t.due_date ? fmtDate(t.due_date) : ''}${t.status === 'doing' ? ' <span class="pill amber">in progress</span>' : ''}</div></div>${t.assigned_to ? avatar(prof(t.assigned_to), 26) : ''}</div>`).join('') : '<div class="empty">No tasks yet.</div>'}</div>`;
      $('#back').onclick = e => { e.preventDefault(); S.projectId = null; renderProjects(); };
      $('#edit-p') && ($('#edit-p').onclick = () => projectForm(p));
      $$('[data-done]').forEach(b => b.onclick = async () => { const t = ts.find(x => x.id === b.dataset.done); await q(sb.from('project_tasks').update({ status: t.status === 'done' ? 'todo' : 'done' }).eq('id', t.id)); renderProjects(); });
      $$('[data-edit]').forEach(el => el.onclick = () => taskForm(p.id, ts.find(x => x.id === el.dataset.edit)));
      fab(() => taskForm(p.id));
      return;
    }
    const order = { active: 0, planning: 1, idea: 2, done: 3 };
    const sorted = [...projects].sort((a, b) => order[a.status] - order[b.status]);
    view.innerHTML = `<h1>Projects</h1>${sorted.length ? sorted.map(p => { const st = stats(p); return `<div class="card" data-open="${p.id}"><div class="row between"><h3>${esc(p.name)}</h3><span class="${PSTAT[p.status][1]}">${PSTAT[p.status][0]}</span></div>
      <div class="progress"><i style="width:${st.n ? st.done / st.n * 100 : 0}%"></i></div>
      <div class="row between small muted" style="margin-top:6px"><span>${st.done}/${st.n} tasks</span><span>${money(st.spent)} of ${money(p.budget)}</span><span>${p.target_date ? fmtDate(p.target_date) : ''}</span></div></div>`; }).join('')
      : `<div class="card"><div class="empty">No projects yet.${isParent() ? ' Tap + to start one (kitchen, yard, garage…).' : ''}</div></div>`}`;
    $$('[data-open]').forEach(el => el.onclick = () => { S.projectId = el.dataset.open; renderProjects(); });
    if (isParent()) fab(() => projectForm());
  }

  // ───────── goals: rocks + 4-week goal ─────────
  function rockForm(pid, existing) {
    const fields = [
      { name: 'title', label: 'Rock (what matters most this week)', required: true, value: existing?.title },
      { name: 'day_of_week', label: 'Day', type: 'select', value: existing?.day_of_week ?? '', options: [{ v: '', l: '— pick a day —' }, ...[1, 2, 3, 4, 5, 6, 0].map(d => ({ v: d, l: DAYS[d] }))] },
      { name: 'at_time', label: 'Time', type: 'time', value: existing?.at_time?.slice(0, 5) || '' }
    ];
    openForm({
      title: existing ? 'Edit rock' : 'New rock', fields,
      onSubmit: async v => {
        const row = { profile_id: pid, week_start: S.week, title: v.title.trim(), day_of_week: v.day_of_week === '' ? null : Number(v.day_of_week), at_time: v.at_time || null };
        if (existing) await q(sb.from('rocks').update(row).eq('id', existing.id)); else await q(sb.from('rocks').insert(row));
        go('goals');
      },
      onDelete: existing ? async () => { await q(sb.from('rocks').delete().eq('id', existing.id)); go('goals'); } : null
    });
  }
  function goalForm(pid, existing) {
    const fields = [
      { name: 'title', label: 'My goal (what, exactly)', required: true, value: existing?.title },
      { name: 'why', label: 'Why it matters to me', type: 'textarea', value: existing?.why || '' },
      { name: 'done_looks_like', label: '"Done" looks like', type: 'textarea', value: existing?.done_looks_like || '' },
      { name: 'first_step', label: 'My very first step (this week)', value: existing?.first_step || '' },
      { name: 'start_date', label: 'Start', type: 'date', value: existing?.start_date || today() },
      ...(existing ? [{ name: 'status', label: 'Status', type: 'select', value: existing.status, options: [{ v: 'active', l: 'Active' }, { v: 'done', l: 'Finished' }, { v: 'paused', l: 'Paused' }] }] : [])
    ];
    openForm({
      title: existing ? 'Edit goal' : 'One goal, four weeks', fields,
      onSubmit: async v => {
        const row = { profile_id: pid, title: v.title.trim(), why: v.why.trim() || null, done_looks_like: v.done_looks_like.trim() || null, first_step: v.first_step.trim() || null, start_date: v.start_date, end_date: addDays(v.start_date, 28), ...(existing ? { status: v.status } : {}) };
        if (existing) await q(sb.from('goals').update(row).eq('id', existing.id)); else await q(sb.from('goals').insert(row));
        go('goals');
      },
      onDelete: existing ? async () => { await q(sb.from('goals').delete().eq('id', existing.id)); go('goals'); } : null
    });
  }
  function checkinForm(goal, week, existing) {
    const fields = [
      { name: 'did', label: 'What I did toward my goal', type: 'textarea', value: existing?.did || '' },
      { name: 'obstacle', label: 'What got in the way', type: 'textarea', value: existing?.obstacle || '' },
      { name: 'next_step', label: 'Next step this week', value: existing?.next_step || '' }
    ];
    openForm({
      title: `Week ${week} check-in`, fields,
      onSubmit: async v => { await q(sb.from('goal_checkins').upsert({ goal_id: goal.id, week_no: week, did: v.did.trim() || null, obstacle: v.obstacle.trim() || null, next_step: v.next_step.trim() || null }, { onConflict: 'goal_id,week_no' })); go('goals'); }
    });
  }
  async function renderGoals() {
    if (!S.week) S.week = monday(today());
    const pid = S.person === 'all' ? S.me.id : S.person; if (S.person === 'all') S.person = pid;
    const [rocks, goals, checkins] = await Promise.all([
      q(sb.from('rocks').select('*').eq('profile_id', pid).eq('week_start', S.week).order('day_of_week', { nullsFirst: false }).order('at_time')),
      q(sb.from('goals').select('*').eq('profile_id', pid).order('created_at', { ascending: false })),
      q(sb.from('goal_checkins').select('*'))
    ]);
    if (S.tab !== 'goals') return;
    const active = goals.find(g => g.status === 'active'); const past = goals.filter(g => g.status !== 'active');
    const mine = canEditFor(pid);
    let goalHtml;
    if (active) {
      const t = today(); const wkNo = Math.min(4, Math.max(1, Math.floor(daysBetween(active.start_date, t) / 7) + 1)); const left = daysBetween(t, active.end_date);
      const cis = checkins.filter(c => c.goal_id === active.id);
      goalHtml = `<div class="card"><div class="row between"><h3>${esc(active.title)}</h3><span class="pill teal">Week ${wkNo} of 4</span></div>
        <div class="progress"><i style="width:${Math.min(100, Math.max(0, daysBetween(active.start_date, t) / 28 * 100))}%"></i></div>
        <div class="tiny muted" style="margin:4px 0 8px">${left >= 0 ? left + ' days left' : 'Past finish line'} · finish by ${fmtDate(active.end_date)}</div>
        ${active.why ? `<p class="small"><b>Why:</b> ${esc(active.why)}</p>` : ''}${active.done_looks_like ? `<p class="small"><b>Done looks like:</b> ${esc(active.done_looks_like)}</p>` : ''}${active.first_step ? `<p class="small"><b>First step:</b> ${esc(active.first_step)}</p>` : ''}
        <h2>Sunday check-ins</h2>${[1, 2, 3, 4].map(w => { const c = cis.find(x => x.week_no === w); return `<div class="item"><span class="pill ${c ? 'green' : w === wkNo ? 'amber' : ''}">Wk ${w}</span><div class="grow small">${c ? `<div><b>Did:</b> ${esc(c.did || '—')}</div><div><b>In the way:</b> ${esc(c.obstacle || '—')}</div><div><b>Next:</b> ${esc(c.next_step || '—')}</div>` : '<span class="muted">Not yet</span>'}</div>${mine ? `<button class="btn sm secondary" data-ci="${w}">${c ? 'Edit' : 'Fill in'}</button>` : ''}</div>`; }).join('')}
        ${mine ? `<div class="row" style="margin-top:10px"><button class="btn ghost sm" id="edit-goal">Edit goal</button><span class="grow"></span><button class="btn sm" id="finish-goal">I finished it 🎉</button></div>` : ''}</div>`;
    } else goalHtml = `<div class="card"><div class="empty">No active 4-week goal.${mine ? '<br><br>Small enough to finish, big enough to matter.' : ''}</div>${mine ? '<button class="btn block" id="new-goal">Set a 4-week goal</button>' : ''}</div>`;
    view.innerHTML = `<h1>Goals</h1>${personChips(renderGoals, false)}
      <h2>My rocks this week</h2>${weekNav(renderGoals)}
      <div class="card">${rocks.length ? rocks.map(r => `<div class="item ${r.done ? 'done' : ''}"><button class="check ${r.done ? 'on' : ''}" data-rock="${r.id}">${r.done ? '✓' : ''}</button><div class="grow" data-editrock="${r.id}"><div class="title">${esc(r.title)}</div><div class="tiny muted">${r.day_of_week != null ? DAYS[r.day_of_week] : '<span class="pill red">no day yet</span>'}${r.at_time ? ' · ' + fmtClock(r.at_time) : ''}</div></div></div>`).join('') : '<div class="empty">No rocks yet. Pick 1 to 3 things that matter most this week and give each a day and time.</div>'}
        ${mine ? `<button class="btn secondary block" id="add-rock" style="margin-top:8px">${rocks.length >= 3 ? 'Add another (3 is plenty)' : '+ Add a rock'}</button>` : ''}</div>
      <div class="callout"><b>Sunday sit-down (10 min):</b> look back at last week · add fixed stuff · place 1–3 rocks · set phone alerts · show a parent.</div>
      <h2>Four-week goal</h2>${goalHtml}
      ${past.length ? `<h2>Past goals</h2><div class="card">${past.map(g => `<div class="item"><span class="pill ${g.status === 'done' ? 'green' : ''}">${g.status}</span><div class="grow small">${esc(g.title)}<div class="tiny muted">${fmtDate(g.start_date)} → ${fmtDate(g.end_date)}</div></div></div>`).join('')}</div>` : ''}`;
    $$('[data-rock]').forEach(b => b.onclick = async () => { if (!mine) return; const r = rocks.find(x => x.id === b.dataset.rock); await q(sb.from('rocks').update({ done: !r.done }).eq('id', r.id)); renderGoals(); });
    $$('[data-editrock]').forEach(el => el.onclick = () => { if (mine) rockForm(pid, rocks.find(x => x.id === el.dataset.editrock)); });
    $('#add-rock') && ($('#add-rock').onclick = () => rockForm(pid));
    $('#new-goal') && ($('#new-goal').onclick = () => goalForm(pid));
    $('#edit-goal') && ($('#edit-goal').onclick = () => goalForm(pid, active));
    $('#finish-goal') && ($('#finish-goal').onclick = async () => { if (confirm('Mark this goal finished?')) { await q(sb.from('goals').update({ status: 'done' }).eq('id', active.id)); renderGoals(); } });
    $$('[data-ci]').forEach(b => b.onclick = () => checkinForm(active, Number(b.dataset.ci), checkins.find(x => x.goal_id === active.id && x.week_no === Number(b.dataset.ci))));
  }

  // ───────── home ─────────
  async function renderHome() {
    const t = today(); const ws = monday(t);
    const [{ chores, comps }, assigns, evs, rocks, goals] = await Promise.all([
      loadChores(ws),
      q(sb.from('assignments').select('*').neq('status', 'done').order('due_date', { nullsFirst: false })),
      q(sb.from('events').select('*').gte('starts_at', new Date(t + 'T00:00:00').toISOString()).lte('starts_at', new Date(addDays(t, 7) + 'T23:59:59').toISOString()).order('starts_at')),
      q(sb.from('rocks').select('*').eq('profile_id', S.me.id).eq('week_start', ws).order('day_of_week', { nullsFirst: false })),
      q(sb.from('goals').select('*').eq('profile_id', S.me.id).eq('status', 'active').limit(1))
    ]);
    if (S.tab !== 'home') return;
    const myChores = chores.filter(c => c.assigned_to === S.me.id && choreDue(c, t, comps.filter(x => x.chore_id === c.id)));
    const myAssign = assigns.filter(a => a.profile_id === S.me.id && (!a.due_date || a.due_date <= addDays(t, 3)));
    const kidsLate = isParent() ? assigns.filter(a => a.due_date && a.due_date < t) : [];
    const goal = goals[0]; const isSunday = new Date().getDay() === 0;
    const hour = new Date().getHours(); const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    view.innerHTML = `<h1>${greet}, ${esc(S.me.display_name)} ${esc(S.me.emoji)}</h1>
      ${isSunday ? '<div class="callout" style="margin-bottom:10px"><b>It\'s Sunday.</b> Ten minutes: plan next week\'s rocks and do your goal check-in. <a href="#" data-go="goals">Open Goals ›</a></div>' : ''}
      <h2>My chores today</h2><div class="card">${myChores.length ? myChores.map(c => { const on = comps.some(x => x.chore_id === c.id && x.done_on === t); return `<div class="item ${on ? 'done' : ''}"><button class="check ${on ? 'on' : ''}" data-c="${c.id}">${on ? '✓' : ''}</button><div class="grow title">${esc(c.title)}</div><span class="tiny muted">${c.points}pt</span></div>`; }).join('') : '<div class="empty">Nothing due today 🎉</div>'}</div>
      <h2>School · due soon</h2><div class="card">${myAssign.length ? myAssign.map(a => `<div class="item"><div class="grow"><div class="title">${esc(a.title)}</div><div class="tiny muted">${esc(a.class_name || '')}${a.due_date ? ' · ' + (a.due_date < t ? '<span class="pill red">Late</span> ' : '') + fmtDate(a.due_date) : ''}</div></div></div>`).join('') : '<div class="empty">Nothing due in the next 3 days.</div>'}
        ${kidsLate.length ? `<div class="item"><span class="pill red">Parent view</span><div class="grow small">${kidsLate.length} overdue across the family: ${kidsLate.map(a => esc(pname(a.profile_id))).filter((v, i, arr) => arr.indexOf(v) === i).join(', ')}</div></div>` : ''}</div>
      <h2>My rocks this week</h2><div class="card rockbox">${rocks.length ? rocks.map(r => `<div class="item ${r.done ? 'done' : ''}"><span>${r.done ? '✅' : '🪨'}</span><div class="grow"><div class="title">${esc(r.title)}</div><div class="tiny muted">${r.day_of_week != null ? DAYS[r.day_of_week] : 'no day'}${r.at_time ? ' · ' + fmtClock(r.at_time) : ''}</div></div></div>`).join('') : '<div class="empty">No rocks placed. <a href="#" data-go="goals">Pick 1–3 ›</a></div>'}
        ${goal ? `<div class="item"><span>🎯</span><div class="grow small"><b>${esc(goal.title)}</b><div class="tiny muted">${Math.max(0, daysBetween(t, goal.end_date))} days left</div></div></div>` : ''}</div>
      <h2>Coming up this week</h2><div class="card">${evs.length ? evs.map(e => `<div class="item"><div class="small muted" style="min-width:64px">${fmtDate(isoDate(e.starts_at)).split(',')[0]}<br>${e.all_day ? 'all day' : fmtTime(e.starts_at)}</div><div class="grow"><div class="title">${esc(e.title)}</div><div class="tiny muted">${CATS[e.category] || ''}${e.location ? ' · ' + esc(e.location) : ''}</div></div></div>`).join('') : '<div class="empty">Nothing on the family calendar this week.</div>'}</div>`;
    $$('.check[data-c]').forEach(b => b.onclick = () => toggleChore(chores.find(c => c.id === b.dataset.c), t, comps, renderHome));
    $$('[data-go]').forEach(a => a.onclick = e => { e.preventDefault(); go(a.dataset.go); });
  }

  // ───────── family / profile ─────────
  async function renderFamily() {
    $$('#tabs button').forEach(b => b.classList.remove('active'));
    S.profiles = await q(sb.from('profiles').select('*').order('created_at'));
    const since = addDays(today(), -30);
    const comps = await q(sb.from('chore_completions').select('profile_id, chores(points)').gte('done_on', since));
    const pts = {}; comps.forEach(c => pts[c.profile_id] = (pts[c.profile_id] || 0) + (c.chores?.points || 0));
    const me = S.profiles.find(p => p.id === S.me.id) || S.me; S.me = me;
    view.innerHTML = `<h1>Family</h1>
      <div class="card"><div class="row">${avatar(me, 44)}<div class="grow"><b>${esc(me.display_name)}</b><div class="tiny muted">${me.role} · ${esc(S.session.user.email)}</div></div><button class="btn sm secondary" id="edit-me">Edit</button></div></div>
      <h2>Members</h2><div class="card">${S.profiles.map(p => `<div class="item">${avatar(p)}<div class="grow"><div class="title">${esc(p.display_name)} ${p.id === me.id ? '<span class="tiny muted">(you)</span>' : ''}</div><div class="tiny muted"><span class="pill ${p.role === 'parent' ? 'teal' : ''}">${p.role}</span> ${p.approved ? '' : '<span class="pill amber">waiting for approval</span>'} · ${pts[p.id] || 0} pts / 30 days</div></div>
        ${isParent() && p.id !== me.id ? `<div class="row" style="gap:4px">${!p.approved ? `<button class="btn sm" data-approve="${p.id}">Approve</button>` : `<button class="btn sm secondary" data-role="${p.id}">${p.role === 'parent' ? 'Make kid' : 'Make parent'}</button>`}<button class="btn sm danger" data-remove="${p.id}">✕</button></div>` : ''}</div>`).join('')}</div>
      <p class="tiny muted">To add someone: they open this same link on their phone, tap "Create an account", and a parent approves them here.</p>
      <h2>App</h2><div class="card"><p class="small muted">Add to your home screen: in Safari tap Share → <b>Add to Home Screen</b>. On Android, use the browser menu → <b>Install app</b>.</p><button class="btn danger block" id="signout">Sign out</button></div>`;
    $('#edit-me').onclick = () => openForm({
      title: 'Edit my profile', fields: [{ name: 'display_name', label: 'Name', required: true, value: me.display_name }, { name: 'emoji', label: 'Avatar', type: 'emoji', value: me.emoji }, { name: 'color', label: 'Color', type: 'color', value: me.color }],
      onSubmit: async v => { await q(sb.from('profiles').update({ display_name: v.display_name.trim(), emoji: v.emoji || me.emoji, color: v.color || me.color }).eq('id', me.id)); await loadMe(); go('family'); }
    });
    $$('[data-approve]').forEach(b => b.onclick = async () => { await q(sb.from('profiles').update({ approved: true }).eq('id', b.dataset.approve)); toast('Approved'); renderFamily(); });
    $$('[data-role]').forEach(b => b.onclick = async () => { const p = prof(b.dataset.role); await q(sb.from('profiles').update({ role: p.role === 'parent' ? 'kid' : 'parent' }).eq('id', p.id)); renderFamily(); });
    $$('[data-remove]').forEach(b => b.onclick = async () => { const p = prof(b.dataset.remove); if (confirm(`Remove ${p.display_name} from the family app? Their chores, assignments, and goals go with them.`)) { await q(sb.from('profiles').delete().eq('id', p.id)); renderFamily(); } });
    $('#signout').onclick = () => sb.auth.signOut();
  }

  boot();
})();

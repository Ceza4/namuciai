// Chores: daily deck for repeating chores and one-offs with due dates.
import { $, esc, svg, I, S, db, uuid, refresh, toast, hueOf, nameOf, partner, notify, on, today, addDays, dow, ymd, daysBetween, fmtDay } from './core.js';
import { t, tn, locale } from './i18n.js';
import { header, srow, ROWS, miniStack, openDeck, openSheet, closeSheet, autoGrow, avatar } from './ui.js';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const dayShort = (d) => new Date(2024, 0, 7 + d).toLocaleDateString(locale(), { weekday: 'narrow' });
const dayName = (d) => new Date(2024, 0, 7 + d).toLocaleDateString(locale(), { weekday: 'short' });
function daysLabel(w) {
  const s = [...w].sort().join('');
  if (s === '0123456') return t('Every day');
  if (s === '12345') return t('Weekdays');
  if (s === '06') return t('Weekends');
  return DAY_ORDER.filter((d) => w.includes(d)).map(dayName).join(', ');
}
function dueLabel(d) {
  const n = daysBetween(today(), d);
  if (n === 0) return t('Due today');
  if (n === 1) return t('Due tomorrow');
  if (n < 0) return tn(-n, 'Overdue by {n} day', 'Overdue by {n} days');
  if (n < 7) return t('Due {day}', { day: fmtDay(d) });
  return t('Due {day}', { day: fmtDay(d, { month: 'short', day: 'numeric' }) });
}

export const logFor = (c, d = today()) => S.log.find((l) => l.chore_id === c.id && l.day === d);
const isDoneToday = (c) => logFor(c)?.status === 'done' || (!c.recurring && !!c.completed_at);
function scheduledToday(c) {
  const d = today();
  if (c.recurring) return c.weekdays.includes(dow(d));
  if (c.completed_at) return ymd(new Date(c.completed_at)) === d;
  return !c.due_date || c.due_date <= addDays(d, 2);
}
export function inMyDeck(c) {
  if (logFor(c)) return false;
  if (c.assignee && c.assignee !== S.uid) return false;
  if (!c.recurring && c.completed_at) return false;
  return scheduledToday(c);
}
function missedYesterday(c) {
  if (!c.recurring) return false;
  const y = addDays(today(), -1);
  if (!c.weekdays.includes(dow(y))) return false;
  if (ymd(new Date(c.created_at)) >= y) return false;
  return !logFor(c, y);
}
const overdue = (c) => !c.recurring && !c.completed_at && c.due_date && c.due_date < today();
const PRI = () => ({ 3: t('High priority'), 2: t('Normal'), 1: t('Low priority') });
const choreSort = (a, b) => (b.priority - a.priority) || (overdue(b) - overdue(a)) || ((a.due_date || '9') < (b.due_date || '9') ? -1 : 1);

ROWS.chore = (id) => {
  const c = S.chores.find((x) => x.id === id);
  if (!c) return {};
  const out = { trail: { label: t('Delete'), icon: I.trash, color: 'var(--warn)', destructive: true, run: () => deleteChore(c) } };
  if (scheduledToday(c)) {
    out.lead = isDoneToday(c)
      ? { label: t('Undo'), icon: I.undo, color: 'var(--no)', run: () => { undoChore(c); refresh(); } }
      : { label: t('Done'), icon: I.tick, color: 'var(--yes)', run: () => { markChore(c, 'done'); refresh(); } };
  }
  return out;
};

function choreRow(c) {
  const l = logFor(c);
  let status = '';
  if (isDoneToday(c)) status = `<span class="chip ok">${svg(I.tick, 14, 2.6)} ${t('Done')}</span>`;
  else if (l?.status === 'snoozed') status = `<span class="chip">${c.recurring ? t('Skipped') : t('Tomorrow')}</span>`;
  else if (scheduledToday(c)) status = `<span class="chip">${t('To do')}</span>`;
  const bits = [esc(c.assignee ? nameOf(c.assignee) : t('Anyone'))];
  if (c.recurring) bits.push(esc(daysLabel(c.weekdays)));
  else if (c.due_date) bits.push(overdue(c) ? `<span class="tag-warn">${esc(dueLabel(c.due_date))}</span>` : esc(dueLabel(c.due_date)));
  else bits.push(t('One-off'));
  if (missedYesterday(c) && !l) bits.push(`<span class="tag-warn">${t('missed yesterday')}</span>`);
  return srow('chore', c.id, `
    <div class="srow-fg row">
      <span class="pri p${c.priority}" title="${esc(PRI()[c.priority])}"></span>
      ${avatar(c.assignee, 'sm')}
      <button class="row-main" data-a="chore-edit" data-id="${c.id}">
        <span class="row-title">${esc(c.title)}</span>
        <span class="row-sub wrap">${bits.join(', ')}</span>
      </button>
      ${status}
    </div>`);
}

export function viewChores() {
  let html = header(t('Chores'), 'chore-new');
  if (!S.chores.length) return html + `<div class="group empty"><p>${t("Add the things that need doing. Repeating chores come back on the days you pick; one-offs stay until they're done.")}</p><button class="btn" data-a="chore-new">${t('Add a chore')}</button></div>`;
  const deck = S.chores.filter(inMyDeck).sort(choreSort);
  html += `<button class="launch ${deck.length ? '' : 'idle'}" data-a="${deck.length ? 'deck-chores' : ''}">
    ${miniStack(deck.length ? deck : S.chores)}
    <span class="launch-text"><span class="launch-title">${deck.length ? t("Swipe today's chores") : t('All swiped for today')}</span>
    <span class="launch-sub">${deck.length ? tn(deck.length, '{n} waiting for you. Right is done, left is later.', '{n} waiting for you. Right is done, left is later.') : t('New cards show up tomorrow.')}</span></span>
  </button>`;
  const todays = S.chores.filter(scheduledToday).sort(choreSort);
  const later = S.chores.filter((c) => !c.recurring && !c.completed_at && !scheduledToday(c)).sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  const other = S.chores.filter((c) => c.recurring && !scheduledToday(c));
  if (todays.length) html += `<div class="sec"><h2>${t('Today')}</h2><span class="count">${t('{d} of {n} done', { d: todays.filter(isDoneToday).length, n: todays.length })}</span></div><div class="group">${todays.map(choreRow).join('')}</div>`;
  if (later.length) html += `<div class="sec"><h2>${t('Coming up')}</h2></div><div class="group">${later.map(choreRow).join('')}</div>`;
  if (other.length) html += `<div class="sec"><h2>${t('Other days')}</h2></div><div class="group">${other.map(choreRow).join('')}</div>`;
  return html;
}

function markChore(c, status) {
  const entry = { chore_id: c.id, day: today(), status, by_user: S.uid, household_id: S.me.household_id, at: new Date().toISOString() };
  S.log = S.log.filter((l) => !(l.chore_id === c.id && l.day === entry.day));
  S.log.push(entry);
  db.upsert('chore_log', entry, 'chore_id,day');
  if (!c.recurring && status === 'done') { c.completed_at = new Date().toISOString(); db.update('chores', { id: c.id }, { completed_at: c.completed_at }); }
}
function undoChore(c) {
  const d = today();
  S.log = S.log.filter((l) => !(l.chore_id === c.id && l.day === d));
  db.del('chore_log', { chore_id: c.id, day: d });
  if (!c.recurring && c.completed_at) { c.completed_at = null; db.update('chores', { id: c.id }, { completed_at: null }); }
}
function deleteChore(c) {
  const copy = { ...c };
  S.chores = S.chores.filter((x) => x.id !== c.id);
  db.del('chores', { id: c.id });
  refresh();
  toast(t('Chore deleted'), { undo: () => { S.chores.push(copy); db.insert('chores', copy); refresh(); } });
}

function choreDeck() {
  openDeck({
    title: t("Today's chores"),
    items: S.chores.filter(inMyDeck).sort(choreSort),
    left: { label: t('Later'), icon: I.clock },
    right: { label: t('Done'), icon: I.tick },
    stampYes: t('Done'), stampNo: t('Later'),
    card: (c) => `
      <div class="meta"><span class="chip"><span class="pri p${c.priority}" style="width:8px;height:8px;margin:0;border-radius:4px;align-self:center"></span>${esc(PRI()[c.priority])}</span>
        ${missedYesterday(c) ? `<span class="chip" style="color:var(--warn)">${t('Missed yesterday')}</span>` : ''}
        ${overdue(c) ? `<span class="chip" style="color:var(--warn)">${esc(dueLabel(c.due_date))}</span>` : ''}</div>
      <h3>${esc(c.title)}</h3>
      ${c.description ? `<p>${esc(c.description)}</p>` : ''}
      <div class="by">${avatar(c.assignee, 'xs')} ${c.assignee ? (c.assignee === S.uid ? t('Yours') : esc(nameOf(c.assignee))) : t('Anyone can do this')}, ${esc((c.recurring ? daysLabel(c.weekdays) : c.due_date ? dueLabel(c.due_date) : t('One-off')).toLowerCase())}</div>`,
    onSwipe(c, dir) { markChore(c, dir === 'right' ? 'done' : 'snoozed'); return () => undoChore(c); },
    end: () => ({ title: t('All swiped'), text: t('That was everything for today.') }),
  });
}

function openChore(id) {
  const c = id ? S.chores.find((x) => x.id === id) : null;
  const st = { assignee: c ? c.assignee : S.uid, priority: c?.priority ?? 2, recurring: c?.recurring ?? true, weekdays: c ? [...c.weekdays] : [0, 1, 2, 3, 4, 5, 6] };
  const p = partner();
  const sheet = openSheet(`
    <div class="sheet-bar">
      <button class="bar-btn plain" data-a="cancel">${t('Cancel')}</button>
      <div class="ttl">${c ? t('Edit chore') : t('New chore')}</div>
      <button class="bar-btn primary" data-a="save">${c ? t('Save') : t('Add')}</button>
    </div>
    <div class="sheet-body"><div>
      <div class="edit-card" style="background:${hueOf(c?.id || 'new-chore')};min-height:170px">
        <textarea class="t" id="choreTitle" rows="1" placeholder="${esc(t('What needs doing?'))}" maxlength="120">${esc(c?.title)}</textarea>
        <textarea class="d" id="choreDesc" rows="2" placeholder="${esc(t('Details (optional)'))}">${esc(c?.description)}</textarea>
      </div>
      <label class="field-label">${t('Who')}</label>
      <div class="seg" data-seg="assignee">
        <button data-v="${S.uid}">${avatar(S.uid, 'xs')} ${t('Me')}</button>
        ${p ? `<button data-v="${p.user_id}">${avatar(p.user_id, 'xs')} ${esc(p.display_name)}</button>` : ''}
        <button data-v="">${t('Anyone')}</button>
      </div>
      <label class="field-label">${t('Priority')}</label>
      <div class="seg" data-seg="priority"><button data-v="1">${t('Low')}</button><button data-v="2">${t('Normal')}</button><button data-v="3">${t('High')}</button></div>
      <label class="field-label">${t('When')}</label>
      <div class="seg" data-seg="recurring"><button data-v="1">${t('Repeats')}</button><button data-v="0">${t('Once')}</button></div>
      <div id="whenRepeat"><div class="days">${DAY_ORDER.map((d) => `<button data-day="${d}" aria-label="${esc(dayName(d))}">${esc(dayShort(d))}</button>`).join('')}</div></div>
      <div id="whenOnce"><label class="field-label" for="due">${t('Due date (optional)')}</label><input class="input" id="due" type="date" value="${esc(c?.due_date || '')}"></div>
      ${c ? `<div style="margin-top:34px;text-align:center"><button class="btn danger" data-a="delete">${svg(I.trash, 18)} ${t('Delete chore')}</button></div>` : ''}
    </div></div>`);
  const tt = $('.t', sheet), d = $('.d', sheet);
  [tt, d].forEach((x) => { autoGrow(x); x.addEventListener('input', () => autoGrow(x)); });
  if (!c) setTimeout(() => tt.focus(), 80);
  const paint = () => {
    sheet.querySelectorAll('[data-seg]').forEach((g) => {
      const key = g.dataset.seg;
      const val = key === 'recurring' ? (st.recurring ? '1' : '0') : String(st[key] ?? '');
      g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === val));
    });
    sheet.querySelectorAll('[data-day]').forEach((b) => b.classList.toggle('on', st.weekdays.includes(+b.dataset.day)));
    $('#whenRepeat', sheet).hidden = !st.recurring;
    $('#whenOnce', sheet).hidden = st.recurring;
  };
  paint();
  sheet.addEventListener('click', (e) => {
    const segBtn = e.target.closest('[data-seg] button');
    if (segBtn) {
      const key = segBtn.parentElement.dataset.seg, v = segBtn.dataset.v;
      if (key === 'assignee') st.assignee = v || null;
      if (key === 'priority') st.priority = +v;
      if (key === 'recurring') st.recurring = v === '1';
      paint(); return;
    }
    const day = e.target.closest('[data-day]');
    if (day) { const n = +day.dataset.day; st.weekdays = st.weekdays.includes(n) ? st.weekdays.filter((x) => x !== n) : [...st.weekdays, n]; paint(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'cancel') closeSheet(sheet);
    if (a === 'delete') { closeSheet(sheet); deleteChore(c); }
    if (a === 'save') {
      const title = tt.value.trim();
      if (!title) { tt.focus(); toast(t('Give the chore a name')); return; }
      if (st.recurring && !st.weekdays.length) { toast(t('Pick at least one day')); return; }
      const row = { title, description: d.value.trim(), assignee: st.assignee, priority: st.priority, recurring: st.recurring, weekdays: [...st.weekdays].sort(), due_date: st.recurring ? null : ($('#due', sheet).value || null) };
      closeSheet(sheet);
      const handed = row.assignee && row.assignee !== S.uid && (!c || row.assignee !== c.assignee);
      if (c) { Object.assign(c, row); db.update('chores', { id: c.id }, row); }
      else { const full = { id: uuid(), household_id: S.me.household_id, created_by: S.uid, created_at: new Date().toISOString(), completed_at: null, ...row }; S.chores.push(full); db.insert('chores', full); }
      refresh();
      if (handed) notify('chore', t('{name} gave you a chore', { name: S.me.display_name }), title, './#chores');
    }
  });
}

on('chore-new', () => openChore(null));
on('chore-edit', (b) => openChore(b.dataset.id));
on('deck-chores', () => choreDeck());

import { createClient } from '@supabase/supabase-js';

const SB_URL = 'https://hyioytjpjdzbenmtwcec.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aW95dGpwamR6YmVubXR3Y2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDg4MTMsImV4cCI6MjEwNzYyNDgxM30.lcveRnQVsADYiW0lySpXan1SSEZ0f5JjEcb5RjqeL10';
const VAPID = 'BOtbYv0JqtLfhgNKLCV6akBE7GoarRp1r2YRJsaR3IAh5_hWs9KeyXbzUIGvTUlihSqPSxVvzcxHoH6EvI0X0rs';

const sb = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'namuciai-auth' },
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const z = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const dow = (s) => new Date(s + 'T12:00:00').getDay();
const norm = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const hueOf = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `var(--h${h % 6})`; };
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function ago(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return 'yesterday';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function dueLabel(d) {
  const t = today();
  if (d === t) return 'Due today';
  if (d === addDays(t, 1)) return 'Due tomorrow';
  if (d < t) {
    const n = Math.round((new Date(t) - new Date(d)) / 86400000);
    return n === 1 ? 'Overdue by a day' : `Overdue by ${n} days`;
  }
  const n = Math.round((new Date(d) - new Date(t)) / 86400000);
  if (n < 7) return 'Due ' + new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' });
  return 'Due ' + new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
function daysLabel(w) {
  const s = [...w].sort().join('');
  if (s === '0123456') return 'Every day';
  if (s === '12345') return 'Weekdays';
  if (s === '06') return 'Weekends';
  return WEEK_ORDER.filter((d) => w.includes(d)).map((d) => DAY_NAME[d]).join(', ');
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

async function q(p) {
  const { data, error } = await p;
  if (error) { console.error(error); toast(friendly(error.message)); return null; }
  return data;
}
function friendly(m = '') {
  if (/fetch|network/i.test(m)) return "You're offline. Changes didn't save.";
  return m.length > 90 ? 'Something went wrong. Try again.' : m;
}

/* ------------------------------------------------------------------ */
/* icons                                                               */
/* ------------------------------------------------------------------ */
const svg = (p, s = 24, w = 1.9) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  notes: '<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  bag: '<path d="M5 8h14l-1.2 11.1A2 2 0 0 1 15.8 21H8.2a2 2 0 0 1-2-1.9z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  bowl: '<path d="M3 12h18a9 9 0 0 1-18 0z"/><path d="M8 8c0-1.6 1.2-1.6 1.2-3.4M12 8c0-1.6 1.2-1.6 1.2-3.4M16 8c0-1.6 1.2-1.6 1.2-3.4"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.4 2.8 2.8L16.2 9.8"/>',
  tick: '<path d="m6 12.5 4 4L18 8"/>',
  search: '<circle cx="11" cy="11" r="6.8"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  cart: '<circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/><path d="M3 4h2.2l2.3 11h10.3L20 7.2H6.3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  pin: '<path d="M9 4h6l-1 5 3 3H7l3-3z"/><path d="M12 12v8"/>',
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
};

/* ------------------------------------------------------------------ */
/* state                                                               */
/* ------------------------------------------------------------------ */
const TABS = [
  { id: 'notes', label: 'Notes', icon: I.notes },
  { id: 'shop', label: 'Shop', icon: I.bag },
  { id: 'eat', label: 'Eat', icon: I.bowl },
  { id: 'dates', label: 'Dates', icon: I.heart },
  { id: 'chores', label: 'Chores', icon: I.check },
];
const S = {
  uid: null, me: null, household: null, members: [],
  notes: [], shop: [], ideas: [], votes: [], chores: [], log: [],
  tab: TABS.some((t) => t.id === location.hash.slice(1)) ? location.hash.slice(1) : (store.get('tab') || 'shop'),
  searching: false,
};

const member = (uid) => S.members.find((m) => m.user_id === uid);
const partner = () => S.members.find((m) => m.user_id !== S.uid);
const nameOf = (uid) => (uid === S.uid ? 'You' : member(uid)?.display_name || 'Someone');
function avatar(uid, size = '') {
  const m = member(uid);
  if (!m) return `<span class="avatar anyone ${size}">${svg(I.home, size === 'xs' ? 11 : 13, 2.2)}</span>`;
  return `<span class="avatar ${m.color === 'rose' ? 'rose' : ''} ${size}">${esc((m.display_name || '?').trim()[0]?.toUpperCase() || '?')}</span>`;
}

const mealRound = () => 'm' + today();
const dateRound = () => 'd' + (S.household?.date_round ?? 1);
const roundFor = (kind) => (kind === 'meal' ? mealRound() : dateRound());

/* ------------------------------------------------------------------ */
/* data                                                                */
/* ------------------------------------------------------------------ */
async function loadMe() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  S.uid = user.id;
  S.email = user.email;
  const rows = await q(sb.from('members').select('*').eq('user_id', user.id));
  S.me = rows?.[0] || null;
  return true;
}

async function loadTable(t) {
  switch (t) {
    case 'households': { const r = await q(sb.from('households').select('*').limit(1)); if (r) S.household = r[0]; break; }
    case 'members': { const r = await q(sb.from('members').select('*').order('created_at')); if (r) { S.members = r; S.me = r.find((m) => m.user_id === S.uid) || S.me; } break; }
    case 'notes': { const r = await q(sb.from('notes').select('*').order('updated_at', { ascending: false })); if (r) S.notes = r; break; }
    case 'shop_items': { const r = await q(sb.from('shop_items').select('*').order('created_at')); if (r) S.shop = r; break; }
    case 'ideas': { const r = await q(sb.from('ideas').select('*').order('created_at')); if (r) S.ideas = r; break; }
    case 'votes': { const r = await q(sb.from('votes').select('*').in('round', [mealRound(), dateRound()])); if (r) S.votes = r; break; }
    case 'chores': { const r = await q(sb.from('chores').select('*').order('created_at')); if (r) S.chores = r; break; }
    case 'chore_log': { const r = await q(sb.from('chore_log').select('*').gte('day', addDays(today(), -7))); if (r) S.log = r; break; }
  }
}
async function loadAll() {
  await Promise.all([loadTable('households'), loadTable('members')]);
  await Promise.all(['notes', 'shop_items', 'ideas', 'votes', 'chores', 'chore_log'].map(loadTable));
}

let channel;
const pending = new Set();
let flushTimer;
function subscribe() {
  if (channel) sb.removeChannel(channel);
  const hid = S.me.household_id;
  channel = sb.channel('home-' + hid);
  for (const t of ['notes', 'shop_items', 'ideas', 'votes', 'chores', 'chore_log', 'members']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `household_id=eq.${hid}` }, () => queueReload(t));
  }
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'households', filter: `id=eq.${hid}` }, () => { queueReload('households'); queueReload('votes'); });
  channel.subscribe();
}
function queueReload(t) {
  pending.add(t);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(async () => {
    const tabs = [...pending]; pending.clear();
    if (tabs.includes('households')) await loadTable('households');
    await Promise.all(tabs.filter((x) => x !== 'households').map(loadTable));
    refresh();
  }, 180);
}

function notify(kind, title, body, url) {
  sb.functions.invoke('notify', { body: { kind, title, body, url } }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

async function boot() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.nav) setTab(e.data.nav); });
  }
  if (isIOS && !standalone() && !store.get('skipInstall')) return renderInstall();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderAuth();
  if (!(await loadMe())) return renderAuth();
  if (!S.me) return renderSetup();
  await enterApp();
}

async function enterApp() {
  await loadAll();
  subscribe();
  renderShell();
  syncPush();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.me) {
      loadAll().then(refresh);
      if (channel?.state !== 'joined') subscribe();
    }
  });
}

sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.reload(); });

/* ------------------------------------------------------------------ */
/* install / auth / setup screens                                     */
/* ------------------------------------------------------------------ */
const root = () => $('#root');

function renderInstall() {
  root().innerHTML = `
  <div class="solo"><div class="solo-inner">
    <img class="app-icon" src="icons/icon-192.png" alt="">
    <h1>Put Namučiai on your Home Screen</h1>
    <p class="lede">It opens full screen from there, like any other app, and can send you notifications.</p>
    <ol class="steps">
      <li><div>Tap <span class="ic">${svg(I.share, 20)}</span> <b>Share</b> in Safari's toolbar. You may need to tap <b>•••</b> first.</div></li>
      <li><div>Scroll down and tap <b>Add to Home Screen</b>.</div></li>
      <li><div>Tap <b>Add</b>. If you see an <b>Open as Web App</b> switch, keep it on.</div></li>
      <li><div>Open Namučiai from your Home Screen and sign in there.</div></li>
    </ol>
    <button class="text-btn" data-a="skip-install">Use it in Safari for now</button>
  </div></div>`;
  root().onclick = (e) => {
    if (e.target.closest('[data-a="skip-install"]')) { store.set('skipInstall', '1'); boot(); }
  };
}

function renderAuth(mode = 'in') {
  const create = mode === 'up';
  root().innerHTML = `
  <div class="solo"><div class="solo-inner">
    <img class="app-icon" src="icons/icon-192.png" alt="">
    <h1>${create ? 'Create your account' : 'Sign in'}</h1>
    <p class="lede">${create ? "You'll stay signed in on this phone." : 'Use the email and password you set up.'}</p>
    <form id="auth" class="stack-gap" autocomplete="on">
      <input class="input" name="email" type="email" inputmode="email" autocomplete="username" placeholder="Email" required>
      <input class="input" name="password" type="password" autocomplete="${create ? 'new-password' : 'current-password'}" placeholder="${create ? 'Password, at least 6 characters' : 'Password'}" required minlength="6">
      <div class="err" id="err"></div>
      <button class="btn block" type="submit">${create ? 'Create account' : 'Sign in'}</button>
    </form>
    <p class="or">${create ? 'Already have an account?' : 'New here?'}</p>
    <button class="btn block ghost" data-a="toggle">${create ? 'Sign in instead' : 'Create an account'}</button>
  </div></div>`;
  root().onclick = (e) => { if (e.target.closest('[data-a="toggle"]')) renderAuth(create ? 'in' : 'up'); };
  $('#auth').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const email = String(f.get('email')).trim().toLowerCase();
    const password = String(f.get('password'));
    const btn = e.target.querySelector('button[type=submit]');
    const err = $('#err');
    btn.disabled = true; err.textContent = '';
    try {
      if (create) {
        const { error } = await sb.functions.invoke('signup', { body: { email, password } });
        if (error) {
          let msg = 'Could not create the account';
          try { msg = (await error.context.json()).error || msg; } catch {}
          throw new Error(msg);
        }
      }
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(/invalid/i.test(error.message) ? "That email and password don't match" : error.message);
      await loadMe();
      if (!S.me) renderSetup(); else enterApp();
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
    }
  };
}

function renderSetup() {
  root().innerHTML = `
  <div class="solo"><div class="solo-inner">
    <img class="app-icon" src="icons/icon-192.png" alt="">
    <h1>Set up your home</h1>
    <p class="lede">One of you starts a home. The other joins with its code.</p>
    <label class="field-label" for="nm">Your name</label>
    <input class="input" id="nm" placeholder="e.g. Matas" autocomplete="given-name">
    <div class="err" id="err"></div>
    <button class="btn block" data-a="start">Start a new home</button>
    <p class="or">or join your partner's</p>
    <div class="stack-gap">
      <input class="input" id="code" placeholder="6-letter home code" autocapitalize="characters" maxlength="6" style="text-transform:uppercase;letter-spacing:.12em">
      <button class="btn block ghost" data-a="join">Join home</button>
    </div>
    <p class="or"><button class="text-btn" data-a="out">Sign out</button></p>
  </div></div>`;
  root().onclick = async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'out') return sb.auth.signOut();
    const name = $('#nm').value.trim();
    const err = $('#err');
    if (!name) { err.textContent = 'Add your name first'; $('#nm').focus(); return; }
    const call = a === 'start'
      ? sb.rpc('create_household', { p_name: name })
      : sb.rpc('join_household', { p_code: $('#code').value.trim(), p_name: name });
    if (a === 'join' && !$('#code').value.trim()) { err.textContent = 'Type the code from your partner\'s phone'; return; }
    const { error } = await call;
    if (error) { err.textContent = error.message.replace(/^.*?:\s*/, ''); return; }
    await loadMe();
    enterApp();
  };
}

/* ------------------------------------------------------------------ */
/* shell                                                               */
/* ------------------------------------------------------------------ */
function renderShell() {
  root().onclick = null;
  root().innerHTML = `
  <div class="app" id="app">
    <div class="topsearch" role="search">
      ${svg(I.search, 20)}
      <input id="q" type="search" placeholder="Search notes, cards and chores" enterkeyhint="search" autocomplete="off">
      <button data-a="search-close">Cancel</button>
    </div>
    <main class="view" id="view"><div class="view-inner" id="viewInner"></div></main>
    <nav class="dock" aria-label="Sections">
      <div class="island" id="island"></div>
      <button class="search-dot" data-a="search-open" aria-label="Search">${svg(I.search, 24, 2.1)}</button>
    </nav>
  </div>`;
  $('#app').addEventListener('click', onClick);
  $('#q').addEventListener('input', () => renderView());
  refresh();
}

function setTab(id) {
  if (!TABS.some((t) => t.id === id)) return;
  if (S.searching) closeSearch();
  S.tab = id;
  store.set('tab', id);
  history.replaceState(null, '', '#' + id);
  refresh();
  $('#view').scrollTop = 0;
}

function refresh() {
  if (!$('#app')) return;
  renderIsland();
  renderView();
  checkMatches();
  const n = S.chores.filter(inMyDeck).length;
  try { n ? navigator.setAppBadge?.(n) : navigator.clearAppBadge?.(); } catch {}
}

function renderIsland() {
  const choreN = S.chores.filter(inMyDeck).length;
  $('#island').innerHTML = TABS.map((t) => `
    <button class="tab ${S.tab === t.id ? 'on' : ''}" data-a="tab" data-id="${t.id}" aria-current="${S.tab === t.id}">
      ${svg(t.icon, 24)}<span>${t.label}</span>
      ${t.id === 'chores' && choreN ? `<span class="dot">${choreN}</span>` : ''}
    </button>`).join('');
}

function header(title, addAction) {
  return `<header class="lt">
    <h1>${title}</h1>
    ${addAction ? `<button class="circle-btn" data-a="${addAction}" aria-label="Add">${svg(I.plus, 22, 2.2)}</button>` : ''}
    <button data-a="settings" aria-label="Settings">${avatar(S.uid)}</button>
  </header>`;
}

function pushBanner() {
  if (!('Notification' in window) || !('PushManager' in window)) return '';
  if (Notification.permission !== 'default' || store.get('pushDismissed')) return '';
  return `<div class="banner">
    ${svg(I.bell, 24)}
    <div class="row-main"><b>Get a heads-up</b>When ${esc(partner()?.display_name || 'your partner')} edits a note or you both pick the same dinner.</div>
    <div style="display:flex;flex-direction:column;gap:4px;align-items:center"><button class="btn small" data-a="push-on">Turn on</button><button class="text-btn small" data-a="push-later" style="padding:2px 4px;color:var(--ink-3)">Not now</button></div>
  </div>`;
}

function renderView() {
  const el = $('#viewInner');
  if (!el) return;
  if (S.searching) { el.innerHTML = viewSearch($('#q').value); return; }
  const v = { notes: viewNotes, shop: viewShop, eat: () => viewIdeas('meal'), dates: () => viewIdeas('date'), chores: viewChores }[S.tab];
  el.innerHTML = v();
}

/* ------------------------------------------------------------------ */
/* notes                                                               */
/* ------------------------------------------------------------------ */
function viewNotes() {
  const notes = [...S.notes].sort((a, b) => (b.pinned - a.pinned) || (new Date(b.updated_at) - new Date(a.updated_at)));
  let body;
  if (!notes.length) {
    body = `<div class="group empty"><p>Nothing written yet. Notes you add here show up on both phones.</p><button class="btn" data-a="note-new">Write a note</button></div>`;
  } else {
    body = `<div class="notes-grid">${notes.map((n, i) => {
      const text = n.body.trim();
      const wide = !text || (i === 0 && n.pinned);
      return `<button class="note-tile ${wide ? 'wide' : ''}" data-a="note-open" data-id="${n.id}">
        <h3>${n.pinned ? `<span style="display:inline-block;vertical-align:-3px;margin-right:4px;color:var(--ink-3)">${svg(I.pin, 16)}</span>` : ''}${esc(n.title || text.split('\n')[0] || 'Untitled')}</h3>
        ${text ? `<p>${esc(n.title ? text : text.split('\n').slice(1).join('\n'))}</p>` : ''}
        <div class="note-meta">${avatar(n.updated_by, 'xs')} ${ago(n.updated_at)}</div>
      </button>`;
    }).join('')}</div>`;
  }
  return header('Notes', 'note-new') + pushBanner() + body;
}

function openNote(id) {
  let note = id ? S.notes.find((n) => n.id === id) : null;
  let changed = false;
  let saving = null;
  let saveTimer;
  const sheet = openSheet(`
    <div class="sheet-bar">
      <button data-a="del" aria-label="Delete note" style="color:var(--warn)">${note ? svg(I.trash, 22) : ''}</button>
      <div class="ttl"></div>
      <button class="end" data-a="pin" aria-label="Pin note" style="color:${note?.pinned ? 'var(--p-blue)' : 'var(--ink-3)'}">${svg(I.pin, 22)}</button>
      <button class="end strong" data-a="done">Done</button>
    </div>
    <div class="sheet-body">
      <div>
        <textarea class="note-title" rows="1" placeholder="Title">${esc(note?.title)}</textarea>
        <div class="note-foot">${note ? `${avatar(note.updated_by, 'xs')} Edited ${ago(note.updated_at)} by ${esc(nameOf(note.updated_by))}` : ''}</div>
        <textarea class="note-body" placeholder="Write something…">${esc(note?.body)}</textarea>
      </div>
    </div>`);
  const t = $('.note-title', sheet), b = $('.note-body', sheet);
  autoGrow(t);
  t.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); b.focus(); } });
  const save = async () => {
    const title = t.value.trim(), body = b.value;
    if (!note && !title && !body.trim()) return;
    const patch = { title, body, updated_by: S.uid, updated_at: new Date().toISOString() };
    if (!note) {
      saving = q(sb.from('notes').insert(patch).select().single());
      note = await saving;
      if (note) S.notes.unshift(note);
    } else {
      Object.assign(note, patch);
      saving = q(sb.from('notes').update(patch).eq('id', note.id));
      await saving;
    }
    saving = null;
  };
  const onInput = () => { changed = true; clearTimeout(saveTimer); saveTimer = setTimeout(save, 700); };
  t.addEventListener('input', () => { autoGrow(t); onInput(); });
  b.addEventListener('input', onInput);
  if (!note) setTimeout(() => t.focus(), 60);

  sheet.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'done') {
      clearTimeout(saveTimer);
      if (saving) await saving;
      if (changed) await save();
      if (changed && note) {
        const label = note.title || note.body.trim().split('\n')[0] || 'a note';
        notify('note', `${S.me.display_name} updated a note`, label, './#notes');
      }
      closeSheet(sheet); refresh();
    }
    if (a === 'pin' && note) {
      note.pinned = !note.pinned;
      e.target.closest('button').style.color = note.pinned ? 'var(--p-blue)' : 'var(--ink-3)';
      q(sb.from('notes').update({ pinned: note.pinned }).eq('id', note.id));
    }
    if (a === 'del' && note) {
      clearTimeout(saveTimer);
      S.notes = S.notes.filter((n) => n.id !== note.id);
      q(sb.from('notes').delete().eq('id', note.id));
      closeSheet(sheet); refresh(); toast('Note deleted');
    }
  });
}

/* ------------------------------------------------------------------ */
/* shopping                                                            */
/* ------------------------------------------------------------------ */
function shopPool() {
  return S.shop.filter((i) => i.status === 'idle')
    .sort((a, b) => (a.last_swiped_at ? new Date(a.last_swiped_at) : 0) - (b.last_swiped_at ? new Date(b.last_swiped_at) : 0));
}
function viewShop() {
  const cart = S.shop.filter((i) => i.status === 'cart');
  const pool = shopPool();
  let html = header('Shopping', 'card-new-shop');
  if (!S.shop.length) {
    return html + `<div class="group empty">
      <p>Make a card for each thing you buy now and then. Then swipe through them to build the list.</p>
      <div class="stack-gap"><button class="btn" data-a="card-new-shop">Make a card</button><br><button class="text-btn" data-a="starter-shop">Add a few everyday cards</button></div>
    </div>`;
  }
  html += `<button class="launch ${pool.length ? '' : 'idle'}" data-a="deck-shop">
    <span class="mini-stack"><i></i><i></i><i></i></span>
    <span class="launch-text"><span class="launch-title">${pool.length ? 'Swipe through cards' : 'Everything is in the cart'}</span>
    <span class="launch-sub" style="display:block">${pool.length ? `${pool.length} ${pool.length === 1 ? 'card' : 'cards'}. Right adds to the cart.` : 'Tick things off as you buy them.'}</span></span>
  </button>`;
  html += `<div class="sec"><h2>In the cart</h2><span class="count">${cart.length || ''}</span>${cart.length > 1 ? '<button class="link" data-a="all-bought">All bought</button>' : ''}</div>`;
  html += cart.length
    ? `<div class="group">${cart.map((i) => `
      <div class="row">
        <button class="tick" data-a="bought" data-id="${i.id}" aria-label="Mark ${esc(i.title)} as bought">${svg(I.tick, 16, 3)}</button>
        <button class="row-main" data-a="card-edit" data-id="${i.id}" style="text-align:left">
          <div class="row-title">${esc(i.title)}</div>${i.description ? `<div class="row-sub">${esc(i.description)}</div>` : ''}
        </button>
      </div>`).join('')}</div>`
    : `<div class="group empty"><p style="margin:0">The cart is empty. Swipe right on a card to add it.</p></div>`;
  if (pool.length) {
    html += `<div class="sec"><h2>Not needed yet</h2><span class="count">${pool.length}</span></div>
    <div class="group">${pool.map((i) => `
      <button class="row" data-a="card-edit" data-id="${i.id}">
        <span class="swatch" style="background:${hueOf(i.id)}"></span>
        <span class="row-main"><span class="row-title" style="display:block">${esc(i.title)}</span>${i.description ? `<span class="row-sub">${esc(i.description)}</span>` : ''}</span>
      </button>`).join('')}</div>`;
  }
  return html;
}

function shopDeck() {
  openDeck({
    title: 'Shopping',
    items: shopPool(),
    left: { label: 'Not now', icon: I.x },
    right: { label: 'To cart', icon: I.cart },
    stampYes: 'Cart', stampNo: 'Not now',
    card: (i) => `
      <div class="meta">${i.description ? '' : ''}</div>
      <h3>${esc(i.title)}</h3>
      ${i.description ? `<p>${esc(i.description)}</p>` : ''}`,
    async onSwipe(item, dir) {
      const prev = { status: item.status, last_swiped_at: item.last_swiped_at };
      const patch = dir === 'right' ? { status: 'cart', last_swiped_at: new Date().toISOString() } : { last_swiped_at: new Date().toISOString() };
      Object.assign(item, patch);
      q(sb.from('shop_items').update(patch).eq('id', item.id));
      return () => { Object.assign(item, prev); q(sb.from('shop_items').update(prev).eq('id', item.id)); };
    },
    end: () => {
      const n = S.shop.filter((i) => i.status === 'cart').length;
      return { title: "That's every card", text: n ? `${n} ${n === 1 ? 'thing' : 'things'} in the cart.` : 'Nothing went in the cart this time.' };
    },
  });
}

/* ------------------------------------------------------------------ */
/* meal + date ideas                                                   */
/* ------------------------------------------------------------------ */
function votesIn(kind) {
  const r = roundFor(kind);
  return S.votes.filter((v) => v.round === r);
}
function matchFor(kind) {
  if (S.members.length < 2) return null;
  const vs = votesIn(kind).filter((v) => v.liked);
  let best = null;
  for (const i of S.ideas.filter((x) => x.kind === kind)) {
    const mine = vs.filter((v) => v.idea_id === i.id);
    if (mine.length >= 2) {
      const t = Math.max(...mine.map((v) => +new Date(v.created_at)));
      if (!best || t < best.t) best = { idea: i, t };
    }
  }
  return best?.idea || null;
}
function ideaPool(kind) {
  const mine = new Set(votesIn(kind).filter((v) => v.user_id === S.uid).map((v) => v.idea_id));
  const theirs = new Set(votesIn(kind).filter((v) => v.user_id !== S.uid && v.liked).map((v) => v.idea_id));
  // shuffle, but gently favour what the partner already liked, so matches come sooner
  return S.ideas.filter((i) => i.kind === kind && !mine.has(i.id))
    .map((i) => ({ i, k: Math.random() + (theirs.has(i.id) ? 0.35 : 0) }))
    .sort((a, b) => b.k - a.k).map((x) => x.i);
}

const IDEA_COPY = {
  meal: { title: 'Dinner', when: 'Tonight', add: 'card-new-meal', deck: 'deck-meal', reset: 'Start over', resetA: 'reset-meal',
    empty: 'Add the dinners you both like. Each of you swipes, and the first one you both swipe right on is tonight\'s dinner.',
    starters: ['Pasta carbonara', 'Cepelinai', 'Homemade pizza', 'Tacos', 'Ramen', 'Burgers', 'Salmon with potatoes', 'Curry', 'Sushi takeaway', 'Šaltibarščiai'] },
  date: { title: 'Dates', when: 'Next date', add: 'card-new-date', deck: 'deck-date', reset: 'Plan another', resetA: 'reset-date',
    empty: 'Add date ideas. You both swipe, and the first one you both like becomes the next date.',
    starters: ['Picnic in Vingis park', 'Cinema night', 'Cook something new together', 'Board game café', 'Sunset walk', 'Museum afternoon', 'Day trip to Trakai', 'Spa evening', 'Concert', 'Try a new restaurant'] },
};

function viewIdeas(kind) {
  const c = IDEA_COPY[kind];
  const ideas = S.ideas.filter((i) => i.kind === kind);
  let html = header(c.title, c.add);
  if (!ideas.length) {
    return html + `<div class="group empty"><p>${c.empty}</p>
      <div class="stack-gap"><button class="btn" data-a="${c.add}">Make a card</button><br><button class="text-btn" data-a="starter-${kind}">Add some starter ideas</button></div></div>`;
  }
  const m = matchFor(kind);
  const p = partner();
  if (m) {
    html += `<div class="pick" style="background:${hueOf(m.id)}">
      <div class="pick-when">${avatar(S.uid, 'sm')}${avatar(p?.user_id, 'sm')} ${c.when}</div>
      <div class="pick-title">${esc(m.title)}</div>
      ${m.description ? `<p class="pick-desc">${esc(m.description)}</p>` : '<div style="height:10px"></div>'}
      <div class="pick-actions"><button class="btn small ghost" data-a="${c.resetA}">${c.reset}</button></div>
    </div>`;
  } else {
    const pool = ideaPool(kind);
    const vs = votesIn(kind);
    const mineN = vs.filter((v) => v.user_id === S.uid).length;
    const theirN = p ? vs.filter((v) => v.user_id === p.user_id).length : 0;
    let sub;
    if (!p) sub = `Matching starts once your partner joins with code <b>${esc(S.household?.invite_code)}</b>.`;
    else if (pool.length) sub = `${p.display_name} has swiped ${theirN} of ${ideas.length}. You've swiped ${mineN}.`;
    else if (theirN < ideas.length) sub = `You're done. Waiting for ${esc(p.display_name)} (${theirN} of ${ideas.length}).`;
    else sub = 'No match this round.';
    html += `<button class="launch ${pool.length ? '' : 'idle'}" data-a="${pool.length ? c.deck : ''}">
      <span class="mini-stack"><i></i><i></i><i></i></span>
      <span class="launch-text"><span class="launch-title">${pool.length ? (kind === 'meal' ? 'Pick tonight\'s dinner' : 'Pick the next date') : 'All swiped'}</span>
      <span class="launch-sub" style="display:block">${sub}</span></span>
    </button>`;
    if (!pool.length && p && theirN >= ideas.length) {
      html += `<div style="margin-top:10px"><button class="btn small ghost" data-a="${c.resetA}">Swipe again</button></div>`;
    }
  }
  html += `<div class="sec"><h2>All ideas</h2><span class="count">${ideas.length}</span></div>
    <div class="group">${ideas.map((i) => {
      const liked = votesIn(kind).filter((v) => v.idea_id === i.id && v.liked).map((v) => v.user_id);
      return `<button class="row" data-a="card-edit" data-id="${i.id}">
        <span class="swatch" style="background:${hueOf(i.id)}"></span>
        <span class="row-main"><span class="row-title" style="display:block">${esc(i.title)}</span>${i.description ? `<span class="row-sub">${esc(i.description)}</span>` : ''}</span>
        ${liked.includes(S.uid) ? `<span style="color:var(--p-rose)">${svg(I.heart, 18, 2.2)}</span>` : ''}
      </button>`;
    }).join('')}</div>`;
  return html;
}

function ideaDeck(kind) {
  const c = IDEA_COPY[kind];
  openDeck({
    title: kind === 'meal' ? "Tonight's dinner" : 'Next date',
    items: ideaPool(kind),
    left: { label: 'Not today', icon: I.x },
    right: { label: 'Yes', icon: I.heart },
    stampYes: 'Yes', stampNo: 'Nope',
    card: (i) => {
      const pLiked = votesIn(kind).some((v) => v.idea_id === i.id && v.user_id !== S.uid);
      return `<div class="meta">${c.when}</div>
      <h3>${esc(i.title)}</h3>
      ${i.description ? `<p>${esc(i.description)}</p>` : ''}
      ${pLiked ? `<div class="by">${avatar(partner()?.user_id, 'xs')} ${esc(partner()?.display_name)} has swiped this one</div>` : ''}`;
    },
    async onSwipe(item, dir, deck) {
      const vote = { idea_id: item.id, user_id: S.uid, round: roundFor(kind), liked: dir === 'right', household_id: S.me.household_id, created_at: new Date().toISOString() };
      S.votes = S.votes.filter((v) => !(v.idea_id === vote.idea_id && v.user_id === S.uid && v.round === vote.round));
      S.votes.push(vote);
      const res = await q(sb.from('votes').upsert(vote, { onConflict: 'idea_id,user_id,round' }));
      if (dir === 'right' && res !== null) {
        const m = matchFor(kind);
        if (m && m.id === item.id) {
          seenMatch(kind, m);
          deck.close();
          showMatch(kind, m);
          notify('match', kind === 'meal' ? 'Dinner is decided' : "It's a date", `You both picked ${m.title}`, kind === 'meal' ? './#eat' : './#dates');
        }
      }
      return () => {
        S.votes = S.votes.filter((v) => !(v.idea_id === vote.idea_id && v.user_id === S.uid && v.round === vote.round));
        q(sb.from('votes').delete().match({ idea_id: vote.idea_id, user_id: S.uid, round: vote.round }));
      };
    },
    end: () => {
      const p = partner();
      if (!p) return { title: 'All swiped', text: 'Once your partner joins, the first idea you both say yes to wins.' };
      return { title: 'All swiped', text: `No match yet. When ${p.display_name} swipes yes on one of yours, you'll both get it.` };
    },
  });
}

function matchKey(kind, m) { return `match:${roundFor(kind)}:${m.id}`; }
function seenMatch(kind, m) { store.set(matchKey(kind, m), '1'); }
function checkMatches() {
  if ($('.match') || $('.deck')) return;
  for (const kind of ['meal', 'date']) {
    const m = matchFor(kind);
    if (m && !store.get(matchKey(kind, m))) {
      seenMatch(kind, m);
      showMatch(kind, m);
      return;
    }
  }
}

function showMatch(kind, m) {
  const p = partner();
  const el = document.createElement('div');
  el.className = 'match';
  el.innerHTML = `
    <div class="pair">${avatar(S.uid)}${avatar(p?.user_id)}</div>
    <div class="when">${kind === 'meal' ? 'Tonight you are eating' : 'Your next date'}</div>
    <h2>${esc(m.title)}</h2>
    <p>You both swiped yes.</p>
    <button class="btn" data-a="ok" style="min-width:160px">Nice</button>`;
  $('#layer').appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  el.addEventListener('click', (e) => {
    if (!e.target.closest('[data-a="ok"]')) return;
    el.classList.remove('in');
    setTimeout(() => el.remove(), 300);
    setTab(kind === 'meal' ? 'eat' : 'dates');
  });
}

async function resetIdeas(kind) {
  if (kind === 'meal') {
    const r = mealRound();
    S.votes = S.votes.filter((v) => v.round !== r);
    await q(sb.from('votes').delete().eq('round', r));
  } else {
    const n = await q(sb.rpc('new_date_round'));
    if (n) S.household.date_round = n;
    await loadTable('votes');
  }
  refresh();
}

/* ------------------------------------------------------------------ */
/* chores                                                              */
/* ------------------------------------------------------------------ */
const logFor = (c, d = today()) => S.log.find((l) => l.chore_id === c.id && l.day === d);
function scheduledToday(c) {
  const d = today();
  if (c.recurring) return c.weekdays.includes(dow(d));
  if (c.completed_at) return ymd(new Date(c.completed_at)) === d;
  return !c.due_date || c.due_date <= addDays(d, 2);
}
function inMyDeck(c) {
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
const PRI = { 3: 'High priority', 2: 'Normal', 1: 'Low priority' };
function choreSort(a, b) {
  return (b.priority - a.priority) || (overdue(b) - overdue(a)) || ((a.due_date || '9') < (b.due_date || '9') ? -1 : 1);
}

function choreRow(c) {
  const l = logFor(c);
  let status = '';
  if (l?.status === 'done' || (!c.recurring && c.completed_at)) status = `<button class="chip ok" data-a="chore-undo" data-id="${c.id}">${svg(I.tick, 14, 2.6)} Done</button>`;
  else if (l?.status === 'snoozed') status = `<button class="chip" data-a="chore-undo" data-id="${c.id}">${c.recurring ? 'Skipped' : 'Tomorrow'}</button>`;
  else if (scheduledToday(c)) status = `<span class="chip">Waiting</span>`;
  const subBits = [];
  subBits.push(esc(c.assignee ? nameOf(c.assignee) : 'Anyone'));
  if (c.recurring) subBits.push(daysLabel(c.weekdays));
  else if (c.due_date) subBits.push(overdue(c) ? `<span class="tag-warn">${dueLabel(c.due_date)}</span>` : dueLabel(c.due_date));
  else subBits.push('One-off');
  if (missedYesterday(c) && !l) subBits.push('<span class="tag-warn">Missed yesterday</span>');
  return `<div class="row">
    <span class="pri p${c.priority}" title="${PRI[c.priority]}"></span>
    ${avatar(c.assignee, 'sm')}
    <button class="row-main" data-a="chore-edit" data-id="${c.id}" style="text-align:left">
      <div class="row-title">${esc(c.title)}</div>
      <div class="row-sub wrap">${subBits.join(', ')}</div>
    </button>
    ${status}
  </div>`;
}

function viewChores() {
  let html = header('Chores', 'chore-new');
  if (!S.chores.length) {
    return html + `<div class="group empty"><p>Add the things that need doing. Repeating chores come back on the days you pick; one-offs stay until they're done.</p><button class="btn" data-a="chore-new">Add a chore</button></div>`;
  }
  const deck = S.chores.filter(inMyDeck);
  html += `<button class="launch ${deck.length ? '' : 'idle'}" data-a="${deck.length ? 'deck-chores' : ''}">
    <span class="mini-stack"><i></i><i></i><i></i></span>
    <span class="launch-text"><span class="launch-title">${deck.length ? "Swipe today's chores" : 'All swiped for today'}</span>
    <span class="launch-sub" style="display:block">${deck.length ? `${deck.length} waiting for you. Right is done, left is later.` : 'New cards show up tomorrow.'}</span></span>
  </button>`;
  const todays = S.chores.filter(scheduledToday).sort(choreSort);
  const later = S.chores.filter((c) => !c.recurring && !c.completed_at && !scheduledToday(c)).sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  const otherDays = S.chores.filter((c) => c.recurring && !scheduledToday(c));
  if (todays.length) html += `<div class="sec"><h2>Today</h2><span class="count">${todays.filter((c) => logFor(c)?.status === 'done' || c.completed_at).length} of ${todays.length} done</span></div><div class="group">${todays.map(choreRow).join('')}</div>`;
  if (later.length) html += `<div class="sec"><h2>Coming up</h2></div><div class="group">${later.map(choreRow).join('')}</div>`;
  if (otherDays.length) html += `<div class="sec"><h2>Other days</h2></div><div class="group">${otherDays.map(choreRow).join('')}</div>`;
  return html;
}

function choreDeck() {
  openDeck({
    title: "Today's chores",
    items: S.chores.filter(inMyDeck).sort(choreSort),
    left: { label: 'Later', icon: I.clock },
    right: { label: 'Done', icon: I.tick },
    stampYes: 'Done', stampNo: 'Later',
    card: (c) => `
      <div class="meta"><span class="chip"><span class="pri p${c.priority}" style="width:8px;height:8px;margin:0;border-radius:4px;align-self:center"></span>${PRI[c.priority]}</span>
        ${missedYesterday(c) ? '<span class="chip" style="color:var(--warn)">Missed yesterday</span>' : ''}
        ${overdue(c) ? `<span class="chip" style="color:var(--warn)">${dueLabel(c.due_date)}</span>` : ''}</div>
      <h3>${esc(c.title)}</h3>
      ${c.description ? `<p>${esc(c.description)}</p>` : ''}
      <div class="by">${avatar(c.assignee, 'xs')} ${c.assignee ? (c.assignee === S.uid ? 'Yours' : esc(nameOf(c.assignee))) : 'Anyone can do this'}, ${c.recurring ? daysLabel(c.weekdays).toLowerCase() : (c.due_date ? dueLabel(c.due_date).toLowerCase() : 'one-off')}</div>`,
    async onSwipe(c, dir) {
      const entry = { chore_id: c.id, day: today(), status: dir === 'right' ? 'done' : 'snoozed', by_user: S.uid, household_id: S.me.household_id };
      S.log = S.log.filter((l) => !(l.chore_id === c.id && l.day === entry.day));
      S.log.push(entry);
      q(sb.from('chore_log').upsert(entry, { onConflict: 'chore_id,day' }));
      if (!c.recurring && dir === 'right') {
        c.completed_at = new Date().toISOString();
        q(sb.from('chores').update({ completed_at: c.completed_at }).eq('id', c.id));
      }
      return () => undoChore(c);
    },
    end: () => ({ title: 'All swiped', text: 'That was everything for today.' }),
  });
}

function undoChore(c) {
  const d = today();
  S.log = S.log.filter((l) => !(l.chore_id === c.id && l.day === d));
  q(sb.from('chore_log').delete().match({ chore_id: c.id, day: d }));
  if (!c.recurring && c.completed_at) {
    c.completed_at = null;
    q(sb.from('chores').update({ completed_at: null }).eq('id', c.id));
  }
}

function openChore(id) {
  const c = id ? S.chores.find((x) => x.id === id) : null;
  const st = {
    assignee: c ? c.assignee : S.uid,
    priority: c?.priority ?? 2,
    recurring: c?.recurring ?? true,
    weekdays: c ? [...c.weekdays] : [0, 1, 2, 3, 4, 5, 6],
  };
  const p = partner();
  const sheet = openSheet(`
    <div class="sheet-bar">
      <button data-a="cancel">Cancel</button>
      <div class="ttl">${c ? 'Edit chore' : 'New chore'}</div>
      <button class="end strong" data-a="save">${c ? 'Save' : 'Add'}</button>
    </div>
    <div class="sheet-body"><div>
      <div class="edit-card" style="background:${hueOf(c?.id || 'new-chore')};min-height:170px">
        <textarea class="t" rows="1" placeholder="What needs doing?" maxlength="120">${esc(c?.title)}</textarea>
        <textarea class="d" rows="2" placeholder="Details (optional)">${esc(c?.description)}</textarea>
      </div>
      <label class="field-label">Who</label>
      <div class="seg" data-seg="assignee">
        <button data-v="${S.uid}">${avatar(S.uid, 'xs')} Me</button>
        ${p ? `<button data-v="${p.user_id}">${avatar(p.user_id, 'xs')} ${esc(p.display_name)}</button>` : ''}
        <button data-v="">Anyone</button>
      </div>
      <label class="field-label">Priority</label>
      <div class="seg" data-seg="priority"><button data-v="1">Low</button><button data-v="2">Normal</button><button data-v="3">High</button></div>
      <label class="field-label">When</label>
      <div class="seg" data-seg="recurring"><button data-v="1">Repeats</button><button data-v="0">Once</button></div>
      <div id="whenRepeat">
        <div class="days">${WEEK_ORDER.map((d) => `<button data-day="${d}" aria-label="${DAY_NAME[d]}">${DAY_SHORT[d]}</button>`).join('')}</div>
      </div>
      <div id="whenOnce">
        <label class="field-label" for="due">Due date (optional)</label>
        <input class="input" id="due" type="date" value="${esc(c?.due_date || '')}">
      </div>
      ${c ? `<div style="margin-top:34px;text-align:center"><button class="btn danger" data-a="delete">${svg(I.trash, 18)} Delete chore</button></div>` : ''}
    </div></div>`);
  const t = $('.t', sheet), d = $('.d', sheet);
  autoGrow(t); autoGrow(d);
  t.addEventListener('input', () => autoGrow(t));
  d.addEventListener('input', () => autoGrow(d));
  if (!c) setTimeout(() => t.focus(), 60);
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
  sheet.addEventListener('click', async (e) => {
    const segBtn = e.target.closest('[data-seg] button');
    if (segBtn) {
      const key = segBtn.parentElement.dataset.seg, v = segBtn.dataset.v;
      if (key === 'assignee') st.assignee = v || null;
      if (key === 'priority') st.priority = +v;
      if (key === 'recurring') st.recurring = v === '1';
      paint(); return;
    }
    const day = e.target.closest('[data-day]');
    if (day) {
      const n = +day.dataset.day;
      st.weekdays = st.weekdays.includes(n) ? st.weekdays.filter((x) => x !== n) : [...st.weekdays, n];
      paint(); return;
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'cancel') closeSheet(sheet);
    if (a === 'delete') {
      S.chores = S.chores.filter((x) => x.id !== c.id);
      q(sb.from('chores').delete().eq('id', c.id));
      closeSheet(sheet); refresh(); toast('Chore deleted');
    }
    if (a === 'save') {
      const title = t.value.trim();
      if (!title) { t.focus(); toast('Give the chore a name'); return; }
      if (st.recurring && !st.weekdays.length) { toast('Pick at least one day'); return; }
      const row = {
        title, description: d.value.trim(), assignee: st.assignee, priority: st.priority,
        recurring: st.recurring, weekdays: st.weekdays.sort(), due_date: st.recurring ? null : ($('#due', sheet).value || null),
      };
      if (c) {
        const handedOver = row.assignee && row.assignee !== S.uid && row.assignee !== c.assignee;
        Object.assign(c, row);
        await q(sb.from('chores').update(row).eq('id', c.id));
        if (handedOver) notify('chore', `${S.me.display_name} gave you a chore`, title, './#chores');
      } else {
        const r = await q(sb.from('chores').insert(row).select().single());
        if (r) S.chores.push(r);
        if (row.assignee && row.assignee !== S.uid) notify('chore', `${S.me.display_name} gave you a chore`, title, './#chores');
      }
      closeSheet(sheet); refresh();
    }
  });
}

/* ------------------------------------------------------------------ */
/* card editor (shop + ideas)                                          */
/* ------------------------------------------------------------------ */
const CARD_KIND = {
  shop: { table: 'shop_items', list: () => S.shop, label: 'shopping card', ph: 'e.g. Oat milk', dph: 'Brand, size, where to buy (optional)' },
  meal: { table: 'ideas', list: () => S.ideas, label: 'dinner idea', ph: 'e.g. Pasta carbonara', dph: 'Recipe link or notes (optional)' },
  date: { table: 'ideas', list: () => S.ideas, label: 'date idea', ph: 'e.g. Picnic by the river', dph: 'Where, when, what to bring (optional)' },
};

function openCard(kind, id) {
  const k = CARD_KIND[kind];
  const item = id ? k.list().find((x) => x.id === id) : null;
  let added = 0;
  const tempId = () => 'new-' + kind + '-' + added;
  const sheet = openSheet(`
    <div class="sheet-bar">
      <button data-a="cancel">${item ? 'Cancel' : 'Done'}</button>
      <div class="ttl">${item ? 'Edit card' : 'New ' + k.label}</div>
      <button class="end strong" data-a="save">${item ? 'Save' : 'Add'}</button>
    </div>
    <div class="sheet-body"><div>
      <div class="edit-card" id="ec" style="background:${hueOf(item?.id || tempId())}">
        <textarea class="t" rows="1" placeholder="${k.ph}" maxlength="80" enterkeyhint="${item ? 'done' : 'next'}">${esc(item?.title)}</textarea>
        <textarea class="d" rows="3" placeholder="${k.dph}" maxlength="300">${esc(item?.description)}</textarea>
      </div>
      <p class="muted small" id="addedNote" style="text-align:center;min-height:20px;margin-top:14px">${item ? '' : 'Add as many as you like, then tap Done.'}</p>
      ${item ? `<div style="margin-top:24px;text-align:center"><button class="btn danger" data-a="delete">${svg(I.trash, 18)} Delete card</button></div>` : ''}
    </div></div>`);
  const t = $('.t', sheet), d = $('.d', sheet);
  autoGrow(t); autoGrow(d);
  t.addEventListener('input', () => autoGrow(t));
  d.addEventListener('input', () => autoGrow(d));
  t.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); item ? d.focus() : save(); } });
  if (!item) setTimeout(() => t.focus(), 60);

  async function save() {
    const title = t.value.trim();
    if (!title) { t.focus(); return; }
    const row = { title, description: d.value.trim() };
    if (item) {
      Object.assign(item, row);
      await q(sb.from(k.table).update(row).eq('id', item.id));
      closeSheet(sheet); refresh();
      return;
    }
    if (k.table === 'ideas') row.kind = kind;
    const r = await q(sb.from(k.table).insert(row).select().single());
    if (!r) return;
    k.list().push(r);
    added++;
    t.value = ''; d.value = ''; autoGrow(t); autoGrow(d);
    $('#ec', sheet).style.background = hueOf(tempId());
    $('#addedNote', sheet).textContent = added === 1 ? `Added “${title}”. Add another or tap Done.` : `${added} cards added. Add another or tap Done.`;
    t.focus();
    refresh();
  }

  sheet.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'cancel') closeSheet(sheet);
    if (a === 'save') save();
    if (a === 'delete') {
      if (k.table === 'ideas') S.ideas = S.ideas.filter((x) => x.id !== item.id);
      else S.shop = S.shop.filter((x) => x.id !== item.id);
      q(sb.from(k.table).delete().eq('id', item.id));
      closeSheet(sheet); refresh(); toast('Card deleted');
    }
  });
}

async function addStarters(kind) {
  if (kind === 'shop') {
    const rows = ['Milk', 'Eggs', 'Bread', 'Butter', 'Coffee', 'Bananas', 'Cheese', 'Toilet paper', 'Dish soap', 'Rice'].map((title) => ({ title }));
    const r = await q(sb.from('shop_items').insert(rows).select());
    if (r) S.shop.push(...r);
  } else {
    const rows = IDEA_COPY[kind].starters.map((title) => ({ title, kind }));
    const r = await q(sb.from('ideas').insert(rows).select());
    if (r) S.ideas.push(...r);
  }
  refresh();
}

/* ------------------------------------------------------------------ */
/* search                                                              */
/* ------------------------------------------------------------------ */
function openSearch() {
  S.searching = true;
  $('#app').classList.add('searching');
  const input = $('#q');
  input.value = '';
  input.focus();
  renderView();
}
function closeSearch() {
  S.searching = false;
  $('#app').classList.remove('searching');
  $('#q').blur();
  renderView();
}
function viewSearch(raw) {
  const n = norm(raw.trim());
  if (!n) return `<div class="empty muted" style="padding-top:40px">Search across notes, shopping cards, ideas and chores.</div>`;
  const hit = (...xs) => xs.some((x) => norm(x).includes(n));
  const groups = [
    ['Notes', S.notes.filter((x) => hit(x.title, x.body)).map((x) => ({ a: 'note-open', id: x.id, t: x.title || x.body.split('\n')[0] || 'Untitled', s: x.body.replace(/\s+/g, ' ').slice(0, 80), icon: I.notes }))],
    ['Shopping', S.shop.filter((x) => hit(x.title, x.description)).map((x) => ({ a: 'card-edit', id: x.id, t: x.title, s: x.status === 'cart' ? 'In the cart' : 'Not needed yet', icon: I.bag }))],
    ['Dinner ideas', S.ideas.filter((x) => x.kind === 'meal' && hit(x.title, x.description)).map((x) => ({ a: 'card-edit', id: x.id, t: x.title, s: x.description, icon: I.bowl }))],
    ['Date ideas', S.ideas.filter((x) => x.kind === 'date' && hit(x.title, x.description)).map((x) => ({ a: 'card-edit', id: x.id, t: x.title, s: x.description, icon: I.heart }))],
    ['Chores', S.chores.filter((x) => hit(x.title, x.description)).map((x) => ({ a: 'chore-edit', id: x.id, t: x.title, s: x.assignee ? nameOf(x.assignee) : 'Anyone', icon: I.check }))],
  ].filter(([, r]) => r.length);
  if (!groups.length) return `<div class="empty muted" style="padding-top:40px">Nothing matches “${esc(raw.trim())}”.</div>`;
  return groups.map(([name, rows]) => `
    <div class="sec"><h2>${name}</h2><span class="count">${rows.length}</span></div>
    <div class="group">${rows.map((r) => `
      <button class="row" data-a="${r.a}" data-id="${r.id}">
        <span style="color:var(--ink-3);width:26px;display:grid;place-items:center">${svg(r.icon, 20)}</span>
        <span class="row-main"><span class="row-title" style="display:block">${esc(r.t)}</span>${r.s ? `<span class="row-sub">${esc(r.s)}</span>` : ''}</span>
      </button>`).join('')}</div>`).join('');
}

/* ------------------------------------------------------------------ */
/* settings + push                                                     */
/* ------------------------------------------------------------------ */
function urlB64(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function enablePush() {
  if (!pushSupported()) {
    toast(isIOS && !standalone() ? 'Open Namučiai from your Home Screen to turn on notifications' : "This browser can't show notifications");
    return false;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Notifications are off. You can turn them on in iPhone Settings.'); store.set('pushDismissed', '1'); refresh(); return false; }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(VAPID) });
  await q(sb.from('push_subs').upsert({ endpoint: sub.endpoint, sub: sub.toJSON(), user_id: S.uid }, { onConflict: 'endpoint' }));
  refresh();
  toast('Notifications are on');
  return true;
}
async function syncPush() {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(VAPID) });
    await sb.from('push_subs').upsert({ endpoint: sub.endpoint, sub: sub.toJSON(), user_id: S.uid }, { onConflict: 'endpoint' });
  } catch (e) { console.warn('push sync', e); }
}

function openSettings() {
  const p = partner();
  const pushOn = pushSupported() && Notification.permission === 'granted';
  const sheet = openSheet(`
    <div class="sheet-bar">
      <button></button><div class="ttl">Home</div>
      <button class="end strong" data-a="close">Done</button>
    </div>
    <div class="sheet-body"><div>
      <label class="field-label" for="myname">Your name</label>
      <input class="input" id="myname" value="${esc(S.me.display_name)}" maxlength="24">
      <label class="field-label">People</label>
      <div class="group">
        <div class="row plain">${avatar(S.uid, 'sm')}<div class="row-main"><div class="row-title">${esc(S.me.display_name)}</div><div class="row-sub">${esc(S.email || '')}</div></div></div>
        ${p ? `<div class="row plain">${avatar(p.user_id, 'sm')}<div class="row-main"><div class="row-title">${esc(p.display_name)}</div></div></div>`
            : `<div class="row plain"><div class="row-main"><div class="row-title">Invite your partner</div><div class="row-sub" style="white-space:normal">They create an account on their phone and join with this code.</div></div><span class="chip" style="font:800 18px/1 var(--round);letter-spacing:.12em;padding:10px 12px">${esc(S.household?.invite_code)}</span></div>`}
      </div>
      <label class="field-label">Notifications</label>
      <div class="group">
        <div class="row plain">
          <div class="row-main"><div class="row-title">${pushOn ? 'On for this phone' : 'Off'}</div>
          <div class="row-sub" style="white-space:normal">Note changes (at most one every 15 minutes), dinner and date matches, chores handed to you, and a morning reminder when chores are waiting.</div></div>
          ${pushOn ? '<button class="btn small ghost" data-a="test">Test</button>' : '<button class="btn small" data-a="push-on">Turn on</button>'}
        </div>
      </div>
      <div style="margin-top:34px;text-align:center"><button class="btn ghost" data-a="out">Sign out</button></div>
    </div></div>`);
  sheet.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'close') {
      const nm = $('#myname', sheet).value.trim();
      if (nm && nm !== S.me.display_name) {
        S.me.display_name = nm;
        const m = member(S.uid); if (m) m.display_name = nm;
        q(sb.from('members').update({ display_name: nm }).eq('user_id', S.uid));
      }
      closeSheet(sheet); refresh();
    }
    if (a === 'push-on') { if (await enablePush()) { closeSheet(sheet); openSettings(); } }
    if (a === 'test') { notifyTest(); }
    if (a === 'out') { await sb.auth.signOut(); }
  });
}
async function notifyTest() {
  const { data } = await sb.functions.invoke('notify', { body: { kind: 'test', title: 'Namučiai', body: 'Notifications work on this phone.', url: './' } });
  toast(data?.sent ? 'Sent. Lock your phone to see it.' : 'Nothing was sent. Try turning notifications off and on.');
}

/* ------------------------------------------------------------------ */
/* sheets                                                              */
/* ------------------------------------------------------------------ */
function openSheet(html) {
  const el = document.createElement('div');
  el.className = 'sheet';
  el.innerHTML = html;
  $('#layer').appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  return el;
}
function closeSheet(el) {
  document.activeElement?.blur?.();
  el.classList.remove('in');
  setTimeout(() => el.remove(), 420);
}
function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }

/* ------------------------------------------------------------------ */
/* the swipe deck                                                      */
/* ------------------------------------------------------------------ */
function openDeck(o) {
  const items = [...o.items];
  const total = items.length;
  let idx = 0;
  const history = [];
  const el = document.createElement('div');
  el.className = 'deck';
  el.innerHTML = `
    <div class="deck-top">
      <div class="side"><button class="circle-btn" data-a="undo" aria-label="Undo last swipe" disabled style="opacity:.35">${svg(I.undo, 20)}</button></div>
      <div class="ttl"><b>${esc(o.title)}</b><span id="deckCount"></span></div>
      <div class="side end"><button class="circle-btn" data-a="close" aria-label="Close">${svg(I.x, 20, 2.2)}</button></div>
    </div>
    <div class="stack" id="stack"></div>
    <div class="deck-controls" id="deckCtl">
      <button class="deck-btn no" data-a="left"><span class="ring">${svg(o.left.icon, 30, 2.4)}</span>${o.left.label}</button>
      <button class="deck-btn yes" data-a="right"><span class="ring">${svg(o.right.icon, 30, 2.4)}</span>${o.right.label}</button>
    </div>`;
  $('#layer').appendChild(el);
  const stack = $('#stack', el);
  const api = { close };
  let busy = false;

  function cardEl(item, depth) {
    const c = document.createElement('div');
    c.className = 'card';
    c.style.background = hueOf(item.id);
    c.innerHTML = `<span class="stamp yes">${esc(o.stampYes)}</span><span class="stamp no">${esc(o.stampNo)}</span>${o.card(item)}`;
    c.dataset.depth = depth;
    return c;
  }
  function layout(intro = false) {
    const live = [...stack.querySelectorAll('.card:not(.gone)')];
    live.forEach((c, i) => {
      const d = live.length - 1 - i;
      c.dataset.depth = d;
      c.style.zIndex = 10 - d;
      const tf = `translateY(${d * 26}px) scale(${1 - d * 0.05})`;
      if (intro && !reduceMotion()) {
        c.style.transition = 'none';
        c.style.transform = `translateY(110vh) rotate(${(d % 2 ? -1 : 1) * (8 + d * 4)}deg)`;
        c.offsetHeight;
        c.style.transition = '';
        setTimeout(() => { c.style.transform = tf; }, 40 + (2 - d) * 90);
      } else c.style.transform = tf;
      c.style.pointerEvents = d === 0 ? 'auto' : 'none';
    });
  }
  function fill(intro) {
    let live = stack.querySelectorAll('.card:not(.gone)').length;
    const next = [];
    while (live < 3 && idx + live < items.length) {
      const item = items[idx + live];
      const c = cardEl(item, live);
      c._item = item;
      next.push(c);
      live++;
    }
    // new cards go underneath
    next.forEach((c) => stack.prepend(c));
    layout(intro);
    const top = topCard();
    if (top) attachDrag(top);
    $('#deckCount', el).textContent = total ? `${Math.min(idx + 1, total)} of ${total}` : '';
    if (!top) showEnd();
    else { $('#deckCtl', el).style.visibility = ''; stack.querySelector('.deck-end')?.remove(); }
  }
  const topCard = () => [...stack.querySelectorAll('.card:not(.gone)')].pop();

  function showEnd() {
    const e = o.end();
    $('#deckCtl', el).style.visibility = 'hidden';
    $('#deckCount', el).textContent = '';
    stack.insertAdjacentHTML('beforeend', `<div class="deck-end"><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p><button class="btn" data-a="close" style="min-width:160px">Done</button></div>`);
  }

  function setStamps(c, dx) {
    const v = Math.min(1, Math.abs(dx) / 90);
    c.querySelector('.stamp.yes').style.opacity = dx > 0 ? v : 0;
    c.querySelector('.stamp.no').style.opacity = dx < 0 ? v : 0;
  }

  function attachDrag(c) {
    let sx = 0, sy = 0, st = 0, dx = 0, dy = 0, down = false;
    c.onpointerdown = (e) => {
      if (busy) return;
      down = true; sx = e.clientX; sy = e.clientY; st = performance.now(); dx = dy = 0;
      c.classList.add('drag');
      c.setPointerCapture(e.pointerId);
    };
    c.onpointermove = (e) => {
      if (!down) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      c.style.transform = `translate(${dx}px, ${dy * 0.35}px) rotate(${dx / 16}deg)`;
      setStamps(c, dx);
    };
    const up = () => {
      if (!down) return;
      down = false;
      c.classList.remove('drag');
      const v = Math.abs(dx) / Math.max(1, performance.now() - st);
      if (Math.abs(dx) > 110 || (v > 0.55 && Math.abs(dx) > 40)) swipe(dx > 0 ? 'right' : 'left', dy);
      else { c.style.transform = 'translateY(0) scale(1)'; setStamps(c, 0); }
    };
    c.onpointerup = up;
    c.onpointercancel = up;
  }

  async function swipe(dir, dy = 0) {
    const c = topCard();
    if (!c || busy) return;
    busy = true;
    c.classList.add('gone');
    c.style.pointerEvents = 'none';
    setStamps(c, dir === 'right' ? 120 : -120);
    const w = innerWidth + 240;
    c.style.transform = `translate(${dir === 'right' ? w : -w}px, ${dy * 0.35 + 40}px) rotate(${dir === 'right' ? 28 : -28}deg)`;
    c.style.opacity = '0.9';
    const item = c._item;
    idx++;
    fill(false);
    setTimeout(() => c.remove(), 450);
    const undo = await o.onSwipe(item, dir, api);
    history.push({ item, undo });
    const ub = $('[data-a="undo"]', el); ub.disabled = false; ub.style.opacity = '';
    busy = false;
  }

  function undoLast() {
    const h = history.pop();
    if (!h || busy) return;
    h.undo?.();
    idx--;
    stack.querySelector('.deck-end')?.remove();
    // drop the bottom card so the stack stays at 3, then put the undone card back on top
    const live = [...stack.querySelectorAll('.card:not(.gone)')];
    if (live.length >= 3) live[0].remove();
    const c = cardEl(h.item, 0);
    c._item = h.item;
    stack.appendChild(c);
    c.style.transition = 'none';
    c.style.transform = 'translate(-120%, 40px) rotate(-20deg)';
    c.offsetHeight;
    c.style.transition = '';
    fill(false);
    if (!history.length) { const ub = $('[data-a="undo"]', el); ub.disabled = true; ub.style.opacity = '.35'; }
  }

  function close() {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 260);
    refresh();
  }

  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'close') close();
    if (a === 'left' || a === 'right') swipe(a);
    if (a === 'undo') undoLast();
  });
  const onKey = (e) => {
    if (!el.isConnected) return document.removeEventListener('keydown', onKey);
    if (e.key === 'ArrowLeft') swipe('left');
    if (e.key === 'ArrowRight') swipe('right');
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => { el.classList.add('in'); fill(true); });
  return api;
}

/* ------------------------------------------------------------------ */
/* clicks                                                              */
/* ------------------------------------------------------------------ */
function kindOfCard(id) {
  if (S.shop.some((x) => x.id === id)) return 'shop';
  return S.ideas.find((x) => x.id === id)?.kind;
}
function onClick(e) {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const { a, id } = b.dataset;
  switch (a) {
    case 'tab': return setTab(id);
    case 'search-open': return openSearch();
    case 'search-close': return closeSearch();
    case 'settings': return openSettings();
    case 'push-on': return enablePush();
    case 'push-later': store.set('pushDismissed', '1'); return refresh();
    case 'note-new': return openNote(null);
    case 'note-open': return openNote(id);
    case 'card-new-shop': return openCard('shop');
    case 'card-new-meal': return openCard('meal');
    case 'card-new-date': return openCard('date');
    case 'card-edit': { const k = kindOfCard(id); if (k) openCard(k, id); return; }
    case 'starter-shop': return addStarters('shop');
    case 'starter-meal': return addStarters('meal');
    case 'starter-date': return addStarters('date');
    case 'deck-shop': return shopPool().length && shopDeck();
    case 'deck-meal': return ideaDeck('meal');
    case 'deck-date': return ideaDeck('date');
    case 'deck-chores': return choreDeck();
    case 'reset-meal': return resetIdeas('meal');
    case 'reset-date': return resetIdeas('date');
    case 'chore-new': return openChore(null);
    case 'chore-edit': return openChore(id);
    case 'chore-undo': { const c = S.chores.find((x) => x.id === id); if (c) { undoChore(c); refresh(); } return; }
    case 'bought': {
      const i = S.shop.find((x) => x.id === id);
      if (!i) return;
      b.classList.add('done');
      setTimeout(() => {
        i.status = 'idle'; i.last_swiped_at = new Date().toISOString();
        q(sb.from('shop_items').update({ status: 'idle', last_swiped_at: i.last_swiped_at }).eq('id', id));
        refresh();
      }, 380);
      return;
    }
    case 'all-bought': {
      const now = new Date().toISOString();
      const ids = S.shop.filter((x) => x.status === 'cart').map((x) => { x.status = 'idle'; x.last_swiped_at = now; return x.id; });
      q(sb.from('shop_items').update({ status: 'idle', last_swiped_at: now }).in('id', ids));
      refresh(); toast('Cart cleared');
      return;
    }
  }
}

boot();

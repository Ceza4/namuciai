// Namučiai: boot, sign-in, the shell (tabs, search island), sync and routing.
import { $, esc, svg, I, S, DEMO, ICON_SRC, sb, q, store, app, ACTIONS, toast, hideToast, raf, reduceMotion, isIOS, standalone, today, addDays, norm, flush, pendingWrites, saveCache, loadCache, db } from './core.js';
import { t, tn, lang } from './i18n.js';
import { initSwipeRows } from './ui.js';
import { guessAisle } from './aisles.js';
import { viewNotes, plainText } from './notes.js';
import { viewShop } from './shop.js';
import { viewIdeas, checkMatches, mealRound, dateRound, bindSetTab } from './ideas.js';
import { viewChores, inMyDeck } from './chores.js';
import { openSettings, pushBanner, syncPush, applyTheme } from './settings.js';
import './cards.js';
import { checkLove, loveReadCheck } from './love.js';

const TABS = () => [
  { id: 'notes', label: t('Notes'), icon: I.notes, hue: 0, title: t('Notes') },
  { id: 'shop', label: t('Shop'), icon: I.bag, hue: 1, title: t('Shopping') },
  { id: 'eat', label: t('Eat'), icon: I.bowl, hue: 4, title: t('Dinner') },
  { id: 'dates', label: lang === 'lt' ? 'Kartu' : t('Dates'), icon: I.heart, hue: 3, title: t('Dates') },
  { id: 'chores', label: t('Chores'), icon: I.check, hue: 2, title: t('Chores') },
];
const tabIds = ['notes', 'shop', 'eat', 'dates', 'chores'];
S.tab = tabIds.includes(location.hash.slice(1)) ? location.hash.slice(1) : (store.get('tab') || 'shop');

applyTheme();
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme()); } catch {}

/* keep the page itself from staying scrolled after the iOS keyboard closes */
function pinViewport() {
  const fix = () => {
    const a = document.activeElement;
    if (a && (/^(INPUT|TEXTAREA)$/.test(a.tagName) || a.isContentEditable)) return;
    if (window.scrollY || window.scrollX || document.documentElement.scrollTop || document.body.scrollTop) {
      window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0;
    }
  };
  document.addEventListener('focusout', () => setTimeout(fix, 90));
  window.addEventListener('scroll', fix, { passive: true });
  window.visualViewport?.addEventListener('resize', () => setTimeout(fix, 90));
  document.addEventListener('visibilitychange', () => setTimeout(fix, 60));
}

/* ================================================================== */
/* data                                                                */
/* ================================================================== */
async function loadTable(tb) {
  switch (tb) {
    case 'households': { const r = await q(sb.from('households').select('*').eq('id', S.me.household_id)); if (r?.[0]) S.household = r[0]; break; }
    case 'members': { const r = await q(sb.from('members').select('*').order('created_at')); if (r) { S.members = r; S.me = r.find((m) => m.user_id === S.uid) || S.me; } break; }
    case 'notes': { const r = await q(sb.from('notes').select('*').order('updated_at', { ascending: false })); if (r) S.notes = r; break; }
    case 'shop_items': { const r = await q(sb.from('shop_items').select('*').order('created_at')); if (r) S.shop = r; break; }
    case 'ideas': { const r = await q(sb.from('ideas').select('*').order('created_at')); if (r) S.ideas = r; break; }
    case 'votes': { const r = await q(sb.from('votes').select('*').in('round', [mealRound(), dateRound()])); if (r) S.votes = r; break; }
    case 'chores': { const r = await q(sb.from('chores').select('*').order('created_at')); if (r) S.chores = r; break; }
    case 'chore_log': { const r = await q(sb.from('chore_log').select('*').gte('day', addDays(today(), -7))); if (r) S.log = r; break; }
    case 'plans': { const r = await q(sb.from('plans').select('*').gte('at', new Date(Date.now() - 7 * 864e5).toISOString()).order('at')); if (r) S.plans = r; break; }
    case 'love_notes': { const prev = S.love; const r = await q(sb.from('love_notes').select('*').order('created_at')); if (r) { S.love = r; loveReadCheck(prev); } break; }
    case 'picks': { const r = await q(sb.from('picks').select('*').order('created_at', { ascending: false }).limit(400)); if (r) S.picks = r; break; }
  }
}
async function loadAll() {
  await flush();
  await Promise.all([loadTable('households'), loadTable('members')]);
  await Promise.all(['notes', 'shop_items', 'ideas', 'votes', 'chores', 'chore_log', 'plans', 'picks', 'love_notes'].map(loadTable));
  sortOldCards();
  saveCache();
}
/* one-time: cards made before aisles existed get a best guess */
function sortOldCards() {
  if (store.get('aisles-v1') || !S.shop.length) return;
  for (const i of S.shop) {
    const g = guessAisle(i.title);
    if ((i.aisle || 'other') === 'other' && g !== 'other') { i.aisle = g; db.update('shop_items', { id: i.id }, { aisle: g }); }
  }
  store.set('aisles-v1', '1');
}

let channel;
const pending = new Set();
let flushTimer;
function subscribe() {
  if (channel) sb.removeChannel(channel);
  const hid = S.me.household_id;
  channel = sb.channel('home-' + hid);
  for (const tb of ['notes', 'shop_items', 'ideas', 'votes', 'chores', 'chore_log', 'members', 'plans', 'picks', 'love_notes']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: tb, filter: `household_id=eq.${hid}` }, () => queueReload(tb));
  }
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'households', filter: `id=eq.${hid}` }, () => { queueReload('households'); queueReload('votes'); });
  channel.subscribe();
}
function queueReload(tb) {
  pending.add(tb);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(async () => {
    const tabs = [...pending]; pending.clear();
    if (tabs.includes('households')) await loadTable('households');
    await Promise.all(tabs.filter((x) => x !== 'households').map(loadTable));
    saveCache();
    refresh();
  }, 180);
}

/* ================================================================== */
/* boot                                                                */
/* ================================================================== */
const root = () => $('#root');

async function boot() {
  document.addEventListener('touchstart', () => {}, { passive: true }); // :active on iOS
  pinViewport();
  if (!DEMO && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.nav) setTab(e.data.nav); });
  }
  if (!DEMO && isIOS && !standalone() && !store.get('skipInstall')) return renderInstall();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderAuth();
  S.uid = session.user.id; S.email = session.user.email;
  if (loadCache(S.uid) && S.me) {        // open straight away from the local copy, then catch up
    renderShell();
    start();
    loadAll().then(() => refresh());
    return;
  }
  const rows = await q(sb.from('members').select('*').eq('user_id', S.uid));
  if (rows === null) return renderOffline();
  S.me = rows[0] || null;
  if (!S.me) return renderSetup();
  await enterApp();
}
async function enterApp() {
  await loadAll();
  renderShell();
  start();
}
let started = false;
function start() {
  subscribe();
  if (started) return;
  started = true;
  syncPush();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !S.me) return;
    if (S.searching && !$('#q')?.value.trim()) closeSearch();
    loadAll().then(() => refresh());
    if (channel?.state !== 'joined') subscribe();
  });
  window.addEventListener('online', () => { S.online = true; netPill(); loadAll().then(() => refresh()); subscribe(); });
  window.addEventListener('offline', () => { S.online = false; netPill(); });
  app.onQueue = netPill;
  if (DEMO) {
    window.addEventListener('demo-notify', (e) => {
      const p = S.members.find((m) => m.user_id !== S.uid)?.display_name || t('Your partner');
      if (e.detail?.kind !== 'test') setTimeout(() => toast(t('{name} gets a notification', { name: p })), 450);
    });
    sb.__demo?.start((title, body) => incoming(title, body));
  }
}
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.reload(); });

function renderOffline() {
  root().innerHTML = `<div class="solo"><div class="solo-inner"><img class="app-icon" src="${ICON_SRC}" alt=""><h1>${t("You're offline")}</h1><p class="lede">${t('Namučiai needs a connection the first time it opens on this phone. It will load as soon as you are back online.')}</p></div></div>`;
  window.addEventListener('online', () => boot(), { once: true });
}

/* notification look-alike, used by the prototype */
function incoming(title, body) {
  const el = document.createElement('button');
  el.className = 'incoming';
  el.innerHTML = `<img src="${ICON_SRC}" alt=""><span style="flex:1;min-width:0;text-align:left"><b>${esc(title)}</b><span>${esc(body)}</span></span>`;
  $('#layer').appendChild(el);
  raf(() => raf(() => el.classList.add('in')));
  const hide = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 500); };
  el.onclick = () => { hide(); setTab('notes'); };
  setTimeout(hide, 4200);
}

/* ================================================================== */
/* install / auth / setup                                              */
/* ================================================================== */
function renderInstall() {
  root().innerHTML = `
  <div class="solo"><div class="solo-inner">
    <img class="app-icon" src="${ICON_SRC}" alt="">
    <h1>${t('Put Namučiai on your Home Screen')}</h1>
    <p class="lede">${t('It opens full screen from there, like any other app, and can send you notifications.')}</p>
    <ol class="steps">
      <li><div>${t('Tap {icon} <b>Share</b> in Safari’s toolbar. You may need to tap <b>•••</b> first.', { icon: `<span class="ic">${svg(I.share, 20)}</span>` })}</div></li>
      <li><div>${t('Scroll down and tap <b>Add to Home Screen</b>.')}</div></li>
      <li><div>${t('Tap <b>Add</b>. If you see an <b>Open as Web App</b> switch, keep it on.')}</div></li>
      <li><div>${t('Open Namučiai from your Home Screen and sign in there.')}</div></li>
    </ol>
    <button class="text-btn" data-a="skip-install">${t('Use it in Safari for now')}</button>
  </div></div>`;
  root().onclick = (e) => { if (e.target.closest('[data-a="skip-install"]')) { store.set('skipInstall', '1'); boot(); } };
}

function renderAuth(mode = 'in') {
  const create = mode === 'up';
  root().innerHTML = `
  <div class="solo"><div class="solo-inner">
    <img class="app-icon" src="${ICON_SRC}" alt="">
    <h1>${create ? t('Create your account') : t('Sign in')}</h1>
    <p class="lede">${create ? t("You'll stay signed in on this phone.") : t('Use the email and password you set up.')}</p>
    <form id="auth" class="stack-gap" autocomplete="on">
      <input class="input" id="email" name="email" type="email" inputmode="email" autocomplete="username" placeholder="${esc(t('Email'))}" required>
      <input class="input" id="password" name="password" type="password" autocomplete="${create ? 'new-password' : 'current-password'}" placeholder="${esc(create ? t('Password, at least 6 characters') : t('Password'))}" required minlength="6">
      <div class="err" id="err"></div>
      <button class="btn block" type="submit">${create ? t('Create account') : t('Sign in')}</button>
    </form>
    <p class="or">${create ? t('Already have an account?') : t('New here?')}</p>
    <button class="btn block ghost" data-a="toggle">${create ? t('Sign in instead') : t('Create an account')}</button>
  </div></div>`;
  root().onclick = (e) => { if (e.target.closest('[data-a="toggle"]')) renderAuth(create ? 'in' : 'up'); };
  $('#auth').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const email = String(f.get('email')).trim().toLowerCase(), password = String(f.get('password'));
    const btn = e.target.querySelector('button[type=submit]'), err = $('#err');
    btn.disabled = true; err.textContent = '';
    try {
      if (create) {
        const { error } = await sb.functions.invoke('signup', { body: { email, password } });
        if (error) { let msg = t('Could not create the account'); try { msg = (await error.context.json()).error || msg; } catch {} throw new Error(msg); }
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(/invalid/i.test(error.message) ? t("That email and password don't match") : error.message);
      S.uid = data.user.id; S.email = data.user.email;
      const rows = await q(sb.from('members').select('*').eq('user_id', S.uid));
      S.me = rows?.[0] || null;
      if (!S.me) renderSetup(); else enterApp();
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
  };
}

function renderSetup() {
  root().innerHTML = `
  <div class="solo"><div class="solo-inner">
    <img class="app-icon" src="${ICON_SRC}" alt="">
    <h1>${t('Set up your home')}</h1>
    <p class="lede">${t('One of you starts a home. The other joins with its code.')}</p>
    <label class="field-label" for="nm">${t('Your name')}</label>
    <input class="input" id="nm" placeholder="${esc(t('e.g. Matas'))}" autocomplete="given-name">
    <div class="err" id="err"></div>
    <button class="btn block" data-a="start">${t('Start a new home')}</button>
    <p class="or">${t("or join your partner's")}</p>
    <div class="stack-gap">
      <input class="input" id="code" placeholder="${esc(t('6-letter home code'))}" autocapitalize="characters" maxlength="6" style="text-transform:uppercase;letter-spacing:.12em">
      <button class="btn block ghost" data-a="join">${t('Join home')}</button>
    </div>
    <p class="or"><button class="text-btn" data-a="out">${t('Sign out')}</button></p>
  </div></div>`;
  root().onclick = async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'out') return sb.auth.signOut();
    const name = $('#nm').value.trim(), err = $('#err');
    if (!name) { err.textContent = t('Add your name first'); $('#nm').focus(); return; }
    if (a === 'join' && !$('#code').value.trim()) { err.textContent = t("Type the code from your partner's phone"); return; }
    const { error } = a === 'start' ? await sb.rpc('create_household', { p_name: name }) : await sb.rpc('join_household', { p_code: $('#code').value.trim(), p_name: name });
    if (error) { err.textContent = error.message.replace(/^.*?:\s*/, ''); return; }
    const rows = await q(sb.from('members').select('*').eq('user_id', S.uid));
    S.me = rows?.[0] || null;
    enterApp();
  };
}

/* ================================================================== */
/* shell                                                               */
/* ================================================================== */
function renderShell() {
  root().onclick = null;
  const tabs = TABS();
  root().innerHTML = `
  <div class="app" id="app">
    <div class="navbar" id="navbar" aria-hidden="true"></div>
    <div class="netpill" id="netpill" hidden></div>
    <div class="topsearch" role="search">
      ${svg(I.search, 20)}
      <input id="q" type="search" placeholder="${esc(t('Search notes, cards and chores'))}" enterkeyhint="search" autocomplete="off">
      <button data-a="search-close">${t('Cancel')}</button>
    </div>
    <main class="view" id="view"><div class="view-inner" id="viewInner"></div></main>
    <nav class="dock" aria-label="${esc(t('Sections'))}">
      <div class="island" id="island">
        <span class="tab-pill" id="tabPill"></span>
        ${tabs.map((tb) => `<button class="tab" data-a="tab" data-id="${tb.id}">${svg(tb.icon, 24)}<span>${tb.label}</span><span class="dot" hidden></span></button>`).join('')}
        <span class="island-div" aria-hidden="true"></span>
        <button class="tab search-tab" data-a="search-open" aria-label="${esc(t('Search'))}">${svg(I.search, 24, 2.1)}<span>${t('Search')}</span></button>
      </div>
    </nav>
  </div>`;
  const appEl = $('#app'), view = $('#view');
  appEl.addEventListener('click', onClick);
  $('#q').addEventListener('input', () => renderView());
  $('#q').addEventListener('blur', () => setTimeout(() => { if (S.searching && !$('#q').value.trim()) closeSearch(); }, 160));
  let compact = false;
  view.addEventListener('scroll', () => { const c = view.scrollTop > 48; if (c !== compact) { compact = c; appEl.classList.toggle('compact', c); } }, { passive: true });
  initSwipeRows(view);
  S.lastHtml = '';
  refresh(true);
  netPill();
}

function netPill() {
  const el = $('#netpill');
  if (!el) return;
  const n = pendingWrites();
  if (!S.online || n) {
    el.hidden = false;
    el.innerHTML = `${svg(I.wifiOff, 15, 2.2)} ${!S.online ? (n ? tn(n, 'Offline, {n} change will sync', 'Offline, {n} changes will sync') : t('Offline. Changes sync later.')) : tn(n, 'Syncing {n} change…', 'Syncing {n} changes…')}`;
  } else el.hidden = true;
}

function setTab(id) {
  if (!tabIds.includes(id)) return;
  S.resetRows?.();
  hideToast();
  if (S.searching) closeSearch();
  if (id === S.tab) { $('#view').scrollTo({ top: 0, behavior: 'smooth' }); return; }
  S.tab = id;
  store.set('tab', id);
  try { history.replaceState(null, '', '#' + id); } catch {}
  $('#view').scrollTop = 0;
  $('#app').classList.remove('compact');
  refresh(true);
}
bindSetTab(setTab);

function refresh(enter = false) {
  if (!$('#app')) return;
  if (S.hold && !enter) { S.dirty = true; return; }
  updateIsland();
  renderView(enter);
  checkMatches();
  checkLove();
  saveCache();
  const n = S.chores.filter(inMyDeck).length;
  try { n ? navigator.setAppBadge?.(n) : navigator.clearAppBadge?.(); } catch {}
}
app.refresh = refresh;

function updateIsland() {
  const tabs = TABS();
  const idx = tabIds.indexOf(S.tab);
  document.documentElement.style.setProperty('--tab-hue', `var(--h${tabs[idx].hue})`);
  const btns = document.querySelectorAll('#island .tab[data-a="tab"]');
  $('#tabPill').style.transform = `translate3d(${btns[idx].offsetLeft - 6}px,0,0)`;
  const choreN = S.chores.filter(inMyDeck).length;
  btns.forEach((b, i) => {
    b.classList.toggle('on', i === idx);
    b.setAttribute('aria-current', i === idx ? 'page' : 'false');
    const dot = b.querySelector('.dot');
    if (tabIds[i] === 'chores' && choreN) { dot.hidden = false; dot.textContent = choreN; } else dot.hidden = true;
  });
  $('#navbar').textContent = tabs[idx].title;
}

function renderView(enter = false) {
  const el = $('#viewInner');
  if (!el) return;
  const html = S.searching ? viewSearch($('#q').value)
    : { notes: () => viewNotes(pushBanner), shop: viewShop, eat: () => viewIdeas('meal'), dates: () => viewIdeas('date'), chores: viewChores }[S.tab]();
  if (html === S.lastHtml && !enter) return;
  S.lastHtml = html;
  el.innerHTML = html;
  if (enter && !reduceMotion()) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
}

/* ================================================================== */
/* search                                                              */
/* ================================================================== */
function openSearch() {
  S.resetRows?.();
  S.searching = true;
  $('#app').classList.add('searching');
  const input = $('#q');
  input.value = '';
  input.focus();
  renderView(true);
}
function closeSearch() {
  if (!S.searching) return;
  S.searching = false;
  $('#app').classList.remove('searching');
  $('#q').blur();
  renderView(true);
}
function viewSearch(raw) {
  const n = norm(raw.trim());
  if (!n) return `<div class="empty muted" style="padding-top:40px">${t('Search across notes, shopping cards, ideas and chores.')}</div>`;
  const hit = (...xs) => xs.some((x) => norm(x).includes(n));
  const groups = [
    [t('Notes'), S.notes.filter((x) => hit(x.title, plainText(x.body))).map((x) => ({ a: 'note-open', id: x.id, t: x.title || plainText(x.body).slice(0, 60) || t('New note'), s: plainText(x.body).slice(0, 80), icon: I.notes }))],
    [t('Shopping'), S.shop.filter((x) => hit(x.title, x.description)).map((x) => ({ a: 'card-edit', id: x.id, t: x.title, s: x.status === 'cart' ? t('In the cart') : t('Not needed yet'), icon: I.bag }))],
    [t('Dinner ideas'), S.ideas.filter((x) => x.kind === 'meal' && hit(x.title, x.description, (x.ingredients || []).join(' '))).map((x) => ({ a: 'card-edit', id: x.id, t: x.title, s: x.description, icon: I.bowl }))],
    [t('Date ideas'), S.ideas.filter((x) => x.kind === 'date' && hit(x.title, x.description)).map((x) => ({ a: 'card-edit', id: x.id, t: x.title, s: x.description, icon: I.heart }))],
    [t('Chores'), S.chores.filter((x) => hit(x.title, x.description)).map((x) => ({ a: 'chore-edit', id: x.id, t: x.title, s: x.assignee ? (S.members.find((m) => m.user_id === x.assignee)?.display_name || '') : t('Anyone'), icon: I.check }))],
  ].filter(([, r]) => r.length);
  if (!groups.length) return `<div class="empty muted" style="padding-top:40px">${t('Nothing matches “{q}”.', { q: esc(raw.trim()) })}</div>`;
  return groups.map(([name, rows]) => `
    <div class="sec"><h2>${name}</h2><span class="count">${rows.length}</span></div>
    <div class="group">${rows.map((r) => `
      <button class="row" data-a="${r.a}" data-id="${r.id}">
        <span style="color:var(--ink-3);width:26px;display:grid;place-items:center">${svg(r.icon, 20)}</span>
        <span class="row-main"><span class="row-title">${esc(r.t)}</span>${r.s ? `<span class="row-sub">${esc(r.s)}</span>` : ''}</span>
      </button>`).join('')}</div>`).join('');
}

/* ================================================================== */
/* clicks                                                              */
/* ================================================================== */
function onClick(e) {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const a = b.dataset.a;
  if (a === 'tab') return setTab(b.dataset.id);
  if (a === 'search-open') return openSearch();
  if (a === 'search-close') return closeSearch();
  if (a === 'settings') return openSettings({ showIncoming: incoming, rerender: () => renderShell() });
  ACTIONS[a]?.(b, e);
}

boot();

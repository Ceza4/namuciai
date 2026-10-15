// Shared state, helpers, icons, the offline-safe write layer and uploads.
import { createClient } from '@supabase/supabase-js';
import { t, locale } from './i18n.js';

/* global __DEMO__, __ICON__ */
export const DEMO = typeof __DEMO__ !== 'undefined' && __DEMO__;
export const ICON_SRC = typeof __ICON__ !== 'undefined' ? __ICON__ : 'icons/icon-192.png';
export const SB_URL = 'https://hyioytjpjdzbenmtwcec.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aW95dGpwamR6YmVubXR3Y2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNDg4MTMsImV4cCI6MjEwNzYyNDgxM30.lcveRnQVsADYiW0lySpXan1SSEZ0f5JjEcb5RjqeL10';
export const VAPID = 'BOtbYv0JqtLfhgNKLCV6akBE7GoarRp1r2YRJsaR3IAh5_hWs9KeyXbzUIGvTUlihSqPSxVvzcxHoH6EvI0X0rs';

export const sb = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'namuciai-auth' },
});

/* ---------------- helpers ---------------- */
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const z = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
export const today = () => ymd(new Date());
export const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
export const dow = (s) => new Date(s + 'T12:00:00').getDay();
export const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
export const norm = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
export const hueOf = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `var(--h${h % 6})`; };
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const raf = (fn) => requestAnimationFrame(fn);
export const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export function ago(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.floor(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.floor(s / 3600) });
  if (s < 172800) return t('yesterday');
  return new Date(ts).toLocaleDateString(locale(), { month: 'short', day: 'numeric' });
}
export function shortWhen(ts) {
  const d = new Date(ts), td = today();
  if (ymd(d) === td) return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  if (ymd(d) === addDays(td, -1)) return t('Yesterday');
  if (Date.now() - d < 6 * 864e5) return d.toLocaleDateString(locale(), { weekday: 'long' });
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}
export const fmtDay = (d, o = { weekday: 'long' }) => new Date(d + 'T12:00:00').toLocaleDateString(locale(), o);
export const fmtTime = (ts) => new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

/* ---------------- state ---------------- */
export const S = {
  uid: null, email: null, me: null, household: null, members: [],
  notes: [], shop: [], ideas: [], votes: [], chores: [], log: [], plans: [], picks: [], love: [], memories: [],
  tab: 'shop', searching: false, hold: 0, dirty: false, lastHtml: '', online: navigator.onLine,
};
export const member = (uid) => S.members.find((m) => m.user_id === uid);
export const partner = () => S.members.find((m) => m.user_id !== S.uid);
export const nameOf = (uid) => (uid === S.uid ? t('You') : member(uid)?.display_name || t('Someone'));

/* hooks main.js fills in, so feature modules can ask for a redraw */
export const app = { refresh: () => {} };
export const refresh = (enter) => app.refresh(enter);
export function holdOn() { S.hold++; }
export function holdOff() { S.hold = Math.max(0, S.hold - 1); if (!S.hold && S.dirty) { S.dirty = false; refresh(); } }

/* click actions, registered by each feature module: data-a="name" */
export const ACTIONS = {};
export const on = (name, fn) => { ACTIONS[name] = fn; };

/* ---------------- icons ---------------- */
export const svg = (p, s = 24, w = 1.9) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const I = {
  notes: '<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  bag: '<path d="M5 8h14l-1.2 11.1A2 2 0 0 1 15.8 21H8.2a2 2 0 0 1-2-1.9z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>',
  bowl: '<path d="M3 12h18a9 9 0 0 1-18 0z"/><path d="M8 8c0-1.6 1.2-1.6 1.2-3.4M12 8c0-1.6 1.2-1.6 1.2-3.4M16 8c0-1.6 1.2-1.6 1.2-3.4"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.4 2.8 2.8L16.2 9.8"/>',
  tick: '<path d="m6 12.5 4 4L18 8"/>',
  search: '<circle cx="11" cy="11" r="6.8"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M6 12h12"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  cart: '<circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/><path d="M3 4h2.2l2.3 11h10.3L20 7.2H6.3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  pin: '<path d="M9 4h6l-1 5 3 3H7l3-3z"/><path d="M12 12v8"/>',
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
  list: '<rect x="4" y="5" width="4" height="4" rx="1.2"/><rect x="4" y="15" width="4" height="4" rx="1.2"/><path d="M11 7h9M11 17h9"/>',
  cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/>',
  store: '<path d="M4 9.5 5.5 5h13L20 9.5"/><path d="M4 9.5h16a2.6 2.6 0 0 1-5.3 0 2.6 2.6 0 0 1-5.4 0A2.6 2.6 0 0 1 4 9.5z"/><path d="M5.5 12.5V19h13v-6.5"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>',
  wifiOff: '<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4-2.4M19 12.5a10 10 0 0 0-3.2-2.1M2 9a15 15 0 0 1 5-3M22 9a15 15 0 0 0-10-4"/><circle cx="12" cy="20" r="1"/>',
  sparkle: '<path d="M12 3.5 13.8 9l5.7 1.9-5.7 1.9L12 18.5l-1.8-5.7L4.5 11l5.7-1.9z"/>',
};

/* ---------------- haptics + toast ---------------- */
let hapticLabel;
export function haptic() {
  try {
    if (!hapticLabel) {
      hapticLabel = document.createElement('label');
      hapticLabel.setAttribute('aria-hidden', 'true');
      hapticLabel.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      const i = document.createElement('input');
      i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
      hapticLabel.appendChild(i);
      document.body.appendChild(hapticLabel);
    }
    // clicking the hidden switch must not steal focus (it would close the keyboard)
    const active = document.activeElement;
    const sel = getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    hapticLabel.click();
    if (active && active !== document.activeElement && active !== document.body) {
      active.focus({ preventScroll: true });
      if (range) { sel.removeAllRanges(); sel.addRange(range); }
    }
  } catch {}
}
let toastTimer;
export function toast(msg, opts = {}) {
  const el = $('#toast');
  if (!el) return;
  const hide = () => { el.classList.remove('show', 'has-action'); el.onclick = null; };
  el.innerHTML = `<span>${esc(msg)}</span>${opts.undo ? `<button data-undo>${esc(t('Undo'))}</button>` : ''}`;
  el.classList.toggle('has-action', !!opts.undo);
  el.onclick = opts.undo ? (e) => { if (e.target.closest('[data-undo]')) { hide(); opts.undo(); } } : null;
  raf(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, opts.undo ? 4500 : 2400);
}
export const hideToast = () => $('#toast')?.classList.remove('show', 'has-action');

/* ---------------- reads ---------------- */
const isNet = (m = '') => /fetch|network|load failed|offline|timed? ?out/i.test(m);
export async function q(p) {
  try {
    const { data, error } = await p;
    if (error) { if (!isNet(error.message)) { console.error(error); toast(friendly(error.message)); } return null; }
    return data;
  } catch (e) { if (!isNet(e.message)) console.error(e); return null; }
}
const friendly = (m = '') => (m.length > 90 ? t('Something went wrong. Try again.') : m);

/* ---------------- writes that survive being offline ----------------
   Every change goes through write(). If the network is down it is queued in
   localStorage and replayed in order once the phone is back online.        */
const QKEY = 'namuciai-queue';
let queue = (() => { try { return JSON.parse(store.get(QKEY) || '[]'); } catch { return []; } })();
const saveQueue = () => store.set(QKEY, JSON.stringify(queue));
export const pendingWrites = () => queue.length;

function build(op) {
  const from = sb.from(op.t);
  const where = (b) => { for (const [k, v] of Object.entries(op.match || {})) b = Array.isArray(v) ? b.in(k, v) : b.eq(k, v); return b; };
  if (op.k === 'insert') return from.insert(op.row);
  if (op.k === 'upsert') return from.upsert(op.row, op.onConflict ? { onConflict: op.onConflict } : undefined);
  if (op.k === 'update') return where(from.update(op.patch));
  if (op.k === 'delete') return where(from.delete());
}
async function runOp(op) {
  try {
    const { error } = await build(op);
    if (!error) return 'ok';
    return isNet(error.message) ? 'net' : (console.error(error, op), 'fail');
  } catch (e) { return isNet(e.message) ? 'net' : 'fail'; }
}
let flushing = null;
export function flush() {
  if (flushing) return flushing;
  flushing = (async () => {
    while (queue.length) {
      const r = await runOp(queue[0]);
      if (r === 'net') break;
      queue.shift(); saveQueue();
    }
    flushing = null;
    app.onQueue?.();
  })();
  return flushing;
}
export async function write(op) {
  if (queue.length) { queue.push(op); saveQueue(); app.onQueue?.(); flush(); return; }
  const r = await runOp(op);
  if (r === 'net') { queue.push(op); saveQueue(); app.onQueue?.(); }
  else if (r === 'fail') toast(t("That change didn't save. Try again."));
}
export const db = {
  insert: (t_, row) => write({ t: t_, k: 'insert', row }),
  upsert: (t_, row, onConflict) => write({ t: t_, k: 'upsert', row, onConflict }),
  update: (t_, match, patch) => write({ t: t_, k: 'update', match, patch }),
  del: (t_, match) => write({ t: t_, k: 'delete', match }),
};

/* ---------------- local copy, so the app opens without signal ---------------- */
const CKEY = 'namuciai-cache';
const CACHED = ['household', 'members', 'notes', 'shop', 'ideas', 'votes', 'chores', 'log', 'plans', 'picks', 'love', 'memories'];
let cacheTimer;
export function saveCache() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    if (!S.me) return;
    const o = { uid: S.uid, me: S.me, email: S.email };
    for (const k of CACHED) o[k] = S[k];
    store.set(CKEY, JSON.stringify(o));
  }, 600);
}
export function loadCache(uid) {
  try {
    const o = JSON.parse(store.get(CKEY) || 'null');
    if (!o || o.uid !== uid) return false;
    for (const k of CACHED) if (o[k] !== undefined) S[k] = o[k];
    S.me = o.me; S.email = o.email;
    return true;
  } catch { return false; }
}
export const clearCache = () => { store.del(CKEY); store.del(QKEY); queue = []; };

/* ---------------- photos and GIFs ---------------- */
async function downscale(file, max = 1400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  } finally { URL.revokeObjectURL(url); }
}
export async function uploadImage(file) {
  const gif = file.type === 'image/gif';
  if (gif && file.size > 9.5e6) throw new Error(t('That GIF is too big. Pick one under 10 MB.'));
  const blob = gif ? file : await downscale(file);
  const path = `${S.me.household_id}/${uuid()}.${gif ? 'gif' : 'jpg'}`;
  const { error } = await sb.storage.from('media').upload(path, blob, { contentType: gif ? 'image/gif' : 'image/jpeg', cacheControl: '31536000' });
  if (error) throw new Error(isNet(error.message) ? t("You're offline. Photos upload once you're back online.") : error.message);
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}
/* opens the photo picker and resolves with the chosen file (or null) */
export function pickImage() {
  return new Promise((res) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'image/*';
    i.onchange = () => res(i.files?.[0] || null);
    i.click();
  });
}

export function notify(kind, title, body, url) {
  if (!S.online) return;
  sb.functions.invoke('notify', { body: { kind, title, body, url } }).catch(() => {});
}

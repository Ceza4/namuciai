// Love notes: write a message, it pops up once on the other phone, then it's gone.
import { $, esc, svg, I, S, db, uuid, refresh, toast, haptic, partner, member, notify, on, raf, reduceMotion, ago, store, saveCache } from './core.js';
import { t } from './i18n.js';
import { openSheet, closeSheet, autoGrow, avatar } from './ui.js';

const QUICK = () => [t('Thinking of you'), t('I love you'), t('Can’t wait to see you'), t('You’re the best')];
let showing = false;
const SEEN = 'namuciai-love-seen';
const shown = new Set((() => { try { return JSON.parse(store.get(SEEN) || '[]'); } catch { return []; } })());
const markSeen = (id) => { shown.add(id); store.set(SEEN, JSON.stringify([...shown].slice(-200))); };

export function loveButton() {
  if (!partner()) return '';
  return `<button class="circle-btn love-btn" data-a="love-new" aria-label="${esc(t('Send a love note'))}">${svg(I.heart, 21, 2.2)}</button>`;
}

function openLove() {
  const p = partner();
  if (!p) return;
  const sheet = openSheet(`
    <div class="sheet-bar">
      <button class="bar-btn plain" data-a="cancel">${t('Cancel')}</button>
      <div class="ttl">${t('Love note')}</div>
      <button class="bar-btn primary love-send" data-a="send" disabled>${t('Send')}</button>
    </div>
    <div class="sheet-body"><div>
      <div class="love-compose">
        <div class="love-to">${avatar(p.user_id, 'sm')} ${t('To {name}', { name: esc(p.display_name) })}</div>
        <textarea id="loveMsg" rows="3" maxlength="400" placeholder="${esc(t('Write something sweet…'))}"></textarea>
      </div>
      <div class="chips love-quick">${QUICK().map((q) => `<button type="button" data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <p class="hint">${t('It pops up once when {name} opens the app, then it disappears for good.', { name: esc(p.display_name) })}</p>
    </div></div>`);
  const ta = $('#loveMsg', sheet), send = $('[data-a="send"]', sheet);
  const sync = () => { autoGrow(ta); send.disabled = !ta.value.trim(); };
  ta.addEventListener('input', sync);
  setTimeout(() => ta.focus(), 120);
  sheet.addEventListener('click', (e) => {
    const qb = e.target.closest('[data-quick]');
    if (qb) { ta.value = qb.dataset.quick; sync(); haptic(); ta.focus(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'cancel') closeSheet(sheet);
    if (a === 'send') {
      const message = ta.value.trim();
      if (!message) return;
      const row = { id: uuid(), household_id: S.me.household_id, from_user: S.uid, to_user: p.user_id, message, created_at: new Date().toISOString() };
      S.love.push(row);
      db.insert('love_notes', row);
      notify('love', t('{name} sent you a love note', { name: S.me.display_name }), t('Open Namučiai to read it'), './');
      closeSheet(sheet);
      heartBurst();
      haptic();
      toast(t('Sent to {name}', { name: p.display_name }));
    }
  });
}

/* a few hearts float up from the button, as a send confirmation */
function heartBurst() {
  if (reduceMotion()) return;
  const btn = document.querySelector('.love-btn');
  const r = btn?.getBoundingClientRect() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const box = document.createElement('div');
  box.className = 'burst';
  box.style.left = r.left + r.width / 2 + 'px';
  box.style.top = r.top + r.height / 2 + 'px';
  box.innerHTML = Array.from({ length: 7 }, (_, i) => `<i style="--dx:${(i - 3) * 16 + (Math.random() * 10 - 5)}px;--d:${i * 40}ms;--s:${0.7 + Math.random() * 0.6}">${svg(I.heart, 18, 0)}</i>`).join('');
  $('#layer').appendChild(box);
  setTimeout(() => box.remove(), 1400);
}

/* show unseen notes addressed to me, one at a time; delete each once it's closed */
export function checkLove() {
  if (showing || !S.me || document.visibilityState === 'hidden') return;
  if ($('.match') || $('.deck')) return;
  const note = S.love.filter((n) => n.to_user === S.uid && !shown.has(n.id)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
  if (!note) return;
  showing = true;
  markSeen(note.id);
  haptic();
  const from = member(note.from_user);
  const el = document.createElement('div');
  el.className = 'love-pop';
  el.innerHTML = `
    <div class="love-float" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => `<i style="--x:${8 + i * 10.5}%;--d:${(i % 5) * 0.5}s;--s:${0.6 + (i % 3) * 0.25}">${svg(I.heart, 22, 0)}</i>`).join('')}</div>
    <div class="love-card" role="dialog" aria-label="${esc(t('Love note'))}">
      <div class="love-from">${avatar(note.from_user, 'sm')} ${t('From {name}', { name: esc(from?.display_name || t('your partner')) })}<span>${esc(ago(note.created_at))}</span></div>
      <p class="love-msg">${esc(note.message)}</p>
      <button class="btn love-close" data-a="love-close">${svg(I.heart, 18, 2.2)} ${t('Close')}</button>
    </div>`;
  $('#layer').appendChild(el);
  raf(() => raf(() => el.classList.add('in')));
  el.addEventListener('click', (e) => {
    if (!e.target.closest('[data-a="love-close"]')) return;
    el.classList.add('out');
    S.love = S.love.filter((n) => n.id !== note.id);
    db.del('love_notes', { id: note.id });
    saveCache();
    setTimeout(() => { el.remove(); showing = false; checkLove(); }, 420);
  });
}

/* tell the sender when their note was read (its row disappears) */
export function loveReadCheck(prev) {
  const now = new Set(S.love.map((n) => n.id));
  for (const n of prev) if (n.from_user === S.uid && !now.has(n.id)) { const p = partner(); if (p) toast(t('{name} read your love note', { name: p.display_name })); break; }
}

on('love-new', () => openLove());

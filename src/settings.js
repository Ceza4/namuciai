// Settings: name, people, appearance, language, notifications, Siri, sign out. Also push + theme.
import { $, esc, svg, I, S, DEMO, sb, q, db, store, toast, haptic, refresh, partner, member, raf, reduceMotion, isIOS, standalone, VAPID, SB_URL, on, clearCache } from './core.js';
import { t, lang, setLang } from './i18n.js';
import { avatar, openSheet, closeSheet } from './ui.js';

/* ---------------- theme ---------------- */
export function applyTheme(animate = false) {
  const r = document.documentElement;
  const mode = store.get('theme') || 'system';
  if (animate && !reduceMotion()) { r.classList.add('theme-anim'); setTimeout(() => r.classList.remove('theme-anim'), 420); }
  if (mode === 'system') { if (r.dataset.themeBy === 'app') { r.removeAttribute('data-theme'); delete r.dataset.themeBy; } }
  else { r.setAttribute('data-theme', mode); r.dataset.themeBy = 'app'; }
  if (store.get('love') === '1') r.setAttribute('data-love', ''); else r.removeAttribute('data-love');
  raf(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    document.querySelectorAll('meta[name="theme-color"]').forEach((x) => x.remove());
    const m = document.createElement('meta'); m.name = 'theme-color'; m.content = bg; document.head.appendChild(m);
  });
}

/* ---------------- push ---------------- */
function urlB64(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
export const pushSupported = () => !DEMO && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export async function enablePush() {
  if (!pushSupported()) {
    toast(DEMO ? t('Notifications work in the installed app') : isIOS && !standalone() ? t('Open Namučiai from your Home Screen to turn on notifications') : t("This browser can't show notifications"));
    return false;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast(t('Notifications are off. You can turn them on in iPhone Settings.')); store.set('pushDismissed', '1'); refresh(); return false; }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(VAPID) });
  await q(sb.from('push_subs').upsert({ endpoint: sub.endpoint, sub: sub.toJSON(), user_id: S.uid }, { onConflict: 'endpoint' }));
  refresh();
  toast(t('Notifications are on'));
  return true;
}
export async function syncPush() {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(VAPID) });
    await sb.from('push_subs').upsert({ endpoint: sub.endpoint, sub: sub.toJSON(), user_id: S.uid }, { onConflict: 'endpoint' });
  } catch (e) { console.warn('push sync', e); }
}
export function pushBanner() {
  if (DEMO || !('Notification' in window) || !('PushManager' in window)) return '';
  if (Notification.permission !== 'default' || store.get('pushDismissed')) return '';
  return `<div class="banner">
    ${svg(I.bell, 24)}
    <div class="row-main"><b>${t('Get a heads-up')}</b>${t('When {name} edits a note or dinner gets picked.', { name: esc(partner()?.display_name || t('your partner')) })}</div>
    <div style="display:flex;flex-direction:column;gap:2px;align-items:center"><button class="btn small" data-a="push-on">${t('Turn on')}</button><button class="text-btn small" data-a="push-later" style="padding:2px 4px;color:var(--ink-3)">${t('Not now')}</button></div>
  </div>`;
}
async function notifyTest(showIncoming) {
  if (DEMO) { showIncoming('Namučiai', t('Notifications work on this phone.')); return; }
  const { data } = await sb.functions.invoke('notify', { body: { kind: 'test', title: 'Namučiai', body: t('Notifications work on this phone.'), url: './' } });
  toast(data?.sent ? t('Sent. Lock your phone to see it.') : t('Nothing was sent. Try turning notifications off and on.'));
}

/* ---------------- Siri ---------------- */
const QUICK_URL = `${SB_URL}/functions/v1/quick`;
async function openSiri() {
  const tok = DEMO ? 'demo-token-1234' : await q(sb.rpc('quick_token', { p_new: false }));
  if (!tok) { toast(t("You're offline. Try again once you're back online.")); return; }
  const copyBtn = (v, label) => `<button class="copy" data-copy="${esc(v)}">${svg(I.copy, 16, 2)} ${esc(label)}</button>`;
  const sheet = openSheet(`
    <div class="sheet-bar"><span></span><div class="ttl">${t('Siri and Shortcuts')}</div><button class="bar-btn primary" data-a="close">${t('Done')}</button></div>
    <div class="sheet-body"><div>
      <p class="lede-s">${t('Say “Hey Siri, add to Namučiai”, then the item. It lands in the cart without opening the app. Set it up once in Apple’s Shortcuts app.')}</p>
      <ol class="steps small">
        <li><div>${t('Open the <b>Shortcuts</b> app, tap <b>+</b>, and name the shortcut <b>Add to Namučiai</b>.')}</div></li>
        <li><div>${t('Add the action <b>Ask for Input</b>. Set the question to “What should I add?”.')}</div></li>
        <li><div>${t('Add the action <b>Get Contents of URL</b> and paste this address:')}<div class="codebox">${esc(QUICK_URL)}</div>${copyBtn(QUICK_URL, t('Copy address'))}</div></li>
        <li><div>${t('Tap <b>Show More</b>: set Method to <b>POST</b> and Request Body to <b>JSON</b>. Add three text fields:')}
          <div class="kv"><span>token</span><code>${esc(tok)}</code></div>${copyBtn(tok, t('Copy token'))}
          <div class="kv"><span>type</span><code>cart</code></div>
          <div class="kv"><span>text</span><code>${t('Provided Input')}</code></div></div></li>
        <li><div>${t('Add <b>Show Result</b> so Siri tells you what was added. Then say “Hey Siri, add to Namučiai”.')}</div></li>
      </ol>
      <p class="hint" style="text-align:left">${t('For quick notes, make a second shortcut with type set to <b>note</b>. You can say several things at once: “milk, eggs and bread”.')}</p>
      <div style="text-align:center;margin-top:18px"><button class="btn ghost small" data-a="new-token">${t('Make a new token')}</button></div>
      <p class="hint">${t('The token works like a password for adding things. Make a new one if you shared it by mistake.')}</p>
    </div></div>`);
  sheet.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) {
      try { await navigator.clipboard.writeText(c.dataset.copy); toast(t('Copied')); haptic(); }
      catch { toast(t("Couldn't copy. Press and hold the text instead.")); }
      return;
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'close') closeSheet(sheet);
    if (a === 'new-token' && !DEMO) { await q(sb.rpc('quick_token', { p_new: true })); closeSheet(sheet); setTimeout(openSiri, 450); toast(t('New token made. Update it in your shortcut.')); }
  });
}

/* ---------------- settings sheet ---------------- */
export function openSettings({ showIncoming, rerender }) {
  const p = partner();
  const pushOn = DEMO || (pushSupported() && Notification.permission === 'granted');
  const sheet = openSheet(`
    <div class="sheet-bar"><span></span><div class="ttl">${t('Home')}</div><button class="bar-btn primary" data-a="close">${t('Done')}</button></div>
    <div class="sheet-body"><div>
      <label class="field-label" for="myname">${t('Your name')}</label>
      <input class="input" id="myname" value="${esc(S.me.display_name)}" maxlength="24">
      <label class="field-label">${t('People')}</label>
      <div class="group flat">
        <div class="row">${avatar(S.uid, 'sm')}<div class="row-main"><span class="row-title">${esc(S.me.display_name)}</span><span class="row-sub">${esc(S.email || '')}</span></div></div>
        ${p ? `<div class="row">${avatar(p.user_id, 'sm')}<div class="row-main"><span class="row-title">${esc(p.display_name)}</span></div></div>`
            : `<div class="row"><div class="row-main"><span class="row-title">${t('Invite your partner')}</span><span class="row-sub wrap">${t('They create an account on their phone and join with this code.')}</span></div><span class="chip" style="font:800 18px/1 var(--round);letter-spacing:.12em;padding:10px 12px">${esc(S.household?.invite_code)}</span></div>`}
      </div>
      <label class="field-label">${t('Appearance')}</label>
      <div class="seg">${[['system', t('Automatic')], ['light', t('Light')], ['dark', t('Dark')]].map(([v, l]) => `<button data-theme-v="${v}" class="${(store.get('theme') || 'system') === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="group flat" style="margin-top:10px">
        <label class="row" for="loveSw"><span class="row-main"><span class="row-title">${t('Love theme')}</span><span class="row-sub">${t('Cream and deep red')}</span></span><input type="checkbox" class="switch" id="loveSw" ${store.get('love') === '1' ? 'checked' : ''}></label>
      </div>
      <label class="field-label">${t('Language')}</label>
      <div class="seg">${[['en', 'English'], ['lt', 'Lietuvių']].map(([v, l]) => `<button data-lang="${v}" class="${lang === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <label class="field-label">${t('Notifications')}</label>
      <div class="group flat"><div class="row">
        <div class="row-main"><span class="row-title">${pushOn ? t('On for this phone') : t('Off')}</span>
        <span class="row-sub wrap">${t('Note changes (at most one every 15 minutes), dinner and date picks, date reminders, chores handed to you, shop runs, and a morning reminder when chores are waiting.')}</span></div>
        ${pushOn ? `<button class="btn small ghost" data-a="test">${t('Test')}</button>` : `<button class="btn small" data-a="push-on">${t('Turn on')}</button>`}
      </div></div>
      <label class="field-label">Siri</label>
      <div class="group flat"><button class="row" data-a="siri">${svg(I.mic, 22, 2)}<span class="row-main"><span class="row-title">${t('Add things with Siri')}</span><span class="row-sub wrap">${t('“Hey Siri, add to Namučiai”, without opening the app')}</span></span>${svg('<path d="m9 6 6 6-6 6"/>', 18, 2)}</button></div>
      <div style="margin-top:34px;text-align:center"><button class="btn ghost" data-a="out">${DEMO ? t('Reset the prototype') : t('Sign out')}</button></div>
    </div></div>`, { onDismiss: () => close() });
  function close() {
    const nm = $('#myname', sheet).value.trim();
    if (nm && nm !== S.me.display_name) {
      S.me.display_name = nm;
      const m = member(S.uid); if (m) m.display_name = nm;
      db.update('members', { user_id: S.uid }, { display_name: nm });
    }
    closeSheet(sheet); refresh();
  }
  $('#loveSw', sheet).addEventListener('change', (e) => { store.set('love', e.target.checked ? '1' : '0'); haptic(); applyTheme(true); });
  sheet.addEventListener('click', async (e) => {
    const tv = e.target.closest('[data-theme-v]');
    if (tv) { store.set('theme', tv.dataset.themeV); sheet.querySelectorAll('[data-theme-v]').forEach((b) => b.classList.toggle('on', b === tv)); applyTheme(true); return; }
    const lb = e.target.closest('[data-lang]');
    if (lb) { if (lb.dataset.lang !== lang) { setLang(lb.dataset.lang); closeSheet(sheet); rerender(); setTimeout(() => openSettings({ showIncoming, rerender }), 300); } return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'close') close();
    if (a === 'push-on') { if (await enablePush()) { closeSheet(sheet); openSettings({ showIncoming, rerender }); } }
    if (a === 'test') notifyTest(showIncoming);
    if (a === 'siri') openSiri();
    if (a === 'out') { clearCache(); if (DEMO) { try { localStorage.clear(); } catch {} } await sb.auth.signOut(); }
  });
}

on('push-on', () => enablePush());
on('push-later', () => { store.set('pushDismissed', '1'); refresh(); });

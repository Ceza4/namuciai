// Shopping: swipe deck with quantities, a cart grouped by aisle, and "I'm at the shop".
import { $, esc, svg, I, S, db, sb, q, refresh, toast, haptic, hueOf, nameOf, member, partner, notify, on, uuid } from './core.js';
import { t, tn } from './i18n.js';
import { header, srow, ROWS, miniStack, collapse, openDeck, avatar } from './ui.js';
import { AISLE_ORDER, guessAisle } from './aisles.js';
import { aisleName } from './cards.js';

export function shopPool() {
  return S.shop.filter((i) => i.status === 'idle')
    .sort((a, b) => (a.last_swiped_at ? new Date(a.last_swiped_at) : 0) - (b.last_swiped_at ? new Date(b.last_swiped_at) : 0));
}
const SHOP_FRESH = 3 * 36e5;
export function shoppingNow() {
  const h = S.household;
  if (!h?.shopping_by || !h.shopping_at || Date.now() - new Date(h.shopping_at) > SHOP_FRESH) return null;
  return h.shopping_by;
}

ROWS.cart = (id) => ({
  lead: { label: t('Bought'), icon: I.tick, color: 'var(--yes)', destructive: true, run: () => unCart(id, t('Bought')) },
  trail: { label: t('Not needed'), icon: I.minus, color: 'var(--no)', destructive: true, run: () => unCart(id, t('Back in the deck')) },
});

function cartRow(i) {
  const q_ = i.qty || 1;
  return srow('cart', i.id, `
    <div class="srow-fg row">
      <button class="tick" data-a="bought" data-id="${i.id}" aria-label="${esc(t('Mark {title} as bought', { title: i.title }))}">${svg(I.tick, 16, 3)}</button>
      ${i.image_url ? `<span class="thumb sm" style="background-image:url('${esc(i.image_url)}')"></span>` : ''}
      <button class="row-main" data-a="card-edit" data-id="${i.id}">
        <span class="row-title">${esc(i.title)}${q_ > 1 ? ` <span class="qty-x">×${q_}</span>` : ''}</span>${i.description ? `<span class="row-sub">${esc(i.description)}</span>` : ''}
      </button>
      <span class="stepper no-swipe">
        <button type="button" data-a="qty" data-d="-1" data-id="${i.id}" aria-label="${esc(t('Fewer'))}" ${q_ <= 1 ? 'disabled' : ''}>${svg(I.minus, 14, 2.6)}</button>
        <b>${q_}</b>
        <button type="button" data-a="qty" data-d="1" data-id="${i.id}" aria-label="${esc(t('More'))}">${svg(I.plus, 14, 2.6)}</button>
      </span>
    </div>`);
}

export function viewShop() {
  const cart = S.shop.filter((i) => i.status === 'cart');
  const pool = shopPool();
  let html = header(t('Shopping'), 'card-new-shop');
  if (!S.shop.length) {
    return html + `<div class="group empty"><p>${t('Make a card for each thing you buy now and then. Then swipe through them to build the list.')}</p>
      <div class="stack-gap" style="align-items:center"><button class="btn" data-a="card-new-shop">${t('Make a card')}</button><button class="text-btn" data-a="starter-shop">${t('Add a few everyday cards')}</button></div></div>`;
  }
  const who = shoppingNow(), p = partner();
  if (who && who === S.uid) {
    html += `<div class="banner live">${svg(I.store, 24)}<div class="row-main"><b>${t("You're at the shop")}</b>${p ? t('{name} knows, and anything they add shows up here.', { name: esc(p.display_name) }) : ''}</div><button class="btn small" data-a="shop-stop">${t("I'm done")}</button></div>`;
  } else if (who) {
    html += `<div class="banner live">${svg(I.store, 24)}<div class="row-main"><b>${t('{name} is at the shop', { name: esc(nameOf(who)) })}</b>${t('Add anything you need now and it lands in the cart.')}</div></div>`;
  }
  html += `<button class="launch ${pool.length ? '' : 'idle'}" data-a="deck-shop">
    ${miniStack(pool)}
    <span class="launch-text"><span class="launch-title">${pool.length ? t('Swipe through cards') : t('Everything is in the cart')}</span>
    <span class="launch-sub">${pool.length ? tn(pool.length, '{n} card. Right adds it to the cart.', '{n} cards. Right adds it to the cart.') : t('Tick things off as you buy them.')}</span></span>
  </button>`;
  if (!who) html += `<button class="go-shop" data-a="shop-go">${svg(I.store, 18, 2)} ${t("I'm going shopping")}</button>`;
  html += `<div class="sec"><h2>${t('In the cart')}</h2><span class="count">${cart.length || ''}</span>${cart.length > 1 ? `<button class="link" data-a="all-bought">${t('All bought')}</button>` : ''}</div>`;
  if (cart.length) {
    const groups = AISLE_ORDER.map((a) => [a, cart.filter((i) => (i.aisle || 'other') === a)]).filter(([, l]) => l.length);
    const showHeads = groups.length > 1;
    html += `<div class="group">${groups.map(([a, l]) => `${showHeads ? `<div class="aisle-h">${esc(aisleName(a))}</div>` : ''}${l.map(cartRow).join('')}`).join('')}</div>`;
  } else html += `<div class="group empty"><p style="margin:0">${t('The cart is empty. Swipe right on a card to add it.')}</p></div>`;
  if (pool.length) {
    html += `<div class="sec"><h2>${t('Not needed yet')}</h2><span class="count">${pool.length}</span></div>
    <div class="group">${pool.map((i) => srow('card', i.id, `
      <button class="srow-fg row" data-a="card-edit" data-id="${i.id}">
        ${i.image_url ? `<span class="swatch img" style="background-image:url('${esc(i.image_url)}')"></span>` : `<span class="swatch" style="background:${hueOf(i.id)}"></span>`}
        <span class="row-main"><span class="row-title">${esc(i.title)}</span><span class="row-sub">${esc([aisleName(i.aisle || 'other'), i.description].filter(Boolean).join(', '))}</span></span>
      </button>`)).join('')}</div>`;
  }
  return html;
}

export function unCart(id, msg) {
  const i = S.shop.find((x) => x.id === id);
  if (!i) return;
  const prevQty = i.qty;
  i.status = 'idle'; i.last_swiped_at = new Date().toISOString(); i.qty = 1;
  db.update('shop_items', { id }, { status: 'idle', last_swiped_at: i.last_swiped_at, qty: 1 });
  refresh();
  if (msg) toast(msg, { undo: () => { i.status = 'cart'; i.qty = prevQty; db.update('shop_items', { id }, { status: 'cart', qty: prevQty }); refresh(); } });
}

/* puts items in the cart by title, creating cards that don't exist yet */
export function addToCart(titles) {
  let n = 0;
  for (const raw of titles) {
    const title = raw.trim();
    if (!title) continue;
    const hit = S.shop.find((x) => x.title.trim().toLowerCase() === title.toLowerCase());
    if (hit) {
      if (hit.status !== 'cart') { hit.status = 'cart'; hit.last_swiped_at = new Date().toISOString(); db.update('shop_items', { id: hit.id }, { status: 'cart', last_swiped_at: hit.last_swiped_at }); n++; }
    } else {
      const row = { id: uuid(), household_id: S.me.household_id, title: title[0].toUpperCase() + title.slice(1), description: '', status: 'cart', qty: 1, aisle: guessAisle(title), created_by: S.uid, created_at: new Date().toISOString(), last_swiped_at: new Date().toISOString() };
      S.shop.push(row); db.insert('shop_items', row); n++;
    }
  }
  refresh();
  return n;
}

function qtyStepperHTML(q_) {
  return `<div class="card-qty no-drag"><span>${t('How many')}</span><div class="stepper on-card"><button type="button" data-q="-1" aria-label="${esc(t('Fewer'))}">${svg(I.minus, 16, 2.6)}</button><b>${q_}</b><button type="button" data-q="1" aria-label="${esc(t('More'))}">${svg(I.plus, 16, 2.6)}</button></div></div>`;
}
function shopDeck() {
  openDeck({
    title: t('Shopping'),
    items: shopPool(),
    left: { label: t('Not now'), icon: I.x },
    right: { label: t('To cart'), icon: I.cart },
    stampYes: t('Cart'), stampNo: t('Not now'),
    card: (i) => `
      <div class="meta">${member(i.created_by) ? `${avatar(i.created_by, 'xs')} ${i.created_by === S.uid ? t('You added this') : t('{name} added this', { name: esc(nameOf(i.created_by)) })}` : esc(aisleName(i.aisle || 'other'))}</div>
      <h3>${esc(i.title)}</h3>
      ${i.description ? `<p>${esc(i.description)}</p>` : ''}
      ${qtyStepperHTML(i.qty || 1)}`,
    mount(c, i) {
      c._qty = i.qty || 1;
      c.querySelector('.card-qty').addEventListener('click', (e) => {
        const b = e.target.closest('[data-q]');
        if (!b) return;
        c._qty = Math.max(1, Math.min(99, c._qty + Number(b.dataset.q)));
        c.querySelector('.card-qty b').textContent = c._qty;
        haptic();
      });
    },
    onSwipe(item, dir, _api, c) {
      const prev = { status: item.status, last_swiped_at: item.last_swiped_at, qty: item.qty || 1 };
      const patch = dir === 'right' ? { status: 'cart', last_swiped_at: new Date().toISOString(), qty: c?._qty || 1 } : { last_swiped_at: new Date().toISOString() };
      Object.assign(item, patch);
      db.update('shop_items', { id: item.id }, patch);
      return () => { Object.assign(item, prev); db.update('shop_items', { id: item.id }, prev); };
    },
    end: () => {
      const n = S.shop.filter((i) => i.status === 'cart').length;
      return { title: t("That's every card"), text: n ? tn(n, '{n} thing in the cart.', '{n} things in the cart.') : t('Nothing went in the cart this time.') };
    },
  });
}

on('deck-shop', () => shopPool().length && shopDeck());
on('bought', (b) => {
  const row = b.closest('.srow');
  b.classList.add('done');
  haptic();
  setTimeout(() => collapse(row, () => unCart(b.dataset.id)), 260);
});
on('qty', (b) => {
  const i = S.shop.find((x) => x.id === b.dataset.id);
  if (!i) return;
  i.qty = Math.max(1, Math.min(99, (i.qty || 1) + Number(b.dataset.d)));
  haptic();
  db.update('shop_items', { id: i.id }, { qty: i.qty });
  refresh();
});
on('all-bought', () => {
  const now = new Date().toISOString();
  const ids = S.shop.filter((x) => x.status === 'cart').map((x) => { x.status = 'idle'; x.last_swiped_at = now; x.qty = 1; return x.id; });
  db.update('shop_items', { id: ids }, { status: 'idle', last_swiped_at: now, qty: 1 });
  refresh(); toast(t('Cart cleared'));
});
on('shop-go', async () => {
  S.household.shopping_by = S.uid; S.household.shopping_at = new Date().toISOString();
  refresh(); haptic();
  await q(sb.rpc('set_shopping', { p_on: true }));
  notify('shop', t('{name} is at the shop', { name: S.me.display_name }), t('Add anything you need now and it lands in the cart.'), './#shop');
  if (partner()) toast(t('{name} will get a heads-up', { name: partner().display_name }));
});
on('shop-stop', async () => {
  S.household.shopping_by = null; S.household.shopping_at = null;
  refresh();
  await q(sb.rpc('set_shopping', { p_on: false }));
});
on('starter-shop', () => {
  const titles = ['Milk', 'Eggs', 'Bread', 'Butter', 'Coffee', 'Bananas', 'Cheese', 'Toilet paper', 'Dish soap', 'Rice'].map((x) => t(x));
  for (const title of titles) {
    const row = { id: uuid(), household_id: S.me.household_id, title, description: '', status: 'idle', qty: 1, aisle: guessAisle(title), created_by: S.uid, created_at: new Date().toISOString(), last_swiped_at: null };
    S.shop.push(row); db.insert('shop_items', row);
  }
  refresh();
});

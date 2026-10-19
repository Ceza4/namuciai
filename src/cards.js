// The card editor shared by shopping items and dinner/date ideas.
import { $, esc, svg, I, S, db, uuid, refresh, toast, haptic, hueOf, uploadImage, pickImage, on, store } from './core.js';
import { shoppingNow } from './shop.js';
import { t, lang } from './i18n.js';
import { openSheet, closeSheet, autoGrow, chips, ROWS } from './ui.js';
import { AISLES, guessAisle } from './aisles.js';

export const aisleName = (id) => { const a = AISLES.find((x) => x.id === id) || AISLES.at(-1); return lang === 'lt' ? a.lt : a.en; };

const KIND = {
  shop: { list: () => S.shop, set: (v) => { S.shop = v; }, table: 'shop_items', label: () => t('New shopping card'), ph: () => t('e.g. Oat milk'), dph: () => t('Brand, size, where to buy (optional)') },
  meal: { list: () => S.ideas, set: (v) => { S.ideas = v; }, table: 'ideas', label: () => t('New dinner idea'), ph: () => t('e.g. Pasta carbonara'), dph: () => t('Recipe link or notes (optional)') },
  date: { list: () => S.ideas, set: (v) => { S.ideas = v; }, table: 'ideas', label: () => t('New date idea'), ph: () => t('e.g. Picnic by the river'), dph: () => t('Where, when, what to bring (optional)') },
};
export const kindOfCard = (id) => (S.shop.some((x) => x.id === id) ? 'shop' : S.ideas.find((x) => x.id === id)?.kind);

export function deleteCard(id) {
  const kind = kindOfCard(id);
  if (!kind) return;
  const k = KIND[kind];
  const copy = { ...k.list().find((x) => x.id === id) };
  k.set(k.list().filter((x) => x.id !== id));
  db.del(k.table, { id });
  refresh();
  toast(t('Card deleted'), { undo: () => { k.list().push(copy); db.insert(k.table, copy); refresh(); } });
}
ROWS.card = (id) => ({ trail: { label: t('Delete'), icon: I.trash, color: 'var(--warn)', destructive: true, run: () => deleteCard(id) } });

export function openCard(kind, id) {
  const k = KIND[kind];
  const item = id ? k.list().find((x) => x.id === id) : null;
  let added = 0, image = item?.image_url || null, uploading = false;
  let aisle = item?.aisle || 'other', aisleTouched = !!item && item.aisle !== 'other';
  let qty = item?.qty || 1;
  /* new shopping cards can skip the deck and go straight into the cart (remembered; on by default while someone is at the shop) */
  const directSaved = store.get('shop-direct');
  let direct = kind === 'shop' && !item && (directSaved ? directSaved === '1' : !!shoppingNow());
  const tempHue = () => hueOf('new-' + kind + '-' + added);
  const sheet = openSheet(`
    <div class="sheet-bar">
      <button class="bar-btn plain" data-a="cancel">${item ? t('Cancel') : t('Done')}</button>
      <div class="ttl">${item ? t('Edit card') : k.label()}</div>
      <button class="bar-btn primary" data-a="save">${item ? t('Save') : t('Add')}</button>
    </div>
    <div class="sheet-body"><div>
      <div class="edit-card ${image ? 'has-img' : ''}" id="ec" style="background:${item ? hueOf(item.id) : tempHue()}">
        <div class="ec-img" id="ecImg" ${image ? `style="background-image:url('${esc(image)}')"` : ''}>
          <button type="button" class="ec-img-btn" data-a="img">${svg(I.image, 18, 2)}<span>${image ? t('Change photo') : t('Add photo')}</span></button>
          ${image ? `<button type="button" class="ec-img-x" data-a="img-x" aria-label="${esc(t('Remove photo'))}">${svg(I.x, 16, 2.4)}</button>` : ''}
        </div>
        <textarea class="t" id="cardTitle" rows="1" placeholder="${esc(k.ph())}" maxlength="80" enterkeyhint="${item ? 'next' : 'done'}">${esc(item?.title)}</textarea>
        <textarea class="d" id="cardDesc" rows="2" placeholder="${esc(k.dph())}" maxlength="300">${esc(item?.description)}</textarea>
      </div>
      ${kind === 'shop' ? `
        <label class="field-label">${t('Aisle')}</label>
        ${chips('aisle', AISLES.map((a) => [a.id, lang === 'lt' ? a.lt : a.en]), aisle)}
        <label class="field-label">${t('How many')}</label>
        <div class="stepper big"><button type="button" data-a="q-" aria-label="${esc(t('Fewer'))}">${svg(I.minus, 18, 2.6)}</button><b id="qtyV">${qty}</b><button type="button" data-a="q+" aria-label="${esc(t('More'))}">${svg(I.plus, 18, 2.6)}</button></div>
        ${!item ? `<label class="direct-row" for="directSw"><span class="direct-ico">${svg(I.cart, 20, 2.2)}</span><span class="row-main"><span class="row-title">${t('Straight to the cart')}</span><span class="row-sub">${t('Skip the swiping for this one')}</span></span><input type="checkbox" class="switch" id="directSw" ${direct ? 'checked' : ''}></label>`
          : item.status !== 'cart' ? `<button type="button" class="btn wide" data-a="to-cart" style="margin-top:18px">${svg(I.cart, 18, 2.2)} ${t('Put in the cart now')}</button>` : ''}` : ''}
      ${kind === 'meal' ? `
        <label class="field-label" for="ingr">${t('Ingredients, one per line')}</label>
        <textarea class="input" id="ingr" rows="4" placeholder="${esc(t('Spaghetti\nEggs\nParmesan'))}">${esc((item?.ingredients || []).join('\n'))}</textarea>` : ''}
      <p class="hint" id="addedNote">${item ? '' : t('Add as many as you like, then tap Done.')}</p>
      ${item ? `<div style="margin-top:24px;text-align:center"><button class="btn danger" data-a="delete">${svg(I.trash, 18)} ${t('Delete card')}</button></div>` : ''}
    </div></div>`);
  const tt = $('#cardTitle', sheet), d = $('#cardDesc', sheet), ingr = $('#ingr', sheet);
  [tt, d].forEach((x) => { autoGrow(x); x.addEventListener('input', () => autoGrow(x)); });
  tt.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); item ? d.focus() : save(); } });
  const paintAisle = () => sheet.querySelectorAll('[data-chips="aisle"] button').forEach((b) => b.classList.toggle('on', b.dataset.v === aisle));
  tt.addEventListener('input', () => { if (kind === 'shop' && !aisleTouched) { aisle = guessAisle(tt.value); paintAisle(); } });
  if (!item) setTimeout(() => tt.focus(), 80);

  const paintImage = () => {
    const ec = $('#ec', sheet), box = $('#ecImg', sheet);
    ec.classList.toggle('has-img', !!image);
    box.style.backgroundImage = image ? `url('${image}')` : '';
    box.innerHTML = `<button type="button" class="ec-img-btn" data-a="img">${svg(I.image, 18, 2)}<span>${uploading ? t('Uploading…') : image ? t('Change photo') : t('Add photo')}</span></button>${image && !uploading ? `<button type="button" class="ec-img-x" data-a="img-x" aria-label="${esc(t('Remove photo'))}">${svg(I.x, 16, 2.4)}</button>` : ''}`;
  };

  async function save() {
    const title = tt.value.trim();
    if (!title) { tt.focus(); return; }
    if (uploading) { toast(t('Wait for the photo to finish uploading')); return; }
    const row = { title, description: d.value.trim(), image_url: image };
    if (kind === 'shop') Object.assign(row, { aisle, qty });
    if (kind === 'meal') row.ingredients = (ingr?.value || '').split('\n').map((x) => x.trim()).filter(Boolean);
    if (item) {
      Object.assign(item, row);
      closeSheet(sheet); refresh();
      db.update(k.table, { id: item.id }, row);
      return;
    }
    const full = { id: uuid(), household_id: S.me.household_id, created_by: S.uid, created_at: new Date().toISOString(), ...row };
    if (kind === 'shop') Object.assign(full, direct ? { status: 'cart', last_swiped_at: full.created_at } : { status: 'idle', last_swiped_at: null });
    else full.kind = kind;
    k.list().push(full);
    db.insert(k.table, full);
    added++;
    haptic();
    tt.value = ''; d.value = ''; if (ingr) ingr.value = ''; image = null; qty = 1; aisle = 'other'; aisleTouched = false;
    autoGrow(tt); autoGrow(d); paintImage(); paintAisle();
    if ($('#qtyV', sheet)) $('#qtyV', sheet).textContent = '1';
    $('#ec', sheet).style.background = tempHue();
    $('#addedNote', sheet).textContent = direct ? t('“{title}” is in the cart. Add another or tap Done.', { title })
      : added === 1 ? t('Added “{title}”. Add another or tap Done.', { title }) : t('{n} cards added. Add another or tap Done.', { n: added });
    tt.focus();
    refresh();
  }
  $('#directSw', sheet)?.addEventListener('change', (e) => { direct = e.target.checked; store.set('shop-direct', direct ? '1' : '0'); haptic(); });
  sheet.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-chips="aisle"] button');
    if (chip) { aisle = chip.dataset.v; aisleTouched = true; paintAisle(); haptic(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'cancel') closeSheet(sheet);
    if (a === 'save') save();
    if (a === 'delete') { closeSheet(sheet); deleteCard(item.id); }
    if (a === 'to-cart' && item) {
      const title = tt.value.trim() || item.title;
      Object.assign(item, { title, description: d.value.trim(), image_url: image, aisle, qty, status: 'cart', last_swiped_at: new Date().toISOString() });
      db.update(k.table, { id: item.id }, { title, description: item.description, image_url: image, aisle, qty, status: 'cart', last_swiped_at: item.last_swiped_at });
      closeSheet(sheet); haptic(); refresh();
      toast(t('“{title}” is in the cart', { title }));
    }
    if (a === 'q-' || a === 'q+') { qty = Math.max(1, Math.min(99, qty + (a === 'q+' ? 1 : -1))); $('#qtyV', sheet).textContent = qty; haptic(); }
    if (a === 'img-x') { image = null; paintImage(); }
    if (a === 'img') {
      const f = await pickImage();
      if (!f) return;
      uploading = true; image = URL.createObjectURL(f); paintImage();
      try { image = await uploadImage(f); } catch (err) { image = item?.image_url || null; toast(err.message); }
      uploading = false; paintImage();
    }
  });
}

on('card-new-shop', () => openCard('shop'));
on('card-new-meal', () => openCard('meal'));
on('card-new-date', () => openCard('date'));
on('card-edit', (b) => { const k = kindOfCard(b.dataset.id); if (k) openCard(k, b.dataset.id); });

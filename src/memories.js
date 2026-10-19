// Date memories: after a date, add photos and a few words. They build a timeline on the Dates tab.
import { $, esc, svg, I, S, db, uuid, refresh, toast, haptic, hueOf, notify, on, store, today, ymd, fmtDay, nameOf, pickImages, uploadMany } from './core.js';
import { t, tn, locale } from './i18n.js';
import { openSheet, closeSheet, autoGrow, avatar } from './ui.js';

const sortedMemories = () => [...S.memories].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : new Date(b.created_at) - new Date(a.created_at)));
const fmtLong = (d) => new Date(d + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (d) => new Date(d + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
/* "14 Oct", or "3–5 Oct" / "30 Sept – 2 Oct" for a range */
export function fmtRange(a, b) {
  if (!b || b === a) return fmtShort(a);
  const A = new Date(a + 'T12:00:00'), B = new Date(b + 'T12:00:00');
  if (A.getMonth() === B.getMonth() && A.getFullYear() === B.getFullYear()) {
    return `${A.getDate()}–${B.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}`;
  }
  return `${fmtShort(a)} – ${fmtShort(b)}`;
}

/* past plans (last two weeks) that don't have a memory yet */
function pendingPrompts() {
  const cutoff = Date.now() - 14 * 864e5;
  return S.plans.filter((p) => {
    const at = new Date(p.at).getTime();
    if (at > Date.now() - 2 * 36e5 || at < cutoff) return false;
    if (S.memories.some((m) => m.plan_id === p.id)) return false;
    return !store.get('mem-skip:' + p.id);
  }).sort((a, b) => new Date(b.at) - new Date(a.at));
}

export function memoryPrompts() {
  const p = pendingPrompts()[0];
  if (!p) return '';
  return `<div class="mem-prompt">
    <div class="mem-prompt-ico">${svg(I.image, 22, 2)}</div>
    <div class="row-main"><b>${t('How was {title}?', { title: esc(p.title) })}</b><span>${t('Add a photo so you remember it.')}</span></div>
    <div class="mem-prompt-btns"><button class="btn small" data-a="mem-from-plan" data-id="${p.id}">${t('Add')}</button><button class="text-btn small" data-a="mem-skip" data-id="${p.id}">${t('Not now')}</button></div>
  </div>`;
}

function memCard(m) {
  const cover = m.photos?.[0];
  return `<button class="mem-card" data-key="m:${m.id}" data-a="mem-open" data-id="${m.id}" style="${cover ? `background-image:url('${esc(cover)}')` : `background:${hueOf(m.id)}`}">
    ${m.photos?.length > 1 ? `<span class="mem-count">${svg(I.image, 13, 2.2)} ${m.photos.length}</span>` : ''}
    <span class="mem-cap ${cover ? '' : 'plain'}"><b>${esc(m.title)}</b><span>${esc(fmtRange(m.day, m.day_end))}</span></span>
  </button>`;
}

export function memoriesSection() {
  const list = sortedMemories();
  let html = `<div class="sec"><h2>${t('Memories')}</h2><span class="count">${list.length || ''}</span>${list.length > 3 ? `<button class="link" data-a="mem-all">${t('See all')}</button>` : ''}<button class="link" data-a="mem-new">${t('Add')}</button></div>`;
  if (!list.length) {
    html += `<button class="mem-empty" data-a="mem-new">${svg(I.image, 26, 1.8)}<span><b>${t('Keep your dates')}</b>${t('After a date, add a photo and a line about it. They line up here as your timeline.')}</span></button>`;
    return html;
  }
  html += `<div class="mem-strip">${list.slice(0, 12).map(memCard).join('')}</div>`;
  return html;
}

/* full timeline, grouped by month */
function openTimeline() {
  const list = sortedMemories();
  const groups = [];
  for (const m of list) {
    const key = m.day.slice(0, 7);
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label: new Date(m.day + 'T12:00:00').toLocaleDateString(locale(), { month: 'long', year: 'numeric' }), items: [] }));
    g.items.push(m);
  }
  const sheet = openSheet(`
    <div class="sheet-bar"><span></span><div class="ttl">${t('Memories')}</div><button class="bar-btn primary" data-a="close">${t('Done')}</button></div>
    <div class="sheet-body"><div>
      <p class="hint" style="margin-top:0">${tn(list.length, '{n} date remembered', '{n} dates remembered')}</p>
      ${groups.map((g) => `<div class="sec"><h2>${esc(g.label)}</h2></div><div class="mem-grid">${g.items.map(memCard).join('')}</div>`).join('')}
    </div></div>`);
  sheet.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]');
    if (!a) return;
    if (a.dataset.a === 'close') closeSheet(sheet);
    if (a.dataset.a === 'mem-open') openMemory({ id: a.dataset.id });
  });
}


export function openMemory({ id, plan, pick = false } = {}) {
  const m = id ? S.memories.find((x) => x.id === id) : null;
  const photos = [...(m?.photos || [])];
  let uploading = 0;
  const title0 = m?.title || plan?.title || '';
  const day0 = m?.day || (plan ? ymd(new Date(plan.at)) : today());
  const sheet = openSheet(`
    <div class="sheet-bar">
      <button class="bar-btn plain" data-a="cancel">${t('Cancel')}</button>
      <div class="ttl">${m ? t('Memory') : t('New memory')}</div>
      <button class="bar-btn primary" data-a="save">${t('Save')}</button>
    </div>
    <div class="sheet-body"><div>
      <div class="mem-photos" id="memPhotos"></div>
      <label class="field-label" for="memTitle">${t('What you did')}</label>
      <input class="input" id="memTitle" value="${esc(title0)}" maxlength="80" placeholder="${esc(t('e.g. Sunset at Gediminas tower'))}">
      <div class="two">
        <div><label class="field-label" for="memDay">${t('From')}</label><input class="input" id="memDay" type="date" value="${day0}" max="${today()}"></div>
        <div><label class="field-label" for="memDayEnd">${t('To (optional)')}</label><input class="input" id="memDayEnd" type="date" value="${m?.day_end || ''}" min="${day0}" max="${today()}"></div>
      </div>
      <label class="field-label" for="memNote">${t('A few words (optional)')}</label>
      <textarea class="input" id="memNote" rows="3" maxlength="600" placeholder="${esc(t('The best part was…'))}">${esc(m?.note || '')}</textarea>
      ${m ? `<p class="hint">${avatar(m.created_by, 'xs')} ${t('Added by {name}', { name: esc(nameOf(m.created_by)) })}</p>
        <div style="margin-top:20px;text-align:center"><button class="btn danger" data-a="mem-del">${svg(I.trash, 18)} ${t('Delete memory')}</button></div>` : ''}
    </div></div>`);
  const box = $('#memPhotos', sheet), note = $('#memNote', sheet);
  $('#memDay', sheet).addEventListener('change', (e) => { const end = $('#memDayEnd', sheet); end.min = e.target.value; if (end.value && end.value < e.target.value) end.value = ''; });
  autoGrow(note); note.addEventListener('input', () => autoGrow(note));
  const paint = () => {
    box.innerHTML = photos.map((src, i) => `<div class="mem-ph ${i === 0 ? 'first' : ''}" style="background-image:url('${esc(src)}')"><button type="button" data-rm="${i}" aria-label="${esc(t('Remove photo'))}">${svg(I.x, 14, 2.6)}</button></div>`).join('')
      + Array.from({ length: uploading }, () => '<div class="mem-ph loading"></div>').join('')
      + `<button type="button" class="mem-add ${photos.length || uploading ? '' : 'only'}" data-a="mem-photos">${svg(I.image, 22, 2)}<span>${photos.length ? t('Add more') : t('Add photos')}</span></button>`;
  };
  paint();
  const addPhotos = async () => {
    const files = await pickImages();
    if (!files.length) return;
    uploading += files.length; paint();
    const at = photos.length;
    const got = new Array(files.length);
    await uploadMany(files, (url, k) => { got[k] = url; uploading--; photos.splice(at, photos.length - at, ...got.filter(Boolean)); paint(); });
    haptic();
  };
  if (pick) setTimeout(addPhotos, 450);

  sheet.addEventListener('click', async (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { photos.splice(+rm.dataset.rm, 1); paint(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'cancel') closeSheet(sheet);
    if (a === 'mem-photos') addPhotos();
    if (a === 'mem-del' && m) {
      closeSheet(sheet);
      const copy = { ...m };
      S.memories = S.memories.filter((x) => x.id !== m.id);
      db.del('memories', { id: m.id });
      refresh();
      toast(t('Memory deleted'), { undo: () => { S.memories.push(copy); db.insert('memories', copy); refresh(); } });
    }
    if (a === 'save') {
      if (uploading) { toast(t('Wait for the photos to finish uploading')); return; }
      const title = $('#memTitle', sheet).value.trim();
      if (!title) { toast(t('Give it a name')); $('#memTitle', sheet).focus(); return; }
      const day = $('#memDay', sheet).value || today();
      let dayEnd = $('#memDayEnd', sheet).value || null;
      if (dayEnd && dayEnd < day) { toast(t('The end date is before the start date')); return; }
      if (dayEnd === day) dayEnd = null;
      const row = { title, day, day_end: dayEnd, note: note.value.trim(), photos };
      closeSheet(sheet);
      if (m) { Object.assign(m, row); db.update('memories', { id: m.id }, row); }
      else {
        const full = { id: uuid(), household_id: S.me.household_id, plan_id: plan?.id || null, idea_id: plan?.idea_id || null, created_by: S.uid, created_at: new Date().toISOString(), ...row };
        S.memories.push(full); db.insert('memories', full);
        notify('plan', t('{name} added a memory', { name: S.me.display_name }), title, './#dates');
        haptic();
      }
      refresh();
    }
  });
}

on('mem-new', () => openMemory({ pick: true }));
on('mem-open', (b) => openMemory({ id: b.dataset.id }));
on('mem-all', () => openTimeline());
on('mem-from-plan', (b) => { const p = S.plans.find((x) => x.id === b.dataset.id); if (p) openMemory({ plan: p, pick: true }); });
on('mem-skip', (b) => { store.set('mem-skip:' + b.dataset.id, '1'); refresh(); });

// Notes: list with Notes-app swipes, and a line-based editor for text, checklists, photos and GIFs.
// Stored as plain text so old notes keep working: "[ ] item", "[x] done item", "![](image url)".
import { $, esc, svg, I, S, db, uuid, refresh, toast, haptic, ago, shortWhen, nameOf, notify, uploadImage, pickImages, on, store, raf } from './core.js';
import { t } from './i18n.js';
import { avatar, header, srow, ROWS, openSheet, closeSheet, autoGrow } from './ui.js';

/* ---------------- format ---------------- */
export function parseBody(body = '') {
  return String(body).split('\n').map((l) => {
    let m;
    if ((m = l.match(/^\[( |x)\] ?(.*)$/))) return { k: 'c', done: m[1] === 'x', text: m[2] };
    if ((m = l.match(/^!\[\]\((\S+)\)$/))) return { k: 'i', src: m[1] };
    return { k: 't', text: l };
  });
}
const serialize = (lines) => lines.map((l) => (l.k === 'c' ? `[${l.done ? 'x' : ' '}] ${l.text}` : l.k === 'i' ? `![](${l.src})` : l.text)).join('\n');
export const plainText = (body) => parseBody(body).filter((l) => l.k !== 'i').map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim();

function summary(n) {
  const lines = parseBody(n.body);
  const checks = lines.filter((l) => l.k === 'c');
  const images = lines.filter((l) => l.k === 'i');
  const texts = lines.filter((l) => l.k !== 'i' && l.text.trim());
  const title = n.title || texts[0]?.text || (images.length ? t('Photo') : t('New note'));
  let rest;
  if (checks.length) rest = t('{d} of {n} ticked', { d: checks.filter((c) => c.done).length, n: checks.length });
  else rest = (n.title ? texts : texts.slice(1)).map((l) => l.text).join(' ').trim() || (images.length ? t('Photo') : t('No additional text'));
  return { title, rest, thumb: images[0]?.src };
}

/* ---------------- list ---------------- */
function noteRow(n) {
  const s = summary(n);
  return srow('note', n.id, `
    <button class="srow-fg row" data-a="note-open" data-id="${n.id}">
      <span class="row-main">
        <span class="row-title">${esc(s.title)}</span>
        <span class="row-sub"><b>${esc(shortWhen(n.updated_at))}</b>${esc(s.rest)}</span>
      </span>
      ${s.thumb ? `<span class="thumb" style="background-image:url('${esc(s.thumb)}')"></span>` : avatar(n.updated_by, 'xs')}
    </button>`);
}
ROWS.note = (id) => {
  const n = S.notes.find((x) => x.id === id);
  if (!n) return {};
  return {
    lead: { label: n.pinned ? t('Unpin') : t('Pin'), icon: I.pin, color: 'var(--pin)', run: () => togglePin(n) },
    trail: { label: t('Delete'), icon: I.trash, color: 'var(--warn)', destructive: true, run: () => deleteNote(n) },
  };
};

export function viewNotes(pushBanner) {
  const sorted = [...S.notes].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  const pinned = sorted.filter((n) => n.pinned), rest = sorted.filter((n) => !n.pinned);
  let html = header(t('Notes'), 'note-new') + pushBanner();
  if (!sorted.length) return html + `<div class="group empty"><p>${t('Nothing written yet. Notes you add here show up on both phones.')}</p><button class="btn" data-a="note-new">${t('Write a note')}</button></div>`;
  if (pinned.length) html += `<div class="sec"><h2>${t('Pinned')}</h2><span class="count">${pinned.length}</span></div><div class="group flat">${pinned.map(noteRow).join('')}</div>`;
  if (rest.length) html += `<div class="sec"><h2>${pinned.length ? t('Notes') : t('All notes')}</h2><span class="count">${rest.length}</span></div><div class="group flat">${rest.map(noteRow).join('')}</div>`;
  if (!store.get('swiped')) html += `<p class="hint">${t('Swipe a note left to delete it, or right to pin it.')}</p>`;
  return html;
}

function togglePin(n) {
  n.pinned = !n.pinned;
  db.update('notes', { id: n.id }, { pinned: n.pinned });
  refresh();
}
export function deleteNote(n) {
  const copy = { ...n };
  S.notes = S.notes.filter((x) => x.id !== n.id);
  db.del('notes', { id: n.id });
  refresh();
  toast(t('Note deleted'), { undo: () => { S.notes.push(copy); db.insert('notes', copy); refresh(); } });
}

/* ---------------- editor ---------------- */
const PLAIN = (() => { const d = document.createElement('div'); d.contentEditable = 'plaintext-only'; return d.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true'; })();

function lineEl(l) {
  const d = document.createElement('div');
  d.className = 'ln' + (l.k === 'c' ? ' chk' : l.k === 'i' ? ' img' : '');
  d.dataset.k = l.k;
  if (l.k === 'i') {
    d.dataset.src = l.src || '';
    d.innerHTML = `<img alt="" ${l.src ? `src="${esc(l.src)}"` : ''}><button type="button" class="img-x" data-x aria-label="${esc(t('Remove image'))}">${svg(I.x, 16, 2.4)}</button>`;
    if (l.uploading) d.classList.add('uploading');
    return d;
  }
  if (l.k === 'c') {
    d.innerHTML = `<button type="button" class="cb ${l.done ? 'on' : ''}" aria-label="${esc(t('Tick'))}" aria-pressed="${!!l.done}">${svg(I.tick, 14, 3)}</button>`;
    if (l.done) d.classList.add('done');
  }
  const ed = document.createElement('div');
  ed.className = 'lt';
  ed.contentEditable = PLAIN;
  ed.spellcheck = true;
  ed.dataset.ph = l.k === 'c' ? t('List item') : '';
  ed.textContent = l.text || '';
  d.appendChild(ed);
  return d;
}
function readLines(box) {
  return [...box.children].map((d) => {
    if (d.dataset.k === 'i') return d.dataset.src ? { k: 'i', src: d.dataset.src } : null;
    const text = d.querySelector('.lt').textContent.replace(/\n/g, ' ');
    return d.dataset.k === 'c' ? { k: 'c', done: d.classList.contains('done'), text } : { k: 't', text };
  }).filter(Boolean);
}
function caret(el) {
  const s = getSelection();
  if (!s.rangeCount || !el.contains(s.anchorNode)) return el.textContent.length;
  const r = s.getRangeAt(0), pre = r.cloneRange();
  pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length;
}
function setCaret(el, off) {
  el.focus({ preventScroll: true });
  const s = getSelection(), r = document.createRange();
  const node = el.firstChild;
  if (node && node.nodeType === 3) r.setStart(node, Math.min(off, node.textContent.length)); else r.setStart(el, 0);
  r.collapse(true); s.removeAllRanges(); s.addRange(r);
  el.closest('.ln')?.scrollIntoView({ block: 'nearest' });
}
/* switch a line between text and checklist in place, so focus and the keyboard stay put */
function convert(ln, k) {
  ln.dataset.k = k;
  ln.classList.toggle('chk', k === 'c');
  ln.classList.remove('done');
  const cb = ln.querySelector('.cb');
  if (k === 'c' && !cb) ln.insertAdjacentHTML('afterbegin', `<button type="button" class="cb" aria-label="${esc(t('Tick'))}" aria-pressed="false">${svg(I.tick, 14, 3)}</button>`);
  if (k !== 'c' && cb) cb.remove();
  const lt = ln.querySelector('.lt');
  if (lt) lt.dataset.ph = k === 'c' ? t('List item') : '';
  return ln;
}

export function openNote(id) {
  let note = id ? S.notes.find((n) => n.id === id) : null;
  let changed = false, saveTimer, finished = false, lastLine = null;
  const sheet = openSheet(`
    <div class="sheet-bar">
      <div class="bar-group ${note ? '' : 'off'}" id="noteTools">
        <button class="bar-btn icon danger" data-a="del" aria-label="${esc(t('Delete note'))}">${svg(I.trash, 20, 2)}</button>
        <button class="bar-btn icon pin ${note?.pinned ? 'on' : ''}" data-a="pin" aria-label="${esc(t('Pin note'))}" aria-pressed="${!!note?.pinned}">${svg(I.pin, 20, 2)}</button>
      </div>
      <div class="ttl"></div>
      <button class="bar-btn primary" data-a="done">${t('Done')}</button>
    </div>
    <div class="note-tools">
      <button class="tool" data-a="tool-check">${svg(I.list, 18, 2)}<span>${t('Checklist')}</span></button>
      <button class="tool" data-a="tool-image">${svg(I.image, 18, 2)}<span>${t('Photo or GIF')}</span></button>
    </div>
    <div class="sheet-body"><div>
      <div class="note-foot">${note ? `${avatar(note.updated_by, 'xs')} ${t('Edited {when} by {who}', { when: ago(note.updated_at), who: esc(nameOf(note.updated_by)) })}` : ''}</div>
      <textarea class="note-title" id="noteTitle" rows="1" placeholder="${esc(t('Title'))}">${esc(note?.title)}</textarea>
      <div class="note-lines" id="noteLines"></div>
      <div class="note-tail" data-a="tail"></div>
    </div></div>`, { onDismiss: () => finish() });
  const title = $('#noteTitle', sheet), box = $('#noteLines', sheet);
  const lines = note ? parseBody(note.body) : [{ k: 't', text: '' }];
  if (!lines.length) lines.push({ k: 't', text: '' });
  lines.forEach((l) => box.appendChild(lineEl(l)));
  autoGrow(title);

  const save = () => {
    const body = serialize(readLines(box)).replace(/\n+$/, '');
    const ttl = title.value.trim();
    if (!note && !ttl && !body.trim()) return;
    const patch = { title: ttl, body, updated_by: S.uid, updated_at: new Date().toISOString() };
    if (!note) {
      note = { id: uuid(), household_id: S.me.household_id, pinned: false, created_at: patch.updated_at, ...patch };
      S.notes.unshift(note);
      db.insert('notes', note);
      $('#noteTools', sheet).classList.remove('off');
    } else {
      Object.assign(note, patch);
      db.update('notes', { id: note.id }, patch);
    }
  };
  const touched = () => { changed = true; clearTimeout(saveTimer); saveTimer = setTimeout(save, 700); };
  title.addEventListener('input', () => { autoGrow(title); touched(); });
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const f = box.querySelector('.lt'); if (f) setCaret(f, 0); } });

  box.addEventListener('focusin', (e) => { const ln = e.target.closest('.ln'); if (ln) lastLine = ln; });
  box.addEventListener('input', (e) => {
    const ed = e.target.closest('.lt');
    if (!ed) return;
    if (ed.innerHTML === '<br>') ed.innerHTML = '';
    const ln = ed.closest('.ln');
    const m = ln.dataset.k === 't' && ed.textContent.match(/^(?:- |\* |\[\] ?|☐ ?)(.*)$/s);
    if (m) { const n = convert(ln, 'c'); const nt = n.querySelector('.lt'); nt.textContent = m[1]; setCaret(nt, m[1].length); haptic(); }
    touched();
  });
  box.addEventListener('keydown', (e) => {
    const ed = e.target.closest('.lt');
    if (!ed || e.isComposing) return;
    const ln = ed.closest('.ln');
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = ed.textContent, off = caret(ed);
      if (ln.dataset.k === 'c' && !text.trim()) { const n = convert(ln, 't'); setCaret(n.querySelector('.lt'), 0); touched(); return; }
      ed.textContent = text.slice(0, off);
      const n = lineEl({ k: ln.dataset.k === 'c' ? 'c' : 't', text: text.slice(off) });
      ln.after(n);
      setCaret(n.querySelector('.lt'), 0);
      touched();
    } else if (e.key === 'Backspace') {
      const s = getSelection();
      if (!s.isCollapsed || caret(ed) !== 0) return;
      if (ln.dataset.k === 'c') { e.preventDefault(); const n = convert(ln, 't'); setCaret(n.querySelector('.lt'), 0); touched(); return; }
      const prev = ln.previousElementSibling;
      if (!prev) return;
      e.preventDefault();
      if (prev.dataset.k === 'i') { prev.remove(); touched(); return; }
      const pt = prev.querySelector('.lt'), len = pt.textContent.length;
      pt.textContent += ed.textContent;
      ln.remove();
      setCaret(pt, len);
      touched();
    }
  });
  box.addEventListener('paste', async (e) => {
    const ed = e.target.closest('.lt');
    if (!ed) return;
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    e.preventDefault();
    if (file) { addImage(file, ed.closest('.ln')); return; }
    const text = (e.clipboardData?.getData('text/plain') || '').replace(/\r/g, '');
    if (!text) return;
    const ln = ed.closest('.ln'), off = caret(ed), cur = ed.textContent;
    const parts = text.split('\n');
    if (parts.length === 1) { ed.textContent = cur.slice(0, off) + text + cur.slice(off); setCaret(ed, off + text.length); touched(); return; }
    ed.textContent = cur.slice(0, off) + parts[0];
    let after = ln;
    parts.slice(1).forEach((p, i) => {
      const last = i === parts.length - 2;
      const m = p.match(/^(?:- |\* |\[ ?\] ?)(.*)$/);
      const n = lineEl({ k: m ? 'c' : 't', text: (m ? m[1] : p) + (last ? cur.slice(off) : '') });
      after.after(n); after = n;
    });
    const lt = after.querySelector('.lt');
    setCaret(lt, lt.textContent.length - cur.slice(off).length);
    touched();
  });
  box.addEventListener('click', (e) => {
    const cb = e.target.closest('.cb');
    if (cb) {
      const ln = cb.closest('.ln');
      const on_ = !ln.classList.contains('done');
      ln.classList.toggle('done', on_); cb.classList.toggle('on', on_); cb.setAttribute('aria-pressed', String(on_));
      haptic(); touched();
      return;
    }
    if (e.target.closest('[data-x]')) {
      const ln = e.target.closest('.ln');
      ln.classList.add('leaving');
      setTimeout(() => { ln.remove(); touched(); }, 220);
    }
  });

  function addImage(file, afterLine) {
    if (!file) return afterLine;
    const ph = lineEl({ k: 'i', uploading: true });
    const local = URL.createObjectURL(file);
    ph.querySelector('img').src = local;
    const anchor = afterLine && box.contains(afterLine) ? afterLine : box.lastElementChild;
    anchor ? anchor.after(ph) : box.appendChild(ph);
    if (!ph.nextElementSibling) ph.after(lineEl({ k: 't', text: '' }));
    uploadImage(file).then((url) => {
      ph.dataset.src = url;
      ph.classList.remove('uploading');
      const img = ph.querySelector('img');
      const real = new Image();
      real.onload = () => { img.src = url; URL.revokeObjectURL(local); };
      real.src = url;
      touched();
    }).catch((err) => { ph.remove(); URL.revokeObjectURL(local); toast(err.message); });
    return ph;
  }

  if (!note) setTimeout(() => title.focus(), 80);

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(saveTimer);
    closeSheet(sheet);
    if (changed) save();
    if (changed && note) {
      if (!note.title && !note.body.trim()) { deleteNote(note); return; }
      notify('note', t('{name} updated a note', { name: S.me.display_name }), summary(note).title, './#notes');
    }
    refresh();
  }
  sheet.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'done') finish();
    if (a === 'tail') { const l = box.lastElementChild; if (l?.dataset.k === 'i' || !l) { const n = lineEl({ k: 't', text: '' }); box.appendChild(n); setCaret(n.querySelector('.lt'), 0); } else { const lt = l.querySelector('.lt'); setCaret(lt, lt.textContent.length); } }
    if (a === 'tool-check') {
      let ln = lastLine && box.contains(lastLine) ? lastLine : null;
      if (!ln || ln.dataset.k === 'i') { ln = lineEl({ k: 'c', text: '' }); box.appendChild(ln); }
      else ln = convert(ln, ln.dataset.k === 'c' ? 't' : 'c');
      const lt = ln.querySelector('.lt'); setCaret(lt, lt.textContent.length);
      haptic(); touched();
    }
    if (a === 'tool-image') {
      const files = await pickImages();
      let after = lastLine && box.contains(lastLine) ? lastLine : null;
      for (const f of files) after = addImage(f, after);
    }
    if (a === 'pin' && note) {
      note.pinned = !note.pinned;
      const pb = e.target.closest('button');
      pb.classList.toggle('on', note.pinned); pb.setAttribute('aria-pressed', String(note.pinned));
      haptic();
      db.update('notes', { id: note.id }, { pinned: note.pinned });
    }
    if (a === 'del' && note) { finished = true; clearTimeout(saveTimer); closeSheet(sheet); deleteNote(note); }
  });
  raf(() => {});
}

on('note-new', () => openNote(null));
on('note-open', (b) => openNote(b.dataset.id));

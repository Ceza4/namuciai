// Reusable interface pieces: avatars, headers, page sheets, swipe rows and the card deck.
import { $, esc, svg, I, S, member, partner, hueOf, raf, haptic, holdOn, holdOff, reduceMotion, refresh } from './core.js';
import { t } from './i18n.js';

export function avatar(uid, size = '') {
  const m = member(uid);
  if (!m) return `<span class="avatar anyone ${size}">${svg(I.home, size === 'xs' ? 11 : 13, 2.2)}</span>`;
  return `<span class="avatar ${m.color === 'rose' ? 'rose' : ''} ${size}">${esc((m.display_name || '?').trim()[0]?.toUpperCase() || '?')}</span>`;
}

export function header(title, addAction, extra = '') {
  return `<header class="lt">
    <h1>${title}</h1>
    ${extra}
    ${partner() ? `<button class="circle-btn love-btn" data-a="love-new" aria-label="${esc(t('Send a love note'))}">${svg(I.heart, 21, 2.2)}</button>` : ''}
    ${addAction ? `<button class="circle-btn tint" data-a="${addAction}" aria-label="${esc(t('Add'))}">${svg(I.plus, 22, 2.3)}</button>` : ''}
    <button class="press" data-a="settings" aria-label="${esc(t('Settings'))}" style="border-radius:50%">${avatar(S.uid)}</button>
  </header>`;
}

/* stacked preview of the next cards in a deck */
export function miniStack(items) {
  const top = items.slice(0, 3);
  return `<span class="mini-stack">${[2, 1, 0].map((i) => {
    const it = top[i];
    const img = i === 0 && it?.image_url ? ` style="background:${hueOf(it.id)} url('${esc(it.image_url)}') center/cover"` : ` style="background:${it ? hueOf(it.id) : `var(--h${(i + 2) % 6})`}"`;
    return `<i${img}>${i === 0 && it && !it.image_url ? esc(it.title) : ''}</i>`;
  }).join('')}</span>`;
}

export function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }

/* ================================================================== */
/* page sheets: drag the top bar down to close                         */
/* ================================================================== */
export function openSheet(html, { onDismiss } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="scrim"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
  $('#layer').appendChild(wrap);
  const sheet = wrap.querySelector('.sheet'), scrim = wrap.querySelector('.scrim');
  sheet._wrap = wrap;
  const dismiss = onDismiss || (() => closeSheet(sheet));
  raf(() => raf(() => wrap.classList.add('in')));
  scrim.addEventListener('click', dismiss);
  let d = null, frame = 0;
  const bar = sheet.querySelector('.sheet-bar');
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    d = { y0: e.clientY, dy: 0, h: sheet.offsetHeight, ly: e.clientY, lt: performance.now(), v: 0, id: e.pointerId };
    try { bar.setPointerCapture(e.pointerId); } catch {}
    sheet.classList.add('drag'); scrim.classList.add('drag');
  });
  bar.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.id) return;
    const tm = performance.now();
    d.v = (e.clientY - d.ly) / Math.max(1, tm - d.lt); d.ly = e.clientY; d.lt = tm;
    const dy = e.clientY - d.y0;
    d.dy = dy > 0 ? dy : -Math.sqrt(-dy) * 2;
    if (!frame) frame = raf(() => {
      frame = 0;
      if (!d) return;
      sheet.style.transform = `translate3d(0,${d.dy}px,0)`;
      scrim.style.opacity = String(Math.max(0, 1 - d.dy / d.h));
    });
  });
  const up = (e) => {
    if (!d || e.pointerId !== d.id) return;
    const dd = d; d = null;
    cancelAnimationFrame(frame); frame = 0;
    sheet.classList.remove('drag'); scrim.classList.remove('drag');
    scrim.style.opacity = ''; sheet.style.transform = '';
    if (dd.dy > dd.h * 0.22 || (dd.v > 0.55 && dd.dy > 40)) dismiss();
  };
  bar.addEventListener('pointerup', up);
  bar.addEventListener('pointercancel', up);
  return sheet;
}
export function closeSheet(sheet) {
  const wrap = sheet._wrap;
  if (!wrap || wrap._closing) return;
  wrap._closing = true;
  document.activeElement?.blur?.();
  wrap.classList.remove('in');
  setTimeout(() => wrap.remove(), 460);
}

/* ================================================================== */
/* swipeable rows (Notes app style)                                    */
/* ================================================================== */
export const ROWS = {};   // kind -> (id) => { lead?, trail? }

export function srow(kind, id, inner) {
  const a = ROWS[kind]?.(id) || {};
  return `<div class="srow" data-kind="${kind}" data-id="${id}" style="${a.lead ? `--lead:${a.lead.color};` : ''}${a.trail ? `--trail:${a.trail.color}` : ''}">
    ${a.lead ? `<div class="srow-act lead" data-side="lead"><span>${svg(a.lead.icon, 20, 2.3)}${esc(a.lead.label)}</span></div>` : ''}
    ${a.trail ? `<div class="srow-act trail" data-side="trail"><span>${svg(a.trail.icon, 20, 2.3)}${esc(a.trail.label)}</span></div>` : ''}
    ${inner}
  </div>`;
}

export function collapse(row, done) {
  holdOn();
  row.style.height = row.offsetHeight + 'px';
  void row.offsetHeight;
  row.classList.add('collapsing');
  row.style.height = '0px';
  row.style.opacity = '0';
  setTimeout(() => { done?.(); holdOff(); }, 270);
}

export function initSwipeRows(container) {
  const REVEAL = 92;
  let g = null, open = null, swallow = false, frame = 0;
  const rubber = (x) => 46 * Math.log1p(x / 46);
  const paint = (row, fg, off, w) => {
    fg.style.transform = `translate3d(${off}px,0,0)`;
    const lead = row.querySelector('.srow-act.lead'), trail = row.querySelector('.srow-act.trail');
    if (lead) lead.style.opacity = off > 0 ? 1 : 0;
    if (trail) trail.style.opacity = off < 0 ? 1 : 0;
    const armed = Math.abs(off) > w * 0.52;
    if (trail) trail.firstElementChild.style.transform = off < 0 && (armed || -off > REVEAL) ? `translate3d(${off + REVEAL}px,0,0)` : 'none';
    if (lead) lead.firstElementChild.style.transform = off > 0 && (armed || off > REVEAL) ? `translate3d(${off - REVEAL}px,0,0)` : 'none';
    return armed;
  };
  const snap = (row, fg, off, done) => {
    fg.classList.add('snap');
    paint(row, fg, off, row.offsetWidth);
    setTimeout(() => { fg.classList.remove('snap'); if (off === 0) row.querySelectorAll('.srow-act').forEach((a) => (a.style.opacity = 0)); done?.(); }, 330);
  };
  const closeOpen = () => { if (!open) return; const o = open; open = null; snap(o.row, o.fg, 0, holdOff); };
  const commit = (row, fg, side, act) => {
    haptic();
    open = null;
    const w = row.offsetWidth;
    if (act.destructive) {
      fg.classList.add('snap');
      fg.style.transform = `translate3d(${side === 'trail' ? -w : w}px,0,0)`;
      const lbl = row.querySelector(`.srow-act.${side} span`);
      if (lbl) lbl.style.transform = `translate3d(${side === 'trail' ? -(w - REVEAL) : w - REVEAL}px,0,0)`;
      setTimeout(() => collapse(row, () => { act.run(); holdOff(); }), 230);
    } else snap(row, fg, 0, () => { act.run(); holdOff(); });
  };
  container.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    swallow = false;
    const act = e.target.closest('.srow-act');
    if (act && open && act.parentElement === open.row) return;
    const fg = e.target.closest('.srow-fg');
    if (open && (!fg || fg !== open.fg)) { closeOpen(); swallow = !!fg; return; }
    if (!fg || e.target.closest('.no-swipe')) return;
    const row = fg.parentElement;
    const base = open?.fg === fg ? open.off : 0;
    g = { row, fg, acts: ROWS[row.dataset.kind]?.(row.dataset.id) || {}, x0: e.clientX, y0: e.clientY, id: e.pointerId, base, off: base, axis: null, armed: false, w: row.offsetWidth, lx: e.clientX, lt: performance.now(), v: 0, wasOpen: !!base };
  });
  container.addEventListener('pointermove', (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.axis) {
      if (Math.abs(dx) < 9 && Math.abs(dy) < 9) return;
      g.axis = Math.abs(dx) > Math.abs(dy) * 1.1 ? 'x' : 'y';
      if (g.axis === 'y') { g = null; return; }
      try { g.fg.setPointerCapture(e.pointerId); } catch {}
      g.fg.classList.remove('snap');
      if (!g.wasOpen) holdOn();
      open = null;
    }
    const tm = performance.now();
    g.v = (e.clientX - g.lx) / Math.max(1, tm - g.lt); g.lx = e.clientX; g.lt = tm;
    let off = g.base + dx;
    if (off > 0 && !g.acts.lead) off = rubber(off) * 0.4;
    if (off < 0 && !g.acts.trail) off = -rubber(-off) * 0.4;
    g.off = off;
    if (!frame) frame = raf(() => {
      frame = 0;
      if (!g) return;
      const armed = paint(g.row, g.fg, g.off, g.w) && !!g.acts[g.off < 0 ? 'trail' : 'lead'];
      if (armed !== g.armed) { g.armed = armed; haptic(); }
    });
  });
  const end = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const gg = g; g = null;
    if (!gg.axis) return;
    swallow = true;
    setTimeout(() => { swallow = false; }, 400);
    cancelAnimationFrame(frame); frame = 0;
    const off = gg.off, side = off < 0 ? 'trail' : 'lead', act = gg.acts[side];
    const fling = Math.abs(gg.v) > 0.8 && Math.sign(gg.v) === Math.sign(off) && Math.abs(off) > 70;
    if (act && (Math.abs(off) > gg.w * 0.52 || fling)) commit(gg.row, gg.fg, side, act);
    else if (act && Math.abs(off) > 44) {
      const to = side === 'trail' ? -REVEAL : REVEAL;
      open = { row: gg.row, fg: gg.fg, off: to };
      snap(gg.row, gg.fg, to);
      try { localStorage.setItem('swiped', '1'); } catch {}
    } else snap(gg.row, gg.fg, 0, holdOff);
  };
  container.addEventListener('pointerup', end);
  container.addEventListener('pointercancel', end);
  container.addEventListener('click', (e) => {
    if (swallow) { e.stopPropagation(); e.preventDefault(); swallow = false; return; }
    const act = e.target.closest('.srow-act');
    if (act && open && act.parentElement === open.row) {
      e.stopPropagation();
      const a = ROWS[open.row.dataset.kind]?.(open.row.dataset.id)?.[act.dataset.side];
      if (a) commit(open.row, open.fg, act.dataset.side, a);
    }
  }, true);
  container.addEventListener('scroll', () => { if (open) closeOpen(); }, { passive: true });
  S.resetRows = () => { if (open) { open = null; holdOff(); } };
}

/* ================================================================== */
/* the swipe deck                                                      */
/* ================================================================== */
export function openDeck(o) {
  const items = [...o.items];
  const total = items.length;
  let idx = 0;
  const past = [];
  holdOn();
  const el = document.createElement('div');
  el.className = 'deck';
  el.innerHTML = `
    <div class="deck-top">
      <div class="side"><button class="circle-btn" data-a="undo" aria-label="${esc(t('Undo last swipe'))}" disabled style="opacity:.35">${svg(I.undo, 20)}</button></div>
      <div class="ttl"><b>${esc(o.title)}</b><span id="deckCount"></span></div>
      <div class="side end"><button class="circle-btn" data-a="close" aria-label="${esc(t('Close'))}">${svg(I.x, 20, 2.2)}</button></div>
    </div>
    <div class="stack" id="stack"></div>
    <div class="deck-controls" id="deckCtl">
      <button class="deck-btn no" data-a="left"><span class="ring">${svg(o.left.icon, 30, 2.4)}</span>${esc(o.left.label)}</button>
      <button class="deck-btn yes" data-a="right"><span class="ring">${svg(o.right.icon, 30, 2.4)}</span>${esc(o.right.label)}</button>
    </div>`;
  $('#layer').appendChild(el);
  const stack = $('#stack', el);
  const api = { close };
  let busy = false;
  const live = () => [...stack.querySelectorAll('.card:not(.gone)')];
  const topCard = () => live().pop();
  const restTf = (d) => `translate3d(0,${d * 26}px,0) scale(${1 - d * 0.05})`;

  function cardEl(item) {
    const c = document.createElement('div');
    c.className = 'card' + (item.image_url ? ' has-img' : '');
    c.style.background = hueOf(item.id);
    c.innerHTML = `${item.image_url ? `<div class="card-img" style="background-image:url('${esc(item.image_url)}')"></div>` : ''}<span class="stamp yes">${esc(o.stampYes)}</span><span class="stamp no">${esc(o.stampNo)}</span>${o.card(item)}`;
    c._item = item;
    o.mount?.(c, item);
    return c;
  }
  function layout(intro = false) {
    const cards = live();
    cards.forEach((c, i) => {
      const d = cards.length - 1 - i;
      c.style.zIndex = 10 - d;
      c.classList.toggle('top', d === 0);
      c.style.pointerEvents = d === 0 ? 'auto' : 'none';
      if (intro && !reduceMotion()) {
        c.style.transition = 'none';
        c.style.transform = `translate3d(0,110vh,0) rotate(${(d % 2 ? -1 : 1) * (8 + d * 4)}deg)`;
        void c.offsetWidth;
        c.style.transition = '';
        setTimeout(() => { c.style.transform = restTf(d); }, 40 + (2 - d) * 85);
      } else c.style.transform = restTf(d);
    });
  }
  function fill(intro) {
    let n = live().length;
    const add = [];
    while (n < 3 && idx + n < items.length) { add.push(cardEl(items[idx + n])); n++; }
    add.forEach((c) => stack.prepend(c));
    layout(intro);
    const top = topCard();
    if (top) attachDrag(top);
    $('#deckCount', el).textContent = total && top ? t('{i} of {n}', { i: idx + 1, n: total }) : '';
    if (!top) showEnd();
    else { $('#deckCtl', el).style.visibility = ''; stack.querySelector('.deck-end')?.remove(); }
  }
  function showEnd() {
    const e = o.end();
    $('#deckCtl', el).style.visibility = 'hidden';
    stack.insertAdjacentHTML('beforeend', `<div class="deck-end"><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p><button class="btn" data-a="close" style="min-width:160px">${esc(t('Done'))}</button></div>`);
  }
  function stamps(c, dx) {
    const v = Math.min(1, Math.abs(dx) / 90);
    c.querySelector('.stamp.yes').style.opacity = dx > 0 ? v : 0;
    c.querySelector('.stamp.no').style.opacity = dx < 0 ? v : 0;
  }
  function attachDrag(c) {
    let sx = 0, sy = 0, dx = 0, dy = 0, down = false, frame = 0, lx = 0, lt = 0, v = 0, armed = false;
    const under = () => live().slice(-2, -1)[0];
    const paint = () => {
      frame = 0;
      c.style.transform = `translate3d(${dx}px,${dy * 0.35}px,0) rotate(${dx / 16}deg)`;
      stamps(c, dx);
      const u = under();
      if (u) { const p = Math.min(1, Math.abs(dx) / 140); u.style.transform = `translate3d(0,${26 - 26 * p}px,0) scale(${0.95 + 0.05 * p})`; }
      const a = Math.abs(dx) > 110;
      if (a !== armed) { armed = a; if (a) haptic(); }
    };
    c.onpointerdown = (e) => {
      if (busy || e.target.closest('.no-drag')) return;
      down = true; sx = lx = e.clientX; sy = e.clientY; lt = performance.now(); dx = dy = v = 0; armed = false;
      c.classList.add('drag');
      const u = under(); if (u) u.classList.add('drag');
      try { c.setPointerCapture(e.pointerId); } catch {}
    };
    c.onpointermove = (e) => {
      if (!down) return;
      const tm = performance.now();
      v = (e.clientX - lx) / Math.max(1, tm - lt); lx = e.clientX; lt = tm;
      dx = e.clientX - sx; dy = e.clientY - sy;
      if (!frame) frame = raf(paint);
    };
    const up = () => {
      if (!down) return;
      down = false;
      cancelAnimationFrame(frame); frame = 0;
      c.classList.remove('drag');
      const u = under(); if (u) u.classList.remove('drag');
      if (Math.abs(dx) > 110 || (Math.abs(v) > 0.55 && Math.abs(dx) > 40 && Math.sign(v) === Math.sign(dx))) swipe(dx > 0 ? 'right' : 'left', dy, v);
      else { c.style.transform = restTf(0); stamps(c, 0); if (u) u.style.transform = restTf(1); }
    };
    c.onpointerup = up;
    c.onpointercancel = up;
  }
  function swipe(dir, dy = 0, v = 0) {
    const c = topCard();
    if (!c || busy) return;
    busy = true;
    if (Math.abs(v) < 0.3) haptic();
    c.classList.add('gone'); c.classList.remove('top');
    c.style.pointerEvents = 'none';
    stamps(c, dir === 'right' ? 120 : -120);
    const w = Math.max(innerWidth, 500) + 260;
    const speed = Math.min(0.42, Math.max(0.24, 0.42 - Math.abs(v) * 0.08));
    c.style.transition = `transform ${speed}s cubic-bezier(.3,.6,.4,1), opacity ${speed}s`;
    c.style.transform = `translate3d(${dir === 'right' ? w : -w}px,${dy * 0.35 + 50}px,0) rotate(${dir === 'right' ? 26 : -26}deg)`;
    const item = c._item;
    idx++;
    fill(false);
    setTimeout(() => c.remove(), speed * 1000 + 40);
    const undo = o.onSwipe(item, dir, api, c);
    past.push({ item, undo });
    const ub = $('[data-a="undo"]', el); ub.disabled = false; ub.style.opacity = '';
    setTimeout(() => { busy = false; }, 140);
  }
  function undoLast() {
    const h = past.pop();
    if (!h || busy) return;
    h.undo?.();
    idx--;
    stack.querySelector('.deck-end')?.remove();
    const cards = live();
    if (cards.length >= 3) cards[0].remove();
    const c = cardEl(h.item);
    stack.appendChild(c);
    c.style.transition = 'none';
    c.style.transform = 'translate3d(-130%,40px,0) rotate(-22deg)';
    void c.offsetWidth;
    c.style.transition = '';
    fill(false);
    if (!past.length) { const ub = $('[data-a="undo"]', el); ub.disabled = true; ub.style.opacity = '.35'; }
  }
  function close() {
    if (el._closing) return;
    el._closing = true;
    el.classList.remove('in');
    setTimeout(() => el.remove(), 240);
    holdOff();
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
  raf(() => { el.classList.add('in'); fill(true); });
  return api;
}

/* a small chip picker (aisles etc.) */
export function chips(name, options, value) {
  return `<div class="chips" data-chips="${name}">${options.map(([v, l]) => `<button type="button" data-v="${esc(v)}" class="${v === value ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
}

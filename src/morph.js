// Update the view in place instead of replacing it, then glide rows that moved (FLIP)
// and fade in rows that are new. Keeps images, scroll and press states steady when
// something changes (a partner's edit, ticking an item, adding a card).

const keyOf = (el) => {
  if (el.nodeType !== 1) return null;
  const k = el.getAttribute('data-key');
  if (k) return k;
  if (el.classList.contains('srow')) return 's:' + el.dataset.kind + ':' + el.dataset.id;
  return null;
};

function syncAttrs(from, to) {
  for (const { name } of [...from.attributes]) if (!to.hasAttribute(name)) from.removeAttribute(name);
  for (const { name, value } of [...to.attributes]) if (from.getAttribute(name) !== value) from.setAttribute(name, value);
}

function patch(from, to) {
  if (from.nodeType === 3 || from.nodeType === 8) { if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue; return; }
  syncAttrs(from, to);
  if (from.tagName === 'INPUT' || from.tagName === 'TEXTAREA' || from.isContentEditable) return;
  patchChildren(from, to);
}

const same = (a, b) => a.nodeType === b.nodeType && (a.nodeType !== 1 || (a.tagName === b.tagName && keyOf(a) === keyOf(b)));

function patchChildren(parent, next) {
  const keyed = new Map();
  for (const c of parent.childNodes) { const k = keyOf(c); if (k) keyed.set(k, c); }
  let cur = parent.firstChild;
  for (const want of [...next.childNodes]) {
    const k = keyOf(want);
    let use = null;
    if (k) use = keyed.get(k) || null;
    else if (cur && !keyOf(cur) && same(cur, want)) use = cur;
    if (use) {
      keyed.delete(k);
      if (use !== cur) parent.insertBefore(use, cur);
      else cur = cur.nextSibling;
      patch(use, want);
    } else {
      parent.insertBefore(want, cur);
      if (want.nodeType === 1 && keyOf(want)) want._fresh = true;
      else if (want.nodeType === 1) want.querySelectorAll?.('.srow,[data-key]').forEach((x) => (x._fresh = true));
    }
  }
  while (cur) { const n = cur.nextSibling; cur.remove(); cur = n; }
}

export function morph(el, html, { animate = true } = {}) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  // where keyed rows were before
  const before = new Map();
  const vh = innerHeight;
  if (animate) for (const n of el.querySelectorAll('.srow,[data-key]')) {
    const r = n.getBoundingClientRect();
    if (r.bottom > -40 && r.top < vh + 40) before.set(n, r.top);
  }
  patchChildren(el, tpl.content);
  if (!animate) return;
  const moved = [];
  for (const n of el.querySelectorAll('.srow,[data-key]')) {
    if (n._fresh) {
      n._fresh = false;
      const r = n.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) { n.classList.remove('pop-in'); void n.offsetWidth; n.classList.add('pop-in'); n.addEventListener('animationend', () => n.classList.remove('pop-in'), { once: true }); }
      continue;
    }
    if (!before.has(n)) continue;
    const dy = before.get(n) - n.getBoundingClientRect().top;
    if (Math.abs(dy) > 1 && Math.abs(dy) < vh) moved.push([n, dy]);
  }
  if (!moved.length || !Element.prototype.animate) return;
  const ease = getComputedStyle(document.documentElement).getPropertyValue('--spring').trim() || 'ease-out';
  for (const [n, dy] of moved) {
    // only animate the outermost moved element (children move with it)
    if (moved.some(([p]) => p !== n && p.contains(n))) continue;
    try { n.animate([{ transform: `translate3d(0,${dy}px,0)` }, { transform: 'none' }], { duration: 520, easing: ease }); }
    catch { n.animate([{ transform: `translate3d(0,${dy}px,0)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)' }); }
  }
}

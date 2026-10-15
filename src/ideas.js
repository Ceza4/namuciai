// Dinner and date ideas: blind swiping, a random pick from shared yeses, history, packs,
// ingredients to the cart, and planning a date with reminders.
import { $, esc, svg, I, S, db, sb, q, uuid, refresh, toast, haptic, hueOf, partner, notify, on, store, raf, today, ymd, daysBetween, fmtDay, fmtTime, addDays } from './core.js';
import { t, tn, lang, locale } from './i18n.js';
import { header, srow, ROWS, miniStack, openDeck, openSheet, closeSheet, avatar } from './ui.js';
import { openCard } from './cards.js';
import { addToCart } from './shop.js';
import { PACKS } from './packs.js';

export const mealRound = () => 'm' + today();
export const dateRound = () => 'd' + (S.household?.date_round ?? 1);
export const roundFor = (kind) => (kind === 'meal' ? mealRound() : dateRound());
const votesIn = (kind) => { const r = roundFor(kind); return S.votes.filter((v) => v.round === r); };

/* Nobody sees the other's swipes. When both have swiped everything, one idea you both
   said yes to is picked at random, derived from the round so both phones agree. */
export function roundState(kind) {
  const ideas = S.ideas.filter((i) => i.kind === kind);
  const ids = new Set(ideas.map((i) => i.id));
  const vs = votesIn(kind).filter((v) => ids.has(v.idea_id));
  const p = partner();
  const swiped = (uid) => new Set(vs.filter((v) => v.user_id === uid).map((v) => v.idea_id));
  const liked = (uid) => new Set(vs.filter((v) => v.user_id === uid && v.liked).map((v) => v.idea_id));
  const mine = swiped(S.uid), theirs = p ? swiped(p.user_id) : new Set();
  const meDone = ideas.length > 0 && mine.size >= ideas.length;
  const themDone = !!p && ideas.length > 0 && theirs.size >= ideas.length;
  const done = meDone && themDone;
  let mutual = [], pick = null;
  if (done) {
    const a = liked(S.uid), b = liked(p.user_id);
    mutual = ideas.filter((i) => a.has(i.id) && b.has(i.id)).sort((x, y) => (x.id < y.id ? -1 : 1));
    if (mutual.length) {
      let h = 0;
      for (const ch of roundFor(kind) + mutual.map((m) => m.id).join('')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      pick = mutual[h % mutual.length];
    }
  }
  return { ideas, p, mine, theirs, meDone, themDone, done, mutual, pick };
}
function ideaPool(kind) {
  const mine = roundState(kind).mine;
  return S.ideas.filter((i) => i.kind === kind && !mine.has(i.id)).map((i) => ({ i, k: Math.random() })).sort((a, b) => a.k - b.k).map((x) => x.i);
}
const pickReason = (n) => (n === 1 ? t('The only one you both said yes to.') : t('Picked at random from {n} you both said yes to.', { n }));

/* when an idea was last picked, not counting the current round */
function lastPicked(idea) {
  const cur = roundFor(idea.kind);
  const days = S.picks.filter((p) => p.idea_id === idea.id && p.round !== cur)
    .map((p) => (p.round.startsWith('m') ? p.round.slice(1) : ymd(new Date(p.created_at))))
    .map((d) => daysBetween(d, today())).filter((n) => n >= 0);
  return days.length ? Math.min(...days) : null;
}
function historyLabel(idea) {
  const n = lastPicked(idea);
  if (n == null) return '';
  const meal = idea.kind === 'meal';
  if (n === 0) return meal ? t('You had this earlier today') : t('You did this today');
  if (n === 1) return meal ? t('You had this yesterday') : t('You did this yesterday');
  if (n < 14) return meal ? tn(n, 'You had this {n} day ago', 'You had this {n} days ago') : tn(n, 'You did this {n} day ago', 'You did this {n} days ago');
  const w = Math.round(n / 7);
  return meal ? tn(w, 'You had this {n} week ago', 'You had this {n} weeks ago') : tn(w, 'You did this {n} week ago', 'You did this {n} weeks ago');
}

const COPY = (kind) => kind === 'meal'
  ? { title: t('Dinner'), when: t('Tonight'), add: 'card-new-meal', deck: 'deck-meal', reset: t('Start over'), resetA: 'reset-meal',
      empty: t("Add the dinners you both like. You each swipe on your own, and once you've both finished, one you both said yes to is picked for tonight.") }
  : { title: t('Dates'), when: t('Next date'), add: 'card-new-date', deck: 'deck-date', reset: t('Pick another date'), resetA: 'reset-date',
      empty: t("Add date ideas. You each swipe on your own, and once you've both finished, one you both liked becomes the next date.") };

/* ---------------- plans ---------------- */
const upcomingPlans = () => S.plans.filter((p) => new Date(p.at) > Date.now() - 4 * 36e5).sort((a, b) => new Date(a.at) - new Date(b.at));
function whenLabel(at) {
  const d = ymd(new Date(at)), n = daysBetween(today(), d);
  const time = fmtTime(at);
  if (n === 0) return t('Today at {time}', { time });
  if (n === 1) return t('Tomorrow at {time}', { time });
  if (n < 7) return t('{day} at {time}', { day: fmtDay(d), time });
  return t('{day} at {time}', { day: fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' }), time });
}
function countdown(at) {
  const ms = new Date(at) - Date.now();
  if (ms < 0) return t('Happening now');
  const h = Math.round(ms / 36e5);
  if (h < 1) return t('in under an hour');
  if (h < 24) return tn(h, 'in {n} hour', 'in {n} hours');
  const d = daysBetween(today(), ymd(new Date(at)));
  return tn(d, 'in {n} day', 'in {n} days');
}
ROWS.plan = (id) => ({ trail: { label: t('Delete'), icon: I.trash, color: 'var(--warn)', destructive: true, run: () => deletePlan(id) } });
function deletePlan(id) {
  const p = S.plans.find((x) => x.id === id);
  if (!p) return;
  S.plans = S.plans.filter((x) => x.id !== id);
  db.del('plans', { id });
  refresh();
  toast(t('Plan removed'), { undo: () => { S.plans.push(p); db.insert('plans', p); refresh(); } });
}
function nextSaturday() {
  const d = new Date(); const add = (6 - d.getDay() + 7) % 7 || 7;
  return addDays(today(), d.getDay() === 6 ? 0 : add);
}
function openPlan({ idea, plan } = {}) {
  const title0 = plan?.title || idea?.title || '';
  const at = plan ? new Date(plan.at) : null;
  const dDay = at ? ymd(at) : nextSaturday();
  const dTime = at ? `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}` : '19:00';
  const sheet = openSheet(`
    <div class="sheet-bar">
      <button class="bar-btn plain" data-a="cancel">${t('Cancel')}</button>
      <div class="ttl">${plan ? t('Edit plan') : t('Plan the date')}</div>
      <button class="bar-btn primary" data-a="save">${t('Save')}</button>
    </div>
    <div class="sheet-body"><div>
      <label class="field-label" for="planTitle">${t('What')}</label>
      <input class="input" id="planTitle" value="${esc(title0)}" maxlength="80">
      <div class="two">
        <div><label class="field-label" for="planDay">${t('Day')}</label><input class="input" id="planDay" type="date" value="${dDay}" min="${today()}"></div>
        <div><label class="field-label" for="planTime">${t('Time')}</label><input class="input" id="planTime" type="time" value="${dTime}"></div>
      </div>
      <label class="field-label" for="planNote">${t('Note (optional)')}</label>
      <input class="input" id="planNote" value="${esc(plan?.note || '')}" placeholder="${esc(t('Book a table, bring a blanket…'))}" maxlength="140">
      <p class="hint">${t("You'll both get a reminder that morning and about an hour before.")}</p>
    </div></div>`);
  sheet.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'cancel') closeSheet(sheet);
    if (a === 'save') {
      const title = $('#planTitle', sheet).value.trim(), day = $('#planDay', sheet).value, time = $('#planTime', sheet).value || '19:00';
      if (!title || !day) { toast(t('Add what and when')); return; }
      const when = new Date(`${day}T${time}:00`).toISOString();
      const note = $('#planNote', sheet).value.trim();
      closeSheet(sheet);
      if (plan) {
        Object.assign(plan, { title, at: when, note, reminded_day: false, reminded_hour: false });
        db.update('plans', { id: plan.id }, { title, at: when, note, reminded_day: false, reminded_hour: false });
      } else {
        const row = { id: uuid(), household_id: S.me.household_id, idea_id: idea?.id || null, title, at: when, note, created_by: S.uid, reminded_day: false, reminded_hour: false, created_at: new Date().toISOString() };
        S.plans.push(row); db.insert('plans', row);
        notify('plan', t('{name} planned a date', { name: S.me.display_name }), `${title}, ${whenLabel(when)}`, './#dates');
      }
      haptic(); refresh();
      toast(t('Planned for {when}', { when: whenLabel(when) }));
    }
  });
}

/* ---------------- view ---------------- */
export function viewIdeas(kind) {
  const c = COPY(kind);
  const st = roundState(kind);
  const { ideas, p } = st;
  let html = header(c.title, c.add);
  if (kind === 'date') {
    const plans = upcomingPlans();
    if (plans.length) {
      html += `<div class="sec" style="margin-top:4px"><h2>${t('Planned')}</h2><span class="count">${plans.length}</span></div><div class="group">${plans.map((pl) => srow('plan', pl.id, `
        <button class="srow-fg row" data-a="plan-edit" data-id="${pl.id}">
          <span class="cal-ico">${svg(I.cal, 20, 2)}</span>
          <span class="row-main"><span class="row-title">${esc(pl.title)}</span><span class="row-sub"><b>${esc(whenLabel(pl.at))}</b>${esc(pl.note || countdown(pl.at))}</span></span>
          <span class="chip">${esc(countdown(pl.at))}</span>
        </button>`)).join('')}</div><div style="height:16px"></div>`;
    }
  }
  if (!ideas.length) {
    return html + `<div class="group empty"><p>${c.empty}</p>
      <div class="stack-gap" style="align-items:center"><button class="btn" data-a="${c.add}">${t('Make a card')}</button><button class="text-btn" data-a="packs-${kind}">${t('Add ready-made ideas')}</button></div></div>`;
  }
  if (st.pick) {
    const m = st.pick;
    const ingr = kind === 'meal' ? (m.ingredients || []) : [];
    const planned = kind === 'date' && S.plans.find((x) => x.idea_id === m.id && new Date(x.at) > Date.now());
    html += `<div class="pick ${m.image_url ? 'has-img' : ''}" style="background:${hueOf(m.id)}">
      ${m.image_url ? `<div class="pick-img" style="background-image:url('${esc(m.image_url)}')"></div>` : ''}
      <div class="pick-when">${avatar(S.uid, 'sm')}${avatar(p?.user_id, 'sm')}<span style="margin-left:4px">${c.when}</span></div>
      <div class="pick-title">${esc(m.title)}</div>
      ${m.description ? `<p class="pick-desc">${esc(m.description)}</p>` : ''}
      <p class="pick-desc">${pickReason(st.mutual.length)}${planned ? ` ${t('Planned for {when}.', { when: esc(whenLabel(planned.at)) })}` : ''}</p>
      <div class="pick-actions">
        ${ingr.length ? `<button class="btn small" data-a="ingr-cart" data-id="${m.id}">${svg(I.cart, 16, 2.2)} ${tn(ingr.length, 'Add {n} ingredient to cart', 'Add {n} ingredients to cart')}</button>` : ''}
        ${kind === 'date' && !planned ? `<button class="btn small" data-a="plan-new" data-id="${m.id}">${svg(I.cal, 16, 2.2)} ${t('Plan it')}</button>` : ''}
        <button class="btn small ghost" data-a="${c.resetA}">${c.reset}</button>
      </div>
    </div>`;
  } else if (st.done) {
    html += `<div class="group empty"><p><b style="color:var(--ink)">${t('No match this time.')}</b><br>${t("You didn't say yes to any of the same ideas.")}</p><button class="btn" data-a="${c.resetA}">${t('Swipe again')}</button></div>`;
  } else {
    const pool = ideaPool(kind), n = ideas.length;
    let sub;
    if (!p) sub = t('Picking starts once your partner joins with code {code}.', { code: esc(S.household?.invite_code) });
    else if (pool.length) sub = (st.themDone ? t('{name} has finished.', { name: esc(p.display_name) }) : t('{name} has swiped {i} of {n}.', { name: esc(p.display_name), i: st.theirs.size, n })) + ' ' + t("The pick appears once you've both finished.");
    else sub = t("You're done. Waiting for {name} ({i} of {n}). Nobody sees the other's swipes.", { name: esc(p.display_name), i: st.theirs.size, n });
    const ttl = pool.length ? (st.mine.size ? t('Keep swiping ({i} of {n})', { i: st.mine.size, n }) : kind === 'meal' ? t("Pick tonight's dinner") : t('Pick the next date')) : t('All swiped');
    html += `<button class="launch ${pool.length ? '' : 'idle'}" data-a="${pool.length ? c.deck : ''}">${miniStack(pool.length ? pool : ideas)}
      <span class="launch-text"><span class="launch-title">${ttl}</span><span class="launch-sub">${sub}</span></span></button>`;
  }
  const myLikes = new Set(votesIn(kind).filter((v) => v.user_id === S.uid && v.liked).map((v) => v.idea_id));
  html += `<div class="sec"><h2>${t('All ideas')}</h2><span class="count">${ideas.length}</span><button class="link" data-a="packs-${kind}">${t('Add more')}</button></div>
    <div class="group">${ideas.map((i) => {
      const hist = historyLabel(i);
      const sub = [hist, i.description, (i.ingredients || []).length ? tn(i.ingredients.length, '{n} ingredient', '{n} ingredients') : ''].filter(Boolean).join(', ');
      return srow('card', i.id, `<button class="srow-fg row" data-a="card-edit" data-id="${i.id}">
        ${i.image_url ? `<span class="swatch img" style="background-image:url('${esc(i.image_url)}')"></span>` : `<span class="swatch" style="background:${hueOf(i.id)}"></span>`}
        <span class="row-main"><span class="row-title">${esc(i.title)}</span>${sub ? `<span class="row-sub">${esc(sub)}</span>` : ''}</span>
        ${myLikes.has(i.id) ? `<span style="color:var(--p-rose)" title="${esc(t('You said yes'))}">${svg(I.heart, 18, 2.2)}</span>` : ''}
      </button>`);
    }).join('')}</div>`;
  if (myLikes.size) html += `<p class="hint">${t("Hearts show your own yeses. {name} can't see them.", { name: esc(p?.display_name || t('Your partner')) })}</p>`;
  return html;
}

function ideaDeck(kind) {
  const c = COPY(kind);
  openDeck({
    title: kind === 'meal' ? t("Tonight's dinner") : t('Next date'),
    items: ideaPool(kind),
    left: { label: t('Not today'), icon: I.x },
    right: { label: t('Yes'), icon: I.heart },
    stampYes: t('Yes'), stampNo: t('Nope'),
    card: (i) => `<div class="meta">${esc(historyLabel(i) || c.when)}</div>
      <h3>${esc(i.title)}</h3>
      ${i.description ? `<p>${esc(i.description)}</p>` : ''}`,
    onSwipe(item, dir, deck) {
      const vote = { idea_id: item.id, user_id: S.uid, round: roundFor(kind), liked: dir === 'right', household_id: S.me.household_id, created_at: new Date().toISOString() };
      const same = (v) => v.idea_id === vote.idea_id && v.user_id === S.uid && v.round === vote.round;
      S.votes = S.votes.filter((v) => !same(v));
      S.votes.push(vote);
      db.upsert('votes', vote, 'idea_id,user_id,round');
      const st = roundState(kind);
      if (st.done) {
        const url = kind === 'meal' ? './#eat' : './#dates';
        if (st.pick) {
          recordPick(kind, st.pick);
          seenMatch(kind, st.pick);
          setTimeout(() => { deck.close(); showMatch(kind, st.pick, st.mutual.length); }, 300);
          notify('match', kind === 'meal' ? t('Dinner is decided') : t("It's a date"), `${st.pick.title}. ${pickReason(st.mutual.length)}`, url);
        } else notify('match', kind === 'meal' ? t('No dinner match') : t('No date match'), t("You didn't say yes to any of the same ideas. Swipe again?"), url);
      }
      return () => { S.votes = S.votes.filter((v) => !same(v)); db.del('votes', { idea_id: vote.idea_id, user_id: S.uid, round: vote.round }); };
    },
    end: () => {
      const st = roundState(kind), p = st.p;
      if (!p) return { title: t('All swiped'), text: t('Once your partner joins and swipes too, one idea you both said yes to gets picked.') };
      if (st.done) return st.pick ? { title: t('Both done'), text: st.pick.title } : { title: t('No match this time.'), text: t("You didn't say yes to any of the same ideas.") };
      return { title: t('All swiped'), text: t("Waiting for {name} to finish. You'll both see the pick then, and nobody sees the other's swipes.", { name: p.display_name }) };
    },
  });
}

function recordPick(kind, idea) {
  const round = roundFor(kind);
  if (S.picks.some((p) => p.round === round && p.idea_id === idea.id)) return;
  const row = { household_id: S.me.household_id, round, kind, idea_id: idea.id, created_at: new Date().toISOString() };
  S.picks = S.picks.filter((p) => p.round !== round).concat(row);
  db.upsert('picks', row, 'household_id,round');
}
const matchKey = (kind, m) => `match:${roundFor(kind)}:${m.id}`;
const seenMatch = (kind, m) => store.set(matchKey(kind, m), '1');
export function checkMatches() {
  for (const kind of ['meal', 'date']) {
    const st = roundState(kind);
    if (!st.pick) continue;
    recordPick(kind, st.pick);
    if ($('.match') || $('.deck')) continue;
    if (!store.get(matchKey(kind, st.pick))) { seenMatch(kind, st.pick); showMatch(kind, st.pick, st.mutual.length); return; }
  }
}
function showMatch(kind, m, n = 1) {
  const p = partner();
  haptic();
  const el = document.createElement('div');
  el.className = 'match';
  el.innerHTML = `
    <div class="pair">${avatar(S.uid)}${avatar(p?.user_id)}</div>
    <div class="when">${kind === 'meal' ? t('Tonight you are eating') : t('Your next date')}</div>
    <h2>${esc(m.title)}</h2>
    <p>${pickReason(n)}</p>
    <div class="stack-gap" style="align-items:center">
      ${kind === 'date' ? `<button class="btn" data-a="m-plan" style="min-width:180px">${svg(I.cal, 18, 2.2)} ${t('Plan it')}</button>` : ''}
      ${kind === 'meal' && (m.ingredients || []).length ? `<button class="btn" data-a="m-ingr" style="min-width:180px">${svg(I.cart, 18, 2.2)} ${t('Ingredients to cart')}</button>` : ''}
      <button class="btn ${kind === 'date' || (m.ingredients || []).length ? 'ghost' : ''}" data-a="ok" style="min-width:180px">${t('Nice')}</button>
    </div>`;
  $('#layer').appendChild(el);
  raf(() => raf(() => el.classList.add('in')));
  const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); };
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    close();
    app_setTab(kind === 'meal' ? 'eat' : 'dates');
    if (a === 'm-plan') setTimeout(() => openPlan({ idea: m }), 320);
    if (a === 'm-ingr') ingredientsToCart(m);
  });
}
let app_setTab = () => {};
export const bindSetTab = (fn) => { app_setTab = fn; };

function ingredientsToCart(m) {
  const n = addToCart(m.ingredients || []);
  haptic();
  toast(n ? tn(n, 'Added {n} item to the cart', 'Added {n} items to the cart') : t('Those are already in the cart'));
}

async function resetIdeas(kind) {
  if (kind === 'meal') {
    const r = mealRound();
    S.votes = S.votes.filter((v) => v.round !== r);
    S.picks = S.picks.filter((p) => p.round !== r);
    db.del('votes', { round: r });
    db.del('picks', { round: r });
  } else {
    const n = await q(sb.rpc('new_date_round'));
    if (n) S.household.date_round = n;
    else { toast(t("You're offline. Try again once you're back online.")); return; }
    const r = await q(sb.from('votes').select('*').in('round', [mealRound(), dateRound()]));
    if (r) S.votes = r;
  }
  refresh();
}

/* ---------------- packs ---------------- */
function openPacks(kind) {
  const have = new Set(S.ideas.filter((i) => i.kind === kind).map((i) => i.title.trim().toLowerCase()));
  const packs = PACKS[kind];
  const sel = new Set();
  const sheet = openSheet(`
    <div class="sheet-bar">
      <button class="bar-btn plain" data-a="cancel">${t('Cancel')}</button>
      <div class="ttl">${kind === 'meal' ? t('Dinner ideas') : t('Date ideas')}</div>
      <button class="bar-btn primary" data-a="add" disabled>${t('Add')}</button>
    </div>
    <div class="sheet-body"><div>
      <p class="hint" style="text-align:left;margin:4px 4px 0">${kind === 'meal' ? t('Recipes come with their ingredients, so the picked dinner can go straight to the cart.') : t('Pick the packs you like. You can edit or delete any card later.')}</p>
      ${packs.map((pk) => {
        const items = pk.items.map((it) => ({ title: lang === 'lt' ? it[1] : it[0], ingr: (lang === 'lt' ? it[3] : it[2]) || [] }));
        const fresh = items.filter((x) => !have.has(x.title.toLowerCase()));
        return `<label class="field-label">${esc(lang === 'lt' ? pk.lt : pk.en)}</label>
          <div class="group flat">
            <label class="row" for="pk-${pk.id}">
              <span class="row-main"><span class="row-title">${fresh.length ? tn(fresh.length, '{n} new idea', '{n} new ideas') : t('All added')}</span>
              <span class="row-sub wrap">${esc(items.map((x) => x.title).join(', '))}</span></span>
              <input type="checkbox" class="switch" id="pk-${pk.id}" data-pk="${pk.id}" ${fresh.length ? '' : 'disabled'}>
            </label>
          </div>`;
      }).join('')}
    </div></div>`);
  sheet.addEventListener('change', (e) => {
    const pk = e.target.dataset.pk;
    if (!pk) return;
    e.target.checked ? sel.add(pk) : sel.delete(pk);
    $('[data-a="add"]', sheet).disabled = !sel.size;
    haptic();
  });
  sheet.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'cancel') closeSheet(sheet);
    if (a === 'add') {
      let n = 0;
      for (const pk of packs.filter((x) => sel.has(x.id))) {
        for (const it of pk.items) {
          const title = lang === 'lt' ? it[1] : it[0];
          if (have.has(title.toLowerCase())) continue;
          have.add(title.toLowerCase());
          const row = { id: uuid(), household_id: S.me.household_id, kind, title, description: '', ingredients: (lang === 'lt' ? it[3] : it[2]) || [], image_url: null, created_by: S.uid, created_at: new Date().toISOString() };
          S.ideas.push(row); db.insert('ideas', row); n++;
        }
      }
      closeSheet(sheet); refresh();
      toast(tn(n, 'Added {n} idea', 'Added {n} ideas'));
    }
  });
}

on('deck-meal', () => ideaDeck('meal'));
on('deck-date', () => ideaDeck('date'));
on('reset-meal', () => resetIdeas('meal'));
on('reset-date', () => resetIdeas('date'));
on('packs-meal', () => openPacks('meal'));
on('packs-date', () => openPacks('date'));
on('ingr-cart', (b) => { const m = S.ideas.find((x) => x.id === b.dataset.id); if (m) ingredientsToCart(m); });
on('plan-new', (b) => openPlan({ idea: S.ideas.find((x) => x.id === b.dataset.id) }));
on('plan-edit', (b) => { const p = S.plans.find((x) => x.id === b.dataset.id); if (p) openPlan({ plan: p }); });
on('starter-meal', () => openPacks('meal'));
on('starter-date', () => openPacks('date'));
export { openCard };

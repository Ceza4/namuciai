// In-browser stand-in for Supabase, used only by the prototype build.
// Implements the small part of the client API the app uses, with sample data
// and a simulated partner (Urtė) who edits a note a little after opening.

const ME = 'me-0000';
const PA = 'pa-0000';
const HID = 'home-0000';
const z = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
const today = ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
let seq = 0;
const uid = () => 'x' + (++seq).toString(36) + Math.random().toString(36).slice(2, 8);
const ALL = [0, 1, 2, 3, 4, 5, 6];

function seed() {
  const db = {
    households: [{ id: HID, name: 'Home', invite_code: 'K7Q2MX', date_round: 1, created_at: iso(now) }],
    members: [
      { user_id: ME, household_id: HID, display_name: 'Matas', color: 'blue', created_at: iso(now - 9e6) },
      { user_id: PA, household_id: HID, display_name: 'Urtė', color: 'rose', created_at: iso(now - 8e6) },
    ],
    notes: [], shop_items: [], ideas: [], votes: [], chores: [], chore_log: [], push_subs: [],
  };
  const note = (title, body, by, ago, pinned = false) => db.notes.push({ id: uid(), household_id: HID, title, body, pinned, updated_by: by, created_at: iso(now - ago - 1e6), updated_at: iso(now - ago) });
  note('Weekend', 'Saturday: market in the morning\nCall grandma\nReturn the drill to Tomas', PA, 20 * 60e3, true);
  note('Gift ideas for Mom', 'Scarf\nThat cookbook she mentioned\nFlowers and a card', ME, 5 * 36e5);
  note('', 'Book the car service before November', PA, 864e5);
  note('Wi-Fi', 'Network: Namai5G\nPassword is on the router sticker', ME, 3 * 864e5);
  note('Paint for the hallway', 'Sadolin, colour code 0502-Y\n2.5 l should be enough', PA, 9 * 864e5);

  for (const [title, status, description] of [
    ['Milk', 'cart', ''], ['Bananas', 'cart', ''], ['Eggs', 'idle', 'Free range, 10 pack'],
    ['Coffee beans', 'idle', 'Medium roast'], ['Bread', 'idle', 'Rye from the bakery'],
    ['Dish soap', 'idle', ''], ['Toilet paper', 'idle', ''], ['Butter', 'idle', ''], ['Tomatoes', 'idle', ''],
  ]) db.shop_items.push({ id: uid(), household_id: HID, title, description, status, last_swiped_at: null, created_by: ME, created_at: iso(now - 1e6), updated_at: iso(now) });

  const meals = ['Pasta carbonara', 'Tacos', 'Cepelinai', 'Ramen', 'Curry', 'Homemade pizza'];
  for (const t of meals) db.ideas.push({ id: uid(), household_id: HID, kind: 'meal', title: t, description: t === 'Tacos' ? 'With the spicy salsa' : '', created_by: ME, created_at: iso(now - 1e6) });
  for (const t of ['Picnic in Vingis park', 'Board game café', 'Day trip to Trakai', 'Cinema night']) db.ideas.push({ id: uid(), household_id: HID, kind: 'date', title: t, description: '', created_by: PA, created_at: iso(now - 1e6) });
  // Urtė already swiped dinner: yes to tacos and ramen, no to the rest
  for (const i of db.ideas.filter((x) => x.kind === 'meal')) {
    db.votes.push({ idea_id: i.id, user_id: PA, round: 'm' + today, liked: ['Tacos', 'Ramen'].includes(i.title), household_id: HID, created_at: iso(now - 6e5) });
  }
  const dateYes = db.ideas.find((x) => x.title === 'Board game café');
  db.votes.push({ idea_id: dateYes.id, user_id: PA, round: 'd1', liked: true, household_id: HID, created_at: iso(now - 6e5) });

  for (const [title, assignee, priority, recurring, weekdays, due, description] of [
    ['Take out the trash', ME, 3, true, ALL, null, 'Bins go out on Tuesday too'],
    ['Feed the cat', ME, 3, true, ALL, null, ''],
    ['Wash the dishes', null, 2, true, ALL, null, ''],
    ['Pay the electricity bill', ME, 3, false, null, today, 'Ignitis app'],
    ['Water the plants', PA, 2, true, [1, 4], null, ''],
    ['Clean the bathroom', PA, 1, true, [6], null, ''],
    ['Fix the wardrobe door', null, 1, false, null, addDays(today, 12), ''],
  ]) db.chores.push({ id: uid(), household_id: HID, title, description, assignee, priority, recurring, weekdays: weekdays ?? ALL, due_date: due, completed_at: null, created_by: ME, created_at: iso(now - 5 * 864e5) });
  db.chore_log.push({ chore_id: db.chores[2].id, day: today, status: 'done', by_user: PA, household_id: HID, at: iso(now) });
  return db;
}

let db = seed();
const listeners = [];
const emit = (table) => listeners.forEach((l) => { if (l.table === table) l.cb({ table }); });
const copy = (o) => JSON.parse(JSON.stringify(o));

function defaults(t, r) {
  const o = { ...r };
  if (t !== 'votes' && t !== 'chore_log' && t !== 'members' && !o.id) o.id = uid();
  o.created_at ??= new Date().toISOString();
  if (['notes', 'shop_items', 'ideas', 'votes', 'chores', 'chore_log'].includes(t)) o.household_id ??= HID;
  if (t === 'notes') { o.pinned ??= false; o.updated_at ??= o.created_at; o.updated_by ??= ME; o.title ??= ''; o.body ??= ''; }
  if (t === 'shop_items') { o.status ??= 'idle'; o.description ??= ''; o.last_swiped_at ??= null; }
  if (t === 'ideas') o.description ??= '';
  if (t === 'chores') { o.description ??= ''; o.completed_at ??= null; o.priority ??= 2; o.weekdays ??= ALL; o.recurring ??= true; o.due_date ??= null; }
  return o;
}

class Query {
  constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.one = false; this.ord = null; this.lim = null; }
  select() { return this; }
  insert(p) { this.op = 'insert'; this.p = p; return this; }
  upsert(p, o) { this.op = 'upsert'; this.p = p; this.oc = o?.onConflict; return this; }
  update(p) { this.op = 'update'; this.p = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(k, v) { this.f.push((r) => String(r[k]) === String(v)); return this; }
  neq(k, v) { this.f.push((r) => String(r[k]) !== String(v)); return this; }
  gte(k, v) { this.f.push((r) => String(r[k]) >= String(v)); return this; }
  in(k, a) { const s = a.map(String); this.f.push((r) => s.includes(String(r[k]))); return this; }
  match(o) { for (const [k, v] of Object.entries(o)) this.eq(k, v); return this; }
  order(k, o = {}) { this.ord = [k, o.ascending !== false]; return this; }
  limit(n) { this.lim = n; return this; }
  single() { this.one = true; return this; }
  then(res, rej) { return new Promise((r) => setTimeout(r, 30)).then(() => this.run()).then(res, rej); }
  run() {
    const rows = db[this.t];
    if (!rows) return { data: null, error: { message: 'Unknown table' } };
    const hit = (r) => this.f.every((fn) => fn(r));
    let out = [];
    if (this.op === 'select') {
      out = rows.filter(hit);
      if (this.ord) { const [k, asc] = this.ord; out.sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (asc ? 1 : -1)); }
      if (this.lim) out = out.slice(0, this.lim);
    } else if (this.op === 'insert' || this.op === 'upsert') {
      const list = Array.isArray(this.p) ? this.p : [this.p];
      out = list.map((r) => {
        if (this.op === 'upsert') {
          const keys = (this.oc || 'id').split(',');
          const ex = rows.find((x) => keys.every((k) => String(x[k]) === String(r[k])));
          if (ex) return Object.assign(ex, copy(r));
        }
        const o = defaults(this.t, copy(r));
        rows.push(o);
        return o;
      });
    } else if (this.op === 'update') {
      out = rows.filter(hit);
      out.forEach((r) => Object.assign(r, copy(this.p)));
    } else if (this.op === 'delete') {
      out = rows.filter(hit);
      db[this.t] = rows.filter((r) => !hit(r));
      if (this.t === 'ideas') { const ids = new Set(out.map((x) => x.id)); db.votes = db.votes.filter((v) => !ids.has(v.idea_id)); }
      if (this.t === 'chores') { const ids = new Set(out.map((x) => x.id)); db.chore_log = db.chore_log.filter((v) => !ids.has(v.chore_id)); }
    }
    const data = copy(out);
    return { data: this.one ? (data[0] ?? null) : data, error: null };
  }
}

const user = { id: ME, email: 'matas@example.com' };
const session = { access_token: 'demo', user };

export function createClient() {
  return {
    from: (t) => new Query(t),
    rpc: async (name) => {
      if (name === 'new_date_round') { db.households[0].date_round++; return { data: db.households[0].date_round, error: null }; }
      return { data: {}, error: null };
    },
    auth: {
      getSession: async () => ({ data: { session } }),
      getUser: async () => ({ data: { user } }),
      signInWithPassword: async () => ({ data: { session }, error: null }),
      signOut: async () => { db = seed(); location.reload(); return {}; },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    functions: {
      invoke: async (name, { body } = {}) => {
        if (name === 'notify') window.dispatchEvent(new CustomEvent('demo-notify', { detail: body }));
        return { data: { ok: true, sent: 1 }, error: null };
      },
    },
    channel: () => {
      const ch = {
        state: 'joined',
        on: (_type, filter, cb) => { listeners.push({ table: filter.table, cb }); return ch; },
        subscribe: () => ch,
      };
      return ch;
    },
    removeChannel: () => { listeners.length = 0; },
    __demo: {
      // Urtė edits a note shortly after the prototype opens, to show live sync + a notification
      start(onIncoming) {
        setTimeout(() => {
          const n = db.notes.find((x) => x.title === 'Weekend');
          if (!n) return;
          n.body += '\nBuy flowers for Sunday';
          n.updated_at = new Date().toISOString();
          n.updated_by = PA;
          emit('notes');
          onIncoming('Urtė updated a note', 'Weekend');
        }, 9000);
      },
    },
  };
}

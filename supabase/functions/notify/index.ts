// Sends web-push notifications to the other person in the household.
// Anti-spam: per recipient + kind there is a quiet window (notes 15 min,
// chores 5 min). Matches always go through. Daily chore reminders are
// triggered by pg_cron with a shared token.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QUIET_MIN: Record<string, number> = { note: 15, chore: 5, match: 0, test: 0, daily: 600, shop: 30, plan: 0, remind: 0 };

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

let secrets: Record<string, string> | null = null;
async function getSecrets() {
  if (secrets) return secrets;
  const { data } = await admin.from("app_secrets").select("key,value");
  secrets = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  webpush.setVapidDetails("mailto:namuciai@example.com", secrets.vapid_public, secrets.vapid_private);
  return secrets;
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function recentlySent(recipient: string, kind: string) {
  const mins = QUIET_MIN[kind] ?? 10;
  if (!mins) return false;
  const since = new Date(Date.now() - mins * 60_000).toISOString();
  const { count } = await admin.from("notify_log").select("id", { count: "exact", head: true })
    .eq("recipient", recipient).eq("kind", kind).gte("sent_at", since);
  return (count ?? 0) > 0;
}

async function pushTo(recipient: string, kind: string, payload: Record<string, unknown>) {
  if (await recentlySent(recipient, kind)) return { sent: 0, throttled: true };
  const { data: subs } = await admin.from("push_subs").select("endpoint, sub").eq("user_id", recipient);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 60 * 60 * 12, urgency: "normal" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_subs").delete().eq("endpoint", s.endpoint);
      else console.error("push failed", code, (e as Error).message);
    }
  }
  if (sent) await admin.from("notify_log").insert({ recipient, kind });
  return { sent, throttled: false };
}

function todayIn(tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
    .formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day: `${get("year")}-${get("month")}-${get("day")}`, dow };
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Vilnius', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
// date plans: a morning heads-up on the day, and one about an hour before
async function planReminders(morning: boolean) {
  const { day } = todayIn('Europe/Vilnius');
  const now = Date.now();
  const { data: plans } = await admin.from('plans').select('*').gte('at', new Date(now - 36e5).toISOString()).lte('at', new Date(now + 36 * 36e5).toISOString());
  const { data: members } = await admin.from('members').select('user_id, household_id');
  const out: unknown[] = [];
  for (const p of plans ?? []) {
    const who = (members ?? []).filter((m) => m.household_id === p.household_id);
    const pday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vilnius' }).format(new Date(p.at));
    const mins = (new Date(p.at).getTime() - now) / 60000;
    if (morning && !p.reminded_day && pday === day) {
      for (const m of who) out.push(await pushTo(m.user_id, 'remind', { title: 'Date today', body: `${p.title} at ${fmtTime(p.at)}`, url: './#dates', tag: 'plan-' + p.id }));
      await admin.from('plans').update({ reminded_day: true }).eq('id', p.id);
    }
    if (!p.reminded_hour && mins > 0 && mins <= 75) {
      for (const m of who) out.push(await pushTo(m.user_id, 'remind', { title: 'Date in about an hour', body: `${p.title} at ${fmtTime(p.at)}`, url: './#dates', tag: 'plan-' + p.id }));
      await admin.from('plans').update({ reminded_hour: true }).eq('id', p.id);
    }
  }
  return out;
}

async function dailyReminders() {
  const { day, dow } = todayIn("Europe/Vilnius");
  const { data: members } = await admin.from("members").select("user_id, household_id, display_name");
  const { data: chores } = await admin.from("chores").select("id, household_id, assignee, recurring, weekdays, due_date, completed_at");
  const { data: logs } = await admin.from("chore_log").select("chore_id").eq("day", day);
  const swiped = new Set((logs ?? []).map((l) => l.chore_id));
  const results: unknown[] = [];
  for (const m of members ?? []) {
    const mine = (chores ?? []).filter((c) =>
      c.household_id === m.household_id &&
      (c.assignee === m.user_id || c.assignee === null) &&
      !swiped.has(c.id) &&
      (c.recurring ? (c.weekdays ?? []).includes(dow) : !c.completed_at && (!c.due_date || c.due_date <= addDays(day, 2)))
    );
    if (!mine.length) continue;
    results.push(await pushTo(m.user_id, "daily", {
      title: "Today's chores",
      body: mine.length === 1 ? "1 chore waiting for a swipe" : `${mine.length} chores waiting for a swipe`,
      url: "./#chores",
      tag: "daily-chores",
    }));
  }
  return results;
}

function addDays(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const s = await getSecrets();

    const cronToken = req.headers.get("x-cron-token");
    if (cronToken) {
      if (cronToken !== s.cron_token) return json({ error: "bad token" }, 401);
      const body = await req.json().catch(() => ({}));
      if (body.mode === 'plans') return json({ ok: true, results: await planReminders(false) });
      return json({ ok: true, results: [...await dailyReminders(), ...await planReminders(true)] });
    }

    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error } = await admin.auth.getUser(jwt);
    if (error || !u?.user) return json({ error: "not signed in" }, 401);
    const me = u.user.id;

    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind ?? "note");
    if (!(kind in QUIET_MIN) || kind === "daily" || kind === "remind") return json({ error: "bad kind" }, 400);

    const { data: mine } = await admin.from("members").select("household_id, display_name").eq("user_id", me).single();
    if (!mine) return json({ error: "no home" }, 400);

    const payload = {
      title: String(body.title ?? "Namučiai").slice(0, 80),
      body: String(body.body ?? "").slice(0, 180),
      url: String(body.url ?? "./"),
      tag: kind === "note" ? "notes" : kind,
    };

    if (kind === "test") return json(await pushTo(me, "test", payload));

    const { data: others } = await admin.from("members").select("user_id")
      .eq("household_id", mine.household_id).neq("user_id", me);
    const out = [];
    for (const o of others ?? []) out.push(await pushTo(o.user_id, kind, payload));
    return json({ ok: true, results: out });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

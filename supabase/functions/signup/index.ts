// Creates a confirmed email+password account without sending email
// (Supabase's built-in mailer only delivers to the project owner).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_USERS = 12;

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { email, password } = await req.json();
    const e = String(email ?? "").trim().toLowerCase();
    const p = String(password ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json({ error: "That email doesn't look right" }, 400);
    if (p.length < 6) return json({ error: "Password needs at least 6 characters" }, 400);

    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: MAX_USERS + 1 });
    if ((list?.users?.length ?? 0) >= MAX_USERS) return json({ error: "Sign-ups are closed" }, 403);

    const { error } = await admin.auth.admin.createUser({ email: e, password: p, email_confirm: true });
    if (error) {
      const msg = /already/i.test(error.message) ? "An account with this email already exists — sign in instead" : error.message;
      return json({ error: msg }, 400);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

// Siri / Shortcuts endpoint. POST { token, type: "cart" | "note", text }.
// The token is personal (Settings → Siri), so no sign-in is needed.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { guessAisle } from "./aisles.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const say = (text: string, status = 200) => new Response(text, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" } });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type" } });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return say("Send JSON with token, type and text.", 400); }
  const token = String(body.token ?? "").trim();
  const type = String(body.type ?? "cart");
  const text = String(body.text ?? "").trim();
  if (!token) return say("Missing token. Copy it from Namučiai settings.", 401);
  if (!text) return say("Nothing to add.", 400);
  const { data: m } = await admin.from("members").select("user_id, household_id, display_name").eq("quick_token", token).maybeSingle();
  if (!m) return say("That token doesn't match. Copy a fresh one from Namučiai settings.", 401);

  if (type === "note") {
    await admin.from("notes").insert({ household_id: m.household_id, title: "", body: text, updated_by: m.user_id });
    return say("Saved to Namučiai notes.");
  }

  // "milk, eggs and bread" / "pienas ir duona" → three items
  const items = text.split(/\s*(?:,|;|\band\b|\bir\b|\n)\s*/i).map((x) => x.trim()).filter(Boolean).slice(0, 20);
  const { data: existing } = await admin.from("shop_items").select("id, title").eq("household_id", m.household_id);
  const added: string[] = [];
  for (const raw of items) {
    const hit = (existing ?? []).find((e) => e.title.trim().toLowerCase() === raw.toLowerCase());
    if (hit) {
      await admin.from("shop_items").update({ status: "cart", qty: 1, last_swiped_at: new Date().toISOString() }).eq("id", hit.id);
      added.push(hit.title);
    } else {
      const title = cap(raw);
      await admin.from("shop_items").insert({ household_id: m.household_id, title, status: "cart", aisle: guessAisle(title), created_by: m.user_id });
      added.push(title);
    }
  }
  const list = added.length > 1 ? `${added.slice(0, -1).join(", ")} and ${added.at(-1)}` : added[0];
  return say(`Added ${list} to the cart.`);
});

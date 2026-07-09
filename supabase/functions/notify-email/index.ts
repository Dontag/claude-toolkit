// notify-email — optional Supabase Edge Function that emails a toolkit owner
// when a change proposal is awaiting their approval.
//
// DISABLED BY DEFAULT. It only does anything if you:
//   1. Set an email provider secret:  supabase secrets set RESEND_API_KEY=...
//   2. Set EMAIL_FROM:                supabase secrets set EMAIL_FROM="Claude Toolkit <noreply@yourdomain>"
//   3. Deploy it:                     supabase functions deploy notify-email
//   4. Wire it to fire on new 'proposal_pending' notifications — either a
//      Database Webhook (Table: notifications, event: INSERT) pointing here, or
//      a pg trigger using pg_net. See DEV.md.
//
// Without a RESEND_API_KEY it returns 200 and no-ops, so it's safe to leave
// undeployed. The in-app notification center works regardless.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Claude Toolkit <noreply@example.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (!RESEND_API_KEY) return new Response("email disabled (no RESEND_API_KEY)", { status: 200 });
  try {
    const body = await req.json();
    // Database Webhook payload: { type, table, record, ... }
    const record = body.record ?? body;
    if (record?.type !== "proposal_pending") return new Response("ignored", { status: 200 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    // look up the owner's email from auth.users
    const { data: userRes } = await admin.auth.admin.getUserById(record.user_id);
    const to = userRes?.user?.email;
    if (!to) return new Response("no email on file", { status: 200 });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to,
        subject: "A change to your toolkit item is awaiting approval",
        html: `<p>Someone proposed a change to one of your shared items in Claude Toolkit.</p>
               <p>Open the app → 🔔 to review and approve or reject it.</p>`,
      }),
    });
    return new Response(await res.text(), { status: res.ok ? 200 : 502 });
  } catch (e) {
    return new Response(`error: ${e}`, { status: 500 });
  }
});

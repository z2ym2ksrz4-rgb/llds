// Supabase Edge Function: fan out unpushed in-app notifications as native push (APNs for iOS, FCM v1 for Android).
// Trigger: pg_cron every minute (select net.http_post(...)) or a Database Webhook on notification INSERT.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), APNS_KEY_ID, APNS_TEAM_ID, APNS_P8 (base64), APNS_BUNDLE_ID,
//          FCM_SERVICE_ACCOUNT (JSON string of the Firebase service account).
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APNS_HOST = Deno.env.get("APNS_SANDBOX") === "1" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";

async function apnsJwt() {
  const p8 = atob(Deno.env.get("APNS_P8")!); const key = await importPKCS8(p8, "ES256");
  return await new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: Deno.env.get("APNS_KEY_ID")! }).setIssuer(Deno.env.get("APNS_TEAM_ID")!).setIssuedAt().sign(key);
}
async function fcmToken() {
  const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!); const key = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" }).setProtectedHeader({ alg: "RS256" }).setIssuer(sa.client_email).setAudience(sa.token_uri).setIssuedAt().setExpirationTime("1h").sign(key);
  const r = await fetch(sa.token_uri, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` });
  return { token: (await r.json()).access_token as string, project: sa.project_id as string };
}

Deno.serve(async () => {
  const { data: rows } = await sb.from("notification").select("id,person_id,title,body,ref").is("pushed_at", null).order("created_at").limit(200);
  if (!rows?.length) return new Response("nothing");
  const ids = rows.map((r) => r.person_id);
  const { data: toks } = await sb.from("push_token").select("token,person_id,platform").in("person_id", ids);
  let apns: string | null = null, fcm: { token: string; project: string } | null = null; const dead: string[] = [];
  for (const n of rows) {
    for (const t of (toks ?? []).filter((x) => x.person_id === n.person_id)) {
      try {
        if (t.platform === "ios" && Deno.env.get("APNS_P8")) {
          apns ??= await apnsJwt();
          const r = await fetch(`${APNS_HOST}/3/device/${t.token}`, { method: "POST", headers: { authorization: `bearer ${apns}`, "apns-topic": Deno.env.get("APNS_BUNDLE_ID")!, "apns-push-type": "alert" }, body: JSON.stringify({ aps: { alert: { title: n.title, body: n.body ?? "" }, sound: "default", badge: 1 }, ref: n.ref }) });
          if (r.status === 410 || r.status === 400) dead.push(t.token);
        } else if (t.platform === "android" && Deno.env.get("FCM_SERVICE_ACCOUNT")) {
          fcm ??= await fcmToken();
          const r = await fetch(`https://fcm.googleapis.com/v1/projects/${fcm.project}/messages:send`, { method: "POST", headers: { authorization: `Bearer ${fcm.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: { token: t.token, notification: { title: n.title, body: n.body ?? "" }, data: Object.fromEntries(Object.entries(n.ref ?? {}).map(([k, v]) => [k, String(v)])) } }) });
          if (r.status === 404) dead.push(t.token);
        }
      } catch (e) { console.error("push failed", t.platform, (e as Error).message); }
    }
  }
  await sb.from("notification").update({ pushed_at: new Date().toISOString() }).in("id", rows.map((r) => r.id));
  if (dead.length) await sb.from("push_token").delete().in("token", dead);
  return new Response(`pushed ${rows.length}, dead ${dead.length}`);
});

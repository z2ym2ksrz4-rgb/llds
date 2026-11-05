#!/usr/bin/env node
// Uploads Line's team photos to the private "media" bucket and sets team.cover_path.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/upload-team-images.mjs /path/to/llds-images
// Folder names (from the Drive export) → team names in seed.sql. "dm-the-axis" is an event folder → a team folder "DM 2026" on The AXIS.
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MAP = {
  "control": "Control", "division": "Division", "empire": "Empire", "mini-angels": "Mini Angels", "mini-cuites": "Mini Cuties",
  "mini-magic": "Mini Magic", "new-age": "New Age", "satellite-stars": "Satellite Stars", "sky-stars": "Sky Stars", "the-axis": "The AXIS",
  "the-attitude": "Apexion",   // 25/26 "The Attitude" → 26/27 Apexion (Airy is the other successor; Line decides)
  "dm-the-axis": "The AXIS",
};
const root = process.argv[2]; if (!root) { console.error("need image root"); process.exit(1); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data: school } = await sb.from("school").select("id,slug").eq("slug", "llds").single();
const { data: teams } = await sb.from("team").select("id,name").eq("school_id", school.id);
const { data: line } = await sb.from("person").select("id").eq("school_id", school.id).eq("is_admin", true).limit(1).single();

for (const dir of readdirSync(root)) {
  const teamName = MAP[dir]; if (!teamName) { console.log("skip", dir); continue; }
  const team = teams.find((t) => t.name === teamName); if (!team) { console.log("no team", teamName); continue; }
  const folderName = dir === "dm-the-axis" ? "DM 2026" : "Holdbilleder 25/26";
  let { data: folder } = await sb.from("folder").select("id").eq("team_id", team.id).eq("name", folderName).maybeSingle();
  if (!folder) ({ data: folder } = await sb.from("folder").insert({ school_id: school.id, team_id: team.id, name: folderName }).select("id").single());
  const files = readdirSync(join(root, dir)).filter((f) => f.endsWith(".jpg")).sort();
  for (const f of files) {
    const path = `${school.slug}/folders/${folder.id}/${f}`;
    const { error } = await sb.storage.from("media").upload(path, readFileSync(join(root, dir, f)), { contentType: "image/jpeg", upsert: true });
    if (error) { console.error(path, error.message); continue; }
    await sb.from("media").upsert({ folder_id: folder.id, uploader_id: line.id, storage_path: path, kind: "image" }, { onConflict: "storage_path", ignoreDuplicates: true });
  }
  if (dir !== "dm-the-axis") {
    const cover = `${school.slug}/teams/${team.id}/cover.jpg`;
    await sb.storage.from("media").upload(cover, readFileSync(join(root, dir, files[0])), { contentType: "image/jpeg", upsert: true });
    await sb.from("team").update({ cover_path: cover }).eq("id", team.id);
  }
  console.log(teamName, files.length, "files");
}

// Phase-3 smoke: parent sees message banner + accepts, posts in team room with photo, comments; admin sends message + sees status, creates folder + uploads, reads reports after a report; trainer writes note; formations editor.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = []; p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
const out = {}; const shot = (n) => p.screenshot({ path: `smoke3-${n}.png` });
const login = async (email) => { await p.waitForSelector("#email"); await p.fill("#email", email); await p.click("form button.cta"); await p.fill("#code", "123456"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar"); };
const logout = async () => { await p.click("nav.tabbar >> text=Indstillinger"); await p.click("text=Log ud"); };
// a tiny JPEG for uploads
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQImWP4z8DwHwyBNAMDA5gBAFJ9BfG8w3ZpAAAAAElFTkSuQmCC", "base64"); writeFileSync("/tmp/claude-0/-home-claude/3044d1cf-5408-513b-86aa-778c465d4d10/scratchpad/t.png", png);
const IMG = "/tmp/claude-0/-home-claude/3044d1cf-5408-513b-86aa-778c465d4d10/scratchpad/t.png";
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });

// 1. parent: banner with 2 messages, accept DM message
await login("parent@demo");
await p.waitForSelector("[data-testid=msg-banner]"); out.bannerCount = await p.$$eval("[data-testid=msg-banner] .item", e => e.length);
await p.click("[data-testid=msg-banner] .item >> nth=0"); await p.waitForSelector("#msg-ack"); await p.click("#msg-ack");
await p.waitForSelector(".toast"); out.accepted = await p.textContent(".toast"); await shot(1);
await p.click(".sheet-bg", { position: { x: 5, y: 5 } }); await p.waitForTimeout(200);
out.bannerAfter = await p.$$eval("[data-testid=msg-banner] .item", e => e.length);
out.homeNews = await p.$$eval("[data-testid=feed] [data-testid=post]", e => e.length);
// 1b. team room: post with photo, then comment on Line's post
await p.click("nav.tabbar >> text=Mit hold"); await p.waitForSelector("[data-testid=feed]");
out.teamPostsBefore = await p.$$eval("[data-testid=post]", e => e.length);
await p.fill("#post-body", "Freja har fået nye dansesko 👟"); await p.setInputFiles("input[type=file]", IMG); await p.click("#post-send");
await p.waitForSelector(".toast"); await p.waitForTimeout(300); out.teamPostsAfter = await p.$$eval("[data-testid=post]", e => e.length);
out.hasImage = await p.$$eval("[data-testid=post] .media img", e => e.length);
await p.click("[data-testid=post] >> nth=1 >> text=/kommentar/i"); await p.waitForSelector("#comment-body");
await p.fill("#comment-body", "Vi kommer!"); await p.click("#comment-send"); await p.waitForTimeout(200); out.comments = await p.$$eval("[data-testid=comment]", e => e.length); await shot(2);
await p.click(".sheet-bg", { position: { x: 5, y: 5 } }); await p.waitForTimeout(200);
// 1c. report Alma's post
const alma = p.locator("[data-testid=post]", { hasText: "hættetrøje" });
await alma.locator("button[aria-label=Mere]").click(); await alma.locator("text=Anmeld").click(); await alma.locator("input").fill("Upassende"); await alma.locator("text=Send anmeldelse").click();
await p.waitForSelector(".toast"); out.reported = await p.textContent(".toast");
// 1d. parent on The AXIS (parents_see_video=false, Freja 13) → choreography locked
out.choreoLocked = await p.$eval("[data-testid=go-choreo]", e => e.disabled);
// folders: open, upload
await p.click("[data-testid=go-folders]"); await p.waitForSelector("[data-testid=folder]"); out.folders = await p.$$eval("[data-testid=folder]", e => e.length);
await p.click("[data-testid=folder] >> nth=1"); await p.waitForSelector("#media-files", { state: "attached" }); await p.setInputFiles("#media-files", IMG); await p.waitForSelector("[data-testid=media]"); out.mediaAfterUpload = await p.$$eval("[data-testid=media]", e => e.length); await shot(3);
await logout();

// 2. admin: reports → hide; messages → new + status; team notes + formations
await login("admin@demo");
await p.click("nav.tabbar >> text=Admin"); await p.click(".item:has-text('Anmeldelser')"); await p.waitForSelector("[data-testid=report]");
out.reportsOpen = await p.$$eval("[data-testid=report]", e => e.length); await p.click("text=Skjul indholdet"); await p.waitForTimeout(200); out.reportsResolved = await p.textContent("section h2");
await p.click("text=‹ Admin"); await p.click(".item:has-text('Beskeder')"); await p.waitForSelector("#admin-new-msg"); await p.click("#admin-new-msg");
await p.fill("#msg-title", "Juleshow 19. december"); await p.fill("#msg-body", "Alle hold danser. Mødetid kl. 14."); await p.click(".chip:has-text('Alle i studiet')"); await p.click("#msg-send");
await p.waitForSelector(".toast"); out.sent = await p.textContent(".toast"); await p.waitForTimeout(300);
await p.click("[data-testid=admin-msg] >> nth=1"); await p.waitForSelector(".sheet"); await p.click("text=Hvem mangler?"); await p.waitForSelector(".sheet .chips .chip"); out.status = await p.textContent(".sheet .eyebrow >> nth=1"); await shot(4);
await p.click(".sheet-bg", { position: { x: 5, y: 5 } });
// team: hidden post visible to admin as hidden; notes; formations
await p.click("nav.tabbar >> text=Mit hold"); await p.waitForSelector("[data-testid=feed]");
out.hiddenVisibleToAdmin = await p.$$eval("[data-testid=post].hidden-post", e => e.length);
await p.click("[data-testid=go-notes]"); await p.waitForSelector("#note-body", { state: "attached" }).catch(() => {});
await p.click(".chips .chip:has-text('Freja')"); await p.fill("#note-body", "Flot fremgang i pirouetter"); await p.click("#note-save"); await p.waitForTimeout(200); out.notes = await p.$$eval("[data-testid=note]", e => e.length);
await p.click("text=‹ Mit hold"); await p.click("[data-testid=go-choreo]"); await p.waitForSelector("[data-testid=video]"); await p.click("[data-testid=video]");
await p.waitForSelector("[data-testid=stage]"); out.formationDots = await p.$$eval("[data-testid=stage] .dot", e => e.length);
await p.click("text=Redigér formationer"); await p.click(".chips .chip:has-text('AN')"); await p.click("[data-testid=stage]", { position: { x: 60, y: 60 } }); await p.click("text=Gem"); await p.waitForSelector(".toast"); await shot(5);
out.dotMoved = await p.$eval("[data-testid=stage] .dot:has-text('AN')", e => e.style.left);
await p.click("text=‹ Koreografi"); await logout();

// 3. trainer (Maja): trainers channel visible, post there
await login("maja@demo"); await p.click("nav.tabbar >> text=Mit hold"); await p.waitForSelector("[data-testid=feed]");
await p.click(".chip:has-text('Trænere')"); await p.waitForTimeout(200); out.trainerPosts = await p.$$eval("[data-testid=post]", e => e.length);
await p.fill("#post-body", "Jeg tager Hip Hop Mini mandag"); await p.click("#post-send"); await p.waitForSelector(".toast"); await p.waitForTimeout(200); out.trainerPostsAfter = await p.$$eval("[data-testid=post]", e => e.length);
// desktop layout check
await p.setViewportSize({ width: 1280, height: 900 }); await p.click("nav.tabbar >> text=Hjem"); await p.waitForTimeout(300); await shot(6);

out.errors = errors; console.log(JSON.stringify(out, null, 1)); await b.close();
if (errors.length) process.exit(1);

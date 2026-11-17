// Click through the whole OVERDRIVE window in a real browser (Playwright + Chromium) against the fake
// Claude, fail on any JavaScript error, and save screenshots.
//   node build/ui_check.cjs OUT_DIR [--scale 2]      (OVERDRIVE_PY = python with OVERDRIVE's requirements)
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const PY = process.env.OVERDRIVE_PY || "python";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function start(port, ...extra) {
  return new Promise((resolve, reject) => {
    const p = spawn(PY, [path.join(ROOT, "build", "demo_server.py"), "--port", String(port), ...extra], { stdio: ["ignore", "pipe", "pipe"] });
    let buf = "";
    const t = setTimeout(() => { p.kill(); reject(new Error("demo server didn't start: " + buf)); }, 30000);
    const onData = (d) => {
      buf += d.toString();
      const m = buf.match(/URL (\S+)/);
      const nm = buf.match(/NOTES (.+)/);
      if (nm) p.notes = nm[1].trim();
      const im = buf.match(/IDLE (.+)/);
      if (im) p.idle = im[1].trim();
      const ex = buf.match(/EXPORT (.+)/);
      if (ex) p.export = ex[1].trim();
      const nn = buf.match(/NET (.+)/);
      if (nn) p.net = nn[1].trim();
      if (m && !p.ready) {
        p.ready = true;
        clearTimeout(t);
        const base = m[1].split("#")[0].replace(/\/$/, "");
        const until = Date.now() + 30000;
        const poll = () => fetch(base + "/api/ping").then((r) => (r.ok ? resolve([p, m[1]]) : Promise.reject()))
          .catch(() => (Date.now() > until ? reject(new Error("demo server never answered: " + buf)) : setTimeout(poll, 250)));
        poll();
      }
    };
    p.stdout.on("data", onData);
    p.stderr.on("data", (d) => { buf += d.toString(); });
  });
}

(async () => {
  const out = path.resolve(process.argv[2] || "shots");
  fs.mkdirSync(out, { recursive: true });
  const scale = process.argv.includes("--scale") ? Number(process.argv[process.argv.indexOf("--scale") + 1]) : 1;
  const errors = [];
  const base = 41000 + Math.floor(Math.random() * 8000) * 2;     // fresh ports every run (old ones may be cooling down)
  const [srv, url] = await start(base);
  const [srv2, url2] = await start(base + 1, "--no-cli");
  // screenshots without the pop-up messages in the way (they're checked separately)
  const shot = async (page, name) => {
    await page.evaluate(() => { const t = document.getElementById("toasts"); if (t) t.style.visibility = "hidden"; });
    await page.screenshot({ path: path.join(out, name) });
    await page.evaluate(() => { const t = document.getElementById("toasts"); if (t) t.style.visibility = ""; });
  };
  const assert = (cond, msg) => { if (!cond) throw new Error("ASSERT: " + msg); };
  let browser;
  try {
    browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1320, height: 880 }, deviceScaleFactor: scale });
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: url.split("#")[0].replace(/\/$/, "") });
    const clip = (page) => page.evaluate(() => navigator.clipboard.readText());
    ctx.on("page", (p) => {
      p.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
      p.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
      p.on("dialog", (d) => d.accept());
    });

    // first-run setup screen (no Claude Code)
    const p2 = await ctx.newPage();
    await p2.goto(url2);
    await p2.waitForSelector("#setup:not(.hidden)", { timeout: 15000 });
    await p2.waitForSelector("text=isn't installed yet", { timeout: 15000 });
    await shot(p2, "00-setup.png");
    await p2.close();

    const page = await ctx.newPage();
    await page.goto(url);
    await page.waitForSelector("#empty:not(.hidden)", { timeout: 15000 });
    await page.waitForSelector("#brain-text:has-text('signed in')", { timeout: 20000 });
    await shot(page, "01-start.png");

    // Piece 2: Chat mode, ChatGPT style: real pictures + lists + a table, every piece numbered with a copy button
    await page.click(".ex >> nth=0");
    await page.waitForSelector(".turn .badge.done", { timeout: 90000 });
    await page.waitForSelector(".pics .pic img", { timeout: 15000 });
    await page.waitForFunction(() => [...document.querySelectorAll(".pics .pic img")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
    const nPics = await page.locator(".pics .pic").count();
    assert(nPics === 3, "pictures shown: " + nPics);
    assert(await page.locator(".answer.numbered table").count() === 1, "table missing");
    const nPieces = await page.locator(".answer.numbered .pc-copy").count();
    assert(nPieces === 10, "pieces: " + nPieces);
    assert((await page.innerText(".answer h3 >> nth=0")).includes("4 strokes"), "heading missing");
    await shot(page, "02a-pictures-answer.png");
    await page.hover(".answer [data-pc='3']");
    await page.click(".answer [data-pc='3'] > .pc-copy");
    await page.waitForSelector(".toast >> text=Copied piece 3", { timeout: 5000 });
    let c = await clip(page);
    assert(c.startsWith("Compression: the piston goes up"), "copy piece 3: " + c);
    const turnsBefore = await page.locator(".turn").count();
    await page.fill("#msg", "copy 4 and 6");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".toast >> text=Copied pieces 4 and 6. No usage used.", { timeout: 5000 });
    c = await clip(page);
    assert(c.startsWith("Power: the spark plug fires") && c.includes("  - this is the only stroke") && c.includes("V8\t8\tdeep rumble"), "copy 4 and 6: " + c);
    assert(await page.locator(".turn").count() === turnsBefore && (await page.inputValue("#msg")) === "", "copy command must not be sent");
    await page.fill("#msg", "copy code");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".toast >> text=has no code", { timeout: 5000 });
    await page.fill("#msg", "");
    await page.click(".pics .pic >> nth=1");
    await page.waitForSelector("#lightbox:not(.hidden)");
    assert((await page.innerText("#lb-cap")).includes("2 / 3"), "lightbox counter");
    await page.keyboard.press("ArrowRight");
    assert((await page.innerText("#lb-cap")).includes("3 / 3") && (await page.innerText("#lb-cap")).includes("CC BY-SA 4.0"), "lightbox next");
    await shot(page, "02b-picture-big.png");
    await page.keyboard.press("Escape");
    assert(await page.isHidden("#lightbox"), "lightbox should close on Esc");
    await page.hover(".turn >> nth=0");
    await page.click(".turn >> nth=0 >> [data-edit]");
    assert((await page.inputValue(".edit-box")).startsWith("How does a V8"), "edit opens the message to change it");
    await page.click("[data-editx]");
    await page.waitForSelector(".edit-box", { state: "detached", timeout: 3000 });

    // task 1: tools only, no approvals
    await page.fill("#msg", "What time is it, and what's 17.5% of 2,480?");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelectorAll(".turn .badge.done").length >= 2, null, { timeout: 90000 });
    assert((await page.innerText("#feed")).includes("434"), "calculator answer missing");
    await shot(page, "02-time-task.png");

    // task 2: Chat mode plans it, then asks "Ready to build?"; Yes switches to Build mode and it builds
    assert((await page.innerText("#mode")).includes("Chat"), "new chats should start in Chat mode");
    await page.fill("#msg", "Make a file called todo.txt with 3 things to do this week");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".card", { timeout: 90000 });
    await page.waitForSelector("#needs-you:not(.hidden)");
    await page.locator(".card").scrollIntoViewIfNeeded();
    assert((await page.innerText(".card")).includes("Ready to build?"), "build card missing");
    await shot(page, "03-approval.png");
    await page.click(".card [data-yes]");
    await page.waitForFunction(() => document.querySelectorAll(".turn .badge.done").length >= 4, null, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector("#mode").textContent.includes("Build"), null, { timeout: 10000 });
    await page.click(".turn:last-child details.checks summary");
    await page.locator(".turn:last-child").scrollIntoViewIfNeeded();
    await sleep(400);
    await shot(page, "04-todo-done.png");
    const t2 = await page.innerText(".turn:last-child");
    assert(t2.includes("todo.txt") && t2.includes("Second check"), t2.slice(0, 400));

    // undo
    await page.click(".turn:last-child [data-undo]");
    await page.waitForSelector(".turn:last-child >> text=Undone:", { timeout: 15000 });

    // status + self-tests
    await page.click("#nav [data-tab=status]");
    await page.waitForSelector(".hero", { timeout: 20000 });
    await page.click("#run-tests");
    await page.waitForSelector("#run-tests:not([disabled])", { timeout: 300000 });
    await page.waitForSelector(".toast >> text=/Self-tests (done|crashed)/", { timeout: 300000 });
    const tt = await page.innerText(".toast");
    assert(tt.includes("Self-tests done") && tt.includes(" 0 failed"), "self-tests in the window: " + tt);
    await sleep(1200);
    const hero = await page.innerText(".hero .num");
    assert(!hero.startsWith("0 "), "no green points after self-tests: " + hero);
    await shot(page, "05-status.png");
    await page.click("[data-area='45']");
    await page.click("[data-rule='33']");
    await sleep(300);
    await shot(page, "06-area.png");
    await page.click("#drawer-x");

    // logs
    await page.click("#nav [data-tab=logs]");
    await page.waitForSelector("#log-table tr.row", { timeout: 15000 });
    await page.click("#log-verify");
    await page.waitForSelector("#log-verify-out.good", { timeout: 15000 });
    await shot(page, "07-logs.png");

    // tools: run the calculator by hand
    await page.click("#nav [data-tab=tools]");
    await page.fill("form[data-tool=calculator] input[name=expression]", "(12.5*4)^2 / sqrt(16)");
    await page.click("form[data-tool=calculator] button.primary");
    await page.waitForSelector("form[data-tool=calculator] + .out >> text=625", { timeout: 10000 });
    await shot(page, "08-tools.png");

    // settings: change a value, check it saved; locked class can't be set to auto
    await page.click("#nav [data-tab=settings]");
    await page.fill("[data-k=max_steps]", "30");
    await page.click("#save-settings");
    await page.waitForSelector(".toast >> text=max_steps", { timeout: 10000 });
    assert(await page.isDisabled("input[name=perm-destructive][value=auto]"), "locked class must be disabled");
    await shot(page, "09-settings.png");

    // Piece 2 settings: search finds the switches; copy buttons can be turned off
    await page.fill("#set-q", "pictures");
    await sleep(150);
    assert(await page.isVisible("[data-k=pictures]") && await page.isHidden("[data-k=max_steps]"), "settings search");
    await shot(page, "10-settings-search.png");
    await page.fill("#set-q", "");
    await page.uncheck("[data-k=copy_numbers]");
    await page.click("#save-settings");
    await page.waitForSelector(".toast >> text=copy_numbers", { timeout: 10000 });
    await page.click("#nav [data-tab=chat]");
    assert(await page.locator(".pc-copy").count() === 0, "copy buttons should be off");

    // chats: search by what was said, rename, delete
    await page.fill("#chat-q", "crankshaft");
    await page.waitForSelector("#chats .snip", { timeout: 5000 });
    assert((await page.innerText("#chats")).toLowerCase().includes("crankshaft"), "search by answer text");
    await page.fill("#chat-q", "");
    await page.hover("#chats .chat-row >> nth=0");
    await page.click("#chats .chat-row >> nth=0 >> [data-ren]");
    await page.fill(".chat-rename", "Engines + todo");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#chats .chat-item >> text=Engines + todo", { timeout: 5000 });
    assert((await page.innerText("#chat-title")) === "Engines + todo", "title follows rename");
    await shot(page, "11-chats.png");
    await page.hover("#chats .chat-row >> nth=0");
    await page.click("#chats .chat-row >> nth=0 >> [data-del]");
    await page.waitForSelector("#chats >> text=No chats yet", { timeout: 5000 });
    assert(await page.isVisible("#empty"), "deleted chat leaves an empty feed");

    // ---- Piece 3, part 1: memory
    await page.fill("#msg", "remember that I love realistic racing games");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".memsaved .ms-row >> text=Likes realistic racing games", { timeout: 30000 });
    await shot(page, "12-memory-saved.png");
    await page.click("#nav [data-tab=memory]");
    await page.waitForSelector(".mem-row >> text=Likes realistic racing games", { timeout: 8000 });
    assert((await page.innerText("#nav-mem")) === "1", "memory count in the menu");
    await page.click("#nav [data-tab=chat]");
    await page.click(".memsaved [data-memundo]");
    await page.waitForSelector(".ms-row.undone", { timeout: 5000 });
    await page.click("#nav [data-tab=memory]");
    await page.waitForSelector(".mem-empty", { timeout: 5000 });
    await page.click("#mem-import-btn");
    await page.fill("#imp-path", srv.notes);
    await page.click("#imp-go");
    await page.waitForSelector(".imp-done", { timeout: 10000 });
    assert((await page.innerText(".imp-done")).includes("new"), "import result");
    await shot(page, "13-memory-import.png");
    await page.click("#drawer-x");
    await page.waitForSelector(".mem-row >> nth=5", { timeout: 5000 });
    await page.click("[data-mcat=rules]");
    await page.waitForSelector("[data-mcat=rules].on", { timeout: 5000 });
    assert((await page.$$(".mem-row")).length === 4, "4 rules");
    await page.click("[data-mcat=all]");
    await page.waitForSelector("[data-mcat=all].on", { timeout: 5000 });
    await page.fill("#mem-q", "engine sounds");
    await page.waitForFunction(() => document.querySelectorAll(".mem-row").length === 3, null, { timeout: 5000 });
    const racing = ".mem-row:has(.mr-title:text-is('RACING GAME'))";
    await page.click(`${racing} [data-mact=pin]`);
    await page.waitForSelector(".mem-row.pinned .mr-title:text-is('RACING GAME')", { timeout: 5000 });
    await page.click(`${racing} [data-mact=edit]`);
    await page.fill(".me-content", "Realistic street racer. Next: engine sounds, then the night map and rain.");
    await page.click("[data-mact=save]");
    await page.waitForSelector(".mem-row >> text=night map and rain", { timeout: 5000 });
    assert(await page.isVisible(".mem-row.pinned .mr-title:text-is('RACING GAME')"), "pin survives an edit");
    await page.fill("#mem-q", "");
    await page.waitForSelector(".mem-row >> nth=6", { timeout: 5000 });
    await shot(page, "14-memory-page.png");
    await page.click(".mem-row:has(.mr-title:text-is('SPACE GAME')) [data-mact=archive]");
    await page.waitForSelector(".mc-arch", { timeout: 5000 });
    await page.check("#mem-arch");
    await page.waitForSelector(".mem-row.arch >> text=SPACE GAME", { timeout: 5000 });
    await page.click(".mem-row.arch [data-mact=forget]");
    await page.waitForSelector(".mem-empty", { timeout: 5000 });
    await page.uncheck("#mem-arch");
    await page.click("#nav [data-tab=chat]");

    // ---- Piece 3, part 2: voice (a fake microphone + fake voices, so it runs anywhere)
    const vp = await ctx.newPage();
    await vp.addInitScript(() => {
      window.__spoken = []; window.__voices = [];
      class FakeRec {
        constructor() { window.__rec = this; }
        start() { window.__recOn = true; window.__recStarts = (window.__recStarts || 0) + 1; }
        stop() { this.abort(); }
        abort() { window.__recOn = false; setTimeout(() => this.onend && this.onend(), 0); }
      }
      window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
      window.__say = (text, final = true) => { const r = window.__rec; r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: final })] }); };
      const voices = [{ name: "Microsoft David - English (United States)", lang: "en-US", localService: true },
        { name: "Microsoft Guy Online (Natural) - English (United States)", lang: "en-US", localService: false }];
      const synth = { speak(u) { window.__spoken.push(u.text); window.__voices.push(u.voice && u.voice.name); setTimeout(() => u.onend && u.onend(), 20); },
        cancel() {}, getVoices() { return voices; }, onvoiceschanged: null };
      Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
      window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    });
    await vp.goto(url);
    await vp.waitForSelector("#brain-text:has-text('signed in')", { timeout: 20000 });
    await vp.click("#new-chat");
    await vp.click("#mic");
    await vp.waitForFunction(() => window.__recOn === true);
    await vp.evaluate(() => { window.__say("make the car", false); });
    assert((await vp.inputValue("#msg")) === "make the car", "interim words show while talking");
    await vp.evaluate(() => { window.__say("make the car faster"); });
    assert((await vp.inputValue("#msg")) === "make the car faster", "final words typed in");
    await vp.click("#mic");
    assert(!(await vp.evaluate(() => window.__recOn)), "mic off");
    await vp.fill("#msg", "");
    await vp.keyboard.press("Control+Shift+Space");
    await vp.waitForSelector("#voice-bar:not(.hidden) .vb-orb.listening", { timeout: 3000 });
    await vp.evaluate(() => window.__say("what time is it"));
    await vp.waitForSelector(".turn .me >> text=what time is it", { timeout: 6000 });
    await vp.waitForFunction(() => window.__spoken.join(" ").includes("434"), null, { timeout: 30000 });
    const said = await vp.evaluate(() => window.__spoken.join(" | "));
    assert(!said.includes("**") && !said.includes("##"), "no markdown read out loud: " + said);
    assert((await vp.evaluate(() => window.__voices[0])).includes("Natural"), "picks the natural voice");
    await vp.waitForSelector(".vb-orb.listening", { timeout: 5000 });      // listens again after talking
    await vp.evaluate(() => window.__say("tell me a story"));
    await vp.waitForSelector(".turn .me >> text=tell me a story", { timeout: 6000 });
    await vp.waitForSelector(".vb-orb.thinking", { timeout: 5000 });
    await vp.evaluate(() => window.__say("make it scary"));
    try { await vp.waitForSelector("#queue-box .qi >> text=make it scary", { timeout: 6000 }); }
    catch (e) { console.log("DEBUG", await vp.evaluate(() => JSON.stringify({ q: S.state.queue, cur: !!S.state.current, heard: P3.v.heard, mode: P3.v.mode, toasts: Array.from(document.querySelectorAll(".toast")).map((t) => t.textContent), turns: Array.from(document.querySelectorAll(".turn .me")).map((t) => t.textContent) }))); throw e; }
    await shot(vp, "15-voice-mode.png");
    await vp.waitForSelector(".turn .me >> text=make it scary", { timeout: 30000 });
    await vp.waitForFunction(() => window.__spoken.join(" ").includes("lights went out"), null, { timeout: 30000 });
    assert(await vp.isHidden("#queue-box"), "queue empties");
    await vp.click("#vb-mute");
    await vp.waitForSelector(".vb-orb.muted", { timeout: 3000 });
    assert(!(await vp.evaluate(() => window.__recOn)), "muted = not listening");
    await vp.click("#vb-end");
    assert(await vp.isHidden("#voice-bar"), "voice mode ends");
    await vp.click("#nav [data-tab=settings]");
    await vp.waitForSelector("[data-k=voice_name] >> text=Guy Online", { state: "attached", timeout: 5000 });
    await vp.click("#voice-test");
    await vp.waitForFunction(() => window.__spoken.join(" ").includes("how I sound"));
    await vp.fill("[data-k=voice_rate]", "1.3");
    await vp.click("#save-settings");
    await vp.waitForSelector("#set-msg:has-text('Saved')", { timeout: 5000 });
    await vp.close();

    // ---- Piece 3, part 3: while you're away
    await page.click("#nav [data-tab=away]");
    await page.waitForSelector(".ptbl >> text=games/street-racer", { timeout: 8000 });
    assert((await page.$$(".ptbl tbody tr")).length === 3, "3 projects");
    await page.click(".ptbl tr:has-text('games/street-racer') [data-pcheck]");
    await page.waitForSelector(".bug-group >> text=Points to a file that isn't there", { timeout: 10000 });
    assert((await page.$$(".bug-group .bug")).length === 3, "3 bugs in the racer (missing picture, json, log)");
    await page.click(".bug:has-text('error line') [data-bugx]");
    await page.waitForFunction(() => document.querySelectorAll(".bug-group .bug").length === 2, null, { timeout: 5000 });
    await page.click("[data-seg=away_learn_cap][data-v='10']");
    await page.waitForSelector("[data-seg=away_learn_cap][data-v='10'].on", { timeout: 5000 });
    await page.check(".ptbl tr:has-text('apps/todo-helper') [data-pdone]");
    await page.waitForSelector(".ptbl tr.pdone >> text=apps/todo-helper", { timeout: 5000 });
    fs.writeFileSync(srv.idle, "3600");                          // "you" walk away
    await page.waitForSelector("#away-chip:has-text('Away')", { timeout: 15000 });
    await page.waitForSelector(".lrn >> text=Real car sounds", { timeout: 40000 });
    await page.waitForFunction(() => /Away$/.test(document.querySelector("#away-chip").textContent) && !S.state.current, null, { timeout: 30000 });
    await shot(page, "16-while-away.png");
    fs.writeFileSync(srv.idle, "0");                             // "you" come back
    await page.click("#nav [data-tab=chat]");
    await page.waitForSelector(".banner.away >> text=While you were away", { timeout: 15000 });
    const bn = await page.innerText(".banner.away");
    assert(bn.includes("learned 1 thing") && bn.includes("new bug"), "away report: " + bn);
    await shot(page, "17-away-banner.png");
    await page.click(".banner.away .bn-x");
    await page.waitForSelector(".banner.away", { state: "detached", timeout: 3000 });
    await page.reload();
    await page.waitForSelector("#brain-text:has-text('signed in')", { timeout: 20000 });
    assert(!(await page.$(".banner.away")), "closed banner stays closed");

    // ---- Piece 3, part 4: schedule, accounts, internet light, done folder, tour
    await page.click("#nav [data-tab=schedule]");
    await page.click("#sj-new");
    await page.fill("#sj-text", "Work on the racing game's night map and test it");
    await page.fill("#sj-title", "Night map");
    await page.selectOption("#sj-mode", "build");
    await page.selectOption("#sj-repeat", "weekly");
    await page.click("#sj-save");
    await page.waitForSelector(".job >> text=Night map", { timeout: 5000 });
    assert((await page.innerText(".job .job-when")).startsWith("Every "), "weekly job");
    assert((await page.innerText("#nav-jobs")) === "1", "job count in the menu");
    await page.click("#sj-new");
    await page.selectOption("#sj-when", "usage_reset");
    assert(await page.isDisabled("#sj-at"), "no time for a usage-reset job");
    await page.fill("#sj-text", "Build the next level");
    await page.click("#sj-save");
    await page.waitForSelector(".job >> text=When my 5-hour usage resets", { timeout: 5000 });
    await shot(page, "18-schedule.png");
    await page.click(".job:has-text('Build the next level') [data-jact=toggle]");
    await page.waitForSelector("h2:has-text('Paused or finished')", { timeout: 5000 });
    await page.click(".job:has-text('Build the next level') [data-jact=delete]");
    await page.waitForFunction(() => document.querySelectorAll(".job").length === 1, null, { timeout: 5000 });

    await page.click("#acct-chip");
    await page.waitForSelector(".acct >> text=this PC's normal sign-in", { timeout: 10000 });
    await page.fill("#acct-new", "Second");
    await page.click("#acct-add");
    await page.waitForSelector(".acct:has-text('Second') [data-acct-use]", { timeout: 10000 });
    await page.click(".acct:has-text('Second') [data-acct-use]");
    await page.waitForSelector("#acct-name:text-is('Second')", { timeout: 10000 });
    await shot(page, "19-accounts.png");
    await page.click(".acct:has-text('main') [data-acct-use]");
    await page.waitForSelector("#acct-name:text-is('main')", { timeout: 10000 });
    await page.click("#drawer-x");
    await page.click("#nav [data-tab=chat]");
    await page.evaluate(() => P3.limitHit({ account: "main", others: ["main", "Second"], resets_at: Date.now() / 1000 + 3600 }));
    await page.waitForSelector(".banner >> text=limit is used up", { timeout: 3000 });
    await page.click("[data-limit-use=Second]");
    await page.waitForSelector("#acct-name:text-is('Second')", { timeout: 10000 });
    assert(!(await page.$(".banner:has-text('limit is used up')")), "limit banner gone after switching");

    await page.click("#nav [data-tab=chat]");
    await page.waitForSelector("#net-light.up", { timeout: 10000 });
    fs.writeFileSync(srv.net, "0");
    await page.waitForSelector(".banner.net.down >> text=SIGNAL LOST", { timeout: 10000 });
    assert(await page.isVisible("#net-light.down"), "red light");
    await shot(page, "20-signal-lost.png");
    fs.writeFileSync(srv.net, "1");
    await page.waitForSelector(".banner.net.up >> text=BACK ONLINE", { timeout: 10000 });
    await page.click(".banner.net .bn-x");
    await page.waitForSelector(".banner.net", { state: "detached", timeout: 3000 });

    const firstChat = "#chats .chat-row >> nth=0";
    const name = await page.innerText(`${firstChat} >> .chat-item`);
    await page.hover(firstChat);
    await page.click(`${firstChat} >> [data-done]`);
    await page.waitForSelector(".done-head", { timeout: 5000 });
    await page.click(".done-head");
    await page.waitForSelector(".chat-row.is-done", { timeout: 3000 });
    assert((await page.innerText(".chat-row.is-done .chat-item")).startsWith(name.slice(0, 10)), "it's in Done");
    await page.hover(".chat-row.is-done");
    await page.click(".chat-row.is-done [data-done]");
    await page.waitForSelector(".done-head", { state: "detached", timeout: 3000 });

    await page.click("#nav [data-tab=settings]");
    await page.click("#set-tour");
    await page.waitForSelector("#tour:not(.hidden) .tour-card >> text=Talk here", { timeout: 5000 });
    await shot(page, "21-tour.png");
    for (let i = 0; i < 8; i++) await page.click("#tour-next");
    await page.waitForSelector(".tour-card.center >> text=Got any questions", { timeout: 3000 });
    await page.click("#tour-end");
    assert(await page.isHidden("#tour"), "tour closed");

    // ---- Piece 3, part 5: by the way, pictures, Quick read, idea buttons, real Edit, power cut, looks, names
    await page.click("#nav [data-tab=chat]");
    await page.click("#new-chat");
    await page.fill("#msg", "tell me a story");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".turn .badge.running", { timeout: 10000 });
    await page.keyboard.press("Control+b");
    await page.fill("#btw-q", "what does a gearbox do?");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".btw-a >> text=sweet spot", { timeout: 20000 });
    assert(await page.isVisible(".turn .badge.running"), "the main job is still running while the side answer came");
    assert(!(await page.innerText("#feed")).includes("sweet spot"), "side answer is not in the main chat");
    await shot(page, "22-by-the-way.png");
    await page.click("#btw-x");
    await page.waitForSelector(".turn .badge.done", { timeout: 30000 });

    await page.click("#new-chat");
    const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP4z8DAwMDAxMDAAAAPBAEBlnRQ3QAAAABJRU5ErkJggg==", "base64");
    await page.setInputFiles("#attach-file", { name: "red.png", mimeType: "image/png", buffer: PNG });
    await page.waitForSelector("#att-tray .att img", { timeout: 5000 });
    await page.fill("#msg", "what is in this picture?");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".me .me-pic img", { timeout: 10000 });
    await page.waitForSelector(".answer >> text=red square", { timeout: 20000 });
    assert(await page.isHidden("#att-tray"), "tray empties after sending");
    await page.waitForSelector("#chats .chat-item >> text=Quick Chat", { timeout: 20000 });     // smart name

    await page.fill("#msg", "how does a gearbox work?");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".answer .quick-read", { timeout: 20000 });
    await page.waitForSelector(".idea-go", { timeout: 5000 });
    assert((await page.$$(".idea-go")).length === 2, "a Do this one button per idea");
    await shot(page, "23-quick-read-ideas.png");
    const editTurns = (await page.$$(".turn")).length;
    await page.click(".turn:last-child .me-acts [data-edit]");
    await page.fill(".edit-box", "how does a gearbox work in a race car?");
    await page.click("[data-editgo]");
    await page.waitForFunction((n) => document.querySelectorAll(".turn").length === n && document.querySelector(".turn:last-child .edited-tag"), editTurns, { timeout: 20000 });
    assert(!(await page.innerText("#feed")).includes("how does a gearbox work?"), "the old message went away");
    await page.waitForSelector(".turn:last-child .badge.done", { timeout: 20000 });
    await page.click(".turn:last-child .idea-go >> nth=0");
    await page.waitForSelector(".turn .me >> text=Let's do your idea: Add a real H-pattern shifter", { timeout: 10000 });
    await page.waitForSelector(".turn:last-child .badge:not(.running)", { timeout: 20000 });

    await page.evaluate(() => P3.interrupted([{ task: "t20261117-090000-beef", conversation: "c0", request: "build the night map for the racer", mode: "build" }]));
    await page.waitForSelector(".banner >> text=I was in the middle of something", { timeout: 3000 });
    await page.click("[data-resume-leave]");
    await page.waitForSelector(".banner:has-text('I was in the middle')", { state: "detached", timeout: 3000 });

    await page.fill("#msg", "half-typed message");
    await page.waitForTimeout(900);
    await page.reload();
    await page.waitForSelector("#brain-text:has-text('signed in')", { timeout: 20000 });
    assert((await page.inputValue("#msg")) === "half-typed message", "the draft survived a reload");
    await page.fill("#msg", "");
    await page.waitForTimeout(800);

    await page.click("#nav [data-tab=settings]");
    await page.selectOption("[data-k=theme]", "light");
    await page.click("[data-accent='#3b82f6']");
    await page.selectOption("[data-k=font]", "verdana");
    await page.click("#save-settings");
    await page.waitForSelector("#set-msg:has-text('Saved')", { timeout: 5000 });
    assert((await page.evaluate(() => document.documentElement.dataset.theme)) === "light", "white theme");
    assert((await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim())) === "#3b82f6", "accent color");
    await page.click("#nav [data-tab=chat]");
    await shot(page, "24-white-theme.png");
    await page.click("#nav [data-tab=settings]");
    await page.selectOption("[data-k=theme]", "dark");
    await page.click("[data-accent='#ff6a2b']");
    await page.selectOption("[data-k=font]", "default");
    await page.click("#save-settings");
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark", null, { timeout: 5000 });

    // ---- Piece 3, part 5c: old claude.ai chats, feelings, its own versions
    await page.click("#set-impchats");
    await page.fill("#impc-path", srv.export);
    await page.click("#impc-go");
    await page.waitForSelector(".imp-done >> text=3 new", { timeout: 10000 });
    await page.click("#drawer-x");
    await page.click("#nav [data-tab=chat]");
    await page.waitForSelector(".imp-row .first-badge", { timeout: 5000 });
    await page.click(".imp-row:has(.first-badge) .chat-item");
    await page.waitForSelector(".imp-view >> text=Nice to meet you", { timeout: 5000 });
    assert((await page.innerText(".imp-top")).includes("2024"), "the real date, not today");
    await shot(page, "25-first-chat-ever.png");
    await page.fill("#chat-q", "arcade");
    await page.waitForSelector("#chats .imp-row >> text=Racing game ideas", { timeout: 5000 });
    await page.fill("#chat-q", "");
    await page.click("#mind-chip");
    await page.waitForSelector("#mind-body .mood-bars", { timeout: 5000 });
    await page.fill("#want-new", "Make menus that fit each game");
    await page.click("#want-add");
    await page.waitForSelector(".want >> text=Make menus that fit each game", { timeout: 5000 });
    await shot(page, "26-mind.png");
    await page.click("#drawer-x");
    await page.click("#nav [data-tab=settings]");
    await page.click("#set-versions");
    await page.waitForSelector("#drawer-body >> text=Its own versions", { timeout: 5000 });
    await page.click("#drawer-x");

    // ---- Piece 3, part 5d: live view, schedule instead, time machine
    await page.click("#nav [data-tab=chat]");
    await page.click("#new-chat");
    await page.click("#live-toggle");
    await page.waitForSelector("#live .live-empty", { timeout: 3000 });
    await page.fill("#msg", "tell me a story");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#live .live-now.on", { timeout: 10000 });
    await shot(page, "27-live-view.png");
    await page.waitForSelector("#live .live-now:not(.on)", { timeout: 30000 });
    await page.click("#live-x");
    await page.click("#new-chat");
    await page.fill("#msg", "make me a todo list file");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".card >> text=Schedule it for later", { timeout: 20000 });
    await page.click(".card >> text=Schedule it for later");
    await page.waitForFunction(() => document.querySelector("#sj-text") && document.querySelector("#sj-text").value.startsWith("Build this"), null, { timeout: 8000 });
    assert((await page.inputValue("#sj-mode")) === "build" && (await page.inputValue("#sj-when")) === "usage_reset", "prefilled as a build after the reset");
    await page.click("#sj-cancel");
    await page.click("#nav [data-tab=away]");
    await page.click(".ptbl tr:has-text('games/street-racer') [data-pversions]");
    await page.click("[data-tmsave]");
    await page.waitForSelector(".tmv", { timeout: 5000 });
    await page.click(".tmv [data-tmopen]");
    await page.waitForSelector(".toast >> text=Opened a copy in", { timeout: 5000 });
    await page.click("#drawer-x");
  } catch (e) {
    errors.push(String(e && e.stack || e));
  } finally {
    if (browser) await browser.close();
    srv.kill(); srv2.kill();
  }
  if (errors.length) { console.error("UI CHECK FAILED:\n" + errors.join("\n")); process.exit(1); }
  console.log("UI check passed;", fs.readdirSync(out).filter((f) => f.endsWith(".png")).length, "screenshots in", out);
})();

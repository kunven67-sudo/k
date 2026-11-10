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
      if (m) { clearTimeout(t); setTimeout(() => resolve([p, m[1]]), 600); }
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
  const [srv, url] = await start(47999);
  const [srv2, url2] = await start(47998, "--no-cli");
  const shot = (page, name) => page.screenshot({ path: path.join(out, name) });
  const assert = (cond, msg) => { if (!cond) throw new Error("ASSERT: " + msg); };
  let browser;
  try {
    browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1320, height: 880 }, deviceScaleFactor: scale });
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

    // task 1: tools only, no approvals
    await page.click(".ex >> nth=0");
    await page.waitForSelector(".turn .badge.done", { timeout: 90000 });
    assert((await page.innerText("#feed")).includes("434"), "calculator answer missing");
    await shot(page, "02-time-task.png");

    // task 2: needs your Yes
    await page.fill("#msg", "Make a file called todo.txt with 3 things to do this week");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".card", { timeout: 90000 });
    await page.waitForSelector("#needs-you:not(.hidden)");
    await page.locator(".card").scrollIntoViewIfNeeded();
    await shot(page, "03-approval.png");
    await page.click(".card [data-yes]");
    await page.waitForFunction(() => document.querySelectorAll(".turn .badge.done").length >= 2, null, { timeout: 120000 });
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
    await page.waitForSelector(".toast >> text=Self-tests done", { timeout: 30000 });
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
  } catch (e) {
    errors.push(String(e && e.stack || e));
  } finally {
    if (browser) await browser.close();
    srv.kill(); srv2.kill();
  }
  if (errors.length) { console.error("UI CHECK FAILED:\n" + errors.join("\n")); process.exit(1); }
  console.log("UI check passed;", fs.readdirSync(out).filter((f) => f.endsWith(".png")).length, "screenshots in", out);
})();

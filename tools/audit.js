#!/usr/bin/env node
/**
 * Responsive audit using the Chrome DevTools Protocol (no npm deps needed).
 *
 *   node tools/audit.js [baseUrl]
 *
 * For every device profile it emulates the viewport, loads the page,
 * reports horizontal overflow / layout problems and writes a screenshot.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const BASE = process.argv[2] || "http://localhost:8765";
const OUT = path.join(__dirname, "..", ".audit");
const PORT = 9333;

const DEVICES = [
  { name: "iphone-se",      w: 320, h: 568,  dpr: 2, mobile: true },
  { name: "iphone-12",      w: 390, h: 844,  dpr: 3, mobile: true },
  { name: "iphone-pro-max", w: 430, h: 932,  dpr: 3, mobile: true },
  { name: "android",        w: 412, h: 915,  dpr: 2.6, mobile: true },
  { name: "ipad-portrait",  w: 768, h: 1024, dpr: 2, mobile: true },
  { name: "ipad-landscape", w: 1024, h: 768, dpr: 2, mobile: true },
  { name: "laptop",         w: 1280, h: 800, dpr: 1, mobile: false },
  { name: "desktop",        w: 1600, h: 900, dpr: 1, mobile: false },
  { name: "desktop-xl",     w: 1920, h: 1080, dpr: 1, mobile: false },
];

const PAGES = [
  { name: "home", url: "/index.html" },
  { name: "project", url: "/projects/besat.html" },
  { name: "project-lixora", url: "/projects/lixora.html" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chromePath() {
  const cands = ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return cands.find((p) => fs.existsSync(p)) || "google-chrome";
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { resolve, reject } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        c.events.push(msg);
      }
    };
    return c;
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cdp-"));
  const chrome = spawn(chromePath(), [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile,
    "--force-device-scale-factor=1", "about:blank",
  ], { stdio: "ignore" });

  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await sleep(250);
    try {
      const r = await fetch("http://127.0.0.1:" + PORT + "/json/version");
      wsUrl = (await r.json()).webSocketDebuggerUrl;
    } catch (e) { /* not ready yet */ }
  }
  if (!wsUrl) { chrome.kill(); throw new Error("Chrome did not start"); }

  const browser = await CDP.connect(wsUrl);
  const results = [];

  for (const dev of DEVICES) {
    for (const pg of PAGES) {
      const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });

      await browser.send("Emulation.setDeviceMetricsOverride", {
        width: dev.w, height: dev.h, deviceScaleFactor: dev.dpr, mobile: dev.mobile,
      }, sessionId);
      await browser.send("Emulation.setTouchEmulationEnabled", {
        enabled: dev.mobile, maxTouchPoints: dev.mobile ? 5 : 1,
      }, sessionId);

      const errors = [];
      browser.events.length = 0;
      await browser.send("Runtime.enable", {}, sessionId);
      await browser.send("Log.enable", {}, sessionId);
      await browser.send("Page.enable", {}, sessionId);

      await browser.send("Page.navigate", { url: BASE + pg.url }, sessionId);
      await sleep(1800);
      // trigger lazy images + scroll reveal
      await browser.send("Runtime.evaluate", {
        expression: `(async()=>{
          document.documentElement.style.scrollBehavior='auto';
          const H=document.body.scrollHeight;
          for(let y=0;y<H;y+=400){window.scrollTo(0,y);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}
          window.scrollTo(0,0);
          await new Promise(r=>setTimeout(r,400));
        })()`, awaitPromise: true,
      }, sessionId);
      await sleep(900);

      const probe = await browser.send("Runtime.evaluate", {
        expression: `(() => {
          const de = document.documentElement;
          const overflowX = de.scrollWidth - de.clientWidth;
          const offenders = [];
          const vw = de.clientWidth;
          document.querySelectorAll('body *').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            const cs = getComputedStyle(el);
            if (cs.position === 'fixed') return;
            if (r.bottom < 0 || r.top > innerHeight) return;   /* off-screen (closed mobile menu) */
            if (r.right > vw + 1.5 || r.left < -1.5) {
              offenders.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').toString().slice(0,60),
                left: Math.round(r.left), right: Math.round(r.right)
              });
            }
          });
          const smallTap = [];
          document.querySelectorAll('a,button,input,select,textarea,[role=button]').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            if (r.bottom < 0 || r.top > innerHeight) return;   /* off-screen */
            if (r.height < 40 && el.offsetParent !== null) {
              smallTap.push({ tag: el.tagName.toLowerCase(), cls: (el.className||'').toString().slice(0,50), h: Math.round(r.height), w: Math.round(r.width) });
            }
          });
          const imgs = Array.from(document.images);
          const brokenImgs = imgs.filter(i => i.getAttribute('src') && i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src'));
          const noAlt = imgs.filter(i => !i.hasAttribute('alt')).map(i => i.getAttribute('src'));
          return {
            overflowX,
            docW: de.scrollWidth, clientW: de.clientWidth,
            offenders: offenders.slice(0, 12),
            smallTap: smallTap.slice(0, 10),
            brokenImgs, noAlt,
            imgCount: imgs.length
          };
        })()`, returnByValue: true,
      }, sessionId);

      const shot = await browser.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
      fs.writeFileSync(path.join(OUT, dev.name + "-" + pg.name + ".png"), Buffer.from(shot.data, "base64"));

      const jsErrors = browser.events
        .filter(e => e.method === "Runtime.exceptionThrown" || (e.method === "Log.entryAdded" && e.params.entry.level === "error"))
        .map(e => (e.params.exceptionDetails && e.params.exceptionDetails.text) || (e.params.entry && e.params.entry.text));

      results.push({ device: dev.name, page: pg.name, w: dev.w, h: dev.h, ...(probe.result && probe.result.value ? probe.result.value : {}), jsErrors });
      await browser.send("Target.closeTarget", { targetId });
    }
  }

  browser.ws.close();
  chrome.kill();

  // report
  let problems = 0;
  for (const r of results) {
    const issues = [];
    if (r.overflowX > 1) issues.push("H-OVERFLOW " + r.overflowX + "px");
    if (r.offenders.length) issues.push("offenders:" + r.offenders.length);
    if (r.smallTap.length) issues.push("small-tap:" + r.smallTap.length);
    if (r.brokenImgs.length) issues.push("broken-img:" + r.brokenImgs.length);
    if (r.noAlt.length) issues.push("no-alt:" + r.noAlt.length);
    if (r.jsErrors.length) issues.push("js-error:" + r.jsErrors.length);
    if (issues.length) problems++;
    console.log(
      (r.device + "/" + r.page).padEnd(30) + String(r.w + "x" + r.h).padEnd(11) +
      (issues.length ? "⚠ " + issues.join(" ") : "✓ ok")
    );
    if (r.offenders.length) console.log("      offenders:", JSON.stringify(r.offenders.slice(0, 6)));
    if (r.smallTap.length) console.log("      smallTap :", JSON.stringify(r.smallTap.slice(0, 6)));
    if (r.brokenImgs.length) console.log("      brokenImg:", JSON.stringify(r.brokenImgs.slice(0, 5)));
    if (r.jsErrors.length) console.log("      jsError  :", JSON.stringify(r.jsErrors.slice(0, 4)));
  }
  console.log("\n" + (problems ? problems + " device/page combos with findings" : "all clean") + "  -> screenshots in .audit/");
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 2));
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch (e) {}
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

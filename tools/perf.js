#!/usr/bin/env node
/**
 * Measures the REAL payload a device downloads + Core Web Vitals,
 * for each page at each device profile (Chrome DevTools Protocol).
 *
 *   node tools/perf.js [baseUrl]
 *
 * Every run is a COLD load (cache cleared + cache disabled) so the numbers
 * are what a first-time visitor on that device really pulls down.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const BASE = process.argv[2] || "http://localhost:8765";
const PORT = 9336;

const DEVICES = [
  { name: "iphone-se",  w: 320,  h: 568,  dpr: 2,   cpu: 4, net: "Slow 4G" },
  { name: "iphone-12",  w: 390,  h: 844,  dpr: 3,   cpu: 4, net: "Slow 4G" },
  { name: "pixel-7",    w: 412,  h: 915,  dpr: 2.6, cpu: 4, net: "4G" },
  { name: "ipad",       w: 768,  h: 1024, dpr: 2,   cpu: 4, net: "4G" },
  { name: "laptop",     w: 1280, h: 800,  dpr: 1,   cpu: 2, net: "4G" },
  { name: "desktop",    w: 1600, h: 900,  dpr: 1,   cpu: 1, net: "Cable" },
];

const PAGES = [
  { name: "home", url: "/index.html" },
  { name: "project", url: "/projects/caspian.html" },
  { name: "project-lixora", url: "/projects/lixora.html" },
];

const NET = {
  "Slow 4G": { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 },
  "4G":       { offline: false, latency: 50,  downloadThroughput: 4 * 1024 * 1024 / 8, uploadThroughput: 3 * 1024 * 1024 / 8 },
  "Cable":    { offline: false, latency: 20,  downloadThroughput: 20 * 1024 * 1024 / 8, uploadThroughput: 5 * 1024 * 1024 / 8 },
};

/* injected before any page script so LCP / CLS are captured */
const VITALS_SCRIPT = `
window.__vitals = { lcp: 0, lcpEl: '', cls: 0, fcp: 0 };
try {
  new PerformanceObserver((l) => {
    const e = l.getEntries();
    const last = e[e.length - 1];
    window.__vitals.lcp = last.startTime;
    window.__vitals.lcpEl = (last.element ? last.element.tagName + '.' + String(last.element.className||'').slice(0,26) : '?');
  }).observe({ type: 'largest-contentful-paint', buffered: true });
} catch (e) {}
try {
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) window.__vitals.cls += e.value;
  }).observe({ type: 'layout-shift', buffered: true });
} catch (e) {}
try {
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__vitals.fcp = e.startTime;
  }).observe({ type: 'paint', buffered: true });
} catch (e) {}
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chromePath = () => ["/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p)) || "google-chrome";

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "perf-"));
  const chrome = spawn(chromePath(), [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile, "about:blank",
  ], { stdio: "ignore" });

  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    await sleep(250);
    try {
      const r = await fetch("http://127.0.0.1:" + PORT + "/json/version");
      wsUrl = (await r.json()).webSocketDebuggerUrl;
    } catch (e) {}
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  let events = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}, sessionId) => {
    const i = ++id;
    const payload = { id: i, method, params };
    if (sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => pending.set(i, { resolve, reject }));
  };

  const rows = [];
  for (const dev of DEVICES) {
    for (const pg of PAGES) {
      const { targetId } = await send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      events = [];

      await send("Page.enable", {}, sessionId);
      await send("Network.enable", {}, sessionId);
      await send("Runtime.enable", {}, sessionId);
      await send("Page.addScriptToEvaluateOnNewDocument", { source: VITALS_SCRIPT }, sessionId);
      await send("Network.clearBrowserCache", {}, sessionId);
      await send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
      await send("Emulation.setDeviceMetricsOverride", {
        width: dev.w, height: dev.h, deviceScaleFactor: dev.dpr, mobile: dev.w < 900,
      }, sessionId);
      await send("Emulation.setCPUThrottlingRate", { rate: dev.cpu }, sessionId);
      await send("Network.emulateNetworkConditions", NET[dev.net], sessionId);

      await send("Page.navigate", { url: BASE + pg.url }, sessionId);
      await sleep(4500);
      await send("Runtime.evaluate", {
        expression: `(async()=>{document.documentElement.style.scrollBehavior='auto';
          const H=document.body.scrollHeight;
          for(let y=0;y<H;y+=500){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,50));}
          window.scrollTo(0,0);await new Promise(r=>setTimeout(r,300));})()`,
        awaitPromise: true,
      }, sessionId);
      await sleep(3000);

      /* transferred bytes (cold load) */
      let bytes = 0, requests = 0;
      const byType = { image: 0, font: 0, script: 0, css: 0, doc: 0, other: 0 };
      const typeOf = {};
      for (const e of events) {
        if (e.method === "Network.responseReceived") typeOf[e.params.requestId] = e.params.type;
      }
      for (const e of events) {
        if (e.method !== "Network.loadingFinished") continue;
        const len = e.params.encodedDataLength || 0;
        bytes += len; requests++;
        const t = typeOf[e.params.requestId] || "Other";
        if (t === "Image") byType.image += len;
        else if (t === "Font") byType.font += len;
        else if (t === "Script") byType.script += len;
        else if (t === "Stylesheet") byType.css += len;
        else if (t === "Document") byType.doc += len;
        else byType.other += len;
      }

      const vitals = await send("Runtime.evaluate", {
        expression: `(()=>{const v=window.__vitals||{};const n=performance.getEntriesByType('navigation')[0]||{};
          return {fcp:Math.round(v.fcp||0), lcp:Math.round(v.lcp||0), lcpEl:v.lcpEl||'',
            cls:Math.round((v.cls||0)*10000)/10000,
            ttfb:Math.round(n.responseStart||0), dcl:Math.round(n.domContentLoadedEventEnd||0),
            load:Math.round(n.loadEventEnd||0)};})()`,
        returnByValue: true,
      }, sessionId);

      rows.push({ device: dev.name, net: dev.net, page: pg.name, bytes, requests, ...(vitals.result.value || {}), ...byType });
      await send("Target.closeTarget", { targetId });
    }
  }

  ws.close(); chrome.kill();
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch (e) {}

  const kb = (n) => (n / 1024).toFixed(0).padStart(4);
  console.log("COLD LOAD  ·  throttled network + CPU  ·  gzip on  ·  every lazy image loaded by scrolling\n");
  console.log("device / net        page             TOTAL   reqs    img   font    css    js   FCP     LCP    LCP element");
  console.log("-".repeat(112));
  for (const r of rows) {
    console.log(
      (r.device + " / " + r.net).padEnd(21) +
      r.page.padEnd(17) +
      kb(r.bytes) + "K " +
      String(r.requests).padStart(4) + " " +
      kb(r.image) + "K " + kb(r.font) + "K " + kb(r.css) + "K " + kb(r.script) + "K " +
      (r.fcp + "ms").padStart(7) + (r.lcp + "ms").padStart(8) + "  " + r.lcpEl
    );
  }
  fs.writeFileSync("/tmp/opencode/perf.json", JSON.stringify(rows, null, 2));
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

#!/usr/bin/env node
/**
 * Screenshots a single element (by CSS selector) at given viewports.
 *   node tools/shoot.js <path> <selector> <out> [w] [h]
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PAGE = process.argv[2] || "/index.html";
const SELECTOR = process.argv[3] || "body";
const OUT = process.argv[4] || "/tmp/opencode/shot.png";
const W = parseInt(process.argv[5] || "390", 10);
const H = parseInt(process.argv[6] || "844", 10);
const BASE = "http://localhost:8765";
const PORT = 9334;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chromePath() {
  const c = ["/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p));
  return c || "google-chrome";
}

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cdp2-"));
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
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };
  const send = (method, params = {}, sessionId) => {
    const i = ++id;
    const payload = { id: i, method, params };
    if (sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => pending.set(i, { resolve, reject }));
  };

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: W < 900 }, sessionId);
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Page.navigate", { url: BASE + PAGE }, sessionId);
  await sleep(2200);
  await send("Runtime.evaluate", {
    expression: `(async()=>{
      document.documentElement.style.scrollBehavior='auto';
      const H=document.body.scrollHeight;
      for(let y=0;y<H;y+=400){window.scrollTo(0,y);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}
      window.scrollTo(0,0);
      await new Promise(r=>setTimeout(r,500));
    })()`, awaitPromise: true,
  }, sessionId);
  await sleep(1200);

  const box = await send("Runtime.evaluate", {
    expression: `(()=>{const e=document.querySelector(${JSON.stringify(SELECTOR)});
      if(!e) return null; const r=e.getBoundingClientRect();
      return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height};})()`,
    returnByValue: true,
  }, sessionId);
  if (!box.result.value) { console.log("selector not found"); process.exit(1); }

  const b = box.result.value;
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: b.x, y: b.y, width: b.width, height: Math.min(b.height, 4000), scale: 1 },
  }, sessionId);
  fs.writeFileSync(OUT, Buffer.from(shot.data, "base64"));
  console.log("wrote", OUT, Math.round(b.width) + "x" + Math.round(b.height));

  ws.close();
  chrome.kill();
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch (e) {}
})();

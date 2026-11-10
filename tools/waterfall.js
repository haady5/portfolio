#!/usr/bin/env node
/**
 * Prints the network waterfall of one page on one device profile.
 *   node tools/waterfall.js <path> [w] [h]
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const BASE = process.argv[2] || "http://localhost:8766";
const PAGE = process.argv[3] || "/index.html";
const W = parseInt(process.argv[4] || "390", 10);
const H = parseInt(process.argv[5] || "844", 10);
const PORT = 9337;

const NET = { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chromePath = () => ["/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p)) || "google-chrome";

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "wf-"));
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

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  events = [];
  await send("Page.enable", {}, sessionId);
  await send("Network.enable", {}, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 3, mobile: true }, sessionId);
  await send("Emulation.setCPUThrottlingRate", { rate: 4 }, sessionId);
  await send("Network.emulateNetworkConditions", NET, sessionId);

  await send("Page.navigate", { url: BASE + PAGE }, sessionId);
  await sleep(6000);

  const rows = [];
  const req = {};
  for (const e of events) {
    if (e.method === "Network.requestWillBeSent") {
      req[e.params.requestId] = { url: e.params.request.url, t: e.params.timestamp, type: e.params.type };
    } else if (e.method === "Network.responseReceived") {
      const r = req[e.params.requestId];
      if (r) { r.resp = e.params.timestamp; r.respType = e.params.response.mimeType; }
    } else if (e.method === "Network.loadingFinished") {
      const r = req[e.params.requestId];
      if (r) { r.end = e.params.timestamp; r.size = e.params.encodedDataLength; }
    }
  }
  const t0 = Math.min(...Object.values(req).filter(r => r.t).map(r => r.t));
  for (const r of Object.values(req)) {
    if (!r.t) continue;
    rows.push({
      start: Math.round((r.t - t0) * 1000),
      dur: r.end ? Math.round((r.end - r.t) * 1000) : null,
      kb: r.size ? Math.round(r.size / 1024) : 0,
      type: r.respType || r.type,
      url: r.url.replace(BASE, "").split("/").slice(-2).join("/") || "/",
    });
  }
  rows.sort((a, b) => a.start - b.start);
  console.log("start  dur   kb  type              url");
  for (const r of rows) {
    console.log(
      String(r.start).padStart(5) +
      String(r.dur === null ? "  -" : r.dur).padStart(6) +
      String(r.kb).padStart(5) + "  " +
      (r.type || "").slice(0, 17).padEnd(18) + r.url
    );
  }
  const total = rows.reduce((s, r) => s + r.kb, 0);
  console.log("\nrequests:", rows.length, "| total:", total, "KB");
  ws.close(); chrome.kill();
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch (e) {}
})();

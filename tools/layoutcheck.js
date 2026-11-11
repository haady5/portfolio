#!/usr/bin/env node
/**
 * Detects mobile layout defects: text that is squeezed into a column that
 * is far too narrow (a symptom of a grid with the wrong column count).
 *
 *   node tools/layoutcheck.js [baseUrl]
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const BASE = process.argv[2] || "http://localhost:8765";
const PORT = 9338;
const PAGES = ["/index.html", "/projects/besat.html", "/projects/lixora.html"];
const WIDTHS = [320, 360, 390, 414, 768, 1024];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chromePath = () => ["/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p)) || "google-chrome";

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lc-"));
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

  const PROBE = `(() => {
    const out = [];
    document.querySelectorAll('body *').forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (cs.position === 'fixed') return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.bottom < 0 || r.top > innerHeight * 40) return;
      const own = Array.from(el.childNodes)
        .filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
      if (own.length < 25) return;
      const words = own.split(/\\s+/).length;
      if (words < 4) return;
      // too narrow for the amount of text -> squeezed column
      const charsPerLine = r.width / 7;
      if (charsPerLine < words * 0.9) {
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || '').slice(0, 50),
          w: Math.round(r.width), h: Math.round(r.height),
          chars: own.length, words: words,
          text: own.slice(0, 46).replace(/\\s+/g, ' ')
        });
      }
    });
    return out;
  })()`;

  let problems = 0;
  for (const w of WIDTHS) {
    for (const p of PAGES) {
      const { targetId } = await send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      await send("Page.enable", {}, sessionId);
      await send("Runtime.enable", {}, sessionId);
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 2, mobile: w < 900 }, sessionId);
      await send("Page.navigate", { url: BASE + p }, sessionId);
      await sleep(2200);
      const res = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true }, sessionId);
      const found = (res.result && res.result.value) || [];
      // de-duplicate identical issues
      const uniq = [];
      const seen = new Set();
      for (const f of found) {
        const k = f.tag + f.cls + f.text;
        if (seen.has(k)) continue;
        seen.add(k); uniq.push(f);
      }
      const flag = uniq.length ? "⚠" : "✓";
      if (uniq.length) problems++;
      console.log(flag + " " + String(w).padStart(4) + "px  " + p.padEnd(24) + (uniq.length ? uniq.length + " squeezed element(s)" : "ok"));
      for (const f of uniq) {
        console.log("        " + f.tag + "." + f.cls + "  w=" + f.w + "px h=" + f.h + "px  words=" + f.words + "  | " + f.text);
      }
      await send("Target.closeTarget", { targetId });
    }
  }
  ws.close(); chrome.kill();
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch (e) {}
  console.log("\n" + (problems ? problems + " viewport/page combos with squeezed text" : "no squeezed text found anywhere"));
})();

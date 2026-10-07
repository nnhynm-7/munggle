// =============================================================
//  Munggle(멍글) - 백엔드 서버
//  역할
//   1) public/app.html 화면과 public/shared.js를 브라우저에 보내준다.
//   2) POST /api/llm : 브라우저가 보낸 {kind, lang, level, simId, messages}로
//      shared.js의 프롬프트를 "서버에서" 만들어 AI(Claude/OpenAI)에 전달한다.
//      → API 키와 프롬프트 선택권이 서버에만 있어서, 외부인이 이 서버를
//        임의의 AI 중계기로 악용할 수 없다.
//  프롬프트(대화 규칙)는 public/shared.js에 있다. 기획 수정은 거기서!
//
//  외부 패키지 없이 Node.js(20.12 이상) 기본 기능만 사용 → npm install 불필요
// =============================================================
import http from "node:http";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (existsSync(path.join(__dirname, ".env"))) process.loadEnvFile(path.join(__dirname, ".env"));

const PROVIDER = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
const HAS_KEY =
  (PROVIDER === "anthropic" && !!process.env.ANTHROPIC_API_KEY) ||
  (PROVIDER === "openai" && !!process.env.OPENAI_API_KEY) ||
  (PROVIDER === "gemini" && !!process.env.GEMINI_API_KEY);

// 사람 같은 목소리 (선택): Microsoft Azure Speech 무료(F0) 요금제. 없으면 브라우저 기본 음성을 쓴다.
const TTS_KEY = process.env.AZURE_SPEECH_KEY || "";
const TTS_REGION = process.env.AZURE_SPEECH_REGION || "";
const TTS_VOICE = process.env.AZURE_TTS_VOICE || "ko-KR-SunHiNeural";          // female (default)
const TTS_VOICE_MALE = process.env.AZURE_TTS_VOICE_MALE || "ko-KR-InJoonNeural"; // male (chosen in Settings)
const TTS_DAILY_CHARS = Number(process.env.TTS_DAILY_CHARS) || 15000;   // 무료 한도(월 50만 자)를 넘지 않게 하루 상한
const HAS_TTS = !!(TTS_KEY && TTS_REGION);

// 요청 제한 (배포 시 비용 폭탄 방지)
const PER_MINUTE = Number(process.env.RATE_PER_MINUTE) || 20;   // 사용자(IP)당 1분 요청 수
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT) || 1000;    // 서버 전체 하루 AI 호출 수
const TRUST_PROXY = Number(process.env.TRUST_PROXY) || 0;       // Render 등 프록시 뒤라면 1

// 화면 파일(app.html, shared.js, sounds.js)은 public 폴더에 두는 게 원칙이지만,
// GitHub에 올리다 보면 맨 위에 올라가는 경우가 있어서 두 곳 다 찾아본다.
const pub = (file) => {
  const inPublic = path.join(__dirname, "public", file);
  return existsSync(inPublic) ? inPublic : path.join(__dirname, file);
};

// 브라우저와 같은 shared.js를 읽어서 프롬프트/상황 데이터를 쓴다.
const sandbox = {};
vm.runInNewContext(readFileSync(pub("shared.js"), "utf8"), sandbox);
const { buildPrompt } = sandbox.MALHAE;

// -------------------------------------------------------------
// AI 호출 (Anthropic / OpenAI / Google Gemini)
// -------------------------------------------------------------
// image: optional { mime, data(base64) } — attached to the last user message (photo reading)
async function callLLM({ system, messages, maxTokens, image }) {
  if (PROVIDER === "gemini") return callGemini({ system, messages, maxTokens, image });
  if (image) {
    const last = messages[messages.length - 1];
    last.content = PROVIDER === "openai"
      ? [{ type: "text", text: last.content }, { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.data}` } }]
      : [{ type: "image", source: { type: "base64", media_type: image.mime, data: image.data } }, { type: "text", text: last.content }];
  }

  if (PROVIDER === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, ...messages],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content.map((b) => b.text || "").join("");
}

// -------------------------------------------------------------
// Google Gemini (AI Studio 무료 키 가능)
//  - 새로 만든 키는 gemini-2.5 계열을 쓸 수 없다(예전부터 쓰던 계정만 허용).
//    그래서 기본값은 gemini-3.5-flash-lite이고, .env의 모델이 막혀 있으면 자동으로 이 모델로 다시 시도한다.
//  - Gemini 3는 thinkingLevel, 2.5는 thinkingBudget으로 생각하는 양을 정한다(짧은 JSON 답이라 최소로).
// -------------------------------------------------------------
const GEMINI_FALLBACK = "gemini-3.5-flash-lite";
let geminiModel = process.env.GEMINI_MODEL || GEMINI_FALLBACK;

class GeminiError extends Error {
  constructor(status, body) {
    let msg = "";
    try { msg = JSON.parse(body).error?.message || ""; } catch { msg = String(body).slice(0, 300); }
    super(`Gemini ${status}: ${msg}`);
    this.status = status; this.googleMessage = msg;
  }
}

async function geminiOnce(model, { system, messages, maxTokens, image }) {
  const thinkingConfig = model.startsWith("gemini-2.5")
    ? { thinkingBudget: 0 }
    : { thinkingLevel: /lite|3\.6/.test(model) ? "minimal" : "low" };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m, i) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: image && i === messages.length - 1 ? [{ inlineData: { mimeType: image.mime, data: image.data } }, { text: m.content }] : [{ text: m.content }],
      })),
      // output limit includes thinking tokens on Gemini 3, so leave headroom
      generationConfig: { maxOutputTokens: maxTokens + 1024, responseMimeType: "application/json", thinkingConfig },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new GeminiError(res.status, await res.text());
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
}

async function callGemini(args) {
  try {
    return await geminiOnce(geminiModel, args);
  } catch (err) {
    // model retired / not available for this key -> switch to the current default once and remember it
    const modelProblem = err instanceof GeminiError && [400, 403, 404].includes(err.status) && /model|not found|not supported|access|permission/i.test(err.googleMessage) && !/api key/i.test(err.googleMessage);
    if (modelProblem && geminiModel !== GEMINI_FALLBACK) {
      console.log(`⚠️  ${geminiModel} 모델을 쓸 수 없어서 ${GEMINI_FALLBACK}(으)로 바꿉니다. (${err.googleMessage})`);
      geminiModel = GEMINI_FALLBACK;
      return await geminiOnce(geminiModel, args);
    }
    throw err;
  }
}

// Turn an AI error into a short, helpful message for the page (never includes the key)
function friendlyAIError(err) {
  const s = err?.status, m = err?.googleMessage || err?.message || "";
  if (/api key|API_KEY_INVALID/i.test(m)) return "The AI key isn't valid. Check GEMINI_API_KEY in the .env file (no spaces), then restart the server.";
  if (s === 429 || /quota|RESOURCE_EXHAUSTED|rate/i.test(m)) return "The free AI limit is used up for now. Wait a minute (or until tomorrow) and try again.";
  if (s === 403 || /permission|PERMISSION_DENIED/i.test(m)) return "Google refused this key (permission). Make sure the key was made in aistudio.google.com.";
  if (s === 404 || /not found|not supported/i.test(m)) return "That AI model isn't available. Set GEMINI_MODEL=gemini-3.5-flash-lite in the .env file and restart.";
  if (/timeout|aborted/i.test(m)) return "The AI took too long. Try again.";
  return "The AI didn't answer. Try again in a moment." + (m ? ` (Google: ${m.slice(0, 160)})` : "");
}

// Anthropic은 첫 메시지가 user여야 하고, 같은 역할이 연속되면 안 됨 → 정리
function cleanMessages(messages) {
  const out = [];
  for (const m of messages.slice(-20)) {
    if (!m || typeof m.content !== "string" || !m.content.trim()) continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    const content = m.content.slice(0, 4000);
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += "\n\n" + content;
    else out.push({ role, content });
  }
  if (!out.length || out[0].role !== "user") out.unshift({ role: "user", content: "(start)" });
  if (out[out.length - 1].role !== "user") out.push({ role: "user", content: "(continue)" });
  return out;
}

// -------------------------------------------------------------
// 요청 제한
// -------------------------------------------------------------
function clientIp(req) {
  // 프록시 뒤에서는 모든 요청이 프록시 IP로 들어오므로 X-Forwarded-For를 본다.
  // 맨 앞 값은 사용자가 조작할 수 있어서, 우리가 믿는 프록시가 붙인 값(뒤에서 N번째)을 쓴다.
  if (TRUST_PROXY) {
    const list = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length) return list[Math.max(0, list.length - TRUST_PROXY)];
  }
  return req.socket.remoteAddress;
}

const hits = new Map(), ttsHits = new Map();
function rateLimited(ip, map = hits, max = PER_MINUTE) {
  const now = Date.now();
  const list = (map.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  map.set(ip, list);
  return list.length > max;
}
// 오래된 기록 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  for (const map of [hits, ttsHits])
    for (const [ip, list] of map) if (!list.some((t) => now - t < 60_000)) map.delete(ip);
}, 60_000).unref();

const ttsDaily = { day: "", chars: 0 };
function overTtsBudget(n) {
  const today = new Date().toISOString().slice(0, 10);
  if (ttsDaily.day !== today) Object.assign(ttsDaily, { day: today, chars: 0 });
  if (ttsDaily.chars + n > TTS_DAILY_CHARS) return true;
  ttsDaily.chars += n;
  return false;
}
const xmlEsc = (s) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);
const TTS_RATES = { zero: "-12%", some: "-6%", conv: "0%", slow: "-30%" };

const daily = { day: "", count: 0 };
function overDailyLimit() {
  const today = new Date().toISOString().slice(0, 10);
  if (daily.day !== today) Object.assign(daily, { day: today, count: 0 });
  return ++daily.count > DAILY_LIMIT;
}

// -------------------------------------------------------------
// 웹 서버
// -------------------------------------------------------------
// app.html은 조각(fragment) 형태라서, 여기서 기본 HTML 뼈대로 감싸서 보낸다.
const FAVICON = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#ffc6da"/><text x="32" y="44" font-size="34" text-anchor="middle" fill="#1d1c24" font-family="sans-serif">C</text></svg>`);
const SHELL_HEAD = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="description" content="Munggle (멍글) — learn Korean for your trip with 멍글이, a fluffy Jindo puppy tutor."><meta name="theme-color" content="#ffffff"><link rel="icon" href="${FAVICON}"><style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>`;
const SHELL_TAIL = `</body></html>`;

const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "microphone=(self), camera=()",
};

function sendJSON(res, status, data) {
  res.writeHead(status, { ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function readBody(req, limit = 100_000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > limit) { reject(new Error("too large")); req.destroy(); }
    });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

async function sendFile(res, file, type) {
  const body = await readFile(pub(file), "utf8");
  res.writeHead(200, { ...BASE_HEADERS, "Content-Type": type, "Cache-Control": "no-cache" });
  res.end(file === "app.html" ? SHELL_HEAD + body + SHELL_TAIL : body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html"))
      return await sendFile(res, "app.html", "text/html; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/shared.js")
      return await sendFile(res, "shared.js", "text/javascript; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/sounds.js")
      return await sendFile(res, "sounds.js", "text/javascript; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/i18n.js")
      return await sendFile(res, "i18n.js", "text/javascript; charset=utf-8");
  } catch (err) {
    console.error(err);
    res.writeHead(500); return res.end("Server error");
  }

  if (url.pathname === "/healthz") return sendJSON(res, 200, { ok: true });
  if (url.pathname === "/api/status") return sendJSON(res, 200, { ai: HAS_KEY, provider: PROVIDER, tts: HAS_TTS });

  // Korean text -> natural voice (mp3). Only short Korean lines, so it cannot be used as a free TTS for anything else.
  if (url.pathname === "/api/tts" && req.method === "POST") {
    if (!HAS_TTS) return sendJSON(res, 503, { error: "No voice key set on the server." });
    if (rateLimited(clientIp(req), ttsHits, 40)) return sendJSON(res, 429, { error: "Too many requests." });
    let body;
    try { body = await readBody(req); } catch { return sendJSON(res, 400, { error: "Bad request." }); }
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const rate = TTS_RATES[body?.speed] || TTS_RATES.some;
    const voiceName = body?.voice === "male" ? TTS_VOICE_MALE : TTS_VOICE;
    if (!text || text.length > 200 || !/[가-힣]/.test(text)) return sendJSON(res, 400, { error: "Bad request." });
    if (overTtsBudget(text.length)) return sendJSON(res, 429, { error: "Voice limit reached for today." });
    try {
      const r = await fetch(`https://${encodeURIComponent(TTS_REGION)}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": TTS_KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "munggle",
        },
        body: `<speak version="1.0" xml:lang="ko-KR"><voice name="${xmlEsc(voiceName)}"><prosody rate="${rate}">${xmlEsc(text)}</prosody></voice></speak>`,
        signal: AbortSignal.timeout(20_000),
      });
      if (!r.ok) throw new Error(`Azure TTS ${r.status}: ${await r.text()}`);
      const audio = Buffer.from(await r.arrayBuffer());
      res.writeHead(200, { ...BASE_HEADERS, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" });
      return res.end(audio);
    } catch (err) {
      console.error(err);
      return sendJSON(res, 502, { error: "Voice failed." });
    }
  }

  if (url.pathname === "/api/llm" && req.method === "POST") {
    if (!HAS_KEY) return sendJSON(res, 503, { error: "No AI key set on the server." });
    if (rateLimited(clientIp(req))) return sendJSON(res, 429, { error: "Too many requests. Wait a minute and try again." });

    let body;
    // a photo (resized on the phone, ~200-400 KB) makes the request bigger than a text chat
    try { body = await readBody(req, 3_000_000); } catch { return sendJSON(res, 400, { error: "That photo is too big. Try another one." }); }
    const { kind, lang, level, simId, scene, messages } = body || {};
    const prompt = buildPrompt({ kind, lang, level, simId, scene });
    if (!prompt || !Array.isArray(messages)) return sendJSON(res, 400, { error: "Bad request." });
    let image = null;
    if (kind === "photo") {
      const img = body.image || {};
      if (!/^image\/(jpeg|png|webp)$/.test(img.mime) || typeof img.data !== "string" || img.data.length > 2_800_000 || !/^[A-Za-z0-9+/=]+$/.test(img.data))
        return sendJSON(res, 400, { error: "That photo is too big. Try another one." });
      image = { mime: img.mime, data: img.data };
    }

    if (overDailyLimit()) return sendJSON(res, 429, { error: "Munggle is very busy today. Please come back tomorrow!" });
    try {
      const text = await callLLM({ system: prompt.system, messages: cleanMessages(messages), maxTokens: prompt.maxTokens, image });
      return sendJSON(res, 200, { text });
    } catch (err) {
      console.error(err);
      return sendJSON(res, 502, { error: friendlyAIError(err) });
    }
  }

  res.writeHead(404, BASE_HEADERS); res.end("Not found");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ Munggle 실행 중: http://localhost:${PORT}`);
  console.log(HAS_KEY ? `🤖 AI: ${PROVIDER} · 1분 ${PER_MINUTE}회/사용자 · 하루 ${DAILY_LIMIT}회` : "⚠️  API 키가 없어 체험(데모) 모드로 동작합니다.");
  console.log(HAS_TTS ? `🔊 목소리: ${TTS_VOICE} (Azure)\n` : "🔈 목소리: 브라우저 기본 음성 (Edge로 열면 가장 자연스러워요)\n");
});

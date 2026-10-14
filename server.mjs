import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8765);
const apiUrl = "https://api.anthropic.com/v1/messages";

function env() {
  const out = { ...process.env };
  const path = join(root, ".env");
  if (existsSync(path)) for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}
function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
}
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (req.method === "GET" && path === "/api/health") {
    return json(res, 200, { ok: true, ai: Boolean(env().ANTHROPIC_API_KEY) });
  }
  if (req.method === "GET" && (path === "/" || path === "/index.html")) {
    const body = readFileSync(join(root, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-length": body.length });
    return res.end(body);
  }
  if (req.method !== "POST" || path !== "/api/ask") return json(res, 404, { error: "not_found" });
  const cfg = env();
  if (!cfg.ANTHROPIC_API_KEY) return json(res, 503, { error: "no_key" });
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 200000) return json(res, 413, { error: "too_large" }); }
  let prompt;
  try { prompt = JSON.parse(raw).prompt; } catch { return json(res, 400, { error: "bad_request" }); }
  if (typeof prompt !== "string" || !prompt.trim()) return json(res, 400, { error: "bad_request" });
  try {
    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": cfg.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: cfg.MODEL || "claude-sonnet-5-5", max_tokens: 2000, stream: true, messages: [{ role: "user", content: prompt }] })
    });
    if (!upstream.ok) return json(res, upstream.status === 401 || upstream.status === 429 ? upstream.status : 502, { error: "upstream" });
    res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" });
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
  } catch (error) { json(res, 502, { error: "upstream" }); }
});
server.listen(port, "127.0.0.1", () => console.log(`문제 발굴소 서버가 켜졌어요: http://localhost:${port}`));

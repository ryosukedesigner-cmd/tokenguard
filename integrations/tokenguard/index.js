// TokenGuard client: rug check for Solana, BNB Chain, Base and Ethereum tokens before you buy.
// No dependencies. Works in Node 18+, Deno, Bun, browsers and edge runtimes.
export const DEFAULT_BASE_URL = "https://gdzlcxskuhupymyxywzm.supabase.co/functions/v1/tokenguard";
const ADDRESS_RE = /0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}/;

export class TokenGuardError extends Error {
  constructor(message, status, body) { super(message); this.name = "TokenGuardError"; this.status = status; this.body = body; }
}

/** Finds the first token address in a text, a pump.fun / DexScreener link or a raw address. */
export function extractAddress(text) {
  const m = String(text || "").match(ADDRESS_RE);
  return m ? (m[0].startsWith("0x") ? m[0].toLowerCase() : m[0]) : null;
}

/** One line a human or an LLM can read: "SAFE · 10/100 · $WIF · no risk signal". */
export function summarize(r) {
  if (!r || !r.verdict) return "No verdict.";
  const flags = (r.flags || []).filter((f) => f !== "trusted_token");
  const sell = r.sell_test ? (r.sell_test.status === "ok" ? `sellable (${r.sell_test.round_trip_pct}% round trip)` : r.sell_test.status === "no_sell_route" ? "NO SELL ROUTE (honeypot)" : "") : "";
  return [`${r.verdict} · ${r.risk_score}/100`, r.token?.symbol ? `$${r.token.symbol}` : "", flags.length ? `risks: ${flags.join(", ")}` : "no risk signal", sell].filter(Boolean).join(" · ");
}

export class TokenGuard {
  /**
   * @param {{ apiKey?: string, baseUrl?: string, fetch?: typeof fetch, timeoutMs?: number }} [opts]
   * Without apiKey, a free key (50 checks a day) is created on first use and kept in memory.
   */
  constructor(opts = {}) {
    this.apiKey = opts.apiKey || (typeof process !== "undefined" && process.env?.TOKENGUARD_API_KEY) || "";
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetch = opts.fetch || globalThis.fetch.bind(globalThis);
    this.timeoutMs = opts.timeoutMs ?? 30000;
  }
  async key() {
    if (this.apiKey) return this.apiKey;
    const r = await this.fetch(`${this.baseUrl}/keys`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contact: "sdk" }) });
    const j = await r.json().catch(() => ({}));
    if (!j.api_key) throw new TokenGuardError(j.error || "could not create a free key", r.status, j);
    this.apiKey = j.api_key;
    return this.apiKey;
  }
  async #get(path, address) {
    const addr = extractAddress(address);
    if (!addr) throw new TokenGuardError("no token address found", 400);
    const r = await this.fetch(`${this.baseUrl}${path}?address=${addr}`, { headers: { "x-api-key": await this.key(), "user-agent": "tokenguard-sdk/1" }, signal: AbortSignal.timeout(this.timeoutMs) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 429) throw new TokenGuardError("daily limit reached: upgrade at https://t.me/Token_guard_bot?start=upgrade", 429, j);
    if (!r.ok || !j.verdict) throw new TokenGuardError(j.error || `HTTP ${r.status}`, r.status, j);
    return j;
  }
  /** Full report: verdict, risk_score, flags, authorities, holders, sell_test, creator_record, market. */
  check(address) { return this.#get("/v1/check", address); }
  /** Lighter and faster: verdict, risk_score, flags. */
  verdict(address) { return this.#get("/v1/verdict", address); }
  /** Pre-trade gate: true only for SAFE with a score at or under maxScore (default 30). */
  async isSafe(address, { maxScore = 30 } = {}) {
    const r = await this.verdict(address);
    return { ok: r.verdict === "SAFE" && r.risk_score <= maxScore, verdict: r.verdict, risk_score: r.risk_score, flags: r.flags || [] };
  }
}

export async function checkToken(address, opts) { return new TokenGuard(opts).check(address); }
export default TokenGuard;

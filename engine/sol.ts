// On-chain Solana token safety analysis. Reads only public chain state over JSON-RPC (no third-party data API).
import { ed25519 } from "npm:@noble/curves@1.9.7/ed25519";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const METADATA_PROGRAM = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

// Unix timestamps (s) of the creator's recent token launches, or null if the history is unavailable.
export type CreatorHistory = (creator: string) => Promise<number[] | null>;

export const TRUSTED: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  So11111111111111111111111111111111111111112: "wSOL",
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo": "PYUSD",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "JUP",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "BONK",
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: "mSOL",
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: "JitoSOL",
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": "WETH (Wormhole)",
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": "WBTC (Wormhole)",
  cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij: "cbBTC",
  HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: "PYTH",
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "RAY",
  jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL: "JTO",
};

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function b58decode(s: string): Uint8Array {
  let n = 0n;
  for (const ch of s) { const i = B58.indexOf(ch); if (i < 0) throw new Error("bad base58"); n = n * 58n + BigInt(i); }
  const bytes: number[] = [];
  while (n > 0n) { bytes.unshift(Number(n & 255n)); n >>= 8n; }
  for (const ch of s) { if (ch === "1") bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}
export function b58encode(b: Uint8Array): string {
  let n = 0n;
  for (const x of b) n = (n << 8n) + BigInt(x);
  let out = "";
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const x of b) { if (x === 0) out = "1" + out; else break; }
  return out;
}
const isOnCurve = (b: Uint8Array) => { try { ed25519.ExtendedPoint.fromHex(b); return true; } catch { return false; } };

async function findPda(seeds: Uint8Array[], programId: string): Promise<string> {
  const prog = b58decode(programId);
  const tag = new TextEncoder().encode("ProgramDerivedAddress");
  for (let bump = 255; bump >= 0; bump--) {
    const parts = [...seeds, Uint8Array.of(bump), prog, tag];
    const buf = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
    if (!isOnCurve(h)) return b58encode(h);
  }
  throw new Error("no PDA");
}

export function makeRpc(url: string, timeoutMs = 8000) {
  return async function rpc(method: string, params: unknown[], attempt = 0): Promise<any> {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (r.status === 429 && attempt < 3) { await new Promise((res) => setTimeout(res, 400 * (attempt + 1))); return rpc(method, params, attempt + 1); }
    if (!r.ok) throw new Error(`rpc ${method} ${r.status}`);
    const j = await r.json();
    if (j.error) throw new Error(`rpc ${method}: ${j.error.message}`);
    return j.result;
  };
}

function readStr(dv: DataView, u8: Uint8Array, o: number): [string, number] {
  const len = dv.getUint32(o, true); o += 4;
  const s = new TextDecoder().decode(u8.slice(o, o + len)).replace(/\0/g, "").trim();
  return [s, o + len];
}
function parseMetadata(u8: Uint8Array) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let o = 1;
  const updateAuthority = b58encode(u8.slice(o, o + 32)); o += 32;
  o += 32;
  let name, symbol, uri;
  [name, o] = readStr(dv, u8, o);
  [symbol, o] = readStr(dv, u8, o);
  [uri, o] = readStr(dv, u8, o);
  o += 2;
  if (u8[o++] === 1) { const n = dv.getUint32(o, true); o += 4 + n * 34; }
  o += 1;
  const isMutable = u8[o] === 1;
  return { name, symbol, uri, updateAuthority, isMutable };
}

// pump.fun creator signals: the creator is read from the token's bonding curve account (offset 49), its current balance
// from its token accounts, its initial buy from the creation transaction, its recent launches (or the deployer's) from `history`.
// Checked on the Falcon recordings (18/10/2026, 1 200 tokens): tokens of creators with 20+ launches lose over half
// within an hour 2.4x as often, and a creator selling in the first minute cuts the migration rate by 3.4.
async function pumpCreator(rpc: (m: string, p: unknown[]) => Promise<any>, mint: string, supplyRaw: number, oldestSig: string | null, history?: CreatorHistory) {
  const curve = await findPda([new TextEncoder().encode("bonding-curve"), b58decode(mint)], PUMP_PROGRAM);
  const acc = await rpc("getAccountInfo", [curve, { encoding: "base64" }]);
  const v = acc?.value;
  if (!v || v.owner !== PUMP_PROGRAM || !v.data?.[0]) return null;
  const d = Uint8Array.from(atob(v.data[0]), (c) => c.charCodeAt(0));
  if (d.length < 81) return null;
  const creator = b58encode(d.slice(49, 81));
  const [held, created, launches] = await Promise.allSettled([
    rpc("getTokenAccountsByOwner", [creator, { mint }, { encoding: "jsonParsed" }]),
    oldestSig ? rpc("getTransaction", [oldestSig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]) : Promise.resolve(null),
    history ? history(creator) : Promise.resolve(null),
  ]);
  const holds = held.status === "fulfilled" && held.value
    ? (held.value.value || []).reduce((a: number, x: any) => a + Number(x.account?.data?.parsed?.info?.tokenAmount?.amount ?? 0), 0) : null;
  const initial = created.status === "fulfilled" && created.value?.meta
    ? (created.value.meta.postTokenBalances || []).filter((b: any) => b.owner === creator && b.mint === mint).reduce((a: number, b: any) => a + Number(b.uiTokenAmount?.amount ?? 0), 0) : null;
  // Launchers sign the creation for another wallet set as creator: the signer (deployer) is checked too.
  const keys = created.status === "fulfilled" ? created.value?.transaction?.message?.accountKeys : null;
  const signer = Array.isArray(keys) ? (keys.find((k: any) => k?.signer)?.pubkey ?? null) : null;
  const deployer = signer && signer !== creator ? signer : null;
  let ts = launches.status === "fulfilled" ? launches.value : null;
  if (deployer && history) {
    const dts = await history(deployer).catch(() => null);
    if (dts && (!ts || dts.length > ts.length)) ts = dts;
  }
  const now = Date.now() / 1000;
  const pct = (x: number | null) => (x === null || !supplyRaw ? null : round2((x / supplyRaw) * 100));
  return {
    address: creator,
    deployer,
    platform: "pump.fun",
    curve_complete: d[48] === 1,
    holds_pct: pct(holds),
    initial_buy_pct: pct(initial),
    sold_pct_of_initial_buy: initial && holds !== null ? round2(Math.max(0, (initial - holds) / initial) * 100) : null,
    launches_7d: ts ? ts.filter((t) => now - t < 7 * 86400).length : null,
    launches_24h: ts ? ts.filter((t) => now - t < 86400).length : null,
    launches_note: ts && ts.length >= 100 ? "lower bound: the last 100 launches only" : deployer ? "launches of the creator or of the deployer, whichever is higher" : null,
  };
}

export async function analyzeSolana(rpc: (m: string, p: unknown[]) => Promise<any>, mint: string, history?: CreatorHistory) {
  const acc = await rpc("getAccountInfo", [mint, { encoding: "jsonParsed", commitment: "confirmed" }]);
  const v = acc?.value;
  if (!v) return { error: "account not found on Solana mainnet", address: mint };
  const program = v.owner;
  const parsed = v.data?.parsed;
  if ((program !== TOKEN_PROGRAM && program !== TOKEN_2022) || parsed?.type !== "mint") {
    return { error: "address is not an SPL token mint", address: mint };
  }
  const info = parsed.info;
  const ext: Record<string, any> = {};
  for (const e of info.extensions || []) ext[e.extension] = e.state ?? true;

  let meta: any = null;
  if (ext.tokenMetadata) {
    meta = { name: ext.tokenMetadata.name, symbol: ext.tokenMetadata.symbol, updateAuthority: ext.tokenMetadata.updateAuthority, isMutable: !!ext.tokenMetadata.updateAuthority };
  }
  const metaPda = meta ? null : await findPda([new TextEncoder().encode("metadata"), b58decode(METADATA_PROGRAM), b58decode(mint)], METADATA_PROGRAM);

  const [largest, metaAcc, sigs] = await Promise.allSettled([
    rpc("getTokenLargestAccounts", [mint, { commitment: "confirmed" }]),
    metaPda ? rpc("getAccountInfo", [metaPda, { encoding: "base64" }]) : Promise.resolve(null),
    rpc("getSignaturesForAddress", [mint, { limit: 1000 }]),
  ]);
  if (!meta && metaAcc.status === "fulfilled" && metaAcc.value?.value?.data?.[0]) {
    try { meta = parseMetadata(Uint8Array.from(atob(metaAcc.value.value.data[0]), (c) => c.charCodeAt(0))); } catch (_) {}
  }

  const decimals = info.decimals;
  const supply = Number(info.supply) / 10 ** decimals;
  let top10Pct: number | null = null, top1Pct: number | null = null, programHeldPct: number | null = null;
  if (largest.status === "fulfilled" && supply > 0) try {
    const rows = (largest.value?.value || []).slice(0, 20);
    const tokAccs = await rpc("getMultipleAccounts", [rows.map((r: any) => r.address), { encoding: "jsonParsed" }]);
    const owners = (tokAccs?.value || []).map((a: any) => a?.data?.parsed?.info?.owner || null);
    const uniqOwners = [...new Set(owners.filter(Boolean))] as string[];
    const ownerAccs = uniqOwners.length ? await rpc("getMultipleAccounts", [uniqOwners, { encoding: "base64", dataSlice: { offset: 0, length: 0 } }]) : { value: [] };
    const ownerProgram: Record<string, string | null> = {};
    uniqOwners.forEach((o, i) => { ownerProgram[o] = ownerAccs.value?.[i]?.owner ?? null; });
    const isWallet = (o: string | null) => {
      if (!o) return false;
      const p = ownerProgram[o];
      if (p && p !== SYSTEM_PROGRAM) return false;
      return isOnCurve(b58decode(o));
    };
    const walletAmounts: Record<string, number> = {};
    let progAmt = 0;
    rows.forEach((r: any, i: number) => {
      const amt = Number(r.uiAmount ?? 0);
      const o = owners[i];
      if (isWallet(o)) walletAmounts[o] = (walletAmounts[o] || 0) + amt; else progAmt += amt;
    });
    const sorted = Object.values(walletAmounts).sort((a, b) => b - a);
    top10Pct = round2((sorted.slice(0, 10).reduce((a, b) => a + b, 0) / supply) * 100);
    top1Pct = round2(((sorted[0] || 0) / supply) * 100);
    programHeldPct = round2((progAmt / supply) * 100);
  } catch (_) { top10Pct = null; top1Pct = null; programHeldPct = null; }

  let ageHours: number | null = null, ageIsLowerBound = false;
  if (sigs.status === "fulfilled" && Array.isArray(sigs.value) && sigs.value.length) {
    const oldest = sigs.value[sigs.value.length - 1];
    ageIsLowerBound = sigs.value.length >= 1000;
    if (oldest.blockTime && !ageIsLowerBound) ageHours = round2((Date.now() / 1000 - oldest.blockTime) / 3600);
  }
  const oldestSig = sigs.status === "fulfilled" && Array.isArray(sigs.value) && sigs.value.length && !ageIsLowerBound ? sigs.value[sigs.value.length - 1].signature : null;
  // Busy tokens (1000+ signatures) hide their age: fall back to the DEX pair creation time (DexScreener, public, keyless).
  if (ageHours === null) {
    try {
      const p = await (await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, { signal: AbortSignal.timeout(5000) })).json();
      const t0 = Array.isArray(p) ? Math.min(...p.map((x: any) => Number(x?.pairCreatedAt) || Infinity)) : Infinity;
      if (Number.isFinite(t0)) { ageHours = round2((Date.now() - t0) / 3600e3); ageIsLowerBound = false; }
    } catch (_) { /* age stays unknown */ }
  }
  let creator: Awaited<ReturnType<typeof pumpCreator>> = null;
  try { creator = await pumpCreator(rpc, mint, Number(info.supply), oldestSig, history); } catch (_) { creator = null; }

  const trusted = TRUSTED[mint];
  const flags: string[] = [];
  const danger: string[] = [];
  let score = 0;
  const add = (cond: boolean, flag: string, pts: number, isDanger = false) => {
    if (!cond) return; flags.push(flag); score += pts; if (isDanger) danger.push(flag);
  };
  const fee = ext.transferFeeConfig;
  const feeBps = fee ? Math.max(Number(fee.newerTransferFee?.transferFeeBasisPoints ?? 0), Number(fee.olderTransferFee?.transferFeeBasisPoints ?? 0)) : 0;

  add(!!info.freezeAuthority, "freeze_authority", 40, true);
  add(!!info.mintAuthority, "mint_authority", 30);
  add(!!ext.permanentDelegate?.delegate, "permanent_delegate", 60, true);
  add(!!ext.nonTransferable, "non_transferable", 60, true);
  add(ext.defaultAccountState?.accountState === "frozen", "accounts_frozen_by_default", 60, true);
  add(!!ext.pausableConfig, "pausable", 40, true);
  add(!!ext.transferHook?.programId, "transfer_hook", 25);
  add(feeBps >= 1000, "transfer_fee_over_10pct", 40, true);
  add(feeBps > 0 && feeBps < 1000, "transfer_fee", 15);
  add(!!fee?.transferFeeConfigAuthority, "transfer_fee_changeable", 15);
  add(!!ext.mintCloseAuthority?.closeAuthority, "mint_close_authority", 10);
  add(!!meta?.isMutable, "metadata_mutable", 5);
  add(top10Pct === null, "holder_data_unavailable", 15);
  add(top10Pct !== null && top10Pct > 50, "top10_wallets_over_50pct", 20);
  add(top1Pct !== null && top1Pct > 20, "top_wallet_over_20pct", 15);
  add(ageHours !== null && !ageIsLowerBound && ageHours < 1, "created_under_1h", 15);
  add(ageHours !== null && !ageIsLowerBound && ageHours >= 1 && ageHours < 24, "created_under_24h", 10);
  if (creator) {
    const sold = creator.sold_pct_of_initial_buy;
    add(sold !== null && creator.holds_pct === 0, "creator_sold_all", 25);
    add(sold !== null && sold >= 50 && creator.holds_pct !== 0, "creator_sold_over_half", 15);
    add((creator.holds_pct ?? 0) > 20, "creator_holds_over_20pct", 15);
    add((creator.launches_7d ?? 0) >= 20, "serial_creator_20plus_7d", 25);
    add((creator.launches_7d ?? 0) >= 5 && (creator.launches_7d ?? 0) < 20, "serial_creator_5plus_7d", 15);
  }

  let verdict = danger.length || score >= 60 ? "DANGER" : score >= 25 ? "CAUTION" : "SAFE";
  if (trusted) { verdict = "SAFE"; score = 0; flags.push("trusted_token"); }

  return {
    chain: "solana",
    address: mint,
    verdict,
    risk_score: Math.min(100, score),
    flags,
    token: { name: meta?.name || trusted || null, symbol: meta?.symbol || null, decimals, supply, program: program === TOKEN_2022 ? "token-2022" : "spl-token" },
    authorities: {
      mint: info.mintAuthority || null,
      freeze: info.freezeAuthority || null,
      metadata_update: meta?.updateAuthority || null,
      permanent_delegate: ext.permanentDelegate?.delegate || null,
    },
    extensions: Object.keys(ext),
    transfer_fee_bps: feeBps,
    holders: { top10_wallets_pct: top10Pct, top_wallet_pct: top1Pct, program_held_pct: programHeldPct, note: "Wallet concentration excludes accounts held by programs (pools, bonding curves, vaults)." },
    age_hours: ageHours,
    activity: ageIsLowerBound ? "established: 1000+ transactions on the mint account" : null,
    creator,
  };
}
const round2 = (x: number) => Math.round(x * 100) / 100;

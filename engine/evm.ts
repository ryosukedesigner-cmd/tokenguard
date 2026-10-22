// On-chain EVM token contract-risk analysis. Reads only public chain state over JSON-RPC (no key, no third-party API).
// Scope: contract-control risk (ownership, mint/pause/blacklist capability, upgradeable proxy). No holder concentration
// or liquidity data (those need an indexer); the caller pairs this with a liquidity/holder source.

const SEL = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  owner: "0x8da5cb5b",
};

const SLOT_IMPL = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const SLOT_BEACON = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
const SLOT_ZEPPELINOS = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3";

const CHAIN_NAME: Record<string, string> = { "eip155:1": "ethereum", "eip155:8453": "base", "eip155:42161": "arbitrum", "eip155:10": "optimism", "eip155:137": "polygon", "eip155:56": "bnb" };

const CAP_SELECTORS: Record<string, string> = {
  "40c10f19": "mint",
  "a0712d68": "mint",
  "8456cb59": "pausable",
  "f9f92be4": "blacklist",
  "ec28438a": "max_tx_limit",
  "437823ec": "fee_exclusion",
};

export const TRUSTED: Record<string, Record<string, string>> = {
  "eip155:8453": {
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
    "0x4200000000000000000000000000000000000006": "WETH",
    "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": "cbBTC",
    "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": "DAI",
    "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": "USDbC",
  },
  "eip155:1": {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
    "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
    "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "WBTC",
  },
  "eip155:42161": {
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC",
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "WETH",
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": "USDT",
  },
  "eip155:10": {
    "0x0b2c639c533813f4aa9d7837caf62653d097ff85": "USDC",
    "0x4200000000000000000000000000000000000006": "WETH",
  },
  "eip155:137": {
    "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "USDC",
    "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": "WETH",
  },
  "eip155:56": {
    "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": "USDC",
    "0x55d398326f99059ff775485246999027b3197955": "USDT",
  },
};

function strip(h: string): string { return h && h.startsWith("0x") ? h.slice(2) : (h || ""); }

function hexToAscii(h: string): string {
  let s = "";
  for (let i = 0; i + 1 < h.length; i += 2) {
    const c = parseInt(h.slice(i, i + 2), 16);
    if (c >= 32 && c < 127) s += String.fromCharCode(c);
  }
  return s.replace(/\u0000/g, "").trim();
}

function decodeString(ret: string): string | null {
  const h = strip(ret);
  if (!h || /^0+$/.test(h)) return null;
  if (h.length === 64) return hexToAscii(h) || null;
  try {
    const len = parseInt(h.slice(64, 128), 16);
    if (!Number.isFinite(len) || len <= 0 || len > 1024) return hexToAscii(h) || null;
    return hexToAscii(h.slice(128, 128 + len * 2)) || null;
  } catch (_) { return hexToAscii(h) || null; }
}

function hexToBigInt(ret: string): bigint | null {
  const h = strip(ret);
  if (!h) return null;
  try { return BigInt("0x" + h); } catch (_) { return null; }
}

function wordToAddress(ret: string): string | null {
  const h = strip(ret);
  if (h.length < 64) return null;
  const addr = h.slice(24, 64).toLowerCase();
  if (/^0+$/.test(addr)) return null;
  return "0x" + addr;
}

export function makeEvmRpc(url: string, timeoutMs = 8000) {
  return async function rpc(method: string, params: unknown[], attempt = 0): Promise<any> {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if ((r.status === 429 || r.status >= 500) && attempt < 3) {
      await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
      return rpc(method, params, attempt + 1);
    }
    if (!r.ok) throw new Error(`rpc ${method} ${r.status}`);
    const j = await r.json();
    if (j.error) throw new Error(`rpc ${method}: ${j.error.message}`);
    return j.result;
  };
}

type Rpc = (m: string, p: unknown[]) => Promise<any>;
const call = async (rpc: Rpc, to: string, data: string): Promise<string | null> => {
  try { return await rpc("eth_call", [{ to, data }, "latest"]); } catch (_) { return null; }
};

export async function isContract(rpc: Rpc, address: string): Promise<boolean | null> {
  try {
    const code = await rpc("eth_getCode", [address, "latest"]);
    return typeof code === "string" && strip(code).length > 2;
  } catch (_) { return null; }
}

export async function analyzeEvm(rpc: Rpc, chain: string, address: string) {
  const addr = address.toLowerCase();
  const code = await rpc("eth_getCode", [address, "latest"]).catch(() => null);
  if (typeof code !== "string" || strip(code).length <= 2) {
    return { error: "address is not a contract on this chain", address };
  }

  let implAddr: string | null = null;
  let isProxy = false;
  try {
    for (const slot of [SLOT_IMPL, SLOT_ZEPPELINOS]) {
      const w = await rpc("eth_getStorageAt", [address, slot, "latest"]).catch(() => null);
      const a = w ? wordToAddress(w) : null;
      if (a) { implAddr = a; isProxy = true; break; }
    }
    if (!implAddr) {
      const beacon = await rpc("eth_getStorageAt", [address, SLOT_BEACON, "latest"]).catch(() => null);
      if (beacon && wordToAddress(beacon)) isProxy = true;
    }
  } catch (_) { /* ignore */ }

  let runtime = strip(code).toLowerCase();
  if (isProxy && implAddr) {
    const implCode = await rpc("eth_getCode", [implAddr, "latest"]).catch(() => null);
    if (typeof implCode === "string" && strip(implCode).length > 2) runtime = strip(implCode).toLowerCase();
  }
  const caps = new Set<string>();
  for (const [sel, label] of Object.entries(CAP_SELECTORS)) {
    if (runtime.includes(sel)) caps.add(label);
  }

  const [nameR, symR, decR, supR, ownR] = await Promise.all([
    call(rpc, address, SEL.name),
    call(rpc, address, SEL.symbol),
    call(rpc, address, SEL.decimals),
    call(rpc, address, SEL.totalSupply),
    call(rpc, address, SEL.owner),
  ]);
  const name = nameR ? decodeString(nameR) : null;
  const symbol = symR ? decodeString(symR) : null;
  const decimals = decR ? Number(hexToBigInt(decR) ?? 18) : null;
  const supplyRaw = supR ? hexToBigInt(supR) : null;
  const decs = decimals ?? 18;
  const supply = supplyRaw !== null ? Number(supplyRaw) / 10 ** decs : null;

  const ownerPresent = ownR !== null && strip(ownR).length >= 64;
  const ownerAddr = ownerPresent ? wordToAddress(ownR!) : null;
  const ownerRenounced = ownerPresent && ownerAddr === null;
  const hasOwner = ownerAddr !== null;

  const trusted = TRUSTED[chain]?.[addr];

  const flags: string[] = [];
  const danger: string[] = [];
  let score = 0;
  const add = (cond: boolean, flag: string, pts: number, isDanger = false) => {
    if (!cond) return; flags.push(flag); score += pts; if (isDanger) danger.push(flag);
  };

  add(isProxy, "upgradeable_proxy", 35, hasOwner);
  add(hasOwner, "owner_not_renounced", 25);
  add(caps.has("mint"), "mint_function", 30, hasOwner);
  add(caps.has("blacklist"), "blacklist_function", 35, true);
  add(caps.has("pausable"), "pausable", 25, true);
  add(caps.has("max_tx_limit"), "max_tx_limit", 10);
  add(caps.has("fee_exclusion"), "fee_exclusion", 10);
  add(ownR === null && !isProxy, "owner_unknown", 0);

  let verdict = danger.length || score >= 60 ? "DANGER" : score >= 25 ? "CAUTION" : "SAFE";
  if (trusted) { verdict = "SAFE"; score = 0; flags.length = 0; flags.push("trusted_token"); }

  return {
    chain: CHAIN_NAME[chain] || chain,
    address,
    verdict,
    risk_score: Math.min(100, score),
    flags,
    token: { name: name || trusted || null, symbol: symbol || null, decimals: decimals, supply, standard: "erc20" },
    control: {
      owner: ownerAddr,
      owner_renounced: ownerRenounced,
      upgradeable_proxy: isProxy,
      implementation: isProxy ? implAddr : null,
      capabilities: [...caps],
    },
    scope: "Contract-control risk only (ownership, upgradeability, mint/pause/blacklist capability). No holder concentration or liquidity data.",
  };
}

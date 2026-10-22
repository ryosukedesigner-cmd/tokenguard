# TokenGuard detection engine (MIT)

The on-chain analysis behind every TokenGuard verdict, published as a public good. It reads **only public chain state over JSON-RPC**: no API key, no third-party data provider (DexScreener's public API is used for market data only).

| File | What it does |
|---|---|
| [`sol.ts`](sol.ts) | Solana SPL and Token-2022: mint, freeze, permanent delegate and close authorities; Token-2022 extensions (transfer hook, transfer fee, default frozen state, pausable, non-transferable); mutable metadata; holder concentration excluding pools and program accounts; token age; pump.fun creator behaviour (sold the initial buy, serial launches) through an optional `CreatorHistory` callback. |
| [`evm.ts`](evm.ts) | BNB Chain, Base, Ethereum: ownership and renouncement, mint / pause / blacklist / max-transaction / fee-exemption functions, upgradeable proxies. |

```ts
import { analyzeSolana, makeRpc } from "./sol.ts";
const rpc = makeRpc("https://api.mainnet-beta.solana.com");
const report = await analyzeSolana(rpc, "<MINT>");   // { verdict, risk_score, flags, authorities, holders, ... }
```

Written for Deno (Supabase Edge Functions); the single import uses the `npm:` specifier (`@noble/curves`), replace it with a normal import for Node or Bun.

The hosted service adds what needs state or paid infrastructure on top of this engine: the real sell test (Jupiter quotes), the creator record across every token seen, market data, caching and the benchmark that measures accuracy 24 h after listing (results published at https://tokenguard-bot.vercel.app/t/).

Risk signals, not financial advice. Contributions and false-positive reports are welcome (issues).

# tokenguard

Rug check for Solana, BNB Chain, Base and Ethereum tokens **before you buy**: SAFE / CAUTION / DANGER, risk score, honeypot sell test, pump.fun creator record, market data. No dependencies.

```bash
npm i tokenguard
```

```js
import { TokenGuard, summarize } from "tokenguard";
const tg = new TokenGuard();                 // free key (50 checks a day) created on first use, or { apiKey: "tg_..." }
const report = await tg.check("https://pump.fun/coin/<MINT>");   // address or pump.fun / DexScreener link
console.log(summarize(report));              // "DANGER · 85/100 · $XYZ · risks: freeze_authority, creator_sold_all · NO SELL ROUTE (honeypot)"
const { ok } = await tg.isSafe(mint);        // pre-trade gate for bots
```

Also: Telegram bot https://t.me/Token_guard_bot · browser extension https://tokenguard-bot.vercel.app/extension/ · MCP server `io.github.ryosukedesigner-cmd/tokenguard`. Risk signals, not financial advice.

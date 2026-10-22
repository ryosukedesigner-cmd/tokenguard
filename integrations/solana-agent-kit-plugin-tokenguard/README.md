# solana-agent-kit-plugin-tokenguard

Gives your Solana Agent Kit agent a pre-trade safety check: **SAFE / CAUTION / DANGER** before it buys a token (freeze and mint authority, Token-2022 traps, holder concentration, real sell test, pump.fun creator record).

```js
import { SolanaAgentKit } from "solana-agent-kit";
import TokenGuardPlugin from "solana-agent-kit-plugin-tokenguard";
const agent = new SolanaAgentKit(wallet, RPC_URL, { TOKENGUARD_API_KEY: process.env.TOKENGUARD_API_KEY }).use(TokenGuardPlugin);
const { ok, verdict } = await agent.methods.tokenguardIsSafe(agent, mint);   // gate any swap on ok
```

Action for LLM tools: `TOKENGUARD_CHECK_ACTION`. Without a key, a free one (50 checks a day) is created on first use. Risk signals, not financial advice.

# goat-plugin-tokenguard

Adds two tools to any GOAT agent (Vercel AI, LangChain, OpenAI Agents, …): `tokenguard_check_token` and `tokenguard_is_safe_to_buy`, a pre-trade rug and honeypot check for Solana, BNB Chain, Base and Ethereum tokens.

```js
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { tokenguard } from "goat-plugin-tokenguard";
const tools = await getOnChainTools({ wallet, plugins: [tokenguard({ apiKey: process.env.TOKENGUARD_API_KEY })] });
```

Without a key, a free one (50 checks a day) is created on first use. Risk signals, not financial advice.

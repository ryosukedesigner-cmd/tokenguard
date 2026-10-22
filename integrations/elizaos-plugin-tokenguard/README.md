# elizaos-plugin-tokenguard

Your elizaOS agent answers **"is this token a rug?"** for any Solana, BNB Chain, Base or Ethereum address or pump.fun / DexScreener link: SAFE / CAUTION / DANGER with the reasons, honeypot sell test and creator record.

```js
import tokenguardPlugin from "elizaos-plugin-tokenguard";
export const character = { name: "Trader", plugins: [tokenguardPlugin] };
```

Optional setting `TOKENGUARD_API_KEY`; otherwise a free key (50 checks a day) is created on first use. Risk signals, not financial advice.

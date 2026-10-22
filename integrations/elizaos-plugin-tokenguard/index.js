// TokenGuard plugin for elizaOS (v1): the agent answers "is this token a rug?" for any address or pump.fun / DexScreener link.
import { TokenGuard, summarize, extractAddress } from "tokenguard";

const clients = new WeakMap();
const client = (runtime) => {
  if (!clients.has(runtime)) clients.set(runtime, new TokenGuard({ apiKey: runtime?.getSetting?.("TOKENGUARD_API_KEY") || undefined }));
  return clients.get(runtime);
};

export const checkTokenAction = {
  name: "TOKENGUARD_CHECK_TOKEN",
  similes: ["RUG_CHECK", "CHECK_TOKEN", "HONEYPOT_CHECK", "TOKEN_RISK", "IS_IT_SAFE"],
  description: "Checks a Solana, BNB Chain, Base or Ethereum token for rug-pull and honeypot risk before buying: SAFE / CAUTION / DANGER with the reasons. Use when a message contains a token address or a pump.fun / DexScreener link and the user asks if it is safe, a rug or a scam.",
  validate: async (_runtime, message) => !!extractAddress(message?.content?.text),
  handler: async (runtime, message, _state, _options, callback) => {
    const address = extractAddress(message?.content?.text);
    try {
      const r = await client(runtime).check(address);
      const text = `TokenGuard: ${summarize(r)}\nhttps://tokenguard-bot.vercel.app/t/${r.address}.html\nRisk signals, not financial advice.`;
      await callback?.({ text, actions: ["TOKENGUARD_CHECK_TOKEN"] });
      return { success: true, text, values: { tokenguardVerdict: r.verdict, tokenguardScore: r.risk_score }, data: { report: r } };
    } catch (e) {
      const text = `TokenGuard could not check ${address}: ${e.message}`;
      await callback?.({ text });
      return { success: false, text, error: e.message };
    }
  },
  examples: [[
    { name: "{{user1}}", content: { text: "is this a rug? https://pump.fun/coin/9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin" } },
    { name: "{{agent}}", content: { text: "TokenGuard: DANGER · 85/100 · risks: creator_sold_all, top10_wallets_over_50pct", actions: ["TOKENGUARD_CHECK_TOKEN"] } },
  ]],
};

export const tokenguardPlugin = {
  name: "tokenguard",
  description: "Rug-pull and honeypot check for Solana, BNB Chain, Base and Ethereum tokens (SAFE / CAUTION / DANGER) before buying.",
  config: { TOKENGUARD_API_KEY: process.env?.TOKENGUARD_API_KEY ?? null },
  actions: [checkTokenAction],
};
export default tokenguardPlugin;

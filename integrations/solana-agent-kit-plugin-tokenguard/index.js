// TokenGuard plugin for Solana Agent Kit v2: lets the agent check any token for rug / honeypot risk before trading it.
// Usage: new SolanaAgentKit(wallet, rpc, { TOKENGUARD_API_KEY }).use(TokenGuardPlugin)
import { z } from "zod";
import { TokenGuard, summarize, extractAddress } from "tokenguard";

export function createTokenGuardPlugin(opts = {}) {
  const tg = new TokenGuard(opts);
  // Plugin methods may be called with the agent first (Solana Agent Kit convention) or with the address only.
  const addr = (a, b) => (typeof a === "string" ? a : b);
  const checkAction = {
    name: "TOKENGUARD_CHECK_ACTION",
    similes: ["check token safety", "is this token a rug", "rug check", "honeypot check", "token risk", "is it safe to buy", "scan token"],
    description: "Checks a Solana, BNB Chain, Base or Ethereum token for rug-pull and honeypot risk BEFORE buying it. Returns SAFE, CAUTION or DANGER, a risk score out of 100, the risk signals (freeze or mint authority, Token-2022 traps, holder concentration, creator dumping), a real sell test and market data. Input: the token address or a pump.fun / DexScreener link. Use it before any swap or buy.",
    examples: [[{
      input: { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
      output: { status: "success", verdict: "SAFE", risk_score: 5, summary: "SAFE · 5/100 · $Bonk · no risk signal · sellable (-0.4% round trip)" },
      explanation: "BONK has no dangerous authority and can be sold, so the agent may proceed.",
    }]],
    schema: z.object({ address: z.string().min(32).describe("Token mint / contract address, or a pump.fun or DexScreener link") }),
    handler: async (_agent, input) => {
      try {
        const r = await tg.check(input.address);
        return { status: "success", verdict: r.verdict, risk_score: r.risk_score, flags: r.flags, summary: summarize(r), report: r };
      } catch (e) {
        return { status: "error", message: e.message };
      }
    },
  };
  return {
    name: "tokenguard",
    methods: {
      tokenguardCheck: (a, b) => tg.check(addr(a, b)),
      tokenguardIsSafe: (a, b, c) => tg.isSafe(addr(a, b), typeof a === "string" ? b : c),
      tokenguardExtractAddress: (a, b) => extractAddress(addr(a, b)),
    },
    actions: [checkAction],
    initialize(agent) {
      if (!tg.apiKey && agent?.config?.TOKENGUARD_API_KEY) tg.apiKey = agent.config.TOKENGUARD_API_KEY;
    },
  };
}

export const TokenGuardPlugin = createTokenGuardPlugin();
export default TokenGuardPlugin;
